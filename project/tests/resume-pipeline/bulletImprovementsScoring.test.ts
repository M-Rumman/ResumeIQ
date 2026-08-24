import assert from 'node:assert/strict';
import { validateRewrites } from '../../api/_lib/aiValidation.js';
import { scoreBulletQuality, hasQuantification } from '../../api/_lib/analysis-engine/bulletScoring.js';

const dummyResume = `John Doe
SUMMARY
UX Researcher with 5 years of experience.

EXPERIENCE
Acme Corp | UX Researcher
- helped with usability testing
- Built and managed a 5,000-person participant panel and centralized research repository, cutting study recruitment time by 50%
- Maintained legacy systems using Java
- run surveys sometimes
- helped manage database queries, reducing downtime by 30%
- Worked on code
- Conducted interviews`;

export const bulletImprovementsScoringTests = [
  {
    name: 'Bullet Scoring: weak passive bullet => wording-only fallback regeneration',
    run: () => {
      const before = 'helped with usability testing';
      // If LLM tries to output a metric like "improving satisfaction by 20%", it is ungrounded
      const rawOutput = [
        {
          before,
          after: 'helped with usability testing, improving satisfaction by 20%',
          confidence: 'High'
        }
      ];

      const validated = validateRewrites(rawOutput, dummyResume, ['usability testing']);
      const rewrite = validated[0];

      assert.ok(rewrite);
      // The ungrounded rewrite must be rejected and regenerated to a wording-only safe rewrite
      assert.equal(rewrite.after, 'Coordinated and set up usability testing.');
      assert.ok(rewrite.improvementScore > 0, 'Wording-only rewrite should improve over weak passive');
      // No metrics were in original, so impact score must not be inflated
      assert.ok(rewrite.afterScoreBreakdown.impact <= rewrite.beforeScoreBreakdown.impact);
    }
  },
  {
    name: 'Bullet Scoring: already strong quantified bullet => no meaningful improvement recommended',
    run: () => {
      const before = 'Built and managed a 5,000-person participant panel and centralized research repository, cutting study recruitment time by 50%';
      const rawOutput = [
        {
          before,
          after: 'Managed a 5,000-person panel and centralized research repository to cut study recruitment time by 50%.',
          confidence: 'High'
        }
      ];

      const validated = validateRewrites(rawOutput, dummyResume, []);
      const rewrite = validated[0];

      assert.ok(rewrite);
      assert.equal(rewrite.after, before);
      assert.equal(rewrite.improvementScore, 0);
      assert.equal(rewrite.reasoning, 'No meaningful improvement recommended.');
    }
  },
  {
    name: 'Bullet Scoring: bullet with no measurable outcome => no additional Impact points',
    run: () => {
      const before = 'Maintained legacy systems using Java';
      const rawOutput = [
        {
          before,
          after: 'Engineered robust patterns to maintain legacy Java systems.',
          confidence: 'High'
        }
      ];

      const validated = validateRewrites(rawOutput, dummyResume, ['Java']);
      const rewrite = validated[0];

      assert.ok(rewrite);
      assert.ok(rewrite.afterScoreBreakdown.impact <= rewrite.beforeScoreBreakdown.impact, 'Rewrite must not get more Impact points if no metric exists');
    }
  },
  {
    name: 'Bullet Scoring: bullet where only wording can improve => correct Action upgrade but no Impact increase',
    run: () => {
      const before = 'run surveys sometimes';
      const rawOutput = [
        {
          before,
          after: 'Conducted surveys.',
          confidence: 'High'
        }
      ];

      const validated = validateRewrites(rawOutput, dummyResume, []);
      const rewrite = validated[0];

      assert.ok(rewrite);
      assert.ok(rewrite.improvementScore > 0);
      assert.ok(rewrite.afterScoreBreakdown.action > rewrite.beforeScoreBreakdown.action, 'Action verb should improve');
      assert.ok(rewrite.afterScoreBreakdown.impact <= rewrite.beforeScoreBreakdown.impact, 'Impact must not increase without metrics');
    }
  },
  {
    name: 'Bullet Scoring: bullet with strong measurable impact => high impact score preserved',
    run: () => {
      const before = 'helped manage database queries, reducing downtime by 30%';
      const rawOutput = [
        {
          before,
          after: 'Optimized database query performance, reducing system downtime by 30%.',
          confidence: 'High'
        }
      ];

      const validated = validateRewrites(rawOutput, dummyResume, []);
      const rewrite = validated[0];

      assert.ok(rewrite);
      assert.ok(rewrite.improvementScore > 0);
      assert.equal(rewrite.afterScoreBreakdown.impact, 20, 'Quantified outcome should receive 20 impact points');
    }
  },
  {
    name: 'Bullet Scoring: bullet where no safe rewrite exists => original preserved',
    run: () => {
      const before = 'Worked on code';
      // LLM output is ungrounded and cannot even be wording-rewritten (already basic)
      const rawOutput = [
        {
          before,
          after: 'Architected advanced distributed cloud infrastructure systems.',
          confidence: 'High'
        }
      ];

      const validated = validateRewrites(rawOutput, dummyResume, []);
      const rewrite = validated[0];

      assert.ok(rewrite);
      assert.equal(rewrite.after, 'Worked on code'); // Cannot be improved without inventing facts, so falls back to original
      assert.equal(rewrite.improvementScore, 0);
    }
  },
  {
    name: 'Bullet Scoring: bullet where an LLM tries to invent a metric => metric stripped/regenerated',
    run: () => {
      const before = 'Conducted interviews';
      const rawOutput = [
        {
          before,
          after: 'Conducted interviews, improving product adoption by 40%',
          confidence: 'High'
        }
      ];

      const validated = validateRewrites(rawOutput, dummyResume, []);
      const rewrite = validated[0];

      assert.ok(rewrite);
      // Hallucinated metric "40%" must be rejected, and fallback to wording-only safe rewrite "Conducted interviews."
      assert.ok(!hasQuantification(rewrite.after));
      assert.ok(!rewrite.after.includes('40%'));
    }
  },
  {
    name: 'Bullet Scoring: missing JD requirement => outputs safety warning without fabricating facts',
    run: () => {
      const before = 'Conducted interviews and usability tests.';
      const rawOutput = [
        {
          before,
          after: 'Cannot safely add this requirement because the resume does not contain supporting evidence.',
          whyItIsWeak: 'The original bullet lacks any evidence of behavioral analytics or data science triangulation.',
          whatInformationIsMissing: 'Requires candidate-provided evidence of analytics collaborations.',
          whyThisIsStronger: 'N/A - Cannot safely add.'
        }
      ];

      const validated = validateRewrites(rawOutput, 'Conducted interviews and usability tests.', []);
      const rewrite = validated[0];

      assert.ok(rewrite);
      assert.equal(rewrite.after, 'Cannot safely add this requirement because the resume does not contain supporting evidence.');
      assert.equal(rewrite.improvementScore, 1);
      assert.match(rewrite.reasoning, /cannot be safely added/);
      assert.equal(rewrite.whatInformationIsMissing, 'Requires candidate-provided evidence of analytics collaborations.');
    }
  },
  {
    name: 'Bullet Prioritisation: prioritizes bullets corresponding to PARTIAL_MATCH and UNDER_EXPRESSED requirements',
    run: () => {
      const candidateContexts = [
        { text: 'Conducted user interviews and surveys.' },
        { text: 'helped database performance.' },
        { text: 'Wrote software features.' }
      ];
      
      const partialAndUnderExpressed = [
        { requirement: { normalized_name: 'database performance' }, classification: 'PARTIAL_MATCH' },
        { requirement: { normalized_name: 'user interviews' }, classification: 'UNDER_EXPRESSED' }
      ];

      // Re-run the prioritization algorithm used in pipeline.ts
      const targetKeywords = ['database performance', 'user interviews'];
      const weakCandidates = candidateContexts
        .map(b => {
          const text = b.text.toLowerCase();
          let priorityScore = 0;
          for (const req of partialAndUnderExpressed) {
            const reqName = req.requirement.normalized_name.toLowerCase();
            if (text.includes(reqName)) {
              priorityScore += 1000;
            } else {
              const reqWords = reqName.split(/\s+/).filter(w => w.length > 3);
              const overlaps = reqWords.filter(w => text.includes(w));
              if (overlaps.length > 0) {
                priorityScore += overlaps.length * 100;
              }
            }
          }
          const qualityScore = scoreBulletQuality(b.text, targetKeywords).total;
          return { ...b, qualityScore, priorityScore };
        })
        .sort((a, b) => {
          if (b.priorityScore !== a.priorityScore) {
            return b.priorityScore - a.priorityScore;
          }
          return a.qualityScore - b.qualityScore;
        });

      // The prioritized order should put the database performance bullet first, followed by user interviews, and finally the unrelated feature bullet.
      assert.equal(weakCandidates[0].text, 'helped database performance.');
      assert.equal(weakCandidates[1].text, 'Conducted user interviews and surveys.');
      assert.equal(weakCandidates[2].text, 'Wrote software features.');
    }
  }
];

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('bulletImprovementsScoring.test.ts')) {
  console.log('Running bullet improvements scoring tests individually...');
  let passed = 0;
  for (const test of bulletImprovementsScoringTests) {
    try {
      test.run();
      console.log(`✅ PASS: ${test.name}`);
      passed++;
    } catch (e: any) {
      console.error(`❌ FAIL: ${test.name}`);
      console.error(e);
    }
  }
  console.log(`\n${passed}/${bulletImprovementsScoringTests.length} tests passed.`);
  if (passed !== bulletImprovementsScoringTests.length) process.exit(1);
}
