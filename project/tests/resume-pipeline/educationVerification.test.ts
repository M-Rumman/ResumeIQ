import assert from 'node:assert/strict';
import { validateEvidenceAttribution } from '../../api/_lib/analysis-engine/validator.js';
import type { JobRequirement, CandidateFact, RequirementMatch } from '../../api/_lib/analysis-engine/types.js';

const req: JobRequirement = {
  id: 'req-edu-verify',
  normalized_name: "Bachelor's degree in Psychology, HCI, Cognitive Science, or related field",
  original_text: "Bachelor's degree in Psychology, HCI, Cognitive Science, or related field",
  category: 'education',
  priority: 'required',
  requirement_type: 'education',
  confidence: 1,
  source_section: 'Requirements',
  source_span: [0, 0],
  source_text: ''
};

export const educationVerificationTests = [
  {
    name: 'Education Verification: Psychology => EXACT_MATCH',
    run: () => {
      const fact: CandidateFact = {
        id: 'fact-edu-1',
        type: 'education',
        normalizedName: 'B.S. in Psychology',
        rawText: 'B.S. in Psychology, Northwestern University',
        sourceSection: 'Education',
        evidence: 'B.S. in Psychology, Northwestern University'
      };

      const match: RequirementMatch = {
        requirement: req,
        classification: 'STRONG_SEMANTIC_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_3_semantic',
        evidence: [{
          source_section: 'Education',
          source_text: fact.rawText,
          fact_id: fact.id,
          relevance: 'semantic',
          evidence_strength: 'primary',
          evidence_type: 'education',
          evidence_tier: 'tier_3_semantic'
        }]
      };

      const validated = validateEvidenceAttribution([match], [fact], fact.rawText);
      assert.equal(validated[0].classification, 'EXACT_MATCH');
      assert.match(validated[0].explanation, /one of the explicitly requested disciplines/i);
    }
  },
  {
    name: 'Education Verification: HCI => EXACT_MATCH',
    run: () => {
      const fact: CandidateFact = {
        id: 'fact-edu-2',
        type: 'education',
        normalizedName: 'M.S. in HCI',
        rawText: 'M.S. in Human-Computer Interaction, Georgia Tech',
        sourceSection: 'Education',
        evidence: 'M.S. in Human-Computer Interaction, Georgia Tech'
      };

      const match: RequirementMatch = {
        requirement: req,
        classification: 'STRONG_SEMANTIC_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_3_semantic',
        evidence: [{
          source_section: 'Education',
          source_text: fact.rawText,
          fact_id: fact.id,
          relevance: 'semantic',
          evidence_strength: 'primary',
          evidence_type: 'education',
          evidence_tier: 'tier_3_semantic'
        }]
      };

      const validated = validateEvidenceAttribution([match], [fact], fact.rawText);
      assert.equal(validated[0].classification, 'EXACT_MATCH');
      assert.match(validated[0].explanation, /one of the explicitly requested disciplines/i);
    }
  },
  {
    name: 'Education Verification: Cognitive Science => EXACT_MATCH',
    run: () => {
      const fact: CandidateFact = {
        id: 'fact-edu-3',
        type: 'education',
        normalizedName: 'B.A. in Cognitive Science',
        rawText: 'B.A. in Cognitive Science, UC Berkeley',
        sourceSection: 'Education',
        evidence: 'B.A. in Cognitive Science, UC Berkeley'
      };

      const match: RequirementMatch = {
        requirement: req,
        classification: 'STRONG_SEMANTIC_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_3_semantic',
        evidence: [{
          source_section: 'Education',
          source_text: fact.rawText,
          fact_id: fact.id,
          relevance: 'semantic',
          evidence_strength: 'primary',
          evidence_type: 'education',
          evidence_tier: 'tier_3_semantic'
        }]
      };

      const validated = validateEvidenceAttribution([match], [fact], fact.rawText);
      assert.equal(validated[0].classification, 'EXACT_MATCH');
      assert.match(validated[0].explanation, /one of the explicitly requested disciplines/i);
    }
  },
  {
    name: 'Education Verification: Sociology => PARTIAL_MATCH',
    run: () => {
      const fact: CandidateFact = {
        id: 'fact-edu-4',
        type: 'education',
        normalizedName: 'B.A. in Sociology',
        rawText: 'B.A. in Sociology, Harvard University',
        sourceSection: 'Education',
        evidence: 'B.A. in Sociology, Harvard University'
      };

      const match: RequirementMatch = {
        requirement: req,
        classification: 'STRONG_SEMANTIC_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_3_semantic',
        evidence: [{
          source_section: 'Education',
          source_text: fact.rawText,
          fact_id: fact.id,
          relevance: 'semantic',
          evidence_strength: 'primary',
          evidence_type: 'education',
          evidence_tier: 'tier_3_semantic'
        }]
      };

      const validated = validateEvidenceAttribution([match], [fact], fact.rawText);
      assert.equal(validated[0].classification, 'PARTIAL_MATCH');
      assert.match(validated[0].explanation, /adjacent to UX research\/user behavior/i);
      assert.match(validated[0].explanation, /is not one of the explicitly requested/i);
    }
  },
  {
    name: 'Education Verification: Anthropology => PARTIAL_MATCH',
    run: () => {
      const fact: CandidateFact = {
        id: 'fact-edu-5',
        type: 'education',
        normalizedName: 'B.A. in Anthropology',
        rawText: 'B.A. in Anthropology, Boston University',
        sourceSection: 'Education',
        evidence: 'B.A. in Anthropology, Boston University'
      };

      const match: RequirementMatch = {
        requirement: req,
        classification: 'STRONG_SEMANTIC_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_3_semantic',
        evidence: [{
          source_section: 'Education',
          source_text: fact.rawText,
          fact_id: fact.id,
          relevance: 'semantic',
          evidence_strength: 'primary',
          evidence_type: 'education',
          evidence_tier: 'tier_3_semantic'
        }]
      };

      const validated = validateEvidenceAttribution([match], [fact], fact.rawText);
      assert.equal(validated[0].classification, 'PARTIAL_MATCH');
      assert.match(validated[0].explanation, /adjacent to UX research\/user behavior/i);
    }
  },
  {
    name: 'Education Verification: Communications => PARTIAL_MATCH',
    run: () => {
      const fact: CandidateFact = {
        id: 'fact-edu-6',
        type: 'education',
        normalizedName: 'B.A. in Communications',
        rawText: 'B.A. in Communications, NYU',
        sourceSection: 'Education',
        evidence: 'B.A. in Communications, NYU'
      };

      const match: RequirementMatch = {
        requirement: req,
        classification: 'STRONG_SEMANTIC_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_3_semantic',
        evidence: [{
          source_section: 'Education',
          source_text: fact.rawText,
          fact_id: fact.id,
          relevance: 'semantic',
          evidence_strength: 'primary',
          evidence_type: 'education',
          evidence_tier: 'tier_3_semantic'
        }]
      };

      const validated = validateEvidenceAttribution([match], [fact], fact.rawText);
      assert.equal(validated[0].classification, 'PARTIAL_MATCH');
      assert.match(validated[0].explanation, /adjacent to UX research\/user behavior/i);
    }
  },
  {
    name: 'Education Verification: Computer Science => PARTIAL_MATCH',
    run: () => {
      const fact: CandidateFact = {
        id: 'fact-edu-7',
        type: 'education',
        normalizedName: 'B.S. in Computer Science',
        rawText: 'B.S. in Computer Science, Stanford University',
        sourceSection: 'Education',
        evidence: 'B.S. in Computer Science, Stanford University'
      };

      const match: RequirementMatch = {
        requirement: req,
        classification: 'STRONG_SEMANTIC_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_3_semantic',
        evidence: [{
          source_section: 'Education',
          source_text: fact.rawText,
          fact_id: fact.id,
          relevance: 'semantic',
          evidence_strength: 'primary',
          evidence_type: 'education',
          evidence_tier: 'tier_3_semantic'
        }]
      };

      const validated = validateEvidenceAttribution([match], [fact], fact.rawText);
      assert.equal(validated[0].classification, 'PARTIAL_MATCH');
      assert.match(validated[0].explanation, /adjacent to UX research\/user behavior/i);
    }
  },
  {
    name: 'Education Verification: Engineering => PARTIAL_MATCH',
    run: () => {
      const fact: CandidateFact = {
        id: 'fact-edu-8',
        type: 'education',
        normalizedName: 'B.S. in Engineering',
        rawText: 'B.S. in Systems Engineering, MIT',
        sourceSection: 'Education',
        evidence: 'B.S. in Systems Engineering, MIT'
      };

      const match: RequirementMatch = {
        requirement: req,
        classification: 'STRONG_SEMANTIC_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_3_semantic',
        evidence: [{
          source_section: 'Education',
          source_text: fact.rawText,
          fact_id: fact.id,
          relevance: 'semantic',
          evidence_strength: 'primary',
          evidence_type: 'education',
          evidence_tier: 'tier_3_semantic'
        }]
      };

      const validated = validateEvidenceAttribution([match], [fact], fact.rawText);
      assert.equal(validated[0].classification, 'PARTIAL_MATCH');
      assert.match(validated[0].explanation, /adjacent to UX research\/user behavior/i);
    }
  },
  {
    name: 'Education Verification: unrelated degree => MISSING',
    run: () => {
      const fact: CandidateFact = {
        id: 'fact-edu-9',
        type: 'education',
        normalizedName: 'B.A. in Art History',
        rawText: 'B.A. in Art History, Yale University',
        sourceSection: 'Education',
        evidence: 'B.A. in Art History, Yale University'
      };

      const match: RequirementMatch = {
        requirement: req,
        classification: 'STRONG_SEMANTIC_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_3_semantic',
        evidence: [{
          source_section: 'Education',
          source_text: fact.rawText,
          fact_id: fact.id,
          relevance: 'semantic',
          evidence_strength: 'primary',
          evidence_type: 'education',
          evidence_tier: 'tier_3_semantic'
        }]
      };

      const validated = validateEvidenceAttribution([match], [fact], fact.rawText);
      assert.equal(validated[0].classification, 'MISSING');
      assert.match(validated[0].explanation, /unrelated to the requested fields/i);
    }
  }
];

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('educationVerification.test.ts')) {
  console.log('Running education verification tests individually...');
  let passed = 0;
  for (const test of educationVerificationTests) {
    try {
      test.run();
      console.log(`✅ PASS: ${test.name}`);
      passed++;
    } catch (e: any) {
      console.error(`❌ FAIL: ${test.name}`);
      console.error(e);
    }
  }
  console.log(`\n${passed}/${educationVerificationTests.length} tests passed.`);
  if (passed !== educationVerificationTests.length) process.exit(1);
}
