import assert from 'node:assert/strict';
import { extractCandidateProfile } from '../../api/_lib/analysis-engine/resumeExtraction.js';
import { matchRequirements } from '../../api/_lib/analysis-engine/matcher.js';
import { parseJobDescription } from '../../api/_lib/analysis-engine/jdParser.js';
import { validateAndSanitizeReport } from '../../api/_lib/analysis-engine/validator.js';
import { evaluateScores } from '../../api/_lib/analysis-engine/evaluator.js';
import { runAnalysisPipeline } from '../../api/_lib/analysis-engine/pipeline.js';

const resumeText = `
A Senior UX Researcher with 7 years of experience.
Experience includes:
- Senior UX Researcher
- UX Researcher
- Associate UX Researcher
- 100+ usability tests and interviews
- qualitative and quantitative research
- presented findings to VP and C-suite stakeholders
- influenced product strategy
- worked across design and product teams
- partnered with data science
- Dovetail
- UserTesting
- Qualtrics
- B.A. in Psychology
`;

const jdText = `
Requirements:
- 3+ years UX research experience
- usability testing, interviews, surveys, qualitative research
- communication and presentation
- actionable product recommendations
- cross-functional product teams
- UserTesting, Qualtrics, Dovetail or similar
- Bachelor's degree in UX, Psychology, HCI or related field
`;

async function testMatcherRegression() {
  process.env.OPENROUTER_API_KEY = 'sk-or-mock_key_for_testing';

  // Mock callOpenRouter
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    const prompt = body.messages?.[1]?.content || '';
    
    // JD Parser mock
    if (prompt.includes('Raw Job Description:')) {
      const mockLlmOutput = [
        { normalized_name: '3+ years UX research', original_text: '3+ years UX research experience', category: 'experience', priority: 'required', minimum_years: 3 },
        { normalized_name: 'usability testing, interviews, surveys', original_text: 'usability testing, interviews, surveys, qualitative research', category: 'methodology', priority: 'required' },
        { normalized_name: 'communication and presentation', original_text: 'communication and presentation', category: 'soft skill', priority: 'required' },
        { normalized_name: 'actionable product recommendations', original_text: 'actionable product recommendations', category: 'responsibility', priority: 'required' },
        { normalized_name: 'cross-functional product teams', original_text: 'cross-functional product teams', category: 'responsibility', priority: 'required' },
        { normalized_name: 'UserTesting, Qualtrics, Dovetail', original_text: 'UserTesting, Qualtrics, Dovetail or similar', category: 'tool', priority: 'required' },
        { normalized_name: 'Bachelor\'s in UX, Psychology, HCI', original_text: 'Bachelor\'s degree in UX, Psychology, HCI or related field', category: 'education', degree_level: 'bachelor', fields: ['UX', 'Psychology', 'HCI'], priority: 'required' }
      ];
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ title: 'UX Researcher', requirements: mockLlmOutput }) } }]
        })
      } as any;
    }

    // Matcher mock
    if (prompt.includes('Candidate Facts')) {
      // Find fact IDs based on what the matcher should realistically map
      const getFactId = (str: string) => {
        const m = prompt.match(new RegExp(`\\[ID:\\s*([^\\]]+)\\][^\\[]*\\[Section:[^\\]]*\\][^\n]*${str}`, 'i'));
        return m ? m[1] : null;
      };

      const matches: any[] = [];
      const lines = prompt.split('\n');
      for (const line of lines) {
        if (line.startsWith('[ID:')) {
          const reqIdMatch = line.match(/\[ID: ([^\]]+)\] Name: (.+) \(Category:/);
          if (reqIdMatch) {
            const reqId = reqIdMatch[1];
            const name = reqIdMatch[2];
            let classification = 'MISSING';
            let factId = null;

            if (name.includes('3+ years')) {
              classification = 'STRONG_SEMANTIC_MATCH';
              factId = getFactId('7 years');
            } else if (name.includes('usability')) {
              classification = 'STRONG_SEMANTIC_MATCH';
              factId = getFactId('100\\+ usability');
            } else if (name.includes('communication')) {
              classification = 'STRONG_SEMANTIC_MATCH';
              factId = getFactId('VP and C-suite');
            } else if (name.includes('actionable')) {
              classification = 'STRONG_SEMANTIC_MATCH';
              factId = getFactId('product strategy');
            } else if (name.includes('cross-functional')) {
              classification = 'STRONG_SEMANTIC_MATCH';
              factId = getFactId('design and product teams');
            } else if (name.includes('UserTesting')) {
              classification = 'STRONG_SEMANTIC_MATCH';
              factId = getFactId('Dovetail');
            } else if (name.includes('Bachelor')) {
              classification = 'STRONG_SEMANTIC_MATCH';
              factId = getFactId('Psychology');
            }

            matches.push({
              requirementId: reqId,
              classification,
              supportingFactId: factId,
              explanation: 'Mocked match'
            });
          }
        }
      }

      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ matches }) } }]
        })
      } as any;
    }

    return { ok: true, json: async () => ({}) } as any;
  };

  try {
    const candidateProfile = extractCandidateProfile(resumeText);
    console.log('--- Candidate Facts ---');
    console.log(JSON.stringify(candidateProfile.facts, null, 2));

    const engineResult = await runAnalysisPipeline({ resumeText, jobDescriptionText: jdText, includePremium: true });
    
    console.log('\n--- Final Report Matches ---');
    const matches = engineResult.legacyReport.requirementBreakdown;
    matches.forEach((m: any) => {
      console.log(`${m.requirement.normalized_name}: ${m.classification} (${m.evidence.length} evidence facts)`);
    });

  } catch (e) {
    console.error(e);
  }
}

testMatcherRegression();
