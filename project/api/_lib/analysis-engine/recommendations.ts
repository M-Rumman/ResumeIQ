import { randomUUID } from 'node:crypto';
import type { MatchingResult, RecommendationResult, Recommendation } from './types.js';

export function generateRecommendations(matchingResult: MatchingResult): RecommendationResult {
  const recommendations: Recommendation[] = [];

  for (const match of matchingResult.matches) {
    if (match.classification === 'MISSING') {
      recommendations.push({
        id: randomUUID(),
        type: 'missing_skill',
        priority: match.requirement.priority === 'required' ? 'critical' : 'optional',
        suggestion: `**What**: Explicitly add ${match.requirement.normalized_name}.\n**Why**: It is a ${match.requirement.priority} requirement for the role.\n**Where**: Experience or Skills section.\n**Evidence**: No evidence was found in your resume.\n**Note**: ONLY add this if you genuinely have practical experience or training. Never invent ${match.requirement.category}s or achievements.`
      });
    } else if (match.classification === 'RELATED_MATCH' || match.classification === 'UNDER_EXPLICIT') {
      const topEvidence = match.evidence.length > 0 ? match.evidence[0].source_text : 'related experience';
      const section = match.evidence.length > 0 ? match.evidence[0].source_section : 'Experience';
      
      recommendations.push({
        id: randomUUID(),
        type: 'weak_bullet',
        priority: 'important',
        suggestion: `**What**: Bridge the gap to explicitly mention ${match.requirement.normalized_name}.\n**Why**: The ATS and recruiters are looking for this specific term.\n**Where**: ${section} section.\n**Evidence**: You already have related experience: "${topEvidence}" (${match.explanation}).\n**Note**: Update your bullet point to use the exact terminology, but only if the context is accurate.`
      });
    } else if (match.classification === 'PARTIAL_MATCH') {
      const topEvidence = match.evidence.length > 0 ? match.evidence[0].source_text : 'partial experience';
      const section = match.evidence.length > 0 ? match.evidence[0].source_section : 'Experience';

      recommendations.push({
        id: randomUUID(),
        type: 'weak_bullet',
        priority: 'important',
        suggestion: `**What**: Expand on your proficiency with ${match.requirement.normalized_name}.\n**Why**: Your current mention lacks depth or metrics.\n**Where**: ${section} section.\n**Evidence**: You currently state: "${topEvidence}".\n**Note**: Add quantified outcomes (e.g. scale, duration, impact) only if accurate. Do not invent metrics.`
      });
    }
  }

  return { recommendations };
}
