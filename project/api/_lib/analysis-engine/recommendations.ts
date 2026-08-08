import { randomUUID } from 'node:crypto';
import type { MatchingResult, RecommendationResult, Recommendation } from './types.js';

export const CATEGORY_PLURAL_MAP: Record<string, string> = {
  'hard skill': 'hard skills',
  'soft skill': 'soft skills',
  'experience': 'experience',
  'education': 'education credentials',
  'domain': 'domains',
  'responsibility': 'responsibilities',
  'tool': 'tools',
  'methodology': 'methodologies',
  'seniority': 'seniority levels',
  'years': 'years of experience',
  'location': 'locations',
  'certification': 'certifications',
  'language': 'languages',
  'other': 'skills'
};

export function generateRecommendations(matchingResult: MatchingResult): RecommendationResult {
  const pluralizeCategory = (cat: string) => {
    return CATEGORY_PLURAL_MAP[cat] || cat + 's';
  };
  const recommendations: Recommendation[] = [];

  for (const match of matchingResult.matches) {
    if (match.classification === 'MISSING') {
      recommendations.push({
        id: randomUUID(),
        type: 'missing_skill',
        priority: match.requirement.priority === 'required' ? 'critical' : 'optional',
        requirement: match.requirement.normalized_name,
        whyItMatters: `It is a ${match.requirement.priority} requirement for the role.`,
        whereToAdd: 'Experience or Skills section.',
        evidenceStatus: 'No evidence was found in your resume.',
        fabricationWarning: `ONLY add this if you genuinely have practical experience or training. Never invent ${pluralizeCategory(match.requirement.category)} or achievements.`
      });
    } else if (match.classification === 'RELATED_MATCH' || match.classification === 'UNDER_EXPRESSED') {
      const topEvidence = match.evidence.length > 0 ? match.evidence[0].source_text : 'related experience';
      const section = match.evidence.length > 0 ? match.evidence[0].source_section : 'Experience';
      
      recommendations.push({
        id: randomUUID(),
        type: 'weak_bullet',
        priority: 'important',
        requirement: match.requirement.normalized_name,
        whyItMatters: 'The ATS and recruiters are looking for this specific term.',
        whereToAdd: `${section} section.`,
        evidenceStatus: `You already have related experience: "${topEvidence}" (${match.explanation}).`,
        fabricationWarning: 'Update your bullet point to use the exact terminology, but only if the context is accurate.'
      });
    } else if (match.classification === 'PARTIAL_MATCH') {
      const topEvidence = match.evidence.length > 0 ? match.evidence[0].source_text : 'partial experience';
      const section = match.evidence.length > 0 ? match.evidence[0].source_section : 'Experience';

      recommendations.push({
        id: randomUUID(),
        type: 'weak_bullet',
        priority: 'important',
        requirement: match.requirement.normalized_name,
        whyItMatters: 'Your current mention lacks depth or metrics.',
        whereToAdd: `${section} section.`,
        evidenceStatus: `You currently state: "${topEvidence}".`,
        fabricationWarning: 'Add quantified outcomes (e.g. scale, duration, impact) only if accurate. Do not invent metrics.'
      });
    }
  }

  return { recommendations };
}
