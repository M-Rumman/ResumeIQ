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

  test('Ensures UI rounding inconsistencies are fixed (displayed percentage = displayed achieved / displayed max * 100)', async () => {
    // Dynamic import to avoid needing to modify top-level imports significantly for types
    const { evaluateScores } = await import('../../api/_lib/analysis-engine/evaluator.js');
    
    function createMatch(
      id: string,
      name: string,
      category: any,
      priority: any,
      classification: any,
      confidence: number
    ): any {
      return {
        requirement: {
          id,
          category,
          priority,
          normalized_name: name,
          original_text: '',
          source_section: '',
          source_span: [0, 0],
          source_text: '',
          requirement_type: 'skill',
          confidence: 1
        },
        classification,
        confidence,
        evidence: [],
        explanation: ''
      };
    }

    const job: any = { title: 'UX Researcher', requirements: [] };
    const baseCandidate: any = {
      contact: { name: 'Test', email: '', phone: '', location: '' },
      facts: [],
      rawStructure: { summary: 'Summary', experience: ['Exp'], projects: ['Proj'], skills: ['Skills'], education: ['Edu'] }
    };
    
    const matchingResult: any = {
      matches: [
        createMatch('1', 'Chicago, IL', 'location', 'required', 'STRONG_SEMANTIC_MATCH', 1.0),
        createMatch('2', 'UX Research Experience', 'experience', 'required', 'STRONG_SEMANTIC_MATCH', 1.0),
        createMatch('3', 'Fintech/Banking', 'domain', 'preferred', 'STRONG_SEMANTIC_MATCH', 1.0),
        createMatch('4', 'Mixed-methods Research', 'hard skill', 'required', 'EXACT_MATCH', 1.0),
        createMatch('5', 'Large-scale Research Operations', 'hard skill', 'required', 'STRONG_SEMANTIC_MATCH', 1.0),
        createMatch('6', 'Stakeholder Communication', 'soft skill', 'required', 'EXACT_MATCH', 1.0),
        createMatch('7', "Bachelor's Degree", 'education', 'required', 'EXACT_MATCH', 1.0),
        createMatch('8', "Master's Degree", 'education', 'nice_to_have', 'EXACT_MATCH', 1.0),
        createMatch('9', 'End-to-end research leadership', 'responsibility', 'required', 'STRONG_SEMANTIC_MATCH', 1.0),
        createMatch('10', 'Mentorship', 'responsibility', 'required', 'STRONG_SEMANTIC_MATCH', 1.0),
        createMatch('11', 'Research Design and Execution', 'responsibility', 'required', 'UNDER_EXPRESSED', 0.85),
        createMatch('12', 'Insight translation', 'responsibility', 'required', 'STRONG_SEMANTIC_MATCH', 0.85),
        createMatch('13', 'Cross-functional partnership', 'responsibility', 'required', 'STRONG_SEMANTIC_MATCH', 1.0),
        createMatch('14', 'Executive presentation', 'responsibility', 'required', 'STRONG_SEMANTIC_MATCH', 1.0)
      ]
    };

    const evalResult = evaluateScores(job, baseCandidate, matchingResult);
    const details = evalResult.matchScoreDetails;

    // 1. Verify exact sums match exactly the known target (which were previously only achieved after UI rounding)
    assert.equal(details.totalMaxScore, 120, 'Max score should exactly be 120');
    assert.equal(details.totalAchievedScore, 98.4, 'Achieved score should exactly be 98.4 due to per-row rounding');

    // 2. Verify individual row point allocations match the UI display expectations
    const matchMap = new Map(details.details.map(d => [d.requirement, d]));
    
    assert.equal(matchMap.get('Chicago, IL')?.achievedPoints, 8.5);
    assert.equal(matchMap.get('UX Research Experience')?.achievedPoints, 8.5);
    assert.equal(matchMap.get('Fintech/Banking')?.achievedPoints, 4.3); // 4.25 rounded to 4.3
    assert.equal(matchMap.get('Mixed-methods Research')?.achievedPoints, 8);
    assert.equal(matchMap.get('Large-scale Research Operations')?.achievedPoints, 6.8);
    assert.equal(matchMap.get('Stakeholder Communication')?.achievedPoints, 8);
    assert.equal(matchMap.get("Bachelor's Degree")?.achievedPoints, 10);
    assert.equal(matchMap.get("Master's Degree")?.achievedPoints, 1);
    assert.equal(matchMap.get('End-to-end research leadership')?.achievedPoints, 8.5);
    assert.equal(matchMap.get('Mentorship')?.achievedPoints, 8.5);
    assert.equal(matchMap.get('Research Design and Execution')?.achievedPoints, 2.1); // 2.125 rounded to 2.1
    assert.equal(matchMap.get('Insight translation')?.achievedPoints, 7.2); // 7.225 rounded to 7.2
    assert.equal(matchMap.get('Cross-functional partnership')?.achievedPoints, 8.5);
    assert.equal(matchMap.get('Executive presentation')?.achievedPoints, 8.5);

    // 3. Verify the final percentage mathematically aligns with the unrounded components 
    // (98.4 / 120 * 100 = 82 exactly)
    assert.equal(details.rawMatchScore, 82, 'The exact final percentage must be exactly 82');

    // Check the exact float calculation
    assert.equal(
      evalResult.matchScore,
      (details.totalAchievedScore / details.totalMaxScore) * 100,
      'Displayed percentage must mathematically equal (totalAchieved / totalMax) * 100'
    );
  });
});
