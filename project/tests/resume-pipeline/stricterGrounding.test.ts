import assert from 'node:assert/strict';
import { validateEvidenceAttribution } from '../../api/_lib/analysis-engine/validator.js';
import type { JobRequirement, CandidateFact, RequirementMatch } from '../../api/_lib/analysis-engine/types.js';

export const stricterGroundingTests = [
  {
    name: 'Case A: Behavioral analytics requirement + generic interview evidence => NOT STRONG_SEMANTIC_MATCH',
    run: () => {
      const req: JobRequirement = {
        id: 'req-a',
        normalized_name: 'Partner with data science to triangulate behavioral analytics with qualitative findings',
        original_text: 'Partner with data science to triangulate behavioral analytics with qualitative findings',
        category: 'hard skill',
        priority: 'required',
        requirement_type: 'skill',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: ''
      };

      const fact: CandidateFact = {
        id: 'fact-a',
        type: 'experience',
        normalizedName: 'interviewing',
        rawText: 'Worked on research for a photo-editing app. Helped set up interviews with users and took notes during sessions.',
        sourceSection: 'Experience',
        evidence: 'Worked on research for a photo-editing app. Helped set up interviews with users and took notes during sessions.'
      };

      const match: RequirementMatch = {
        requirement: req,
        classification: 'STRONG_SEMANTIC_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_3_semantic',
        evidence: [{
          source_section: 'Experience',
          source_text: fact.rawText,
          fact_id: fact.id,
          relevance: 'semantic',
          evidence_strength: 'primary',
          evidence_type: 'experience',
          evidence_tier: 'tier_3_semantic'
        }]
      };

      const validated = validateEvidenceAttribution([match], [fact], fact.rawText);
      assert.notEqual(validated[0].classification, 'STRONG_SEMANTIC_MATCH');
      assert.notEqual(validated[0].classification, 'EXACT_MATCH');
      assert.equal(validated[0].classification, 'PARTIAL_MATCH');
    }
  },
  {
    name: 'Case B: Research-at-scale requirement + generic UX researcher title => NOT STRONG_SEMANTIC_MATCH',
    run: () => {
      const req: JobRequirement = {
        id: 'req-b',
        normalized_name: 'Research at scale',
        original_text: 'Experience running research at scale (research repositories, participant panels)',
        category: 'experience',
        priority: 'required',
        requirement_type: 'experience',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: ''
      };

      const fact: CandidateFact = {
        id: 'fact-b',
        type: 'experience',
        normalizedName: 'UX Researcher',
        rawText: 'Worked as a UX Researcher for an e-commerce platform.',
        sourceSection: 'Experience',
        evidence: 'Worked as a UX Researcher for an e-commerce platform.'
      };

      const match: RequirementMatch = {
        requirement: req,
        classification: 'STRONG_SEMANTIC_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_3_semantic',
        evidence: [{
          source_section: 'Experience',
          source_text: fact.rawText,
          fact_id: fact.id,
          relevance: 'semantic',
          evidence_strength: 'primary',
          evidence_type: 'experience',
          evidence_tier: 'tier_3_semantic'
        }]
      };

      const validated = validateEvidenceAttribution([match], [fact], fact.rawText);
      assert.notEqual(validated[0].classification, 'STRONG_SEMANTIC_MATCH');
      assert.notEqual(validated[0].classification, 'EXACT_MATCH');
    }
  },
  {
    name: 'Case C: Senior leadership requirement + shared findings with design team => NOT EXACT_MATCH or STRONG_SEMANTIC_MATCH',
    run: () => {
      const req: JobRequirement = {
        id: 'req-c',
        normalized_name: 'presented findings to senior leadership and influenced product strategy',
        original_text: 'presented findings to senior leadership and influenced product strategy',
        category: 'responsibility',
        priority: 'required',
        requirement_type: 'responsibility',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: ''
      };

      const fact: CandidateFact = {
        id: 'fact-c',
        type: 'experience',
        normalizedName: 'shared findings',
        rawText: 'Shared research findings with design team and developers.',
        sourceSection: 'Experience',
        evidence: 'Shared research findings with design team and developers.'
      };

      const match: RequirementMatch = {
        requirement: req,
        classification: 'STRONG_SEMANTIC_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_3_semantic',
        evidence: [{
          source_section: 'Experience',
          source_text: fact.rawText,
          fact_id: fact.id,
          relevance: 'semantic',
          evidence_strength: 'primary',
          evidence_type: 'experience',
          evidence_tier: 'tier_3_semantic'
        }]
      };

      const validated = validateEvidenceAttribution([match], [fact], fact.rawText);
      assert.notEqual(validated[0].classification, 'STRONG_SEMANTIC_MATCH');
      assert.notEqual(validated[0].classification, 'EXACT_MATCH');
    }
  },
  {
    name: 'Case D: Mentoring requirement + no mentoring evidence => MISSING',
    run: () => {
      const req: JobRequirement = {
        id: 'req-d',
        normalized_name: 'mentored junior researchers',
        original_text: 'mentored junior researchers',
        category: 'responsibility',
        priority: 'preferred',
        requirement_type: 'responsibility',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: ''
      };

      const fact: CandidateFact = {
        id: 'fact-d',
        type: 'experience',
        normalizedName: 'UX researcher',
        rawText: 'Conducted user research and designed interfaces.',
        sourceSection: 'Experience',
        evidence: 'Conducted user research and designed interfaces.'
      };

      const match: RequirementMatch = {
        requirement: req,
        classification: 'STRONG_SEMANTIC_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_3_semantic',
        evidence: [{
          source_section: 'Experience',
          source_text: fact.rawText,
          fact_id: fact.id,
          relevance: 'semantic',
          evidence_strength: 'primary',
          evidence_type: 'experience',
          evidence_tier: 'tier_3_semantic'
        }]
      };

      const validated = validateEvidenceAttribution([match], [fact], fact.rawText);
      assert.equal(validated[0].classification, 'MISSING');
    }
  },
  {
    name: 'Case E: Qualitative research requirement + interviews/usability testing => valid semantic/strong semantic match',
    run: () => {
      const req: JobRequirement = {
        id: 'req-e',
        normalized_name: 'qualitative research methods',
        original_text: 'Strong command of qualitative research methods',
        category: 'hard skill',
        priority: 'required',
        requirement_type: 'skill',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: ''
      };

      const fact: CandidateFact = {
        id: 'fact-e',
        type: 'experience',
        normalizedName: 'Conducted usability tests and user interviews',
        rawText: 'Conducted usability tests and user interviews for banking application.',
        sourceSection: 'Experience',
        evidence: 'Conducted usability tests and user interviews for banking application.'
      };

      const match: RequirementMatch = {
        requirement: req,
        classification: 'STRONG_SEMANTIC_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_3_semantic',
        evidence: [{
          source_section: 'Experience',
          source_text: fact.rawText,
          fact_id: fact.id,
          relevance: 'semantic',
          evidence_strength: 'primary',
          evidence_type: 'experience',
          evidence_tier: 'tier_3_semantic'
        }]
      };

      const validated = validateEvidenceAttribution([match], [fact], fact.rawText);
      assert.equal(validated[0].classification, 'STRONG_SEMANTIC_MATCH');
    }
  },
  {
    name: 'Case F: Research repository + built and managed centralized research repository => valid strong semantic/exact match',
    run: () => {
      const req: JobRequirement = {
        id: 'req-f',
        normalized_name: 'built and managed centralized research repository',
        original_text: 'built and managed centralized research repository',
        category: 'hard skill',
        priority: 'required',
        requirement_type: 'skill',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: ''
      };

      const fact: CandidateFact = {
        id: 'fact-f',
        type: 'experience',
        normalizedName: 'centralized research repository',
        rawText: 'Successfully built and managed centralized research repository using Notion and Dovetail.',
        sourceSection: 'Experience',
        evidence: 'Successfully built and managed centralized research repository using Notion and Dovetail.'
      };

      const match: RequirementMatch = {
        requirement: req,
        classification: 'EXACT_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_2_lexical',
        evidence: [{
          source_section: 'Experience',
          source_text: fact.rawText,
          fact_id: fact.id,
          relevance: 'direct',
          evidence_strength: 'primary',
          evidence_type: 'experience',
          evidence_tier: 'tier_2_lexical'
        }]
      };

      const validated = validateEvidenceAttribution([match], [fact], fact.rawText);
      assert.equal(validated[0].classification, 'EXACT_MATCH');
    }
  }
];

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('stricterGrounding.test.ts')) {
  console.log('Running stricterGrounding tests individually...');
  let passed = 0;
  for (const test of stricterGroundingTests) {
    try {
      test.run();
      console.log(`✅ PASS: ${test.name}`);
      passed++;
    } catch (e: any) {
      console.error(`❌ FAIL: ${test.name}`);
      console.error(e);
    }
  }
  console.log(`\n${passed}/${stricterGroundingTests.length} tests passed.`);
  if (passed !== stricterGroundingTests.length) process.exit(1);
}
