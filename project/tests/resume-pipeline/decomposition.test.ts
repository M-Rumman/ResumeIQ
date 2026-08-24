import assert from 'node:assert/strict';
import { validateEvidenceAttribution } from '../../api/_lib/analysis-engine/validator.js';
import type { JobRequirement, CandidateFact, RequirementMatch } from '../../api/_lib/analysis-engine/types.js';

export const decompositionTests = [
  {
    name: 'Case 1: City matches but hybrid requirement absent => PARTIAL_MATCH',
    run: () => {
      const req: JobRequirement = {
        id: 'req-loc-1',
        normalized_name: 'location: Chicago, IL (Hybrid — 3 days onsite)',
        original_text: 'Chicago, IL (Hybrid — 3 days onsite)',
        category: 'location',
        priority: 'required',
        requirement_type: 'location',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: ''
      };

      const fact: CandidateFact = {
        id: 'fact-loc-1',
        type: 'other',
        normalizedName: 'Chicago',
        rawText: 'Lives in Chicago, IL',
        sourceSection: 'Personal Info',
        evidence: 'Lives in Chicago, IL'
      };

      const match: RequirementMatch = {
        requirement: req,
        classification: 'EXACT_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_1_deterministic',
        evidence: [{
          source_section: 'Personal Info',
          source_text: fact.rawText,
          fact_id: fact.id,
          relevance: 'direct',
          evidence_strength: 'primary',
          evidence_type: 'other',
          evidence_tier: 'tier_1_deterministic'
        }]
      };

      const validated = validateEvidenceAttribution([match], [fact], fact.rawText);
      assert.equal(validated[0].classification, 'PARTIAL_MATCH');
      assert.match(validated[0].explanation, /hybrid/i);
    }
  },
  {
    name: 'Case 2: Generic title vs senior title => Downgraded from Exact/Strong to Partial',
    run: () => {
      const req: JobRequirement = {
        id: 'req-sen-1',
        normalized_name: 'Senior UX Researcher',
        original_text: 'Senior UX Researcher',
        category: 'seniority',
        priority: 'required',
        requirement_type: 'role',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: ''
      };

      const fact: CandidateFact = {
        id: 'fact-sen-1',
        type: 'experience',
        normalizedName: 'UX Researcher',
        rawText: 'UX Researcher, Bloomtrail — 2022 to now',
        sourceSection: 'Experience',
        evidence: 'UX Researcher, Bloomtrail — 2022 to now'
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
      assert.match(validated[0].explanation, /seniority|senior-level/i);
    }
  },
  {
    name: 'Case 3: 4 years vs 6+ years => PARTIAL_MATCH',
    run: () => {
      const req: JobRequirement = {
        id: 'req-dur-3',
        normalized_name: '6+ years UX research',
        original_text: '6+ years of UX research experience',
        category: 'experience',
        priority: 'required',
        requirement_type: 'experience',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: '',
        minimum_years: 6
      };

      const fact: CandidateFact = {
        id: 'fact-dur-3',
        type: 'experience',
        normalizedName: 'UX Researcher',
        rawText: 'UX Researcher from 2020 to 2024 (4 years)',
        sourceSection: 'Experience',
        evidence: 'UX Researcher from 2020 to 2024 (4 years)',
        employment_duration_years: 4
      };

      const match: RequirementMatch = {
        requirement: req,
        classification: 'EXACT_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_1_deterministic',
        evidence: [{
          source_section: 'Experience',
          source_text: fact.rawText,
          fact_id: fact.id,
          relevance: 'direct',
          evidence_strength: 'primary',
          evidence_type: 'experience',
          evidence_tier: 'tier_1_deterministic'
        }]
      };

      const validated = validateEvidenceAttribution([match], [fact], fact.rawText);
      assert.equal(validated[0].classification, 'PARTIAL_MATCH');
      assert.match(validated[0].explanation, /less than the required/i);
    }
  },
  {
    name: 'Case 4: Communications bachelor vs explicitly requested Psychology/HCI/Cognitive Science => MISSING',
    run: () => {
      const req: JobRequirement = {
        id: 'req-edu-1',
        normalized_name: 'bachelors degree in psychology, hci, cognitive science, or related field',
        original_text: "Bachelor's degree in Psychology, HCI, Cognitive Science, or related field",
        category: 'education',
        priority: 'required',
        requirement_type: 'education',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: '',
        degree_level: 'bachelor',
        fields: ['Psychology', 'HCI', 'Cognitive Science']
      };

      const fact: CandidateFact = {
        id: 'fact-edu-1',
        type: 'education',
        normalizedName: 'Communications',
        rawText: 'B.A. in Communications',
        sourceSection: 'Education',
        evidence: 'B.A. in Communications',
        degree_level: 'bachelor',
        fields: ['Communications']
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
    name: 'Case 5: Exact match when all compound components are actually supported => EXACT_MATCH',
    run: () => {
      const req: JobRequirement = {
        id: 'req-comp-1',
        normalized_name: 'location: Chicago, IL (Hybrid — 3 days onsite)',
        original_text: 'Chicago, IL (Hybrid — 3 days onsite)',
        category: 'location',
        priority: 'required',
        requirement_type: 'location',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: ''
      };

      const fact: CandidateFact = {
        id: 'fact-comp-1',
        type: 'other',
        normalizedName: 'Chicago',
        rawText: 'Lives in Chicago, IL and works hybrid (3 days onsite).',
        sourceSection: 'Personal Info',
        evidence: 'Lives in Chicago, IL and works hybrid (3 days onsite).'
      };

      const match: RequirementMatch = {
        requirement: req,
        classification: 'EXACT_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_1_deterministic',
        evidence: [{
          source_section: 'Personal Info',
          source_text: fact.rawText,
          fact_id: fact.id,
          relevance: 'direct',
          evidence_strength: 'primary',
          evidence_type: 'other',
          evidence_tier: 'tier_1_deterministic'
        }]
      };

      const validated = validateEvidenceAttribution([match], [fact], fact.rawText);
      assert.equal(validated[0].classification, 'EXACT_MATCH');
    }
  }
];

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('decomposition.test.ts')) {
  console.log('Running decomposition tests individually...');
  let passed = 0;
  for (const test of decompositionTests) {
    try {
      test.run();
      console.log(`✅ PASS: ${test.name}`);
      passed++;
    } catch (e: any) {
      console.error(`❌ FAIL: ${test.name}`);
      console.error(e);
    }
  }
  console.log(`\n${passed}/${decompositionTests.length} tests passed.`);
  if (passed !== decompositionTests.length) process.exit(1);
}
