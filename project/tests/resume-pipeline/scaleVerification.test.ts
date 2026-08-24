import assert from 'node:assert/strict';
import { validateEvidenceAttribution } from '../../api/_lib/analysis-engine/validator.js';
import type { JobRequirement, CandidateFact, RequirementMatch } from '../../api/_lib/analysis-engine/types.js';

export const scaleVerificationTests = [
  {
    name: 'Scale Verification: generic UX researcher title => MISSING',
    run: () => {
      const req: JobRequirement = {
        id: 'req-scale-1',
        normalized_name: 'Experience running research at scale (research repositories, participant panels)',
        original_text: 'Experience running research at scale (research repositories, participant panels)',
        category: 'hard skill',
        priority: 'required',
        requirement_type: 'skill',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: ''
      };

      const fact: CandidateFact = {
        id: 'fact-scale-1',
        type: 'experience',
        normalizedName: 'UX Researcher',
        rawText: 'UX Researcher at Company X.',
        sourceSection: 'Experience',
        evidence: 'UX Researcher at Company X.'
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
    name: 'Scale Verification: 100+ usability tests => UNDER_EXPRESSED',
    run: () => {
      const req: JobRequirement = {
        id: 'req-scale-2',
        normalized_name: 'Experience running research at scale (research repositories, participant panels)',
        original_text: 'Experience running research at scale (research repositories, participant panels)',
        category: 'hard skill',
        priority: 'required',
        requirement_type: 'skill',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: ''
      };

      const fact: CandidateFact = {
        id: 'fact-scale-2',
        type: 'experience',
        normalizedName: '100+ usability tests',
        rawText: 'Conducted 100+ usability tests across multiple product lines.',
        sourceSection: 'Experience',
        evidence: 'Conducted 100+ usability tests across multiple product lines.'
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
      assert.equal(validated[0].classification, 'UNDER_EXPRESSED');
    }
  },
  {
    name: 'Scale Verification: 5,000-person participant panel => STRONG_SEMANTIC_MATCH (unmodified)',
    run: () => {
      const req: JobRequirement = {
        id: 'req-scale-3',
        normalized_name: 'Experience running research at scale (research repositories, participant panels)',
        original_text: 'Experience running research at scale (research repositories, participant panels)',
        category: 'hard skill',
        priority: 'required',
        requirement_type: 'skill',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: ''
      };

      const fact: CandidateFact = {
        id: 'fact-scale-3',
        type: 'experience',
        normalizedName: 'participant panel',
        rawText: 'Built and managed a 5,000-person participant panel.',
        sourceSection: 'Experience',
        evidence: 'Built and managed a 5,000-person participant panel.'
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
    name: 'Scale Verification: centralized research repository => STRONG_SEMANTIC_MATCH (unmodified)',
    run: () => {
      const req: JobRequirement = {
        id: 'req-scale-4',
        normalized_name: 'Experience running research at scale (research repositories, participant panels)',
        original_text: 'Experience running research at scale (research repositories, participant panels)',
        category: 'hard skill',
        priority: 'required',
        requirement_type: 'skill',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: ''
      };

      const fact: CandidateFact = {
        id: 'fact-scale-4',
        type: 'experience',
        normalizedName: 'centralized research repository',
        rawText: 'Managed a centralized research repository for studies.',
        sourceSection: 'Experience',
        evidence: 'Managed a centralized research repository for studies.'
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
    name: 'Scale Verification: large research program without explicit numeric size => UNDER_EXPRESSED',
    run: () => {
      const req: JobRequirement = {
        id: 'req-scale-5',
        normalized_name: 'Experience running research at scale (research repositories, participant panels)',
        original_text: 'Experience running research at scale (research repositories, participant panels)',
        category: 'hard skill',
        priority: 'required',
        requirement_type: 'skill',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: ''
      };

      const fact: CandidateFact = {
        id: 'fact-scale-5',
        type: 'experience',
        normalizedName: 'large research program',
        rawText: 'Led a large research program across products.',
        sourceSection: 'Experience',
        evidence: 'Led a large research program across products.'
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
      assert.equal(validated[0].classification, 'UNDER_EXPRESSED');
    }
  },
  {
    name: 'Scale Verification: no scale evidence => MISSING',
    run: () => {
      const req: JobRequirement = {
        id: 'req-scale-6',
        normalized_name: 'Experience running research at scale (research repositories, participant panels)',
        original_text: 'Experience running research at scale (research repositories, participant panels)',
        category: 'hard skill',
        priority: 'required',
        requirement_type: 'skill',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: ''
      };

      const fact: CandidateFact = {
        id: 'fact-scale-6',
        type: 'experience',
        normalizedName: 'Conducted interviews',
        rawText: 'Conducted interviews and usability tests.',
        sourceSection: 'Experience',
        evidence: 'Conducted interviews and usability tests.'
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
  }
];

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('scaleVerification.test.ts')) {
  console.log('Running scale verification tests individually...');
  let passed = 0;
  for (const test of scaleVerificationTests) {
    try {
      test.run();
      console.log(`✅ PASS: ${test.name}`);
      passed++;
    } catch (e: any) {
      console.error(`❌ FAIL: ${test.name}`);
      console.error(e);
    }
  }
  console.log(`\n${passed}/${scaleVerificationTests.length} tests passed.`);
  if (passed !== scaleVerificationTests.length) process.exit(1);
}
