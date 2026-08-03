import { parseJobDescription } from './jdParser.js';
import { extractCandidateProfile } from './resumeExtraction.js';
import { matchRequirements } from './matcher.js';
import { evaluateScores } from './evaluator.js';
import { generateRecommendations } from './recommendations.js';
import { validateAndSanitizeReport } from './validator.js';
import type { PipelineContext, EngineResult, AiResumeAnalysisFull } from './types.js';
import type { AiObservabilityContext } from '../aiObservability.js';
import type { ParsedResume, KeywordCompatibility } from '../openrouter.js';

export async function runAnalysisPipeline(
  context: PipelineContext,
  options: { observability?: AiObservabilityContext } = {}
): Promise<EngineResult> {
  console.info('[pipeline] Starting modular analysis engine...');

  // 1. Extraction (Parallel)
  const [jobProfile, candidateProfile] = await Promise.all([
    parseJobDescription(context.jobDescriptionText, options),
    Promise.resolve(extractCandidateProfile(context.resumeText))
  ]);

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
  const matchingResult = await matchRequirements(jobProfile, candidateProfile, options);
  const evaluationResult = evaluateScores(jobProfile, candidateProfile, matchingResult);
  const recommendationResult = generateRecommendations(matchingResult);

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
    .filter(m => ['PARTIAL_MATCH', 'RELATED_MATCH', 'UNDER_EXPLICIT'].includes(m.classification))
    .map(m => m.requirement.normalized_name);

  const missingCoreSkills = sortedMatches
    .filter(m => m.classification === 'MISSING' && m.requirement.priority === 'required')
    .map(m => m.requirement.normalized_name);

  const missingPreferredSkills = sortedMatches
    .filter(m => m.classification === 'MISSING' && m.requirement.priority !== 'required')
    .map(m => m.requirement.normalized_name);

  const allMissingSkills = [...missingCoreSkills, ...missingPreferredSkills];
  const allStrongSkills = [...exactSkills, ...semanticSkills];

  const formatSuggestion = (r: any) => `**What**: Explicitly add ${r.requirement}.\n**Why**: ${r.whyItMatters}\n**Where**: ${r.whereToAdd}\n**Evidence**: ${r.evidenceStatus}\n**Note**: ${r.fabricationWarning}`;
  const improvements = recommendationResult.recommendations.map(formatSuggestion);

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
    weakBullets: [],
    improvedBulletPoints: [],
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
    jobMatchExplanation: {
      strongMatches: allStrongSkills,
      partialMatches: partialSkills,
      missingSkills: allMissingSkills,
    },
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
    }
  };

  const validatedReport = validateAndSanitizeReport(legacyReport, jobProfile, candidateProfile);

  return {
    tier: 'premium',
    legacyReport: validatedReport
  };
}
