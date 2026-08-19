import { describe, it } from 'node:test';
import assert from 'node:assert';
import { matchRequirements } from '../../api/_lib/analysis-engine/matcher.js';
import type { JobProfile, CandidateProfile, RequirementMatch, JobRequirement, CandidateFact } from '../../api/_lib/analysis-engine/types.js';

// Mock the openrouter fetch to simulate the LLM ranking response
const originalFetch = globalThis.fetch;

describe('Generic Semantic Evidence Ranking', () => {
  it('should rank tied evidence and assign the most semantically relevant one as primary', async () => {
    
    process.env.OPENROUTER_API_KEY = 'sk-or-mock_key';
    
    // Simulate LLM ranking quantitative to fact2 and qualitative to fact1
    globalThis.fetch = async (input, init) => {
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
      const prompt = body.messages?.[0]?.content || '';
      
      if (prompt.includes('most semantically relevant')) {
        return new Response(JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                rankings: [
                  { requirementId: 'req-qual', bestFactId: 'fact1' },
                  { requirementId: 'req-quant', bestFactId: 'fact2' },
                  { requirementId: 'req-scale', bestFactId: 'fact3' },
                  { requirementId: 'req-stakeholder', bestFactId: 'fact4' }
                ]
              })
            }
          }]
        }), { status: 200 });
      }
      return new Response('{}');
    };

    const reqQual: JobRequirement = {
      id: 'req-qual',
      normalized_name: 'qualitative research methods',
      original_text: 'Strong command of qualitative research methods',
      category: 'hard skill',
      priority: 'required'
    };

    const reqQuant: JobRequirement = {
      id: 'req-quant',
      normalized_name: 'quantitative research methods',
      original_text: 'Strong command of quantitative research methods',
      category: 'hard skill',
      priority: 'required'
    };

    const fact1: CandidateFact = {
      id: 'fact1',
      type: 'experience',
      sourceSection: 'experience',
      sectionInferred: false,
      normalizedName: 'Conducted 100+ usability tests and interviews across web and mobile lending products',
      rawText: 'Conducted 100+ usability tests and interviews across web and mobile lending products',
      evidence: 'Conducted 100+ usability tests and interviews across web and mobile lending products'
    };

    const fact2: CandidateFact = {
      id: 'fact2',
      type: 'experience',
      sourceSection: 'experience',
      sectionInferred: false,
      normalizedName: 'Designed and fielded quarterly surveys (NPS, CSAT) reaching 10,000+ customers',
      rawText: 'Designed and fielded quarterly surveys (NPS, CSAT) reaching 10,000+ customers',
      evidence: 'Designed and fielded quarterly surveys (NPS, CSAT) reaching 10,000+ customers'
    };

    const reqScale: JobRequirement = {
      id: 'req-scale',
      normalized_name: 'research at scale',
      original_text: 'Experience running research at scale (research repositories, participant panels)',
      category: 'experience',
      priority: 'required'
    };

    const reqStakeholder: JobRequirement = {
      id: 'req-stakeholder',
      normalized_name: 'stakeholder communication and storytelling',
      original_text: 'Excellent stakeholder communication and storytelling skills',
      category: 'soft skill',
      priority: 'required'
    };

    const fact3: CandidateFact = {
      id: 'fact3',
      type: 'experience',
      sourceSection: 'experience',
      sectionInferred: false,
      normalizedName: 'Built and managed a 5,000-person participant panel and centralized research repository',
      rawText: 'Built and managed a 5,000-person participant panel and centralized research repository',
      evidence: 'Built and managed a 5,000-person participant panel and centralized research repository'
    };

    const fact4: CandidateFact = {
      id: 'fact4',
      type: 'experience',
      sourceSection: 'experience',
      sectionInferred: false,
      normalizedName: 'Regularly presented findings to VP and C-suite stakeholders',
      rawText: 'Regularly presented findings to VP and C-suite stakeholders',
      evidence: 'Regularly presented findings to VP and C-suite stakeholders'
    };

    // Both facts received the exact same score in getDeterministicMatches (e.g., 5000 points added via generic heuristics)
    const matchQual: RequirementMatch & { _needsRanking?: boolean } = {
      requirement: reqQual,
      classification: 'STRONG_SEMANTIC_MATCH',
      confidence: 1.0,
      match_tier: 'tier_2_lexical',
      explanation: 'Deterministic match',
      _needsRanking: true,
      evidence: [
        { fact_id: 'fact1', source_text: fact1.rawText, source_section: 'experience', relevance: 'direct', evidence_strength: 'primary', evidence_type: 'experience', evidence_tier: 'tier_2_lexical' },
        { fact_id: 'fact2', source_text: fact2.rawText, source_section: 'experience', relevance: 'direct', evidence_strength: 'primary', evidence_type: 'experience', evidence_tier: 'tier_2_lexical' },
        { fact_id: 'fact3', source_text: fact3.rawText, source_section: 'experience', relevance: 'direct', evidence_strength: 'primary', evidence_type: 'experience', evidence_tier: 'tier_2_lexical' },
        { fact_id: 'fact4', source_text: fact4.rawText, source_section: 'experience', relevance: 'direct', evidence_strength: 'primary', evidence_type: 'experience', evidence_tier: 'tier_2_lexical' }
      ]
    };

    const matchQuant: RequirementMatch & { _needsRanking?: boolean } = {
      requirement: reqQuant,
      classification: 'STRONG_SEMANTIC_MATCH',
      confidence: 1.0,
      match_tier: 'tier_2_lexical',
      explanation: 'Deterministic match',
      _needsRanking: true,
      evidence: [
        { fact_id: 'fact1', source_text: fact1.rawText, source_section: 'experience', relevance: 'direct', evidence_strength: 'primary', evidence_type: 'experience', evidence_tier: 'tier_2_lexical' },
        { fact_id: 'fact2', source_text: fact2.rawText, source_section: 'experience', relevance: 'direct', evidence_strength: 'primary', evidence_type: 'experience', evidence_tier: 'tier_2_lexical' },
        { fact_id: 'fact3', source_text: fact3.rawText, source_section: 'experience', relevance: 'direct', evidence_strength: 'primary', evidence_type: 'experience', evidence_tier: 'tier_2_lexical' },
        { fact_id: 'fact4', source_text: fact4.rawText, source_section: 'experience', relevance: 'direct', evidence_strength: 'primary', evidence_type: 'experience', evidence_tier: 'tier_2_lexical' }
      ]
    };

    const matchScale: RequirementMatch & { _needsRanking?: boolean } = {
      requirement: reqScale,
      classification: 'STRONG_SEMANTIC_MATCH',
      confidence: 1.0,
      match_tier: 'tier_2_lexical',
      explanation: 'Deterministic match',
      _needsRanking: true,
      evidence: [
        { fact_id: 'fact1', source_text: fact1.rawText, source_section: 'experience', relevance: 'direct', evidence_strength: 'primary', evidence_type: 'experience', evidence_tier: 'tier_2_lexical' },
        { fact_id: 'fact2', source_text: fact2.rawText, source_section: 'experience', relevance: 'direct', evidence_strength: 'primary', evidence_type: 'experience', evidence_tier: 'tier_2_lexical' },
        { fact_id: 'fact3', source_text: fact3.rawText, source_section: 'experience', relevance: 'direct', evidence_strength: 'primary', evidence_type: 'experience', evidence_tier: 'tier_2_lexical' },
        { fact_id: 'fact4', source_text: fact4.rawText, source_section: 'experience', relevance: 'direct', evidence_strength: 'primary', evidence_type: 'experience', evidence_tier: 'tier_2_lexical' }
      ]
    };

    const matchStakeholder: RequirementMatch & { _needsRanking?: boolean } = {
      requirement: reqStakeholder,
      classification: 'STRONG_SEMANTIC_MATCH',
      confidence: 1.0,
      match_tier: 'tier_2_lexical',
      explanation: 'Deterministic match',
      _needsRanking: true,
      evidence: [
        { fact_id: 'fact1', source_text: fact1.rawText, source_section: 'experience', relevance: 'direct', evidence_strength: 'primary', evidence_type: 'experience', evidence_tier: 'tier_2_lexical' },
        { fact_id: 'fact2', source_text: fact2.rawText, source_section: 'experience', relevance: 'direct', evidence_strength: 'primary', evidence_type: 'experience', evidence_tier: 'tier_2_lexical' },
        { fact_id: 'fact3', source_text: fact3.rawText, source_section: 'experience', relevance: 'direct', evidence_strength: 'primary', evidence_type: 'experience', evidence_tier: 'tier_2_lexical' },
        { fact_id: 'fact4', source_text: fact4.rawText, source_section: 'experience', relevance: 'direct', evidence_strength: 'primary', evidence_type: 'experience', evidence_tier: 'tier_2_lexical' }
      ]
    };

    const deterministicResult = {
      matches: [matchQual, matchQuant, matchScale, matchStakeholder],
      unmatchedRequirements: [],
      prioritizedFacts: [fact1, fact2, fact3, fact4]
    };

    const job = { title: 'UX', requirements: [reqQual, reqQuant, reqScale, reqStakeholder] } as JobProfile;
    const candidate = { facts: [fact1, fact2, fact3, fact4], rawStructure: {} } as CandidateProfile;

    const result = await matchRequirements(job, candidate, deterministicResult);

    const resultingQualMatch = result.matches.find(m => m.requirement.id === 'req-qual');
    const resultingQuantMatch = result.matches.find(m => m.requirement.id === 'req-quant');
    const resultingScaleMatch = result.matches.find(m => m.requirement.id === 'req-scale');
    const resultingStakeholderMatch = result.matches.find(m => m.requirement.id === 'req-stakeholder');

    // Asserts that the match classification was PRESERVED
    assert.strictEqual(resultingQualMatch?.classification, 'STRONG_SEMANTIC_MATCH');
    assert.strictEqual(resultingQuantMatch?.classification, 'STRONG_SEMANTIC_MATCH');
    assert.strictEqual(resultingScaleMatch?.classification, 'STRONG_SEMANTIC_MATCH');
    assert.strictEqual(resultingStakeholderMatch?.classification, 'STRONG_SEMANTIC_MATCH');

    // Asserts that the primary evidence was properly swapped/selected
    assert.strictEqual(resultingQualMatch?.evidence[0].fact_id, 'fact1');
    assert.strictEqual(resultingQuantMatch?.evidence[0].fact_id, 'fact2'); // This was originally fact1, LLM swapped it!
    assert.strictEqual(resultingScaleMatch?.evidence[0].fact_id, 'fact3');
    assert.strictEqual(resultingStakeholderMatch?.evidence[0].fact_id, 'fact4');
    
    // Asserts that no evidence was completely dropped, just reordered
    assert.strictEqual(resultingQuantMatch?.evidence.length, 4);

    globalThis.fetch = originalFetch;
  });
});
