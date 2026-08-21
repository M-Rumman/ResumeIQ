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
    
    // Relevance should remain capped because both lack a strong action verb
    assert.strictEqual(beforeScore.breakdown.relevance, 15);
    assert.strictEqual(afterScore.breakdown.relevance, 15);
    assert.ok(afterScore.total < 70, 'Total score should remain relatively low despite stuffing');
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
