import assert from 'node:assert/strict';
import { validateEvidenceAttribution } from '../../api/_lib/analysis-engine/validator.js';
import { scoreBulletQuality } from '../../api/_lib/analysis-engine/bulletScoring.js';
import { validateRewrites } from '../../api/_lib/aiValidation.ts';
import type { JobRequirement, CandidateFact, RequirementMatch } from '../../api/_lib/analysis-engine/types.js';

export const correctionsVerificationTests = [
  {
    name: 'Experience Threshold Invariant: 4.6 years vs 6+ requirement must NOT be EXACT_MATCH',
    run: () => {
      const req: JobRequirement = {
        id: 'req-exp-6plus',
        normalized_name: '6+ years of UX research experience',
        original_text: '6+ years of UX research experience',
        category: 'experience',
        priority: 'required',
        requirement_type: 'experience',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: '6+ years of UX research experience',
        minimum_years: 6
      };

      const facts: CandidateFact[] = [
        {
          id: 'f-exp-4.6',
          type: 'experience',
          normalizedName: 'UX Researcher',
          rawText: 'UX Researcher, Acme — Jan 2020 to Aug 2024', // 4.6 years
          sourceSection: 'Experience',
          evidence: 'UX Researcher, Acme — Jan 2020 to Aug 2024',
          employment_duration_years: 4.6
        }
      ];

      const initialMatch: RequirementMatch = {
        requirement: req,
        classification: 'EXACT_MATCH', // even if candidate passed in EXACT_MATCH initially
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

      const validated = validateEvidenceAttribution([initialMatch], facts, facts[0].rawText);
      const match = validated[0];

      assert.notEqual(match.classification, 'EXACT_MATCH', 'Candidate with 4.6 years must NOT receive EXACT_MATCH for 6+ year requirement');
      assert.equal(match.classification, 'PARTIAL_MATCH', 'Candidate with 4.6 years must receive PARTIAL_MATCH');
      assert.match(match.explanation, /4\.6 years/i, 'Explanation must explicitly state candidate has 4.6 years');
      assert.match(match.explanation, /less than the required 6\+? years/i, 'Explanation must explicitly state 4.6 is less than required 6+ years');
    }
  },
  {
    name: 'Experience Threshold Invariant: 6+ years candidate DOES receive EXACT_MATCH',
    run: () => {
      const req: JobRequirement = {
        id: 'req-exp-6plus-2',
        normalized_name: '6+ years of UX research experience',
        original_text: '6+ years of UX research experience',
        category: 'experience',
        priority: 'required',
        requirement_type: 'experience',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: '6+ years of UX research experience',
        minimum_years: 6
      };

      const facts: CandidateFact[] = [
        {
          id: 'f-exp-6.5',
          type: 'experience',
          normalizedName: 'UX Researcher',
          rawText: 'UX Researcher, Acme — Jan 2018 to Aug 2024', // 6.6 years
          sourceSection: 'Experience',
          evidence: 'UX Researcher, Acme — Jan 2018 to Aug 2024',
          employment_duration_years: 6.6
        }
      ];

      const initialMatch: RequirementMatch = {
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

      const validated = validateEvidenceAttribution([initialMatch], facts, facts[0].rawText);
      assert.equal(validated[0].classification, 'EXACT_MATCH', 'Candidate with 6.6 years must receive EXACT_MATCH');
    }
  },
  {
    name: 'Location Hybrid Disambiguation: Chicago candidate without hybrid evidence must be PARTIAL_MATCH',
    run: () => {
      const req: JobRequirement = {
        id: 'req-loc-hybrid',
        normalized_name: 'Location: Chicago, IL (Hybrid - 3 days onsite)',
        original_text: 'Chicago, IL (Hybrid — 3 days onsite)',
        category: 'location',
        priority: 'required',
        requirement_type: 'location',
        confidence: 1,
        source_section: 'Requirements',
        source_span: [0, 0],
        source_text: 'Chicago, IL (Hybrid — 3 days onsite)'
      };

      const facts: CandidateFact[] = [
        {
          id: 'f-loc-chicago',
          type: 'other',
          normalizedName: 'Location',
          rawText: 'Chicago, IL',
          sourceSection: 'summary',
          evidence: 'Chicago, IL'
        }
      ];

      const initialMatch: RequirementMatch = {
        requirement: req,
        classification: 'EXACT_MATCH',
        confidence: 1,
        explanation: 'Initial match',
        match_tier: 'tier_1_deterministic',
        evidence: [{
          source_section: 'summary',
          source_text: facts[0].rawText,
          fact_id: facts[0].id,
          relevance: 'direct',
          evidence_strength: 'primary',
          evidence_type: 'other',
          evidence_tier: 'tier_1_deterministic'
        }]
      };

      const validated = validateEvidenceAttribution([initialMatch], facts, facts[0].rawText);
      assert.equal(validated[0].classification, 'PARTIAL_MATCH', 'Chicago location without hybrid evidence must yield PARTIAL_MATCH');
      assert.match(validated[0].explanation, /does not establish availability for the required hybrid\/onsite schedule/i, 'Must explain missing hybrid schedule evidence without instructing to fabricate');
    }
  },
  {
    name: 'Weak Conversational Bullet: "I do research for our e-commerce app." produces grounded improvement opportunity',
    run: () => {
      const before = 'I do research for our e-commerce app.';
      const resumeText = `John Doe\nSummary\n${before}`;
      
      const beforeScore = scoreBulletQuality(before, ['UX Research']);
      assert.ok(beforeScore.total < 75, `Conversational bullet should receive quality score < 75, got ${beforeScore.total}`);

      const rawRewrites = [
        {
          before,
          after: 'Conduct user research for an e-commerce application.',
          confidence: 'High'
        }
      ];

      const validated = validateRewrites(rawRewrites, resumeText, ['UX Research'], [{ text: before, sourceContext: resumeText }]);
      assert.equal(validated.length, 1, 'Weak conversational bullet must produce 1 validated rewrite');
      assert.ok(validated[0].improvementScore > 0, 'Improvement score must be positive for conversational bullet rewrite');
      assert.equal(validated[0].afterScore > validated[0].beforeScore, true, 'afterScore > beforeScore invariant must hold');
    }
  },
  {
    name: 'Weak Ownership Bullet: "Helped set up interviews with users." produces grounded improvement opportunity',
    run: () => {
      const before = 'Helped set up interviews with users.';
      const resumeText = `John Doe\nExperience\n${before}`;

      const rawRewrites = [
        {
          before,
          after: 'Coordinated user interview setup and documented sessions.',
          confidence: 'High'
        }
      ];

      const validated = validateRewrites(rawRewrites, resumeText, ['User Interviews'], [{ text: before, sourceContext: resumeText }]);
      assert.equal(validated.length, 1, 'Weak ownership bullet must produce 1 validated rewrite');
      assert.ok(validated[0].improvementScore > 0, 'Improvement score must be positive for weak ownership bullet rewrite');
      assert.equal(validated[0].afterScore > validated[0].beforeScore, true, 'afterScore > beforeScore invariant must hold');
    }
  },
  {
    name: 'Strong Bullet: High quality bullet returns no unnecessary rewrite or +0 improvement',
    run: () => {
      const strong = 'Built and managed a 5,000-person participant panel and centralized research repository, cutting study recruitment time by 50%.';
      const resumeText = `John Doe\nExperience\n${strong}`;

      const rawRewrites = [
        {
          before: strong,
          after: 'Managed a 5,000-person panel and centralized repository to cut recruitment time by 50%.',
          confidence: 'High'
        }
      ];

      const validated = validateRewrites(rawRewrites, resumeText, ['Research Repository'], [{ text: strong, sourceContext: resumeText }]);
      assert.equal(validated[0].after, 'No meaningful improvement recommended.', 'Strong bullet must return No meaningful improvement recommended.');
      assert.equal(validated[0].improvementScore, 0, 'Improvement score must be 0 for already strong bullet');
    }
  },
  {
    name: 'Score Integrity: Only positive improvement (afterScore > beforeScore) is accepted as positive score',
    run: () => {
      const bullet = 'Maintained code base.';
      const resumeText = `John Doe\nExperience\n${bullet}`;

      const rawRewrites = [
        {
          before: bullet,
          after: 'Maintained code base.', // identical rewrite
          confidence: 'High'
        }
      ];

      const validated = validateRewrites(rawRewrites, resumeText, ['Codebase'], [{ text: bullet, sourceContext: resumeText }]);
      assert.equal(validated[0].after, 'No meaningful improvement recommended.');
      assert.equal(validated[0].improvementScore, 0);
    }
  }
];

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('correctionsVerification.test.ts')) {
  console.log('Running ResuV targeted corrections verification tests...');
  let passed = 0;
  for (const test of correctionsVerificationTests) {
    try {
      test.run();
      console.log(`✅ PASS: ${test.name}`);
      passed++;
    } catch (e: any) {
      console.error(`❌ FAIL: ${test.name}`);
      console.error(e);
    }
  }
  console.log(`\n${passed}/${correctionsVerificationTests.length} tests passed.`);
  if (passed !== correctionsVerificationTests.length) process.exit(1);
}
