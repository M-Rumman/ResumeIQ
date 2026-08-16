import { parseJobDescription } from './jdParser.js';
import { extractCandidateProfile } from './resumeExtraction.js';
import { matchRequirements, getDeterministicMatches } from './matcher.js';
import { evaluateScores } from './evaluator.js';
import { scoreBulletQuality } from './bulletScoring.js';
import { generateRecommendations } from './recommendations.js';
import { validateAndSanitizeReport } from './validator.js';
import { validateRewrites } from '../aiValidation.js';
import type { PipelineContext, EngineResult, AiResumeAnalysisFull, CanonicalRequirements } from './types.js';
import { AiPipelineError } from './types.js'; // AiPipelineError from where it's exported or openrouter.ts? Wait, let me check where AiPipelineError is. It's in openrouter.ts usually.
import type { AiObservabilityContext } from '../aiObservability.js';
import type { ParsedResume, KeywordCompatibility } from '../openrouter.js';
import { generateBulletRewritesWithAi, AiPipelineError as OpenRouterPipelineError } from '../openrouter.js';

export async function runAnalysisPipeline(
  context: PipelineContext,
  options: { observability?: AiObservabilityContext } = {}
): Promise<EngineResult> {
  console.info('[pipeline] Starting modular analysis engine...');

  const startDb = performance.now();
  // (DB preflight is tracked in analyze-resume.ts)

  // 1. Extraction (Parallel)
  console.info('[analysis-trace] JD_PARSE_START');
  const extractStart = performance.now();
  const [jobProfile, candidateProfile] = await Promise.all([
    parseJobDescription(context.jobDescriptionText, options),
    context.candidateProfile ? Promise.resolve(context.candidateProfile) : Promise.resolve(extractCandidateProfile(context.resumeText))
  ]);
  const extractEnd = performance.now();
  console.info(`[analysis-trace] JD_PARSE_END durationMs=${Math.round(extractEnd - extractStart)}`);

  // Create a ParsedResume object for legacy compat
  const parsedResume: ParsedResume = {
    name: candidateProfile.contact?.name || '',
    email: candidateProfile.contact?.email || '',
    phone: candidateProfile.contact?.phone || '',
    location: candidateProfile.contact?.location || '',
    education: candidateProfile.rawStructure.education,
    skills: candidateProfile.rawStructure.skills,
    experience: candidateProfile.rawStructure.experience,
    projects: candidateProfile.rawStructure.projects,
    certifications: candidateProfile.rawStructure.certifications,
    summary: candidateProfile.rawStructure.summary,
    awards: candidateProfile.rawStructure.awards,
    publications: candidateProfile.rawStructure.languages, // mapped for compat
  };

  const standardExpectedSections = ['summary', 'experience', 'projects', 'skills', 'education'];
  const allDetectedKeys = Object.keys(candidateProfile.rawStructure).filter(
    k => Array.isArray((candidateProfile.rawStructure as any)[k]) 
      ? (candidateProfile.rawStructure as any)[k].length > 0 
      : !!(candidateProfile.rawStructure as any)[k]
  );
  
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const detectedSections = standardExpectedSections
    .filter(s => allDetectedKeys.includes(s))
    .map(capitalize);
  const missingSections = standardExpectedSections
    .filter(s => !allDetectedKeys.includes(s))
    .map(capitalize);

  // 2. Free Tier Fast-Path
  // Free users only get basic parsing and structure check.
  if (!context.includePremium) {

    return {
      tier: 'free',
      legacyReport: {
        tier: 'free',
        parsed: parsedResume,
        atsScore: 0, // Placeholder
        detectedSections,
        missingSections,
        basicFeedback: ['Unlock Pro for deep analysis and ATS scoring.']
      }
    };
  }

  // 3. Premium Deep Analysis
  console.info('[analysis-trace] MATCHER_REWRITER_START');
  const matcherStart = performance.now();
  const deterministicResult = getDeterministicMatches(jobProfile, candidateProfile);


  // Extract true accomplishment bullets instead of raw section lines
  const candidateBullets = [
    ...(parsedResume.understanding?.experienceDetails || []).flatMap(e => [...(e.responsibilities || []), ...(e.achievements || [])]),
    ...(parsedResume.projectDetails || []).flatMap(p => p.bullets || [])
  ];

  // Fallback to heuristic line filtering if structured understanding failed
  const fallbackBullets = candidateBullets.length > 0 
    ? candidateBullets 
    : [...parsedResume.experience, ...parsedResume.projects].filter(line => line.length > 20 && /^[-*•\s]/.test(line));

  const targetKeywords = jobProfile.requirements.map(r => r.normalized_name);
  
  // Score and select only weak bullets (score < 55) for LLM rewriting
  const weakCandidates = fallbackBullets
    .map(text => ({ text, score: scoreBulletQuality(text, targetKeywords).total }))
    .filter(b => b.score < 55)
    .sort((a, b) => a.score - b.score)
    .slice(0, 15)
    .map(b => b.text);

  const [matchingResult, bulletRewrites] = await Promise.all([
    matchRequirements(jobProfile, candidateProfile, deterministicResult, options).catch(err => {
      console.error('[pipeline] AI Matcher failed, degrading to deterministic:', err);
      return deterministicResult as any; // Fallback to deterministic matcher
    }),
    generateBulletRewritesWithAi(
      weakCandidates,
      [], // pass projects empty since weakCandidates contains both

      {
        title: jobProfile.title,
        requiredSkills: jobProfile.requirements.filter(r => r.priority === 'required').map(r => r.normalized_name),
        preferredSkills: jobProfile.requirements.filter(r => r.priority === 'preferred').map(r => r.normalized_name),
        responsibilities: jobProfile.requirements.filter(r => r.category === 'responsibility').map(r => r.normalized_name)
      },
      jobProfile.requirements.map(r => r.normalized_name),
      deterministicResult.matches.map(m => ({
        skill: m.requirement.normalized_name,
        status: m.classification,
        evidence: [] // Omitted to prevent payload explosion/token limit failures
      })),
      options.observability
    ).catch(err => {
      console.error('[pipeline] AI Rewriter failed, skipping rewrites:', err);
      return { improvedBulletPoints: [], weakBullets: [] };
    })
  ]);
  const matcherEnd = performance.now();
  console.info(`[analysis-trace] MATCHER_REWRITER_END durationMs=${Math.round(matcherEnd - matcherStart)}`);

  const evaluatorStart = performance.now();

  const canonical: CanonicalRequirements = {
    exact: [],
    semantic: [],
    partial: [],
    missingCore: [],
    missingPreferred: [],
    analysisFailed: [],
    all: matchingResult.matches,
  };

  for (const m of matchingResult.matches) {
    if (m.classification === 'EXACT_MATCH') canonical.exact.push(m);
    else if (m.classification === 'STRONG_SEMANTIC_MATCH') canonical.semantic.push(m);
    else if (m.classification === 'PARTIAL_MATCH' || m.classification === 'RELATED_MATCH' || m.classification === 'UNDER_EXPRESSED') canonical.partial.push(m);
    else if (m.classification === 'MISSING') {
      if (m.requirement.priority === 'required') canonical.missingCore.push(m);
      else canonical.missingPreferred.push(m);
    } else if (m.classification === 'ANALYSIS_FAILED') canonical.analysisFailed.push(m);
  }

  const evaluationResult = evaluateScores(jobProfile, candidateProfile, canonical);
  const recommendationResult = generateRecommendations(canonical);
  const evaluatorEnd = performance.now();

  // 4. Keyword & Skill Categorization
  const exactSkills = canonical.exact.map(m => m.requirement.normalized_name);
  const semanticSkills = canonical.semantic.map(m => m.requirement.normalized_name);
  const partialSkills = canonical.partial.map(m => m.requirement.normalized_name);
  const missingCoreSkills = canonical.missingCore.map(m => m.requirement.normalized_name);
  const missingPreferredSkills = canonical.missingPreferred.map(m => m.requirement.normalized_name);
  const analysisFailedSkills = canonical.analysisFailed.map(m => m.requirement.normalized_name);

  const allMissingSkills = [...missingCoreSkills, ...missingPreferredSkills];
  const allStrongSkills = [...exactSkills, ...semanticSkills];

  const formatSuggestion = (r: any) => {
    return `**What**: ${r.recommendedAction || 'Improve this area'}.\n**Why**: ${r.whyItMatters}\n**Where**: ${r.whereToAdd}\n**Evidence**: ${r.evidenceStatus}\n**Note**: ${r.fabricationWarning}`;
  };
  const improvements = recommendationResult.recommendations.map(formatSuggestion);

  const contextGaps = [];
  const contextStrengths = [];
  const contextPartial = [];

  const contextFailed = [];

  for (const match of matchingResult.matches) {
    const detail = evaluationResult.matchScoreDetails.details.find(d => d.requirement === match.requirement.normalized_name);
    if (!detail) continue;

    const pointsLost = detail.maxPoints - detail.achievedPoints;
    const item = {
      requirement: match.requirement.normalized_name,
      context: match.explanation,
      tag: match.classification === 'UNDER_EXPRESSED' ? 'Presentation Opportunity' as const : 
           (match.classification === 'MISSING' ? 'Genuine risk' as const : 
           (match.classification === 'ANALYSIS_FAILED' ? 'Unresolved' as const : 
           (match.classification === 'PARTIAL_MATCH' ? 'Weakness/Opportunity' as const : 
           (match.classification === 'STRONG_SEMANTIC_MATCH' ? 'Strong semantic evidence' as const : 
           (match.classification === 'EXACT_MATCH' ? 'Strong evidence of satisfaction' as const : undefined))))),
      _pointsLost: pointsLost,
      _achievedPoints: detail.achievedPoints
    };

    if (match.classification === 'MISSING') {
      contextGaps.push(item);
    } else if (match.classification === 'ANALYSIS_FAILED') {
      contextFailed.push(item);
    } else if (match.classification === 'EXACT_MATCH' || match.classification === 'STRONG_SEMANTIC_MATCH') {
      contextStrengths.push(item);
    } else {
      contextPartial.push(item);
    }
  }

  const cleanItem = (item: any) => ({ requirement: item.requirement, context: item.context, tag: item.tag });

  const jobMatchExplanation = {
    strongMatches: contextStrengths.sort((a, b) => b._achievedPoints - a._achievedPoints).slice(0, 5).map(cleanItem),
    partialMatches: contextPartial.sort((a, b) => b._achievedPoints - a._achievedPoints).slice(0, 5).map(cleanItem),
    missingSkills: contextGaps.sort((a, b) => b._pointsLost - a._pointsLost).slice(0, 5).map(cleanItem),
  };

  const legacyReport: AiResumeAnalysisFull = {
    tier: 'premium',
    parsed: parsedResume,
    atsScore: evaluationResult.atsScore,
    matchScore: evaluationResult.matchScore,
    existingSkills: allStrongSkills,
    missingSkills: allMissingSkills,
    missingKeywords: allMissingSkills,
    analysisFailedSkills,
    keywordRecommendations: [],
    keywordGaps: allMissingSkills,
    missingRequiredSkills: missingCoreSkills,
    educationAlignment: [],
    detectedSections,
    missingSections,
    formattingIssues: [],
    formattingSuggestions: [],
    weakBullets: bulletRewrites.weakBullets,
    improvedBulletPoints: validateRewrites(bulletRewrites.improvedBulletPoints, context.resumeText, jobProfile.requirements.map(r => r.normalized_name), fallbackBullets),
    improvementSuggestions: improvements,
    optimizationRecommendations: improvements,
    keywordSuggestions: allMissingSkills,
    atsIssues: [],
    recommendationPriorities: {
      critical: recommendationResult.recommendations.filter(r => r.priority === 'critical').map(formatSuggestion),
      important: recommendationResult.recommendations.filter(r => r.priority === 'important').map(formatSuggestion),
      optional: recommendationResult.recommendations.filter(r => r.priority === 'optional').map(formatSuggestion),
    },
    actionPlan: recommendationResult.recommendations,
    atsScoreExplanation: {
      strengths: evaluationResult.scoreExplanations.whatIncreasedScore,
      missingElements: evaluationResult.scoreExplanations.whatReducedScore,
      formattingIssues: [],
      keywordIssues: allMissingSkills,
      whatIncreasedScore: evaluationResult.scoreExplanations.whatIncreasedScore,
      whatReducedScore: evaluationResult.scoreExplanations.whatReducedScore,
      topImprovements: improvements.slice(0, 3),
      estimatedScoreImprovement: 15,
      potentialAtsScore: Math.min(100, evaluationResult.atsScore + 15),
    },
    jobMatchExplanation,
    keywordCompatibility: { 
      overallMatch: evaluationResult.matchScore, 
      exactMatches: exactSkills,
      semanticMatches: semanticSkills,
      underExpressed: partialSkills, 
      missing: allMissingSkills,
      analysisFailed: analysisFailedSkills
    },
    requirementBreakdown: matchingResult.matches,
    coachingReport: [],
    atsBreakdown: evaluationResult.atsBreakdown,
    roleStrengths: allStrongSkills,
    hiringManagerAssessment: {
      overallDecision: (jobProfile.requirements.length === 0 || matchingResult.matches.length === 0 || canonical.analysisFailed.length === matchingResult.matches.length) 
                       ? 'Analysis Incomplete'
                       : evaluationResult.matchScore >= 90 ? 'Strong Match' : 
                         evaluationResult.matchScore >= 75 ? 'Good Match' : 
                         evaluationResult.matchScore >= 50 ? 'Potential Match' : 'Weak Match',
      recruiterSummary: (jobProfile.requirements.length === 0 || matchingResult.matches.length === 0 || canonical.analysisFailed.length === matchingResult.matches.length) 
                       ? 'The job-match analysis could not be completed securely.' 
                       : 'Deterministically evaluated candidate profile against requirements.',
      topReasonsToInterview: [
        ...canonical.exact.map(m => `Strong evidence of satisfaction for ${m.requirement.category}: ${m.requirement.normalized_name}. ${m.explanation}`),
        ...canonical.semantic.map(m => `Strong evidence with semantic equivalence for ${m.requirement.category}: ${m.requirement.normalized_name}. ${m.explanation}`)
      ].slice(0, 3),
      topReasonsForRejection: [
        ...canonical.missingCore.map(m => `Genuine risk: Missing required ${m.requirement.category}: ${m.requirement.normalized_name}. No matching evidence found.`),
        ...canonical.missingPreferred.map(m => `Genuine risk: Missing preferred ${m.requirement.category}: ${m.requirement.normalized_name}. No matching evidence found.`),
        ...canonical.analysisFailed.map(m => `Unresolved: Analysis incomplete for ${m.requirement.category}: ${m.requirement.normalized_name}.`),
        ...canonical.partial.filter(m => m.classification === 'PARTIAL_MATCH').map(m => `Weakness/Opportunity: Partial match for ${m.requirement.category}: ${m.requirement.normalized_name}. ${m.explanation}`),
        ...canonical.partial.filter(m => m.classification === 'UNDER_EXPRESSED').map(m => `Presentation Opportunity: Under-expressed ${m.requirement.category}: ${m.requirement.normalized_name}. ${m.explanation}`)
      ].slice(0, 3),
      biggestImprovements: improvements.slice(0, 3).map(text => ({ text, estimatedImpact: 5 })),
      confidence: 'High'
    },
    matchScoreDetails: evaluationResult.matchScoreDetails
  };

  const validatorStart = performance.now();
  const validatedReport = validateAndSanitizeReport(legacyReport, jobProfile, candidateProfile);
  
  assertReportInvariants(validatedReport, canonical, evaluationResult.matchScoreDetails);
  
  const validatorEnd = performance.now();

  const pipelineEnd = performance.now();

  console.info('[pipeline] Engine complete.');
  
  return {
    tier: 'premium',
    legacyReport: validatedReport,
    timings: {
      extract_and_parse_jd: extractEnd - extractStart,
      matcher_and_rewriter: matcherEnd - matcherStart,
      evaluator: evaluatorEnd - evaluatorStart,
      validator: validatorEnd - validatorStart,
      pipeline_total: pipelineEnd - extractStart,
    }
  };
}

