import assert from 'node:assert/strict';
import { validateEvidenceAttribution } from '../../api/_lib/analysis-engine/validator.js';
import type { JobRequirement, CandidateFact, RequirementMatch } from '../../api/_lib/analysis-engine/types.js';

export const stakeholderVerificationTests = [
  {
    name: 'Stakeholder Verification: design team communication => Level 1 (PARTIAL_MATCH for senior req)',
    run: () => {
      const req: JobRequirement = {
        id: 'req-stake-1',
        normalized_name: 'Present research findings to senior leadership and influence strategy',
        original_text: 'Present research findings to senior leadership and influence strategy',
        category: 'soft skill',
        priority: 'required',
        requirement_type: 'skill',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: ''
      };

      const fact: CandidateFact = {
        id: 'fact-stake-1',
        type: 'experience',
        normalizedName: 'Shared findings',
        rawText: 'I write up what I find and share it with the design team so they can make changes.',
        sourceSection: 'Experience',
        evidence: 'I write up what I find and share it with the design team so they can make changes.'
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
      assert.equal(validated[0].classification, 'PARTIAL_MATCH');
      assert.match(validated[0].explanation, /demands senior leadership/i);
      assert.match(validated[0].explanation, /Level 1/i);
    }
  },
  {
    name: 'Stakeholder Verification: cross-functional presentation => Level 2 (STRONG_SEMANTIC_MATCH for general req)',
    run: () => {
      const req: JobRequirement = {
        id: 'req-stake-2',
        normalized_name: 'Excellent stakeholder communication and storytelling skills',
        original_text: 'Excellent stakeholder communication and storytelling skills',
        category: 'soft skill',
        priority: 'required',
        requirement_type: 'skill',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: ''
      };

      const fact: CandidateFact = {
        id: 'fact-stake-2',
        type: 'experience',
        normalizedName: 'Present research narratives',
        rawText: 'Presented research narratives to cross-functional teams and product/design stakeholders.',
        sourceSection: 'Experience',
        evidence: 'Presented research narratives to cross-functional teams and product/design stakeholders.'
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
    name: 'Stakeholder Verification: VP/C-suite presentation => Level 3 (STRONG_SEMANTIC_MATCH for senior req)',
    run: () => {
      const req: JobRequirement = {
        id: 'req-stake-3',
        normalized_name: 'Present research findings to senior leadership',
        original_text: 'Present research findings to senior leadership',
        category: 'soft skill',
        priority: 'required',
        requirement_type: 'skill',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: ''
      };

      const fact: CandidateFact = {
        id: 'fact-stake-3',
        type: 'experience',
        normalizedName: 'VP/C-suite',
        rawText: 'Presented research findings to the VP and C-suite executives.',
        sourceSection: 'Experience',
        evidence: 'Presented research findings to the VP and C-suite executives.'
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
    name: 'Stakeholder Verification: roadmap influence => Level 3 (STRONG_SEMANTIC_MATCH)',
    run: () => {
      const req: JobRequirement = {
        id: 'req-stake-4',
        normalized_name: 'Influence product strategy and roadmaps',
        original_text: 'Influence product strategy and roadmaps',
        category: 'soft skill',
        priority: 'required',
        requirement_type: 'skill',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: ''
      };

      const fact: CandidateFact = {
        id: 'fact-stake-4',
        type: 'experience',
        normalizedName: 'Roadmap influence',
        rawText: 'Influenced product roadmap and long-term product strategy.',
        sourceSection: 'Experience',
        evidence: 'Influenced product roadmap and long-term product strategy.'
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
    name: 'Stakeholder Verification: generic communication skill => Level 1 (PARTIAL_MATCH for general req)',
    run: () => {
      const req: JobRequirement = {
        id: 'req-stake-5',
        normalized_name: 'Excellent communication and storytelling',
        original_text: 'Excellent communication and storytelling',
        category: 'soft skill',
        priority: 'required',
        requirement_type: 'skill',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: ''
      };

      const fact: CandidateFact = {
        id: 'fact-stake-5',
        type: 'experience',
        normalizedName: 'Share with team',
        rawText: 'I write up findings and share them with the design team.',
        sourceSection: 'Experience',
        evidence: 'I write up findings and share them with the design team.'
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
      assert.equal(validated[0].classification, 'PARTIAL_MATCH');
      assert.match(validated[0].explanation, /demands strong stakeholder storytelling/i);
      assert.match(validated[0].explanation, /Level 1/i);
    }
  },
  {
    name: 'Stakeholder Verification: no stakeholder evidence => MISSING',
    run: () => {
      const req: JobRequirement = {
        id: 'req-stake-6',
        normalized_name: 'Excellent stakeholder communication and storytelling',
        original_text: 'Excellent stakeholder communication and storytelling',
        category: 'soft skill',
        priority: 'required',
        requirement_type: 'skill',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: ''
      };

      const fact: CandidateFact = {
        id: 'fact-stake-6',
        type: 'experience',
        normalizedName: 'Figma mockups',
        rawText: 'Created Figma wireframes and high-fidelity mockups.',
        sourceSection: 'Experience',
        evidence: 'Created Figma wireframes and high-fidelity mockups.'
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

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('stakeholderVerification.test.ts')) {
  console.log('Running stakeholder verification tests individually...');
  let passed = 0;
  for (const test of stakeholderVerificationTests) {
    try {
      test.run();
      console.log(`✅ PASS: ${test.name}`);
      passed++;
    } catch (e: any) {
      console.error(`❌ FAIL: ${test.name}`);
      console.error(e);
    }
  }
  console.log(`\n${passed}/${stakeholderVerificationTests.length} tests passed.`);
  if (passed !== stakeholderVerificationTests.length) process.exit(1);
}
