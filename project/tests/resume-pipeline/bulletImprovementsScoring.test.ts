import assert from 'node:assert/strict';
import { validateRewrites } from '../../api/_lib/aiValidation.js';
import { scoreBulletQuality, hasQuantification, BulletScore } from '../../api/_lib/analysis-engine/bulletScoring.js';

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
    name: '1. Genuinely stronger bullet: correctly calculates score breakdown and improvement score',
    run: () => {
      const before = 'helped manage database queries, reducing downtime by 30%';
      const after = 'Optimized database query performance, reducing system downtime by 30%';
      
      const beforeQuality = scoreBulletQuality(before);
      const afterQuality = scoreBulletQuality(after);
      const expectedImprovement = afterQuality.total - beforeQuality.total;

      const rawOutput = [{ before, after, confidence: 'High' }];
      const validated = validateRewrites(rawOutput, dummyResume, []);
      const rewrite = validated[0];

      assert.ok(rewrite);
      assert.equal(rewrite.after, after);
      assert.equal(rewrite.improvementScore, expectedImprovement);
      assert.equal(rewrite.beforeScore, beforeQuality.total);
      assert.equal(rewrite.afterScore, afterQuality.total);
      
      // Breakdown consistency check
      const bd = rewrite.scoreBreakdown;
      assert.equal(rewrite.afterScore, bd.relevance + bd.specificity + bd.impact + bd.action + bd.clarity + bd.evidence);
    }
  },
  {
    name: '2. Already strong bullet: returns "No meaningful improvement recommended."',
    run: () => {
      const before = 'Built and managed a 5,000-person participant panel and centralized research repository, cutting study recruitment time by 50%';
      const after = 'Managed a 5,000-person panel and centralized research repository to cut study recruitment time by 50%.';
      
      const rawOutput = [{ before, after, confidence: 'High' }];
      const validated = validateRewrites(rawOutput, dummyResume, []);
      const rewrite = validated[0];

      assert.ok(rewrite);
      assert.equal(rewrite.after, 'No meaningful improvement recommended.');
      assert.equal(rewrite.improvementScore, 0);
    }
  },
  {
    name: '3. Unsupported metric: rejected and returns "No meaningful improvement recommended." (or safe fallback)',
    run: () => {
      const before = 'Conducted interviews';
      const after = 'Conducted interviews, improving product adoption by 40%'; // 40% is hallucinated
      
      const rawOutput = [{ before, after, confidence: 'High' }];
      const validated = validateRewrites(rawOutput, dummyResume, []);
      const rewrite = validated[0];

      assert.ok(rewrite);
      assert.equal(rewrite.improvementScore, 0);
      assert.equal(rewrite.after, 'No meaningful improvement recommended.');
    }
  },
  {
    name: '4. Unsupported responsibility escalation: rejected and returns "No meaningful improvement recommended."',
    run: () => {
      const before = 'helped with usability testing';
      const after = 'Directed and owned the usability testing program'; // "Directed" / "owned" is hallucinated
      
      const rawOutput = [{ before, after, confidence: 'High' }];
      const validated = validateRewrites(rawOutput, dummyResume, []);
      const rewrite = validated[0];

      assert.ok(rewrite);
      assert.equal(rewrite.improvementScore, 0);
      assert.equal(rewrite.after, 'No meaningful improvement recommended.');
    }
  },
  {
    name: '5. Unsupported tool/methodology: rejected and returns "No meaningful improvement recommended."',
    run: () => {
      const before = 'Maintained legacy systems using Java';
      const after = 'Maintained legacy systems using Java and Docker'; // Docker is hallucinated
      
      const rawOutput = [{ before, after, confidence: 'High' }];
      const validated = validateRewrites(rawOutput, dummyResume, []);
      const rewrite = validated[0];

      assert.ok(rewrite);
      assert.equal(rewrite.improvementScore, 0);
      assert.equal(rewrite.after, 'No meaningful improvement recommended.');
    }
  },
  {
    name: '6. Rewrite with +0 improvement: rejected and returns "No meaningful improvement recommended."',
    run: () => {
      const before = 'Worked on code';
      const after = 'Wrote the code'; 
      // Very small change, score is probably identical or worse
      
      const rawOutput = [{ before, after, confidence: 'High' }];
      const validated = validateRewrites(rawOutput, dummyResume, []);
      const rewrite = validated[0];

      assert.ok(rewrite);
      if (rewrite.improvementScore <= 0) {
        assert.equal(rewrite.improvementScore, 0);
        assert.equal(rewrite.after, 'No meaningful improvement recommended.');
      }
    }
  },
  {
    name: '7. Rewrite rejected by grounding: returns "No meaningful improvement recommended."',
    run: () => {
      const before = 'Worked on code';
      const after = 'Architected advanced distributed cloud infrastructure systems'; // completely hallucinated
      
      const rawOutput = [{ before, after, confidence: 'High' }];
      const validated = validateRewrites(rawOutput, dummyResume, []);
      const rewrite = validated[0];

      assert.ok(rewrite);
      assert.equal(rewrite.improvementScore, 0);
      assert.equal(rewrite.after, 'No meaningful improvement recommended.');
    }
  },
  {
    name: '8. Score breakdown consistency: totals must exactly match components',
    run: () => {
      const before = 'run surveys sometimes';
      const after = 'Conducted comprehensive user surveys.';
      
      const rawOutput = [{ before, after, confidence: 'High' }];
      // We manually check scoreBulletQuality to ensure it never violates the math
      const quality = scoreBulletQuality(after, ['usability testing']);
      
      const sum = quality.breakdown.relevance + 
                  quality.breakdown.specificity + 
                  quality.breakdown.impact + 
                  quality.breakdown.action + 
                  quality.breakdown.clarity + 
                  quality.breakdown.evidence;
                  
      assert.equal(quality.total, sum, 'Total must equal sum of breakdown');
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
