import { sortMatches, rankStrengths } from './api/_lib/analysis-engine/evaluator.js';

const mockMatches: any[] = [
  {
    requirement: { id: 'req1', normalized_name: 'Python', category: 'experience', priority: 'preferred', aliases: [] },
    classification: 'EXACT_MATCH',
    confidence: 0.9,
    evidence: [],
    explanation: 'has Python',
    match_tier: 'tier_1_deterministic'
  },
  {
    requirement: { id: 'req2', normalized_name: 'Java', category: 'experience', priority: 'required', aliases: [] },
    classification: 'STRONG_SEMANTIC_MATCH',
    confidence: 0.9,
    evidence: [],
    explanation: 'has Java',
    match_tier: 'tier_1_deterministic'
  },
  {
    requirement: { id: 'req3', normalized_name: 'C++', category: 'experience', priority: 'required', aliases: [] },
    classification: 'EXACT_MATCH',
    confidence: 0.8,
    evidence: [],
    explanation: 'has C++',
    match_tier: 'tier_1_deterministic'
  },
  {
    requirement: { id: 'req4', normalized_name: 'Go', category: 'experience', priority: 'required', aliases: [] },
    classification: 'PARTIAL_MATCH',
    confidence: 0.8,
    evidence: [],
    explanation: 'has Go',
    match_tier: 'tier_1_deterministic'
  }
];

const sorted = sortMatches(mockMatches);
console.log('Sorted all matches:');
sorted.forEach(s => console.log(s.classification, s.requirement.priority, s.requirement.normalized_name));

const strengths = rankStrengths(mockMatches);
console.log('\nRanked strengths:');
strengths.forEach(s => console.log(s.classification, s.requirement.priority, s.requirement.normalized_name));
