import assert from 'node:assert';
import { test, suite } from 'node:test';
import { validateAiResumeOutput } from '../../api/_lib/aiValidation.js';
import { scoreBulletQuality } from '../../api/_lib/analysis-engine/bulletScoring.js';

suite('Bullet Scoring Engine', () => {
  test('Genuine improvement increases score', () => {
    const before = 'Worked on the backend API using Node.';
    const after = 'Architected a scalable backend API using Node, reducing response time by 20%.';
    const targetKeywords = ['Node', 'API'];
    
    const beforeScore = scoreBulletQuality(before, targetKeywords);
    const afterScore = scoreBulletQuality(after, targetKeywords);
    
    assert.ok(afterScore.total > beforeScore.total, 'After score should be strictly greater than before score');
    assert.ok(afterScore.breakdown.impact > beforeScore.breakdown.impact, 'Measurable impact should increase');
    assert.ok(afterScore.breakdown.action > beforeScore.breakdown.action, 'Action verb should be stronger');
  });

  test('Keyword stuffing without stronger evidence yields minimal keyword points', () => {
    const before = 'Worked on the backend API using Node.';
    // Stuffed keywords without action verb or quantification
    const after = 'Worked on the backend API using Node, Python, AWS, Docker, Kubernetes, and React.';
    const targetKeywords = ['Node', 'API', 'Python', 'AWS', 'Docker', 'Kubernetes', 'React'];
    
    const beforeScore = scoreBulletQuality(before, targetKeywords);
    const afterScore = scoreBulletQuality(after, targetKeywords);
    
    // Relevance is high because target keywords are mentioned
    assert.strictEqual(beforeScore.breakdown.relevance, 20);
    assert.strictEqual(afterScore.breakdown.relevance, 20);
    assert.ok(afterScore.total < 80, 'Total score should remain relatively low despite stuffing');
  });
});

suite('Bullet Validation & Fallback Logic', () => {
  const resumeText = 'Worked on the backend API using Node. Managed a team of 5 engineers.';
  
  test('No safe improvement falls back to original bullet', () => {
    const rawAiOutput = {
      improvedBulletPoints: [
        {
          before: 'Worked on the backend API using Node.',
          after: 'Worked on the backend API using Node.', // Same quality
          confidence: 'High'
        }
      ]
    };
    
    const validated = validateAiResumeOutput(rawAiOutput, resumeText, '', undefined, ['Node']);
    const rewrite = validated.improvedBulletPoints[0];
    
    assert.strictEqual(rewrite.after, rewrite.before, 'Should fall back to original');
    assert.strictEqual(rewrite.improvementScore, 0, 'Improvement score should be 0');
    assert.ok(rewrite.reasoning.includes('Original bullet preserved') || rewrite.reasoning.includes('yielded no significant gain'), 'Should explain lack of improvement');
  });

  test('Attempted hallucination triggers fallback', () => {
    const rawAiOutput = {
      improvedBulletPoints: [
        {
          before: 'Worked on the backend API using Node.',
          after: 'Architected a scalable backend API using Node, reducing response time by 99%.', // 99% is invented
          confidence: 'High'
        }
      ]
    };
    
    const validated = validateAiResumeOutput(rawAiOutput, resumeText, '', undefined, ['Node']);
    const rewrite = validated.improvedBulletPoints[0];
    
    assert.strictEqual(rewrite.after, rewrite.before, 'Should reject hallucination and fallback');
    assert.strictEqual(rewrite.improvementScore, 0, 'Improvement score should be 0');
    assert.ok(rewrite.reasoning.includes('Original bullet preserved') || rewrite.reasoning.includes('inventing unsupported facts'), 'Should explain lack of improvement due to inventing info');
  });

  test('Valid improvement passes through with correct scores', () => {
    const rawAiOutput = {
      improvedBulletPoints: [
        {
          before: 'Worked on the backend API using Node.',
          after: 'Built a scalable backend API using Node for a team of 5 engineers.', // Reused 5 from resumeText
          confidence: 'High'
        }
      ]
    };
    
    const validated = validateAiResumeOutput(rawAiOutput, resumeText, '', undefined, ['Node']);
    const rewrite = validated.improvedBulletPoints[0];
    
    assert.ok(rewrite.after !== rewrite.before, 'Should accept valid improvement');
    assert.ok(rewrite.improvementScore > 0, 'Improvement score should be > 0');
    assert.ok(rewrite.afterScore > rewrite.beforeScore, 'After score should be greater');
  });
});

