import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateRewrites } from '../../api/_lib/aiValidation.js';

describe('Cross-Employer Grounding Validations', () => {
  const resumeText = `
Experience
Company A | 2020-2022
- Conducted 100+ studies
- Reduced processing time by 50%
- Supported 10,000 users

Company B | 2022-Present
- Conducted interviews
- Managed processing
- Managed active users
- Optimized backend for 25% faster queries
  `;

  const contextA = `Company A | 2020-2022
- Conducted 100+ studies
- Reduced processing time by 50%
- Supported 10,000 users`;

  const contextB = `Company B | 2022-Present
- Conducted interviews
- Managed processing
- Managed active users
- Optimized backend for 25% faster queries`;

  const bulletContexts = [
    { text: 'Conducted 100+ studies', sourceContext: contextA },
    { text: 'Reduced processing time by 50%', sourceContext: contextA },
    { text: 'Supported 10,000 users', sourceContext: contextA },
    { text: 'Conducted interviews', sourceContext: contextB },
    { text: 'Managed processing', sourceContext: contextB },
    { text: 'Managed active users', sourceContext: contextB },
    { text: 'Optimized backend for 25% faster queries', sourceContext: contextB }
  ];

  it('1, 9-12. Cross-employer metric transfer is rejected (e.g. 100+ from A to B)', () => {
    const rawAiOutput = [{
      before: 'Conducted interviews',
      after: 'Conducted 100+ interviews',
      confidence: 'High',
      inferenceType: 'STRONGLY_SUPPORTED_INFERENCE',
      whyThisIsStronger: 'Added metrics'
    }];
    
    const validated = validateRewrites(rawAiOutput, resumeText, [], bulletContexts);
    
    assert.equal(validated.length, 1);
    // 9. Invalid rewrite is never shown in UI (reverted to before)
    assert.equal(validated[0].after, 'Conducted interviews');
    // 10. Grounding confidence drops to Low
    assert.equal(validated[0].groundingConfidence, 'Low');
    // 11. AfterScore is not calculated (defaults to beforeScore)
    assert.equal(validated[0].afterScore, validated[0].beforeScore);
    // 12. ImprovementScore is 0
    assert.equal(validated[0].improvementScore, 0);
  });

  it('2. Cross-employer outcome transfer is rejected (e.g. 50% from A to B)', () => {
    const rawAiOutput = [{
      before: 'Managed processing',
      after: 'Managed processing, reducing time by 50%',
      confidence: 'High'
    }];
    const validated = validateRewrites(rawAiOutput, resumeText, [], bulletContexts);
    assert.equal(validated[0].after, 'Managed processing');
    assert.equal(validated[0].groundingConfidence, 'Low');
  });

  it('3. Cross-employer user/customer count transfer is rejected', () => {
    const rawAiOutput = [{
      before: 'Managed active users',
      after: 'Managed 10,000 active users',
      confidence: 'High'
    }];
    const validated = validateRewrites(rawAiOutput, resumeText, [], bulletContexts);
    assert.equal(validated[0].after, 'Managed active users');
    assert.equal(validated[0].groundingConfidence, 'Low');
  });

  it("4. A metric must be attributable to the target bullet's experience", () => {
    // 25% is in Context B, so we can use it in Context B
    const rawAiOutput = [{
      before: 'Managed processing',
      after: 'Managed processing, improving performance by 25%',
      confidence: 'High'
    }];
    const validated = validateRewrites(rawAiOutput, resumeText, [], bulletContexts);
    // Improvement accepted because 25% is in contextB
    assert.equal(validated[0].after, 'Managed processing, improving performance by 25%');
    assert.equal(validated[0].groundingConfidence, 'High');
    assert.ok(validated[0].improvementScore >= 0);
  });

  it('5. A valid fact from the same employer/context may be reused', () => {
    const rawAiOutput = [{
      before: 'Conducted interviews',
      after: 'Conducted interviews and optimized backend for 25% faster queries',
      confidence: 'High'
    }];
    const validated = validateRewrites(rawAiOutput, resumeText, [], bulletContexts);
    assert.equal(validated[0].after, 'Conducted interviews and optimized backend for 25% faster queries');
    assert.equal(validated[0].groundingConfidence, 'High');
  });

  it('6. Existing metrics in the target bullet can be preserved', () => {
    const rawAiOutput = [{
      before: 'Optimized backend for 25% faster queries',
      after: 'Architected backend optimizations resulting in 25% faster queries',
      confidence: 'High'
    }];
    const validated = validateRewrites(rawAiOutput, resumeText, [], bulletContexts);
    assert.equal(validated[0].after, 'Architected backend optimizations resulting in 25% faster queries');
  });

  it('7. Missing metrics cannot be invented', () => {
    const rawAiOutput = [{
      before: 'Conducted interviews',
      after: 'Conducted 999 interviews',
      confidence: 'High'
    }];
    const validated = validateRewrites(rawAiOutput, resumeText, [], bulletContexts);
    assert.equal(validated[0].after, 'Conducted interviews'); // Rejected
    assert.equal(validated[0].groundingConfidence, 'Low');
  });

  it('8. Unsupported outcomes cannot be invented', () => {
    const rawAiOutput = [{
      before: 'Conducted interviews',
      after: 'Conducted interviews, improving conversion by [x]%',
      confidence: 'High'
    }];
    const validated = validateRewrites(rawAiOutput, resumeText, [], bulletContexts);
    assert.equal(validated[0].after, 'Conducted interviews'); // Rejected due to placeholder/unsupported outcome
    assert.equal(validated[0].groundingConfidence, 'Low');
  });

});
