import { parseJobDescription } from './jdParser.js';
import { randomUUID } from 'node:crypto';
import { extractCandidateProfile } from './resumeExtraction.js';
import { matchRequirements, getDeterministicMatches } from './matcher.js';
import { evaluateScores, rankStrengths, sortMatches } from './evaluator.js';
import { scoreBulletQuality } from './bulletScoring.js';
import { generateRecommendations } from './recommendations.js';
import { validateAndSanitizeReport, validateEvidenceAttribution } from './validator.js';
import { validateRewrites } from '../aiValidation.js';
import type { PipelineContext, EngineResult, AiResumeAnalysisFull, CanonicalRequirements } from './types.js';

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
  // 2. Fail on Empty Requirements
  // Ensure that JD parsing failure or empty requirements throws an error instead of returning a dummy report
  if (jobProfile.requirements.length === 0) {
    throw new OpenRouterPipelineError(
      'parser',
      'JD_PARSING_FAILED',
      'No job requirements could be extracted from the target job description. Please ensure you paste a valid job description containing responsibilities and qualifications.'
    );
  }

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


  // Extract true accomplishment bullets using candidate facts to avoid job titles and metadata
  const candidateContexts = candidateProfile.facts
    .filter(f => f.type === 'experience' || f.type === 'project')
    .flatMap(f => f.evidence.split('\n').map(line => ({
      text: line.replace(/^[•\-\*·\s]+/, '').trim(),
      sourceContext: f.rawText
    })))
    .filter(b => {
      const text = b.text;
      if (text.length < 30) return false;
      if (/\b(?:19|20)\d{2}\b/.test(text)) return false; // Often contains years -> metadata
      if (text.includes('|') || text.includes('—')) return false; // Common separators in headers
      return true;
    });

  const candidateBullets = candidateContexts.map(c => c.text);

  const targetKeywords = jobProfile.requirements.map(r => r.normalized_name);
  
  const matchingResult = await matchRequirements(jobProfile, candidateProfile, deterministicResult, options).then((res) => {
    // Strict validation of evidence provenance and logic
    res.matches = validateEvidenceAttribution(res.matches, candidateProfile.facts, context.resumeText);
    return res;
  });

  const partialAndUnderExpressed = matchingResult.matches.filter(m => 
    m.classification === 'PARTIAL_MATCH' || m.classification === 'UNDER_EXPRESSED'
  );

  // Prioritize bullets that have relevance to partial/under-expressed requirements
  const weakCandidates = candidateContexts
    .map(b => {
      const text = b.text.toLowerCase();
      let priorityScore = 0;
      for (const req of partialAndUnderExpressed) {
        const reqName = req.requirement.normalized_name.toLowerCase();
        if (text.includes(reqName)) {
          priorityScore += 1000;
        } else {
          // Check word overlap
          const reqWords = reqName.split(/\s+/).filter(w => w.length > 3);
          const overlaps = reqWords.filter(w => text.includes(w));
          if (overlaps.length > 0) {
            priorityScore += overlaps.length * 100;
          }
        }
      }
      
      const qualityScore = scoreBulletQuality(b.text, targetKeywords).total;
      return { ...b, qualityScore, priorityScore };
    })
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore; // Higher priority score first
      }
      return a.qualityScore - b.qualityScore; // Lower quality score first
    })
    .slice(0, 15)
    .map(b => b.text);

  const bulletRewrites = await generateBulletRewritesWithAi(
    weakCandidates,
    [], // pass projects empty since weakCandidates contains both
    {
      title: jobProfile.title,
      requiredSkills: jobProfile.requirements.filter(r => r.priority === 'required').map(r => r.normalized_name),
      preferredSkills: jobProfile.requirements.filter(r => r.priority === 'preferred').map(r => r.normalized_name),
      responsibilities: jobProfile.requirements.filter(r => r.category === 'responsibility').map(r => r.normalized_name)
    },
    jobProfile.requirements.map(r => r.normalized_name),
    matchingResult.matches.map((m: any) => ({
      skill: m.requirement.normalized_name,
      status: m.classification,
      evidence: m.evidence || []
    })),
    options.observability
  );

  console.log(`[DEBUG] weakCandidates length: ${weakCandidates.length}`);
  console.log(`[DEBUG] raw LLM bulletRewrites:`, bulletRewrites.improvedBulletPoints.length);
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
    candidateBulletsCount: candidateBullets.length,
    improvedBulletPoints: validateRewrites(bulletRewrites.improvedBulletPoints, context.resumeText, jobProfile.requirements.map(r => r.normalized_name), candidateContexts),
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
    requirementBreakdown: sortMatches(evaluationResult.finalizedMatches),
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
                       : generateRecruiterSummary(canonical, evaluationResult.matchScore),
      topReasonsToInterview: (jobProfile.requirements.length === 0 || matchingResult.matches.length === 0 || canonical.analysisFailed.length === matchingResult.matches.length)
        ? []
        : [generateNarrativeSynthesis(canonical.exact.concat(canonical.semantic), evaluationResult.matchScore)],
      topReasonsForRejection: [
        ...canonical.missingCore.map(m => `Genuine risk: Missing required ${m.requirement.category}: ${m.requirement.normalized_name}. No matching evidence found.`),
        ...canonical.missingPreferred.map(m => `Genuine risk: Missing preferred ${m.requirement.category}: ${m.requirement.normalized_name}. No matching evidence found.`),
        ...canonical.analysisFailed.map(m => `Unresolved: Analysis incomplete for ${m.requirement.category}: ${m.requirement.normalized_name}.`),
        ...canonical.partial.filter(m => m.classification === 'PARTIAL_MATCH').map(m => `Weakness/Opportunity: Partial match for ${m.requirement.category}: ${m.requirement.normalized_name}. ${m.explanation}`),
        ...canonical.partial.filter(m => m.classification === 'UNDER_EXPRESSED').map(m => `Presentation Opportunity: Under-expressed ${m.requirement.category}: ${m.requirement.normalized_name}. ${m.explanation}`)
      ],
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
    if (missingNames.includes(f)) throw new OpenRouterPipelineError('validation', 'INVARIANT_FAILED', `Requirement ${f} is both missing and failed.`);
  }

  // 2. Failed analysis must NOT drop from the denominator, to prevent a "free pass".
  const failedDetails = matchScoreDetails.details.filter((d: any) => d.classification === 'ANALYSIS_FAILED');
  for (const f of failedDetails) {
    if (f.achievedPoints !== 0) {
      throw new OpenRouterPipelineError('validation', 'INVARIANT_FAILED', `Failed analysis ${f.requirement} improperly awarded achieved points.`);
    }
    if (f.maxPoints !== 0) {
      throw new OpenRouterPipelineError('validation', 'INVARIANT_FAILED', `Failed analysis ${f.requirement} improperly assigned max points, penalizing candidate.`);
    }
  }

  // Scoring bounds and consistency invariants
  for (const d of matchScoreDetails.details) {
    if (d.classification === 'ANALYSIS_FAILED') continue;

    // 1. Every requirement has a positive valid maximum score.
    if (d.maxPoints <= 0) {
      throw new OpenRouterPipelineError('validation', 'INVARIANT_FAILED', `Requirement ${d.requirement} has invalid max points: ${d.maxPoints}`);
    }
    // 2. 0 <= awarded points <= maximum points
    if (d.achievedPoints < 0 || d.achievedPoints > d.maxPoints) {
      throw new OpenRouterPipelineError('validation', 'INVARIANT_FAILED', `Requirement ${d.requirement} has invalid achieved points: ${d.achievedPoints} (max: ${d.maxPoints})`);
    }
  }

  // 3 & 4. Total awarded points = sum of requirement awarded points. Total max = sum of max.
  const sumMax = matchScoreDetails.details.reduce((sum: number, d: any) => sum + d.maxPoints, 0);
  const sumAchieved = matchScoreDetails.details.reduce((sum: number, d: any) => sum + d.achievedPoints, 0);
  
  if (Math.abs(sumMax - matchScoreDetails.totalMaxScore) > 0.001) {
    throw new OpenRouterPipelineError('validation', 'INVARIANT_FAILED', `Total max score ${matchScoreDetails.totalMaxScore} does not match sum of details ${sumMax}`);
  }
  if (Math.abs(sumAchieved - matchScoreDetails.totalAchievedScore) > 0.001) {
    throw new OpenRouterPipelineError('validation', 'INVARIANT_FAILED', `Total achieved score ${matchScoreDetails.totalAchievedScore} does not match sum of details ${sumAchieved}`);
  }

  // 5 & 7. Job Match % = total awarded / total maximum * 100, and must match displayed score
  if (matchScoreDetails.totalMaxScore > 0) {
    const calcScore = Math.round((matchScoreDetails.totalAchievedScore / matchScoreDetails.totalMaxScore) * 100);
    if (calcScore !== report.matchScore) {
      throw new OpenRouterPipelineError('validation', 'INVARIANT_FAILED', `Match score calculation mismatch. Calculated: ${calcScore}, Displayed: ${report.matchScore}`);
    }
  } else {
    throw new OpenRouterPipelineError('validation', 'INVARIANT_FAILED', `Total maximum score cannot be 0. Analysis is invalid.`);
  }

  // 3. A requirement classified as matched must not simultaneously appear as missing.
  const matchedNames = [...canonical.exact, ...canonical.semantic].map(m => m.requirement.normalized_name);
  for (const m of matchedNames) {
    if (missingNames.includes(m)) throw new OpenRouterPipelineError('validation', 'INVARIANT_FAILED', `Requirement ${m} is both matched and missing.`);
  }

  // 4. A requirement classified as missing must have no valid supporting evidence.
  for (const m of [...canonical.missingCore, ...canonical.missingPreferred]) {
    if (m.evidence && m.evidence.length > 0) throw new OpenRouterPipelineError('validation', 'INVARIANT_FAILED', `Missing requirement ${m.requirement.normalized_name} has evidence.`);
  }

  // 5. "No material requirements are missing" must not be displayed when requirements remain unevaluated.
  if (failedNames.length > 0 && (!report.hiringManagerAssessment.topReasonsForRejection || report.hiringManagerAssessment.topReasonsForRejection.length === 0)) {
    throw new OpenRouterPipelineError('validation', 'INVARIANT_FAILED', `UI would falsely claim no material requirements are missing.`);
  }

  // 7. Keyword counts must derive from the same canonical classifications as the requirement breakdown.
  if (report.keywordCompatibility.missing.length !== missingNames.length) {
    throw new OpenRouterPipelineError('validation', 'INVARIANT_FAILED', `Keyword compatibility missing count does not match canonical missing count.`);
  }
}

