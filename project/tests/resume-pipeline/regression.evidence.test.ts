import test from 'node:test';
import assert from 'node:assert';
import { validateEvidenceAttribution } from '../../api/_lib/analysis-engine/validator.js';
import type { RequirementMatch, CandidateFact } from '../../api/_lib/analysis-engine/types.js';

test('validateEvidenceAttribution strips invalid evidence and downgrades match', () => {
  const candidateFacts: CandidateFact[] = [
    {
      id: 'fact-1',
      type: 'experience',
      normalizedName: 'software engineering',
      rawText: 'Led development of backend services in Node.js.',
      sourceSection: 'experience',
      evidence: 'Led development of backend services in Node.js.'
    },
    {
      id: 'fact-2',
      type: 'education',
      normalizedName: 'bachelors degree',
      rawText: 'B.S. Computer Science, University of Technology',
      sourceSection: 'education',
      evidence: 'B.S. Computer Science, University of Technology'
    }
  ];

  const resumeText = 'Led development of backend services in Node.js. B.S. Computer Science, University of Technology';

  const matches: RequirementMatch[] = [
    {
      // 1. Valid Match (Category and ID match)
      requirement: {
        id: 'req-1',
        category: 'experience',
        normalized_name: 'backend development',
        original_text: 'backend development',
        source_section: 'Requirements',
        source_span: [0, 10],
        source_text: 'backend development',
        priority: 'required',
        requirement_type: 'experience',
        confidence: 0.9
      },
      classification: 'EXACT_MATCH',
      confidence: 0.9,
      match_tier: 'tier_3_semantic',
      explanation: 'Matched backend.',
      evidence: [
        {
          fact_id: 'fact-1',
          source_section: 'experience',
          source_text: 'Led development of backend services in Node.js.',
          relevance: 'semantic',
          evidence_strength: 'primary',
          evidence_type: 'experience',
          evidence_tier: 'tier_3_semantic'
        }
      ]
    },
    {
      // 2. Invalid Match: Wrong category (Education citing Experience)
      requirement: {
        id: 'req-2',
        category: 'education',
        normalized_name: 'masters degree',
        original_text: 'Masters Degree',
        source_section: 'Requirements',
        source_span: [0, 10],
        source_text: 'Masters Degree',
        priority: 'required',
        requirement_type: 'education',
        confidence: 0.9
      },
      classification: 'EXACT_MATCH',
      confidence: 0.9,
      match_tier: 'tier_3_semantic',
      explanation: 'Matched masters.',
      evidence: [
        {
          fact_id: 'fact-1', // Points to experience fact!
          source_section: 'experience',
          source_text: 'Led development of backend services in Node.js.',
          relevance: 'semantic',
          evidence_strength: 'primary',
          evidence_type: 'experience',
          evidence_tier: 'tier_3_semantic'
        }
      ]
    },
    {
      // 3. Invalid Match: Hallucinated Text (Not in resume or fact)
      requirement: {
        id: 'req-3',
        category: 'experience',
        normalized_name: 'frontend development',
        original_text: 'frontend development',
        source_section: 'Requirements',
        source_span: [0, 10],
        source_text: 'frontend development',
        priority: 'required',
        requirement_type: 'experience',
        confidence: 0.9
      },
      classification: 'STRONG_SEMANTIC_MATCH',
      confidence: 0.9,
      match_tier: 'tier_3_semantic',
      explanation: 'Matched frontend.',
      evidence: [
        {
          fact_id: 'fact-1', // Points to valid fact
          source_section: 'experience',
          source_text: 'Built the entire frontend in React.', // Hallucinated! Not in fact-1
          relevance: 'semantic',
          evidence_strength: 'primary',
          evidence_type: 'experience',
          evidence_tier: 'tier_3_semantic'
        }
      ]
    }
  ];

  const validatedMatches = validateEvidenceAttribution(matches, candidateFacts, resumeText);

  // 1. Valid match should remain untouched
  assert.equal(validatedMatches[0].classification, 'EXACT_MATCH');
  assert.equal(validatedMatches[0].evidence.length, 1);

  // 2. Wrong category match should be stripped and downgraded
  assert.equal(validatedMatches[1].classification, 'ANALYSIS_FAILED');
  assert.equal(validatedMatches[1].evidence.length, 0);
  assert.ok(validatedMatches[1].explanation.includes('Evidence validation failed'));

  // 3. Hallucinated text match should be stripped and downgraded
  assert.equal(validatedMatches[2].classification, 'ANALYSIS_FAILED');
  assert.equal(validatedMatches[2].evidence.length, 0);
  assert.ok(validatedMatches[2].explanation.includes('Evidence validation failed'));
});
