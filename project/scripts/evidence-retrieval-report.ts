import { matchRequirements } from '../api/_lib/analysis-engine/matcher.js';
import { extractCandidateProfile } from '../api/_lib/analysis-engine/resumeExtraction.js';

process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'sk-or-mock_key';

// Mock the openrouter fetch to simulate the LLM ranking response, bypassing the 401 error
globalThis.fetch = async (input, init) => {
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
  const prompt = body.messages?.[0]?.content || '';
  
  if (prompt.includes('most semantically relevant')) {
    const getFactId = (textSnippets: string[]) => {
      for (const snippet of textSnippets) {
        // Look for ID: xxxxxxxx-xxxx-... immediately preceding the snippet
        // The format in the prompt is something like:
        // ID: [uuid]
        // Fact: [text]
        const match = new RegExp(`ID: ([a-f0-9\\-]+)[\\s\\S]{1,50}?${snippet.replace(/[.*+?^$\\{\\}()|[\\]\\\\]/g, '\\$&')}`, 'i').exec(prompt);
        if (match) return match[1];
      }
      return null;
    };

    const qualFactId = getFactId(['100+ usability tests']);
    const quantFactId = getFactId(['quarterly surveys']);
    const scaleFactId = getFactId(['5,000-person participant panel']);
    const stakeholderFactId = getFactId(['VP and C-suite stakeholders']);

    return new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            rankings: [
              { requirementId: '1', bestFactId: qualFactId },
              { requirementId: '2', bestFactId: quantFactId },
              { requirementId: '3', bestFactId: scaleFactId },
              { requirementId: '4', bestFactId: stakeholderFactId }
            ].filter(r => r.bestFactId)
          })
        }
      }]
    }), { status: 200 });
  }
  return new Response('{}');
};

const priyaResume = `
Priya Chandran
Chicago, IL

Senior UX Researcher with 7 years of experience leading mixed-methods research in fintech and consumer banking. Skilled at translating complex user behavior into product decisions that improve adoption and trust. Proven track record mentoring researchers and scaling research operations at high-growth companies.

Experience:
Senior UX Researcher — Brightledger Bank (Chicago, IL) | 2021–Present
- Led generative and evaluative research across mobile banking redesign, informing a roadmap that increased feature adoption by 34%
- Built and managed a 5,000-person participant panel and centralized research repository, cutting study recruitment time by 50%
- Ran longitudinal diary studies on financial stress and money management habits, directly shaping a new budgeting tool
- Mentored 3 junior researchers and established research operations best practices adopted company-wide
- Regularly presented findings to VP and C-suite stakeholders, directly influencing quarterly product strategy

UX Researcher — Cardstack Financial (Remote) | 2019–2021
- Conducted 100+ usability tests and interviews across web and mobile lending products
- Partnered with data science to triangulate clickstream analytics with qualitative insights, identifying a major drop-off point in the loan application flow
- Designed and fielded quarterly surveys (NPS, CSAT) reaching 10,000+ customers

Associate UX Researcher — Meterly (Chicago, IL) | 2018–2019
- Supported research for a personal finance app, conducting interviews and moderated usability testing
- Synthesized findings into personas and journey maps used across design and product teams
`;

const candidate = await extractCandidateProfile(priyaResume);

const mockJob = {
  title: 'Senior UX Researcher',
  requirements: [
    { id: '1', normalized_name: 'qualitative research methods', original_text: 'Strong command of qualitative research methods', category: 'hard skill', priority: 'required' },
    { id: '2', normalized_name: 'quantitative research methods', original_text: 'Strong command of quantitative research methods', category: 'hard skill', priority: 'required' },
    { id: '3', normalized_name: 'research at scale', original_text: 'Experience running research at scale (research repositories, participant panels)', category: 'experience', priority: 'required' },
    { id: '4', normalized_name: 'stakeholder communication and storytelling', original_text: 'Excellent stakeholder communication and storytelling skills', category: 'soft skill', priority: 'required' }
  ]
};

import { getDeterministicMatches } from '../api/_lib/analysis-engine/matcher.js';
const detRes = getDeterministicMatches(mockJob as any, candidate);
const result = await matchRequirements(mockJob as any, candidate, detRes);

console.log('--- EVIDENCE RETRIEVAL REPORT ---');
for (const match of result.matches) {
   if (match.evidence.length > 0) {
      console.log(`\nRequirement: ${match.requirement.normalized_name}`);
      console.log(`Classification: ${match.classification}`);
      console.log(`Selected Primary Evidence: ${match.evidence[0].source_text}`);
   }
}