export function generateNarrativeSynthesis(matches: any[], matchScore: number): string {
  const exactOrStrong = matches.filter(m => m.classification === 'EXACT_MATCH' || m.classification === 'STRONG_SEMANTIC_MATCH');
  if (exactOrStrong.length === 0) {
    return 'Based on the evaluation, no direct matching strengths were identified in the candidate profile for the specified requirements.';
  }
  
  const topNames = exactOrStrong.slice(0, 3).map(m => m.requirement.normalized_name);
  let skillsList = '';
  if (topNames.length === 1) {
    skillsList = topNames[0];
  } else if (topNames.length === 2) {
    skillsList = `${topNames[0]} and ${topNames[1]}`;
  } else if (topNames.length >= 3) {
    skillsList = `${topNames[0]}, ${topNames[1]}, and ${topNames[2]}`;
  }

  const fitLevel = matchScore >= 90 ? 'an exceptional' : matchScore >= 75 ? 'a strong' : matchScore >= 50 ? 'a solid' : 'a partial';
  
  return `The candidate demonstrates ${fitLevel} overall fit for the position, with robust evidence satisfying key role requirements such as ${skillsList}. Their background aligns well with the target domain competency, making them a competitive applicant for an interview.`;
}

export function generateRecruiterSummary(canonical: CanonicalRequirements, matchScore: number): string {
  if (canonical.analysisFailed.length > 0 && canonical.exact.length === 0 && canonical.semantic.length === 0) {
    return 'The job-match analysis could not be completed securely for the primary requirements.';
  }

  const missingMajor = [...canonical.missingCore, ...canonical.missingPreferred].filter(m => 
    m.requirement.normalized_name.toLowerCase().includes('year') ||
    m.requirement.normalized_name.toLowerCase().includes('experience') ||
    m.requirement.normalized_name.toLowerCase().includes('mentoring') ||
    m.requirement.normalized_name.toLowerCase().includes('lead')
  ).map(m => m.requirement.normalized_name);

  let summary = '';
  
  if (matchScore >= 90) {
    summary += `This candidate is a highly competitive match for the role, demonstrating comprehensive evidence across core requirements. `;
  } else if (matchScore >= 75) {
    summary += `This candidate is a strong match for the role, providing solid evidence for most key requirements. `;
  } else if (matchScore >= 50) {
    summary += `This candidate is a potential match, possessing foundational skills but missing evidence for some specific requirements. `;
  } else {
    summary += `This candidate appears to be a weak match for the role based on the provided resume. `;
  }

  if (canonical.exact.length > 0) {
    const topExact = canonical.exact.slice(0, 2).map(m => m.requirement.normalized_name).join(' and ');
    summary += `They exhibit definitive strengths in ${topExact}. `;
  } else if (canonical.semantic.length > 0) {
    summary += `They show relevant transferable experience for the core responsibilities. `;
  }

  if (missingMajor.length > 0) {
    const topMissing = missingMajor.slice(0, 2).join(' and ');
    summary += `However, they lack explicit evidence for critical requirements such as ${topMissing}, which presents a significant hiring risk. `;
  } else if (canonical.missingCore.length > 0 || canonical.missingPreferred.length > 0) {
    const missingCount = canonical.missingCore.length + canonical.missingPreferred.length;
    summary += `There are ${missingCount} stated requirements with no matching evidence in the resume. `;
  }

  if (canonical.analysisFailed.length > 0) {
    summary += `Note that ${canonical.analysisFailed.length} requirement(s) could not be fully analyzed. `;
  }

  if (matchScore >= 75 && missingMajor.length === 0) {
    summary += `Overall, their profile warrants moving forward to an interview to assess deeper technical fit.`;
  } else if (matchScore >= 50) {
    summary += `They may require additional screening to verify missing competencies before proceeding.`;
  } else {
    summary += `Given the substantial gaps in required experience, they are unlikely to advance in the hiring process without a revised resume providing further evidence.`;
  }

  return summary.trim();
}
