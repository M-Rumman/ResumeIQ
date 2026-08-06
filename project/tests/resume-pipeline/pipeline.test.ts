import assert from 'node:assert/strict';
import { runAnalysisPipeline } from '../../api/_lib/analysis-engine/pipeline.js';

type TestCase = { name: string; run: () => Promise<void> };

const tests: TestCase[] = [
  {
    name: 'Detected lists all 5 and Missing is empty when resume has all standard sections',
    run: async () => {
      // Mock fetch
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ title: 'Engineer', requirements: [] }) } }]
        })
      }) as any;
      process.env.OPENROUTER_API_KEY = 'sk-or-mock_key_for_testing';

      try {
        const result = await runAnalysisPipeline({
          resumeText: 'Summary\nGreat.\nExperience\nWorked.\nProjects\nDid stuff.\nSkills\nJava\nEducation\nBS',
          jobDescriptionText: 'Engineer',
          includePremium: false
        });

        assert.deepEqual(result.legacyReport.detectedSections.sort(), ['Education', 'Experience', 'Projects', 'Skills', 'Summary']);
        assert.deepEqual(result.legacyReport.missingSections, []);
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  },
  {
    name: 'Detected lists 4 and Missing lists Skills when resume is missing Skills',
    run: async () => {
      // Mock fetch
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ title: 'Engineer', requirements: [] }) } }]
        })
      }) as any;
      process.env.OPENROUTER_API_KEY = 'sk-or-mock_key_for_testing';

      try {
        const result = await runAnalysisPipeline({
          resumeText: 'Summary\nGreat.\nExperience\nWorked.\nProjects\nDid stuff.\nEducation\nBS',
          jobDescriptionText: 'Engineer',
          includePremium: false
        });

        assert.deepEqual(result.legacyReport.detectedSections.sort(), ['Education', 'Experience', 'Projects', 'Summary']);
        assert.deepEqual(result.legacyReport.missingSections, ['Skills']);
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  },
  {
    name: 'auto-populates bullet improvements using extracted resume data without duplicate input',
    run: async () => {
      // Mock fetch
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url: any, init: any) => {
        const body = JSON.parse(init.body);
        const content = body.messages[body.messages.length - 1].content;
        
        // Return Bullet Rewriter result if we see jobGapFocus
        if (content.includes('jobGapFocus') && content.includes('experience')) {
          assert.equal(content.includes('Developed software.'), true, 'Did not receive the extracted experience');
          return {
            ok: true,
            json: async () => ({
              choices: [{ message: { content: JSON.stringify({
                weakBullets: ['Developed software.'],
                improvedBulletPoints: [{
                  before: 'Developed software.',
                  after: 'Developed software that increased revenue by 10%.',
                  confidence: 'High'
                }]
              }) } }]
            })
          } as any;
        }

        // Return JD parse result (default)
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: JSON.stringify({ title: 'Engineer', requirements: [], responsibilities: [], preferredSkills: [] }) } }]
          })
        } as any;
      };
      process.env.OPENROUTER_API_KEY = 'sk-or-mock_key_for_testing';

      try {
        const result = await runAnalysisPipeline({
          resumeText: 'Summary\nGreat.\nExperience\nDeveloped software.\nProjects\nDid stuff.\nSkills\nJava\nEducation\nBS',
          jobDescriptionText: 'Engineer',
          includePremium: true
        });

        if (!('legacyReport' in result) || !result.legacyReport) {
          throw new Error('legacyReport is missing');
        }

        assert.deepEqual(result.legacyReport.weakBullets, ['Developed software.']);
        assert.deepEqual(result.legacyReport.improvedBulletPoints, [{
          before: 'Developed software.',
          after: 'Developed software that increased revenue by 10%.',
          confidence: 'High'
        }]);
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  }
];

async function runTests() {
  let passed = 0;
  for (const test of tests) {
    try {
      await test.run();
      passed++;
    } catch (e: any) {
      console.error(`❌ FAILED: ${test.name}`);
      console.error(e.message);
    }
  }
  console.log(`\n${passed}/${tests.length} tests passed.`);
  if (passed !== tests.length) process.exit(1);
}

runTests();
