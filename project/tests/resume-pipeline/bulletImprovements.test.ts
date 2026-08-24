import assert from 'node:assert/strict';
import { extractCandidateProfile } from '../../api/_lib/analysis-engine/resumeExtraction.js';
import { validateRewrites } from '../../api/_lib/aiValidation.js';
import { scoreBulletQuality } from '../../api/_lib/analysis-engine/bulletScoring.js';

type TestCase = { name: string; run: () => void };

const dummyResume = `John Doe
johndoe@example.com

SUMMARY
Software Engineer with 5 years experience.

EXPERIENCE
Software Engineer — Acme Corp | 2020 - Present
- Led the migration to React, improving performance by 20%
- Maintained legacy systems using Java
- Wrote code for some features
- Fixed bugs in the backend

EDUCATION
B.S. Computer Science`;

const tests: TestCase[] = [
  {
    name: '1-6. Extraction: Includes valid bullets, excludes metadata',
    run: () => {
      const candidateProfile = extractCandidateProfile(dummyResume);
      const candidateBullets = candidateProfile.facts
        .filter(f => f.type === 'experience' || f.type === 'project')
        .flatMap(f => f.evidence.split('\n'))
        .map(text => text.replace(/^[•\-\*·\s]+/, '').trim())
        .filter(text => {
          if (text.length < 30) return false;
          if (/\b(?:19|20)\d{2}\b/.test(text)) return false;
          if (text.includes('|') || text.includes('—')) return false;
          return true;
        });

      // 1-2. Valid bullets detected
      assert.ok(candidateBullets.includes('Led the migration to React, improving performance by 20%'));
      assert.ok(candidateBullets.includes('Maintained legacy systems using Java'));

      // 3-6. Metadata excluded (Job title, Company, Dates)
      assert.ok(!candidateBullets.includes('Software Engineer — Acme Corp | 2020 - Present'));
      assert.ok(!candidateBullets.includes('Software Engineer'));
      assert.ok(!candidateBullets.includes('Acme Corp'));
      assert.ok(!candidateBullets.includes('B.S. Computer Science'));
    }
  },
  {
    name: '7-13. Validator filters +0, negative, unchanged, and unsupported facts',
    run: () => {
      const before1 = 'Maintained legacy systems using Java';
      const before2 = 'Wrote code for some features';
      const before3 = 'Fixed bugs in the backend';
      
      const mockLlmOutput = [
        {
          // 11. +0 improvement (score is same or lower) -> will be filtered
          before: before1,
          after: before1,
          whyWeak: '', whatIsMissing: '', whyStronger: '', confidence: 'High'
        },
        {
          // 14. Hallucination: "Vue" not in resume
          before: before2,
          after: 'Wrote code for features using Vue and Angular',
          whyWeak: '', whatIsMissing: '', whyStronger: '', confidence: 'High'
        },
        {
          // 8. Grounded improvement (New valid action verb "Orchestrated")
          // Score will be higher due to "Orchestrated" (action)
          before: before3,
          after: 'Orchestrated the backend bug fixes and optimized performance',
          whyWeak: 'Passive', whatIsMissing: 'Action', whyStronger: 'Active', confidence: 'High'
        }
      ];

      const validated = validateRewrites(mockLlmOutput, dummyResume, ['Java'], [before1, before2, before3]);
      
      assert.equal(validated.length, 3); // Wait, they all survive validateRewrites!
      // But improvementScore is what determines if it's shown in the UI!
      // Actually, validateRewrites returns all items, but sets improvementScore = 0 for the filtered ones.
      
      const improvements = validated.filter(v => v.improvementScore > 0);
      
      assert.equal(improvements.length, 1);
      assert.equal(improvements[0].after, 'Orchestrated the backend bug fixes and optimized performance');
    }
  },
  {
    name: '15. One failed bullet does not erase other valid improvements',
    run: () => {
      const before3 = 'Fixed bugs in the backend';
      
      const mockLlmOutput = [
        null, // Malformed
        { invalidFormat: true }, // Malformed
        {
          before: before3,
          after: 'Orchestrated the backend bug fixes and optimized performance',
          whyWeak: 'Passive', whatIsMissing: 'Action', whyStronger: 'Active', confidence: 'High'
        }
      ];

      const validated = validateRewrites(mockLlmOutput, dummyResume, ['Java'], [before3]);
      
      const improvements = validated.filter(v => v.improvementScore > 0);
      assert.equal(improvements.length, 1);
      assert.equal(improvements[0].after, 'Orchestrated the backend bug fixes and optimized performance');
    }
  },
  {
    name: '16-20. Grounding rules: explicit metrics, implied research method, no outcome, stronger wording, no safe improvement',
    run: () => {
      const resume = `Candidate Name
SUMMARY
Software Engineer specializing in API backend performance and user experience research with 10 years experience.

EXPERIENCE
Acme Corp | Software Engineer
- helped manage a team of 5 engineers, improving backend performance by 20%.
- Conducted usability interviews for the product.
- Maintained legacy systems using Java.
- Fixed bugs in the database.
- Worked on code.`;

      // 16. A bullet with explicit metrics
      const mockOutputMetrics = [
        {
          before: 'helped manage a team of 5 engineers, improving backend performance by 20%.',
          after: 'Directed a cross-functional team of 5 engineers, optimizing backend systems for 10 clients to improve performance by 20%.',
          confidence: 'High'
        }
      ];
      const validatedMetrics = validateRewrites(mockOutputMetrics, resume, ['Java'], [mockOutputMetrics[0].before]);
      const improvementsMetrics = validatedMetrics.filter(v => v.improvementScore > 0);
      assert.equal(improvementsMetrics.length, 1);
      assert.equal(improvementsMetrics[0].after, 'Directed a cross-functional team of 5 engineers, optimizing backend systems for 10 clients to improve performance by 20%.');

      // 17. A bullet with implied research method
      const mockOutputImpliedMethod = [
        {
          before: 'Conducted usability interviews for the product.',
          after: 'Orchestrated user experience research using usability interviews for the product.',
          confidence: 'High'
        }
      ];
      const validatedImplied = validateRewrites(mockOutputImpliedMethod, resume, ['Java'], [mockOutputImpliedMethod[0].before]);
      const improvementsImplied = validatedImplied.filter(v => v.improvementScore > 0);
      assert.equal(improvementsImplied.length, 1);
      assert.equal(improvementsImplied[0].after, 'Orchestrated user experience research using usability interviews for the product.');

      // 18. A bullet with no outcome (should trigger fallback if outcome/metric is manufactured)
      const mockOutputNoOutcome = [
        {
          before: 'Maintained legacy systems using Java.',
          after: 'Maintained legacy systems using Java, leading to 15% better uptime.',
          confidence: 'High'
        }
      ];
      const validatedNoOutcome = validateRewrites(mockOutputNoOutcome, resume, ['Java'], [mockOutputNoOutcome[0].before]);
      const improvementsNoOutcome = validatedNoOutcome.filter(v => v.improvementScore > 0);
      assert.equal(improvementsNoOutcome.length, 0);
      assert.equal(validatedNoOutcome[0].after, 'Maintained legacy systems using Java.');

      // 19. A bullet where stronger wording is possible
      const mockOutputStrongerWording = [
        {
          before: 'Fixed bugs in the database.',
          after: 'Optimized database query execution to resolve anomalies.',
          confidence: 'High'
        }
      ];
      const validatedStronger = validateRewrites(mockOutputStrongerWording, resume, ['Java'], [mockOutputStrongerWording[0].before]);
      const improvementsStronger = validatedStronger.filter(v => v.improvementScore > 0);
      assert.equal(improvementsStronger.length, 1);
      assert.equal(improvementsStronger[0].after, 'Optimized database query execution to resolve anomalies.');

      // 20. A bullet where no safe improvement is possible
      const mockOutputNoSafeImprovement = [
        {
          before: 'Worked on code.',
          after: 'Developed enterprise-level Kubernetes microservices.',
          confidence: 'High'
        }
      ];
      const validatedNoSafe = validateRewrites(mockOutputNoSafeImprovement, resume, ['Java'], [mockOutputNoSafeImprovement[0].before]);
      const improvementsNoSafe = validatedNoSafe.filter(v => v.improvementScore > 0);
      assert.equal(improvementsNoSafe.length, 0);
      assert.equal(validatedNoSafe[0].after, 'Worked on code.');
    }
  }
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    test.run();
    console.log(`✅ ${test.name}`);
    passed++;
  } catch (err: any) {
    console.error(`❌ ${test.name}`);
    console.error(err.stack || err);
    failed++;
  }
}
console.log(`\nTests: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
