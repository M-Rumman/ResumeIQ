import assert from 'node:assert/strict';
import { validateEvidenceAttribution } from '../../api/_lib/analysis-engine/validator.js';
import type { JobRequirement, CandidateFact, RequirementMatch } from '../../api/_lib/analysis-engine/types.js';

export const durationRobustnessTests = [
  {
    name: 'Duration Robustness: clearly >= 6 years',
    run: () => {
      const req: JobRequirement = {
        id: 'req-dur-4',
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

      const facts: CandidateFact[] = [
        {
          id: 'f-dur-4-1',
          type: 'experience',
          normalizedName: 'UX Researcher',
          rawText: 'UX Researcher, Bloomtrail — 2018 to 2024',
          sourceSection: 'Experience',
          evidence: 'UX Researcher, Bloomtrail — 2018 to 2024',
          employment_duration_years: 6
        }
      ];

      const match: RequirementMatch = {
        requirement: req,
        classification: 'EXACT_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_1_deterministic',
        evidence: [{
          source_section: 'Experience',
          source_text: facts[0].rawText,
          fact_id: facts[0].id,
          relevance: 'direct',
          evidence_strength: 'primary',
          evidence_type: 'experience',
          evidence_tier: 'tier_1_deterministic'
        }]
      };

      const validated = validateEvidenceAttribution([match], facts, facts[0].rawText);
      assert.equal(validated[0].classification, 'EXACT_MATCH');
      assert.match(validated[0].explanation, /6\+? years/i);
    }
  },
  {
    name: 'Duration Robustness: clearly < 6 years',
    run: () => {
      const req: JobRequirement = {
        id: 'req-dur-5',
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

      const facts: CandidateFact[] = [
        {
          id: 'f-dur-5-1',
          type: 'experience',
          normalizedName: 'UX Researcher',
          rawText: 'UX Researcher, Bloomtrail — 2021 to 2024',
          sourceSection: 'Experience',
          evidence: 'UX Researcher, Bloomtrail — 2021 to 2024',
          employment_duration_years: 3
        }
      ];

      const match: RequirementMatch = {
        requirement: req,
        classification: 'EXACT_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_1_deterministic',
        evidence: [{
          source_section: 'Experience',
          source_text: facts[0].rawText,
          fact_id: facts[0].id,
          relevance: 'direct',
          evidence_strength: 'primary',
          evidence_type: 'experience',
          evidence_tier: 'tier_1_deterministic'
        }]
      };

      const validated = validateEvidenceAttribution([match], facts, facts[0].rawText);
      assert.equal(validated[0].classification, 'PARTIAL_MATCH');
      assert.match(validated[0].explanation, /only 3 years/i);
    }
  },
  {
    name: 'Duration Robustness: overlapping jobs',
    run: () => {
      const req: JobRequirement = {
        id: 'req-dur-6',
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

      const facts: CandidateFact[] = [
        {
          id: 'f-dur-6-1',
          type: 'experience',
          normalizedName: 'UX Researcher A',
          rawText: 'UX Researcher, Bloomtrail — 2018 to 2022',
          sourceSection: 'Experience',
          evidence: 'UX Researcher, Bloomtrail — 2018 to 2022',
          employment_duration_years: 4
        },
        {
          id: 'f-dur-6-2',
          type: 'experience',
          normalizedName: 'UX Researcher B',
          rawText: 'UX Researcher, Pixelworks — 2020 to 2024',
          sourceSection: 'Experience',
          evidence: 'UX Researcher, Pixelworks — 2020 to 2024',
          employment_duration_years: 4
        }
      ];

      const match: RequirementMatch = {
        requirement: req,
        classification: 'EXACT_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_1_deterministic',
        evidence: [
          {
            source_section: 'Experience',
            source_text: facts[0].rawText,
            fact_id: facts[0].id,
            relevance: 'direct',
            evidence_strength: 'primary',
            evidence_type: 'experience',
            evidence_tier: 'tier_1_deterministic'
          },
          {
            source_section: 'Experience',
            source_text: facts[1].rawText,
            fact_id: facts[1].id,
            relevance: 'direct',
            evidence_strength: 'primary',
            evidence_type: 'experience',
            evidence_tier: 'tier_1_deterministic'
          }
        ]
      };

      const validated = validateEvidenceAttribution([match], facts, facts[0].rawText + '\n' + facts[1].rawText);
      assert.equal(validated[0].classification, 'EXACT_MATCH');
      assert.match(validated[0].explanation, /6\+? years/i);
    }
  },
  {
    name: 'Duration Robustness: missing end date / present',
    run: () => {
      const req: JobRequirement = {
        id: 'req-dur-7',
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

      const currentYear = new Date().getFullYear();
      const startYear = currentYear - 7;

      const facts: CandidateFact[] = [
        {
          id: 'f-dur-7-1',
          type: 'experience',
          normalizedName: 'UX Researcher',
          rawText: `UX Researcher, Bloomtrail — ${startYear} to present`,
          sourceSection: 'Experience',
          evidence: `UX Researcher, Bloomtrail — ${startYear} to present`,
          employment_duration_years: 7
        }
      ];

      const match: RequirementMatch = {
        requirement: req,
        classification: 'EXACT_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_1_deterministic',
        evidence: [{
          source_section: 'Experience',
          source_text: facts[0].rawText,
          fact_id: facts[0].id,
          relevance: 'direct',
          evidence_strength: 'primary',
          evidence_type: 'experience',
          evidence_tier: 'tier_1_deterministic'
        }]
      };

      const validated = validateEvidenceAttribution([match], facts, facts[0].rawText);
      assert.equal(validated[0].classification, 'EXACT_MATCH');
      assert.match(validated[0].explanation, /7(?:\.\d+)?\+? years/i);
    }
  },
  {
    name: 'Duration Robustness: internship',
    run: () => {
      const req: JobRequirement = {
        id: 'req-dur-8',
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

      const facts: CandidateFact[] = [
        {
          id: 'f-dur-8-1',
          type: 'experience',
          normalizedName: 'UX Researcher',
          rawText: 'UX Researcher, Bloomtrail — 2019 to 2024',
          sourceSection: 'Experience',
          evidence: 'UX Researcher, Bloomtrail — 2019 to 2024',
          employment_duration_years: 5
        },
        {
          id: 'f-dur-8-2',
          type: 'experience',
          normalizedName: 'Research Intern',
          rawText: 'Research Intern, Campus Lab — 2018 to 2019',
          sourceSection: 'Experience',
          evidence: 'Research Intern, Campus Lab — 2018 to 2019',
          employment_duration_years: 1
        }
      ];

      const match: RequirementMatch = {
        requirement: req,
        classification: 'EXACT_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_1_deterministic',
        evidence: [
          {
            source_section: 'Experience',
            source_text: facts[0].rawText,
            fact_id: facts[0].id,
            relevance: 'direct',
            evidence_strength: 'primary',
            evidence_type: 'experience',
            evidence_tier: 'tier_1_deterministic'
          },
          {
            source_section: 'Experience',
            source_text: facts[1].rawText,
            fact_id: facts[1].id,
            relevance: 'direct',
            evidence_strength: 'primary',
            evidence_type: 'experience',
            evidence_tier: 'tier_1_deterministic'
          }
        ]
      };

      const validated = validateEvidenceAttribution([match], facts, facts[0].rawText + '\n' + facts[1].rawText);
      assert.equal(validated[0].classification, 'PARTIAL_MATCH');
      assert.match(validated[0].explanation, /including internship/i);
    }
  },
  {
    name: 'Duration Robustness: unrelated non-research role',
    run: () => {
      const req: JobRequirement = {
        id: 'req-dur-9',
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

      const facts: CandidateFact[] = [
        {
          id: 'f-dur-9-1',
          type: 'experience',
          normalizedName: 'UX Researcher',
          rawText: 'UX Researcher, Bloomtrail — 2020 to 2024',
          sourceSection: 'Experience',
          evidence: 'UX Researcher, Bloomtrail — 2020 to 2024',
          employment_duration_years: 4
        },
        {
          id: 'f-dur-9-2',
          type: 'experience',
          normalizedName: 'Sales Assistant',
          rawText: 'Sales Assistant, Target — 2018 to 2020',
          sourceSection: 'Experience',
          evidence: 'Sales Assistant, Target — 2018 to 2020',
          employment_duration_years: 2
        }
      ];

      const match: RequirementMatch = {
        requirement: req,
        classification: 'EXACT_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_1_deterministic',
        evidence: [
          {
            source_section: 'Experience',
            source_text: facts[0].rawText,
            fact_id: facts[0].id,
            relevance: 'direct',
            evidence_strength: 'primary',
            evidence_type: 'experience',
            evidence_tier: 'tier_1_deterministic'
          },
          {
            source_section: 'Experience',
            source_text: facts[1].rawText,
            fact_id: facts[1].id,
            relevance: 'direct',
            evidence_strength: 'primary',
            evidence_type: 'experience',
            evidence_tier: 'tier_1_deterministic'
          }
        ]
      };

      const validated = validateEvidenceAttribution([match], facts, facts[0].rawText + '\n' + facts[1].rawText);
      assert.equal(validated[0].classification, 'PARTIAL_MATCH');
      assert.match(validated[0].explanation, /only 4 years/i);
    }
  },
  {
    name: 'Duration Robustness: ambiguous dates',
    run: () => {
      const req: JobRequirement = {
        id: 'req-dur-10',
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

      const facts: CandidateFact[] = [
        {
          id: 'f-dur-10-1',
          type: 'experience',
          normalizedName: 'UX Researcher',
          rawText: 'UX Researcher, Bloomtrail — some time ago',
          sourceSection: 'Experience',
          evidence: 'UX Researcher, Bloomtrail — some time ago',
          employment_duration_years: 0
        }
      ];

      const match: RequirementMatch = {
        requirement: req,
        classification: 'EXACT_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_1_deterministic',
        evidence: [{
          source_section: 'Experience',
          source_text: facts[0].rawText,
          fact_id: facts[0].id,
          relevance: 'direct',
          evidence_strength: 'primary',
          evidence_type: 'experience',
          evidence_tier: 'tier_1_deterministic'
        }]
      };

      const validated = validateEvidenceAttribution([match], facts, facts[0].rawText);
      assert.equal(validated[0].classification, 'ANALYSIS_FAILED');
      assert.match(validated[0].explanation, /unable to determine experience duration/i);
    }
  }
];

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('durationRobustness.test.ts')) {
  console.log('Running duration robustness tests individually...');
  let passed = 0;
  for (const test of durationRobustnessTests) {
    try {
      test.run();
      console.log(`✅ PASS: ${test.name}`);
      passed++;
    } catch (e: any) {
      console.error(`❌ FAIL: ${test.name}`);
      console.error(e);
    }
  }
  console.log(`\n${passed}/${durationRobustnessTests.length} tests passed.`);
  if (passed !== durationRobustnessTests.length) process.exit(1);
}