function assertReportInvariants(report: AiResumeAnalysisFull, canonical: CanonicalRequirements, matchScoreDetails: any) {
  const missingNames = [...canonical.missingCore, ...canonical.missingPreferred].map(m => m.requirement.normalized_name);
  const failedNames = canonical.analysisFailed.map(m => m.requirement.normalized_name);

  // 1. ANALYSIS_FAILED must not be equivalent to MISSING.
  for (const f of failedNames) {
    if (missingNames.includes(f)) throw new OpenRouterPipelineError('validator', 'INVARIANT_FAILED', `Requirement ${f} is both missing and failed.`);
  }

  // 2. Failed analysis must NOT drop from the denominator, to prevent a "free pass".
  // Therefore, maxPoints must be > 0 (for required requirements), and achievedPoints must be 0.
  const failedDetails = matchScoreDetails.details.filter((d: any) => d.classification === 'ANALYSIS_FAILED');
  for (const f of failedDetails) {
    if (f.achievedPoints !== 0) {
      throw new OpenRouterPipelineError('validator', 'INVARIANT_FAILED', `Failed analysis ${f.requirement} improperly awarded achieved points.`);
    }
    if (f.priority === 'required' && f.maxPoints === 0) {
      throw new OpenRouterPipelineError('validator', 'INVARIANT_FAILED', `Failed analysis ${f.requirement} was silently dropped from the denominator.`);
    }
  }

  // 3. A requirement classified as matched must not simultaneously appear as missing.
  const matchedNames = [...canonical.exact, ...canonical.semantic].map(m => m.requirement.normalized_name);
  for (const m of matchedNames) {
    if (missingNames.includes(m)) throw new OpenRouterPipelineError('validator', 'INVARIANT_FAILED', `Requirement ${m} is both matched and missing.`);
  }

  // 4. A requirement classified as missing must have no valid supporting evidence.
  for (const m of [...canonical.missingCore, ...canonical.missingPreferred]) {
    if (m.evidence && m.evidence.length > 0) throw new OpenRouterPipelineError('validator', 'INVARIANT_FAILED', `Missing requirement ${m.requirement.normalized_name} has evidence.`);
  }

  // 5. "No material requirements are missing" must not be displayed when requirements remain unevaluated.
  if (failedNames.length > 0 && (!report.hiringManagerAssessment.topReasonsForRejection || report.hiringManagerAssessment.topReasonsForRejection.length === 0)) {
    throw new OpenRouterPipelineError('validator', 'INVARIANT_FAILED', `UI would falsely claim no material requirements are missing.`);
  }

  // 7. Keyword counts must derive from the same canonical classifications as the requirement breakdown.
  if (report.keywordCompatibility.missing.length !== missingNames.length) {
    throw new OpenRouterPipelineError('validator', 'INVARIANT_FAILED', `Keyword compatibility missing count does not match canonical missing count.`);
  }

  // 10. The final percentage must equal the displayed achieved points divided by the displayed maximum points
  if (matchScoreDetails.totalMaxScore > 0) {
    const calcScore = Math.round((matchScoreDetails.totalAchievedScore / matchScoreDetails.totalMaxScore) * 100);
    if (calcScore !== report.matchScore) {
      throw new OpenRouterPipelineError('validator', 'INVARIANT_FAILED', `Match score calculation mismatch. Calculated: ${calcScore}, Displayed: ${report.matchScore}`);
    }
  }
}
