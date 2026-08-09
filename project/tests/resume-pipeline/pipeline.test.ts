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
  },
  {
    name: 'Unified parser integration: Evaluator and Bullet Rewriter consume the same correct Experience section for Marcus Delgado',
    run: async () => {
      // Mock fetch
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url: any, init: any) => {
        const body = JSON.parse(init.body);
        const content = body.messages[body.messages.length - 1].content;
        
        // Return Bullet Rewriter result if we see jobGapFocus (Rewriter stage)
        if (content.includes('jobGapFocus')) {
          const userContent = JSON.parse(content);
          // Assert that the 'experience' array passed to the rewriter contains the 15 lines,
          // and 'projects' is empty. This proves the bullet rewriter is using the same fixed output.
          assert.equal(userContent.experience.length, 15, 'Rewriter did not receive the 15 experience lines');
          assert.equal(userContent.projects.length, 0, 'Rewriter should not have received projects');
          
          return {
            ok: true,
            json: async () => ({
              choices: [{ message: { content: JSON.stringify({
                weakBullets: [],
                improvedBulletPoints: []
              }) } }]
            })
          } as any;
        }

        // Return Matcher result (if we see JD requirement matching)
        if (content.includes('EXACT_MATCH') || content.includes('classification')) {
          return {
            ok: true,
            json: async () => ({
              choices: [{ message: { content: JSON.stringify({ matches: [] }) } }]
            })
          } as any;
        }

        // Return JD parse result (default analyzer stage)
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: JSON.stringify({ title: 'Project Manager', requirements: [], responsibilities: [], preferredSkills: [] }) } }]
          })
        } as any;
      };
      process.env.OPENROUTER_API_KEY = 'sk-or-mock_key_for_testing';

      try {
        const resumeText = `Marcus Delgado
Denver, CO | marcus.delgado@email.com | (303) 555-0142

Summary
Construction Project Manager with 8 years of experience.

Experience

Senior Project Manager — Ridgepoint Construction Group (Denver, CO) | 2020–Present
- Managed 6 concurrent commercial projects ranging from $2M to $12M, delivering all on schedule and within 3% of budget
- Negotiated subcontractor and vendor contracts, reducing material costs by 8% through competitive bidding
- Led weekly stakeholder meetings with clients, architects, and engineers to align on scope, timeline, and change orders
- Maintained project schedules in Procore, reducing schedule slippage by 20% through proactive milestone tracking
- Oversaw OSHA compliance across all job sites, maintaining a zero-lost-time-incident record for 3 consecutive years
- Mentored 2 assistant project managers, both promoted to PM roles within 18 months

Project Manager — Summit Commercial Builders (Denver, CO) | 2017–2020
- Managed ground-up construction of a $6.5M retail center from permitting through closeout
- Processed and tracked 150+ change orders using Bluebeam, maintaining accurate budget forecasts
- Conducted weekly site inspections for quality control and safety compliance
- Coordinated with architects and engineers to resolve design conflicts during construction

Assistant Project Manager — Frontier Development Co. (Boulder, CO) | 2018–2017
- Supported project scheduling and subcontractor coordination on a $3.5M office renovation
- Assisted in preparing bid packages and reviewing subcontractor proposals

Education
B.S. in Construction Management — Colorado State University, 2016`;

        const result = await runAnalysisPipeline({
          resumeText,
          jobDescriptionText: 'Project Manager',
          includePremium: true
        });

        if (!('legacyReport' in result) || !result.legacyReport) {
          throw new Error('legacyReport is missing');
        }

        const { legacyReport } = result;

        // 1. Assert Evaluator consumed Experience successfully (no missing section penalty)
        assert.equal(legacyReport.missingSections.includes('Experience'), false, 'Evaluator incorrectly marked Experience as missing');
        assert.equal(legacyReport.detectedSections.includes('Experience'), true, 'Evaluator failed to detect Experience section');
        
        // 2. Assert ATS breakdown doesn't complain about missing Experience
        const structureIssue = legacyReport.atsBreakdown.find((b: any) => b.label === 'Section Recognition');
        assert.equal(structureIssue?.explanation.includes('Missing or unparseable section: experience'), false, 'ATS score penalized for missing experience');

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