suite('New Rubric Calibration & Grounding Regression Tests', () => {
  const priyaResume = `
Priya Chandran
Experience:
Senior UX Researcher — Brightledger Bank | 2021–Present
- Led generative and evaluative research across mobile banking redesign, informing a roadmap that increased feature adoption by 34%
- Built and managed a 5,000-person participant panel and centralized research repository, cutting study recruitment time by 50%
- Mentored 3 junior researchers and established research operations best practices adopted company-wide
- Regularly presented findings to VP and C-suite stakeholders, directly influencing quarterly product strategy

UX Researcher — Cardstack Financial | 2019–2021
- Conducted 100+ usability tests and interviews across web and mobile lending products

Associate UX Researcher — Meterly | 2018–2019
- Supported research for a personal finance app, conducting interviews and moderated usability testing
  `;

  const targetKeywords = ['UX research', 'research operations', 'stakeholder communication', 'participant panel'];

  test('1. Strong quantified bullet receives a high score (85-100)', () => {
    const bullet = 'Built and managed a 5,000-person participant panel and centralized research repository, cutting study recruitment time by 50%';
    const score = scoreBulletQuality(bullet, targetKeywords);
    assert.ok(score.total >= 85 && score.total <= 100, `Score ${score.total} should be in range 85-100`);
  });

  test('2. Strong qualitative bullet without a metric can still receive a high score (80-95)', () => {
    const bullet = 'Regularly presented findings to VP and C-suite stakeholders, directly influencing quarterly product strategy';
    const score = scoreBulletQuality(bullet, targetKeywords);
    assert.ok(score.total >= 80 && score.total <= 95, `Score ${score.total} should be in range 80-95`);
  });

  test('3. Passive/generic bullet receives a lower score (50-70)', () => {
    const bullet = 'Supported research for a personal finance app, conducting interviews and moderated usability testing';
    const score = scoreBulletQuality(bullet, targetKeywords);
    assert.ok(score.total >= 50 && score.total <= 70, `Score ${score.total} should be in range 50-70`);
  });

  test('4. Strong bullet does not receive an artificially low score merely because it could be improved', () => {
    const bullet = 'Mentored 3 junior researchers and established research operations best practices adopted company-wide';
    const score = scoreBulletQuality(bullet, targetKeywords);
    assert.ok(score.total >= 80, `Score ${score.total} should be high (>= 80)`);
  });

  test('5. Improvement score equals After - Before', () => {
    const rawAiOutput = {
      improvedBulletPoints: [
        {
          before: 'Supported research for a personal finance app, conducting interviews and moderated usability testing',
          after: 'Led UX research for a personal finance app, conducting interviews and usability testing to define user journeys.',
          confidence: 'High'
        }
      ]
    };
    const validated = validateAiResumeOutput(rawAiOutput, priyaResume, '', undefined, targetKeywords);
    const rewrite = validated.improvedBulletPoints[0];
    assert.equal(rewrite.improvementScore, rewrite.afterScore - rewrite.beforeScore);
  });

  test('6. Already excellent bullets can correctly return +0', () => {
    const rawAiOutput = {
      improvedBulletPoints: [
        {
          before: 'Built and managed a 5,000-person participant panel and centralized research repository, cutting study recruitment time by 50%',
          after: 'Built and managed a 5,000-person participant panel and centralized research repository, cutting study recruitment time by 50%',
          confidence: 'High'
        }
      ]
    };
    const validated = validateAiResumeOutput(rawAiOutput, priyaResume, '', undefined, targetKeywords);
    const rewrite = validated.improvedBulletPoints[0];
    assert.equal(rewrite.improvementScore, 0);
    assert.equal(rewrite.after, rewrite.before);
  });

  test('7. Unsupported improvements are rejected', () => {
    const rawAiOutput = {
      improvedBulletPoints: [
        {
          before: 'Conducted 100+ usability tests and interviews across web and mobile lending products',
          after: 'Conducted 100+ usability tests and interviews, generating $10M in revenue and 99% satisfaction.',
          confidence: 'High'
        }
      ]
    };
    const validated = validateAiResumeOutput(rawAiOutput, priyaResume, '', undefined, targetKeywords);
    const rewrite = validated.improvedBulletPoints[0];
    assert.equal(rewrite.improvementScore, 0);
    assert.equal(rewrite.after, rewrite.before);
  });

  test('8. Cross-employer metrics cannot increase a bullet score', () => {
    const bulletContexts = [
      {
        text: 'Conducted 100+ usability tests and interviews across web and mobile lending products',
        sourceContext: 'UX Researcher — Cardstack Financial (Remote) | 2019–2021\n- Conducted 100+ usability tests and interviews across web and mobile lending products'
      }
    ];
    const rawAiOutput = {
      improvedBulletPoints: [
        {
          before: 'Conducted 100+ usability tests and interviews across web and mobile lending products',
          after: 'Conducted 100+ usability tests and interviews across web and mobile lending products, increasing adoption by 34%.',
          confidence: 'High'
        }
      ]
    };
    const validated = validateAiResumeOutput(rawAiOutput, priyaResume, '', undefined, targetKeywords, bulletContexts);
    const rewrite = validated.improvedBulletPoints[0];
    assert.equal(rewrite.improvementScore, 0, 'Should reject cross-employer metric rewrite');
    assert.equal(rewrite.after, rewrite.before);
  });

  test('9. Score Breakdown always sums exactly to the total score', () => {
    const bullet = 'Built and managed a 5,000-person participant panel and centralized research repository, cutting study recruitment time by 50%';
    const score = scoreBulletQuality(bullet, targetKeywords);
    const sum = score.breakdown.relevance +
                score.breakdown.specificity +
                score.breakdown.impact +
                score.breakdown.action +
                score.breakdown.clarity +
                score.breakdown.evidence;
    assert.equal(score.total, sum);
  });

  test('10. Same input produces stable scores across repeated runs', () => {
    const bullet = 'Regularly presented findings to VP and C-suite stakeholders, directly influencing quarterly product strategy';
    const firstScore = scoreBulletQuality(bullet, targetKeywords).total;
    for (let i = 0; i < 5; i++) {
      const repeatedScore = scoreBulletQuality(bullet, targetKeywords).total;
      assert.equal(repeatedScore, firstScore);
    }
  });
});

