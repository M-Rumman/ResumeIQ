import assert from 'node:assert/strict';
import { validateRewrites } from '../../api/_lib/aiValidation.js';

type TestCase = { name: string; run: () => void };

const tests: TestCase[] = [
  {
    name: '1. Prevents "assisted" -> "coordinated and set up" escalation without evidence',
    run: () => {
      const resumeText = 'Assisted with a research project studying how students use a university\'s mobile app. Helped transcribe interviews and organize data in spreadsheets.';
      
      const before = 'Assisted with a research project studying how students use a university\'s mobile app.';
      const after = 'Coordinated and set up a research project studying how students use a university\'s mobile app.';
      
      const rewrites = validateRewrites([
        {
          before,
          after,
          confidence: 'High',
          inferenceType: 'STRONGLY_SUPPORTED_INFERENCE',
          whyItIsWeak: 'Weak verb',
          whatInformationIsMissing: 'None',
          whyThisIsStronger: 'Stronger verbs'
        }
      ], resumeText, ['research']);
      
      // Because "coordinat" and "set up" are not in the resume, it should fall back to safe wording or reject the improvement
      // If it falls back to before, the improvement score is 0 and it's rejected.
      // So validateRewrites should return an empty array if the fallback has no improvement.
      // Or if it returns something, it must NOT be the original dangerous after text.
      if (rewrites.length > 0) {
        assert.notStrictEqual(rewrites[0].after, after, 'Must not accept the escalated after text');
        assert.ok(!rewrites[0].after.toLowerCase().includes('coordinated'), 'Must not contain ungrounded escalation verb');
      } else {
        assert.strictEqual(rewrites.length, 0, 'Should reject the rewrite if no safe improvement exists');
      }
    }
  },
  {
    name: '2. Allows "coordinated and set up" if resume has evidence',
    run: () => {
      // Resume explicitly says "coordinated" and "set up" somewhere else
      const resumeText = 'Assisted with a research project studying how students use a university\'s mobile app. Previously I coordinated and set up a different project.';
      
      const before = 'Assisted with a research project studying how students use a university\'s mobile app.';
      const after = 'Coordinated and set up a research project studying how students use a university\'s mobile app.';
      
      const rewrites = validateRewrites([
        {
          before,
          after,
          confidence: 'High',
          inferenceType: 'STRONGLY_SUPPORTED_INFERENCE',
          whyItIsWeak: 'Weak verb',
          whatInformationIsMissing: 'None',
          whyThisIsStronger: 'Stronger verbs'
        }
      ], resumeText, ['research']);
      
      // Because the resume has the roots "coordinat" and "set up", it should allow it
      assert.strictEqual(rewrites.length, 1, 'Should accept the rewrite');
      assert.strictEqual(rewrites[0].after, after, 'Must accept the escalated after text because evidence exists');
    }
  },
  {
    name: '3. Prevents "helped" -> "managed" escalation without evidence',
    run: () => {
      const resumeText = 'Helped design the new database schema.';
      const before = 'Helped design the new database schema.';
      const after = 'Managed the design of the new database schema.';
      
      const rewrites = validateRewrites([
        { before, after, confidence: 'High' }
      ], resumeText, ['database']);
      
      if (rewrites.length > 0) {
        assert.notStrictEqual(rewrites[0].after, after);
        assert.ok(!rewrites[0].after.toLowerCase().includes('managed'));
      }
    }
  },
  {
    name: '4. Prevents "supported" -> "owned" escalation without evidence',
    run: () => {
      const resumeText = 'Supported the release of the new product.';
      const before = 'Supported the release of the new product.';
      const after = 'Owned the release of the new product.';
      
      const rewrites = validateRewrites([
        { before, after, confidence: 'High' }
      ], resumeText, ['product']);
      
      if (rewrites.length > 0) {
        assert.notStrictEqual(rewrites[0].after, after);
        assert.ok(!rewrites[0].after.toLowerCase().includes('owned'));
      }
    }
  }
];

async function run() {
  console.log('Running responsibility escalation regression tests...');
  for (const t of tests) {
    try {
      t.run();
      console.log(`✅ ${t.name}`);
    } catch (err) {
      console.error(`❌ ${t.name}`);
      console.error(err);
      process.exit(1);
    }
  }
}

run();
