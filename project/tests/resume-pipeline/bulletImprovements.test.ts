import assert from 'node:assert/strict';
import { extractCandidateProfile } from '../../api/_lib/analysis-engine/resumeExtraction.js';
import { validateRewrites } from '../../api/_lib/aiValidation.js';
import { scoreBulletQuality } from '../../api/_lib/analysis-engine/bulletScoring.js';
import { bulletsFromAi } from '../../src/lib/api/mapAiResults.js';

type TestCase = { name: string; run: () => void | Promise<void> };

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
      
      assert.equal(validated.length, 3);
      
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
          after: 'Managed a cross-functional team of 5 engineers, optimizing backend systems for 10 clients to improve performance by 20%.',
          confidence: 'High'
        }
      ];
      const validatedMetrics = validateRewrites(mockOutputMetrics, resume, ['Java'], [mockOutputMetrics[0].before]);
      const improvementsMetrics = validatedMetrics.filter(v => v.improvementScore > 0);
      assert.equal(improvementsMetrics.length, 1);
      assert.equal(improvementsMetrics[0].after, 'Managed a cross-functional team of 5 engineers, optimizing backend systems for 10 clients to improve performance by 20%.');

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
      assert.equal(validatedNoOutcome.length, 1);
      assert.equal(validatedNoOutcome[0].improvementScore, 0);
      assert.equal(validatedNoOutcome[0].after, 'No meaningful improvement recommended.');

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
      assert.equal(validatedNoSafe.length, 1);
      assert.equal(validatedNoSafe[0].improvementScore, 0);
      assert.equal(validatedNoSafe[0].after, 'No meaningful improvement recommended.');
    }
  },
  {
    name: 'TEST 1: Weak bullet -> valid improved bullet -> improvement returned',
    run: () => {
      const resume = `Alex Mercer\nUX Researcher\nExperience\n- I do research for our e-commerce app.`;
      const raw = [{
        before: 'I do research for our e-commerce app.',
        after: 'Conduct user research for an e-commerce application.',
        confidence: 'High'
      }];
      const validated = validateRewrites(raw, resume, ['UX Research'], [{ text: raw[0].before, sourceContext: resume }]);
      assert.equal(validated.length, 1);
      assert.ok(validated[0].improvementScore > 0);
      assert.ok(validated[0].afterScore > validated[0].beforeScore);
      assert.equal(validated[0].after, 'Conduct user research for an e-commerce application.');
      assert.equal(validated[0].groundingConfidence, 'High');
    }
  },
  {
    name: 'TEST 2: Weak bullet -> hallucinated metric -> rewrite rejected',
    run: () => {
      const resume = `John Doe\nExperience\n- Conducted interviews`;
      const raw = [{
        before: 'Conducted interviews',
        after: 'Conducted interviews, improving product adoption by 40%',
        confidence: 'High'
      }];
      const validated = validateRewrites(raw, resume, ['Interviews'], [{ text: raw[0].before, sourceContext: resume }]);
      assert.equal(validated[0].improvementScore, 0);
      assert.equal(validated[0].after, 'No meaningful improvement recommended.');
    }
  },
  {
    name: 'TEST 3: Weak bullet -> unsupported responsibility -> rewrite rejected',
    run: () => {
      const resume = `John Doe\nExperience\n- helped with usability testing`;
      const raw = [{
        before: 'helped with usability testing',
        after: 'Directed and owned the usability testing program',
        confidence: 'High'
      }];
      const validated = validateRewrites(raw, resume, ['Usability Testing'], [{ text: raw[0].before, sourceContext: resume }]);
      assert.equal(validated[0].improvementScore, 0);
      assert.equal(validated[0].after, 'No meaningful improvement recommended.');
    }
  },
  {
    name: 'TEST 4: Strong bullet -> no rewrite generated',
    run: () => {
      const strongBullet = 'Built and managed a 5,000-person participant panel and centralized research repository, cutting study recruitment time by 50%';
      const resume = `John Doe\nExperience\n- ${strongBullet}`;
      const raw = [{
        before: strongBullet,
        after: 'Managed a 5,000-person participant panel and repository to cut recruitment time by 50%',
        confidence: 'High'
      }];
      const validated = validateRewrites(raw, resume, ['Research'], [{ text: strongBullet, sourceContext: resume }]);
      assert.equal(validated[0].improvementScore, 0);
      assert.equal(validated[0].after, 'No meaningful improvement recommended.');
    }
  },
  {
    name: 'TEST 5: Rewrite where After Score <= Before Score -> rejected/omitted',
    run: () => {
      const bullet = 'Maintained legacy systems using Java';
      const resume = `John Doe\nExperience\n- ${bullet}`;
      const raw = [{
        before: bullet,
        after: 'Maintained legacy systems using Java',
        confidence: 'High'
      }];
      const validated = validateRewrites(raw, resume, ['Java'], [{ text: bullet, sourceContext: resume }]);
      assert.equal(validated[0].improvementScore, 0);
      assert.equal(validated[0].after, 'No meaningful improvement recommended.');
    }
  },
  {
    name: 'TEST 6: Valid backend improvement -> correctly appears in frontend mapper',
    run: () => {
      const validPair = {
        before: 'I do research for our e-commerce app.',
        beforeScore: 46,
        after: 'Conduct user research for an e-commerce application.',
        afterScore: 61,
        improvementScore: 15,
        groundingConfidence: 'High' as const,
        whyItIsWeak: 'Uses conversational language.',
        whatInformationIsMissing: 'None',
        whyThisIsStronger: 'Professional active verb phrasing.'
      };
      const frontendBullets = bulletsFromAi({ improvedBulletPoints: [validPair] } as any);
      assert.equal(frontendBullets.length, 1);
      assert.equal(frontendBullets[0].before, validPair.before);
      assert.equal(frontendBullets[0].after, validPair.after);
      assert.equal(frontendBullets[0].improvementScore, 15);
      assert.equal(frontendBullets[0].beforeScore, 46);
      assert.equal(frontendBullets[0].afterScore, 61);
    }
  },
  {
    name: 'TEST 7: Empty improvement list -> UI shows empty only when genuinely empty after filtering',
    run: () => {
      const rejectedPair = {
        before: 'Maintained legacy systems using Java',
        beforeScore: 60,
        after: 'No meaningful improvement recommended.',
        afterScore: 60,
        improvementScore: 0,
        groundingConfidence: 'Low' as const
      };
      const frontendBullets = bulletsFromAi({ improvedBulletPoints: [rejectedPair] } as any);
      assert.equal(frontendBullets.length, 0, 'Rejected improvements must not be passed to the frontend');
    }
  },
  {
    name: 'TEST 8: Improvement Score equals After Score - Before Score',
    run: () => {
      const resume = `Alex Mercer\nUX Researcher\nExperience\n- Helped set up interviews with users and took notes during sessions.`;
      const raw = [{
        before: 'Helped set up interviews with users and took notes during sessions.',
        after: 'Coordinated user interview setup and documented research sessions.',
        confidence: 'High'
      }];
      const validated = validateRewrites(raw, resume, ['UX Research'], [{ text: raw[0].before, sourceContext: resume }]);
      assert.equal(validated.length, 1);
      assert.equal(validated[0].improvementScore, validated[0].afterScore - validated[0].beforeScore);
      assert.ok(validated[0].improvementScore > 0);
    }
  }
];

async function runAll() {
  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      await test.run();
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
}

runAll();

