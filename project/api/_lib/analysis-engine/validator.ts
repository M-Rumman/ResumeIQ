import type { AiResumeAnalysisFull } from '../openrouter.js';
import type { JobProfile, CandidateProfile } from './types.js';

export function validateAndSanitizeReport(
  report: AiResumeAnalysisFull,
  jobProfile: JobProfile,
  candidateProfile: CandidateProfile
): AiResumeAnalysisFull {
  // 1. Requirement Provenance Check
  // Gather all valid requirement names extracted strictly from the JD.
  const validRequirements = new Set(jobProfile.requirements.map(req => req.normalized_name));

  const stripHallucinations = (arr: string[]) => arr.filter(skill => validRequirements.has(skill));

  report.missingSkills = stripHallucinations(report.missingSkills);
  report.existingSkills = stripHallucinations(report.existingSkills);
  report.missingKeywords = stripHallucinations(report.missingKeywords);
  report.keywordGaps = stripHallucinations(report.keywordGaps);
  report.missingRequiredSkills = stripHallucinations(report.missingRequiredSkills);
  report.keywordSuggestions = stripHallucinations(report.keywordSuggestions);
  
  if (report.jobMatchExplanation) {
    const stripHallucinatedObjects = (arr: any[]) => arr.filter(item => validRequirements.has(item.requirement));
    report.jobMatchExplanation.strongMatches = stripHallucinatedObjects(report.jobMatchExplanation.strongMatches);
    report.jobMatchExplanation.partialMatches = stripHallucinatedObjects(report.jobMatchExplanation.partialMatches);
    report.jobMatchExplanation.missingSkills = stripHallucinatedObjects(report.jobMatchExplanation.missingSkills);
  }

  if (report.keywordCompatibility) {
    report.keywordCompatibility.exactMatches = stripHallucinations(report.keywordCompatibility.exactMatches || []);
    report.keywordCompatibility.semanticMatches = stripHallucinations(report.keywordCompatibility.semanticMatches || []);
    report.keywordCompatibility.underExpressed = stripHallucinations(report.keywordCompatibility.underExpressed || []);
    report.keywordCompatibility.missing = stripHallucinations(report.keywordCompatibility.missing || []);
  }

  // 2. Recommendation Grounding Check
  // Ensures no recommendation tells a user to blindly add a skill without a warning.
  const warningClauses = ['only add this if accurate', 'never invent', 'only if accurate'];

  const enforceWarning = (suggestion: string) => {
    const lower = suggestion.toLowerCase();
    const hasWarning = warningClauses.some(clause => lower.includes(clause));
    if (!hasWarning) {
      return `${suggestion}\n**Note**: Only add this if accurate and supported by your actual experience.`;
    }
    return suggestion;
  };

  report.improvementSuggestions = report.improvementSuggestions.map(enforceWarning);
  report.optimizationRecommendations = report.optimizationRecommendations.map(enforceWarning);

  if (report.recommendationPriorities) {
    report.recommendationPriorities.critical = report.recommendationPriorities.critical.map(enforceWarning);
    report.recommendationPriorities.important = report.recommendationPriorities.important.map(enforceWarning);
    report.recommendationPriorities.optional = report.recommendationPriorities.optional.map(enforceWarning);
  }

  if (report.actionPlan) {
    report.actionPlan = report.actionPlan.map(gap => {
      const lower = gap.fabricationWarning.toLowerCase();
      const hasWarning = warningClauses.some(clause => lower.includes(clause));
      if (!hasWarning) {
        return {
          ...gap,
          fabricationWarning: `${gap.fabricationWarning} Only add this if accurate and supported by your actual experience.`
        };
      }
      return gap;
    });
  }

  // 3. Duplicate Validation
  const dedupe = (arr: string[]) => Array.from(new Set(arr));
  
  report.missingSkills = dedupe(report.missingSkills);
  report.existingSkills = dedupe(report.existingSkills);
  report.missingKeywords = dedupe(report.missingKeywords);
  report.keywordGaps = dedupe(report.keywordGaps);
  report.missingRequiredSkills = dedupe(report.missingRequiredSkills);
  report.keywordSuggestions = dedupe(report.keywordSuggestions);

  if (report.jobMatchExplanation) {
    const dedupeObjects = (arr: any[]) => {
      const seen = new Set();
      return arr.filter(item => {
        if (seen.has(item.requirement)) return false;
        seen.add(item.requirement);
        return true;
      });
    };
    report.jobMatchExplanation.strongMatches = dedupeObjects(report.jobMatchExplanation.strongMatches);
    report.jobMatchExplanation.partialMatches = dedupeObjects(report.jobMatchExplanation.partialMatches);
    report.jobMatchExplanation.missingSkills = dedupeObjects(report.jobMatchExplanation.missingSkills);
  }

  if (report.keywordCompatibility) {
    report.keywordCompatibility.exactMatches = dedupe(report.keywordCompatibility.exactMatches);
    report.keywordCompatibility.semanticMatches = dedupe(report.keywordCompatibility.semanticMatches);
    report.keywordCompatibility.underExpressed = dedupe(report.keywordCompatibility.underExpressed);
    report.keywordCompatibility.missing = dedupe(report.keywordCompatibility.missing);
  }

  // 4. Score Reconciliations
  if (report.atsBreakdown && report.atsBreakdown.length > 0) {
    const calculatedSum = report.atsBreakdown.reduce((sum, item) => sum + item.score, 0);
    report.atsScore = Math.max(0, Math.min(100, calculatedSum));
  }

  // 5. Interview Probability Removal
  // Replaces the hallucinated probability generated by match models.
  if (report.hiringManagerAssessment) {
    delete report.hiringManagerAssessment.estimatedInterviewProbability;
  }

  return report;
}
