import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRecommendations } from '../../api/_lib/analysis-engine/recommendations.js';
import type { MatchingResult, MatchData } from '../../api/_lib/analysis-engine/types.js';

test('generateRecommendations logic', async (t) => {
  const createMockMatch = (classification: any, name: string): MatchData => ({
    requirement: {
      id: '1',
      normalized_name: name,
      original_text: name,
      source_section: 'Requirements',
      source_span: [0, 10],
      source_text: name,
      category: 'hard skill',
      priority: 'required',
      requirement_type: 'explicit',
      confidence: 1
    },
    classification,
    confidence: 1,
    evidence: [{ source_text: 'Used stuff', source_section: 'Experience', confidence: 1 }],
    explanation: 'Test'
  });

  await t.test('Skips EXACT_MATCH and STRONG_SEMANTIC_MATCH', () => {
    const result = generateRecommendations({
      score: 100,
      matches: [
        createMockMatch('EXACT_MATCH', 'TypeScript'),
        createMockMatch('STRONG_SEMANTIC_MATCH', 'JavaScript')
      ],
      unmatched_requirements: []
    });
    
    assert.equal(result.recommendations.length, 0);
  });

  await t.test('MISSING match suggests adding only if it genuinely exists', () => {
    const result = generateRecommendations({
      score: 100,
      matches: [
        createMockMatch('MISSING', 'Python')
      ],
      unmatched_requirements: []
    });
    
    assert.equal(result.recommendations.length, 1);
    assert.match(result.recommendations[0].recommendedAction, /Suggest adding Python only if it genuinely exists elsewhere in your experience/);
  });

  await t.test('UNDER_EXPRESSED suggests a truthful rewrite using existing facts', () => {
    const result = generateRecommendations({
      score: 100,
      matches: [
        createMockMatch('UNDER_EXPRESSED', 'Node.js')
      ],
      unmatched_requirements: []
    });
    
    assert.equal(result.recommendations.length, 1);
    assert.match(result.recommendations[0].recommendedAction, /Suggest a truthful rewrite using existing facts to explicitly highlight Node.js/);
  });
});
