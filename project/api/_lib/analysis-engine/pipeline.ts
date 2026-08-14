import { parseJobDescription } from './jdParser.js';
import { extractCandidateProfile } from './resumeExtraction.js';
import { matchRequirements, getDeterministicMatches } from './matcher.js';
import { evaluateScores } from './evaluator.js';
import { generateRecommendations } from './recommendations.js';
import { validateAndSanitizeReport } from './validator.js';
import { validateRewrites } from '../aiValidation.js';
import type { PipelineContext, EngineResult, AiResumeAnalysisFull } from './types.js';
import type { AiObservabilityContext } from '../aiObservability.js';
import type { ParsedResume, KeywordCompatibility } from '../openrouter.js';
import { generateBulletRewritesWithAi } from '../openrouter.js';

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

  const [matchingResult, bulletRewrites] = await Promise.all([
    matchRequirements(jobProfile, candidateProfile, deterministicResult, options).catch(err => {
      console.error('[pipeline] AI Matcher failed, degrading to deterministic:', err);
      return deterministicResult as any; // Fallback to deterministic matcher
    }),
    generateBulletRewritesWithAi(
      parsedResume.experience,
      parsedResume.projects,
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
        evidence: m.evidence.map(e => e.source_text)
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
  const evaluationResult = evaluateScores(jobProfile, candidateProfile, matchingResult);
  const recommendationResult = generateRecommendations(matchingResult);
  const evaluatorEnd = performance.now();

  // 4. Keyword & Skill Categorization
  // Sort requirements so core/required items appear first
  const sortedMatches = [...matchingResult.matches].sort((a, b) => {
    if (a.requirement.priority === 'required' && b.requirement.priority !== 'required') return -1;
    if (a.requirement.priority !== 'required' && b.requirement.priority === 'required') return 1;
    return 0;
  });

  const exactSkills = sortedMatches
    .filter(m => m.classification === 'EXACT_MATCH')
    .map(m => m.requirement.normalized_name);

  const semanticSkills = sortedMatches
    .filter(m => m.classification === 'STRONG_SEMANTIC_MATCH')
    .map(m => m.requirement.normalized_name);

  const partialSkills = sortedMatches
    .filter(m => ['PARTIAL_MATCH', 'RELATED_MATCH', 'UNDER_EXPRESSED'].includes(m.classification))
    .map(m => m.requirement.normalized_name);

  const missingCoreSkills = sortedMatches
    .filter(m => m.classification === 'MISSING' && m.requirement.priority === 'required')
    .map(m => m.requirement.normalized_name);

  const missingPreferredSkills = sortedMatches
    .filter(m => m.classification === 'MISSING' && m.requirement.priority !== 'required')
    .map(m => m.requirement.normalized_name);

  const allMissingSkills = [...missingCoreSkills, ...missingPreferredSkills];
  const allStrongSkills = [...exactSkills, ...semanticSkills];

  const formatSuggestion = (r: any) => {
    return `**What**: ${r.recommendedAction || 'Improve this area'}.\n**Why**: ${r.whyItMatters}\n**Where**: ${r.whereToAdd}\n**Evidence**: ${r.evidenceStatus}\n**Note**: ${r.fabricationWarning}`;
  };
  const improvements = recommendationResult.recommendations.map(formatSuggestion);

  const contextGaps = [];
  const contextStrengths = [];
  const contextPartial = [];

  for (const match of matchingResult.matches) {
    const detail = evaluationResult.matchScoreDetails.details.find(d => d.requirement === match.requirement.normalized_name);
    if (!detail) continue;

    const pointsLost = detail.maxPoints - detail.achievedPoints;
    const item = {
      requirement: match.requirement.normalized_name,
      context: match.explanation,
      tag: match.classification === 'UNDER_EXPRESSED' ? 'Addressable by rewording' as const : 
           (match.classification === 'MISSING' ? 'Genuine gap' as const : undefined),
      _pointsLost: pointsLost,
      _achievedPoints: detail.achievedPoints
    };

    if (match.classification === 'MISSING') {
      contextGaps.push(item);
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
    keywordRecommendations: [],
    keywordGaps: allMissingSkills,
    missingRequiredSkills: missingCoreSkills,
    educationAlignment: [],
    detectedSections,
    missingSections,
    formattingIssues: [],
    formattingSuggestions: [],
    weakBullets: bulletRewrites.weakBullets,
    improvedBulletPoints: validateRewrites(bulletRewrites.improvedBulletPoints, context.resumeText, jobProfile.requirements.map(r => r.normalized_name)),
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
      missing: allMissingSkills 
    },
    requirementBreakdown: matchingResult.matches,
    coachingReport: [],
    atsBreakdown: evaluationResult.atsBreakdown,
    roleStrengths: allStrongSkills,
    hiringManagerAssessment: {
      overallDecision: evaluationResult.matchScore >= 90 ? 'Strong Match' : 
                       evaluationResult.matchScore >= 75 ? 'Good Match' : 
                       evaluationResult.matchScore >= 50 ? 'Potential Match' : 'Weak Match',
      recruiterSummary: 'Deterministically evaluated candidate profile against requirements.',
      topReasonsToInterview: allStrongSkills.slice(0, 3),
      topReasonsForRejection: missingCoreSkills.slice(0, 3),
      biggestImprovements: improvements.slice(0, 3).map(text => ({ text, estimatedImpact: 5 })),
      confidence: 'High'
    },
    matchScoreDetails: evaluationResult.matchScoreDetails
  };

  const validatorStart = performance.now();
  const validatedReport = validateAndSanitizeReport(legacyReport, jobProfile, candidateProfile);
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
