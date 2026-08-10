import assert from 'node:assert';
import { test, suite } from 'node:test';
import { runAnalysisPipeline } from '../../api/_lib/analysis-engine/pipeline.js';
import type { PipelineContext } from '../../api/_lib/analysis-engine/types.js';

suite('Job Match Report Consistency', () => {
  test('UNDER_EXPRESSED maps to opportunities, not gaps, and uses "Reword"', async () => {
    
    // Mock fetch to control OpenRouter responses for matching and rewrites
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (req: any, options?: any) => {
      const url = typeof req === 'string' ? req : (req instanceof Request ? req.url : '');
      const bodyStr = typeof req === 'string' ? options?.body : (req instanceof Request ? await req.clone().text() : '');
      
      // If it's a rewrite request, just return empty arrays to speed up the test
      if (bodyStr && (bodyStr.includes('Rewrite the following') || bodyStr.includes('rewritePriorities') || bodyStr.includes('jobGapFocus'))) {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: JSON.stringify({ weakBullets: [], improvedBulletPoints: [] }) } }]
          })
        } as any;
      }
      
      // If it's a JD parsing request
      if (bodyStr && (bodyStr.includes('You are an expert Job Description') || bodyStr.includes('Raw Job Description:'))) {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: JSON.stringify({
              title: 'Mock Title',
              requirements: [
                {
                  id: 'req_1',
                  category: 'responsibility',
                  priority: 'required',
                  name: 'Research Design and Execution',
                  normalized_name: 'Research Design and Execution',
                  original_text: 'Research Design and Execution',
                  source_text: 'Research Design and Execution'
                },
                {
                  id: 'req_2',
                  category: 'experience',
                  priority: 'required',
                  name: 'A completely missing skill',
                  normalized_name: 'A completely missing skill',
                  original_text: 'A completely missing skill',
                  source_text: 'A completely missing skill'
                }
              ]
            }) } }]
          })
        } as any;
      }
      
      // Otherwise, it's the matcher request
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({
            matches: [
              {
                requirementId: 'Research Design and Execution',
                classification: 'UNDER_EXPRESSED',
                supportingFactId: 'f1',
                explanation: 'Evidence is present but weak.'
              },
              {
                requirementId: 'A completely missing skill',
                classification: 'MISSING',
                supportingFactId: null,
                explanation: 'No evidence.'
              }
            ]
          }) } }]
        })
      } as any;
    };
    
    process.env.OPENROUTER_API_KEY = 'sk-or-mock_key_for_testing';

    const context: PipelineContext = {
      resumeText: 'Ran longitudinal diary studies and conducted usability tests',
      jobDescriptionText: 'Required: Research Design and Execution (1). Required: A completely missing skill (2).',
      includePremium: true
    };

    try {
      const engineResult = await runAnalysisPipeline(context);
      const report = engineResult.legacyReport as any;

      const jobMatchExplanation = report.jobMatchExplanation;
      
      console.log('DEBUG jobMatchExplanation:', JSON.stringify(jobMatchExplanation, null, 2));

      // 1. UNDER_EXPRESSED should NOT be in missingSkills (gaps)
      const missingSkills = jobMatchExplanation.missingSkills.map((s: any) => s.requirement);
      assert.ok(!missingSkills.includes('Research Design and Execution'), 'UNDER_EXPRESSED must not appear as a missing gap');
      
      // 2. MISSING should be in missingSkills (gaps)
      assert.ok(missingSkills.includes('A completely missing skill'), 'MISSING must appear as a gap');

      // 3. UNDER_EXPRESSED should be in partialMatches (opportunities)
      const partialMatches = jobMatchExplanation.partialMatches.map((s: any) => s.requirement);
      assert.ok(partialMatches.includes('Research Design and Execution'), 'UNDER_EXPRESSED must appear as a partial match');

      // 4. Recommendation text should use "Reword" not "Explicitly add" for UNDER_EXPRESSED
      const improvements: string[] = report.improvementSuggestions;
      const researchRec = improvements.find((i: string) => i.includes('Research Design and Execution'));
      assert.ok(researchRec, 'Should generate a recommendation for the under expressed skill');
      assert.ok(researchRec.includes('**What**: Reword your experience'), 'Recommendation must use "Reword" for under expressed items');
      assert.ok(!researchRec.includes('**What**: Explicitly add'), 'Recommendation must not tell the user to add an under expressed item as if it were completely missing');

      // 5. Hiring Manager Summary: Why You Might Be Rejected
      const rejectionReasons = report.hiringManagerAssessment.topReasonsForRejection;
      assert.ok(!rejectionReasons.includes('Research Design and Execution'), 'UNDER_EXPRESSED must not be a top reason for rejection');
      assert.ok(rejectionReasons.includes('A completely missing skill'), 'MISSING must be a top reason for rejection');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
