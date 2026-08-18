import assert from 'node:assert/strict';
import { runAnalysisPipeline } from '../../api/_lib/analysis-engine/pipeline.js';
import { AiPipelineError } from '../../api/_lib/openrouter.js';

// Mock the openrouter fetch to throw an error
const originalFetch = globalThis.fetch;

async function runTests() {
  let passed = 0;
  let total = 0;

  const testCases = [
    {
      name: 'runAnalysisPipeline throws AiPipelineError when jdParser fails instead of returning dummy data',
      run: async () => {
        globalThis.fetch = async () => {
          throw new Error('Simulated network timeout');
        };

        try {
          await runAnalysisPipeline({
            resumeText: 'Test Candidate\nSoftware Engineer',
            jobDescriptionText: 'We need a backend developer with Node.js and AWS.',
            includePremium: true,
          });
          assert.fail('Pipeline should have thrown an error');
        } catch (e: any) {
          assert.ok(e instanceof AiPipelineError, 'Expected an AiPipelineError');
          assert.equal(e.stage, 'parser');
          assert.equal(e.code, 'JD_PARSING_FAILED');
        }
      }
    }
  ];

  for (const test of testCases) {
    total++;
    try {
      globalThis.fetch = originalFetch; // Reset before each test's setup
      await test.run();
      passed++;
      console.log(`✅ ${test.name}`);
    } catch (e) {
      console.error(`❌ FAILED: ${test.name}`);
      console.error(e);
    }
  }

  globalThis.fetch = originalFetch;

  console.log(`\n${passed}/${total} tests passed.`);
  if (passed !== total) process.exit(1);
}

runTests();
