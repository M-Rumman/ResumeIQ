import { runAnalysisPipeline } from '../../api/_lib/analysis-engine/pipeline.js';
import { parseResumeText } from '../../api/_lib/resumeParser.js';

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

Education:
M.S. in Human-Computer Interaction — DePaul University, 2018
B.A. in Psychology — University of Illinois Urbana-Champaign, 2016

Skills:
Qualitative & quantitative research methods, usability testing, survey design, diary studies, research operations, stakeholder communication, Dovetail, UserTesting, Qualtrics, SQL (basic)
`;

const priyaJd = `
Senior UX Researcher

Requirements:
* 6+ years of UX research experience, ideally in fintech, banking, or a regulated industry
* Strong command of both qualitative and quantitative research methods
* Experience running research at scale (research repositories, participant panels)
* Excellent stakeholder communication and storytelling skills
* Bachelor's degree in Psychology, HCI, Cognitive Science, or related field (Master's preferred)
* Location: Chicago, IL (Hybrid — 3 days onsite)

Responsibilities:
* Lead end-to-end research studies (generative, evaluative, and longitudinal) across web and mobile banking products
* Design and conduct interviews, usability tests, surveys, and diary studies
* Translate qualitative and quantitative findings into clear, actionable insights for cross-functional stakeholders
* Mentor junior researchers and help scale research operations
* Partner with data science to triangulate behavioral analytics with qualitative findings
* Present findings to senior leadership and influence product strategy
`;

const mockValidJD = {
  title: 'Senior UX Researcher',
  company: 'Northlight Financial',
  requirements: [
    { normalized_name: '6+ years of UX research experience', original_text: '6+ years of UX research experience, ideally in fintech, banking, or a regulated industry', category: 'experience', priority: 'required', minimum_years: 6 },
    { normalized_name: 'qualitative and quantitative research methods', original_text: 'Strong command of both qualitative and quantitative research methods', category: 'hard skill', priority: 'required' },
    { normalized_name: 'Research at Scale', original_text: 'Experience running research at scale (research repositories, participant panels)', category: 'experience', priority: 'required' },
    { normalized_name: 'stakeholder communication', original_text: 'Excellent stakeholder communication and storytelling skills', category: 'soft skill', priority: 'required' },
    { normalized_name: 'Bachelor\'s degree in Psychology, HCI, Cognitive Science, or related field', original_text: 'Bachelor\'s degree in Psychology, HCI, Cognitive Science, or related field (Master\'s preferred)', category: 'education', priority: 'required', degree_level: 'bachelor' },
    { normalized_name: 'Master\'s degree', original_text: 'Master\'s preferred', category: 'education', priority: 'preferred', degree_level: 'master' },
    { normalized_name: 'Location: Chicago, IL (Hybrid — 3 days onsite)', original_text: 'Location: Chicago, IL (Hybrid — 3 days onsite)', category: 'location', priority: 'required' },
    { normalized_name: 'Lead end-to-end research studies', original_text: 'Lead end-to-end research studies (generative, evaluative, and longitudinal) across web and mobile banking products', category: 'responsibility', priority: 'required' },
    { normalized_name: 'Design and conduct research studies', original_text: 'Design and conduct interviews, usability tests, surveys, and diary studies', category: 'responsibility', priority: 'required' },
    { normalized_name: 'Mentorship', original_text: 'Mentor junior researchers and help scale research operations', category: 'soft skill', priority: 'required' },
    { normalized_name: 'Partner with data science', original_text: 'Partner with data science to triangulate behavioral analytics with qualitative findings', category: 'responsibility', priority: 'required' },
    { normalized_name: 'Present findings to senior leadership', original_text: 'Present findings to senior leadership and influence product strategy', category: 'responsibility', priority: 'required' },
    { normalized_name: 'Fintech/Banking Industry', original_text: 'fintech, banking, or a regulated industry', category: 'domain', priority: 'required' }
  ]
};

const mockValidMatcher = {
  matches: [
    { requirement: 'Lead end-to-end research studies', classification: 'ANALYSIS_FAILED', explanation: 'Mocked match' },
    { requirement: 'Fintech/Banking Industry', classification: 'ANALYSIS_FAILED', explanation: 'Mocked match' }
  ]
};

const mockValidRewrites = {
  weakBullets: [],
  improvedBulletPoints: []
};

async function runScenario(name: string, fetchMock: (prompt: string) => any, jdArg: string) {
  console.log(`\n\n========== SCENARIO: ${name} ==========`);
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input, init) => {
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
      const prompt = body.messages?.[1]?.content || '';
      return fetchMock(prompt);
    };

    const parsedResume = parseResumeText(priyaResume);
    const result = await runAnalysisPipeline({
      parsedResume,
      resumeText: priyaResume,
      jobDescriptionText: jdArg,
      includePremium: true
    });

    console.log('[SUCCESS] Pipeline completed.');
    console.log('[SUCCESS] Pipeline completed.');
    const report = result.legacyReport || result;
    if (report) {
      console.log('Report Keys:', Object.keys(report));
      console.log('Requirements count:', report.requirementBreakdown ? report.requirementBreakdown.length : 'N/A');
      console.log('Match Score:', report.matchScore);
      console.log('Hiring Decision:', report.hiringManagerAssessment?.overallDecision);
      console.log('Classifications:', report.requirementBreakdown ? report.requirementBreakdown.map(r => r.classification).reduce((acc, curr) => {
        acc[curr] = (acc[curr] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) : 'N/A');
      console.log('Bullet improvements:', report.improvedBulletPoints?.length || 0);
    }

  } catch (e: any) {
    console.log('[ERROR] Pipeline failed with:', e.message);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function main() {
  process.env.OPENROUTER_API_KEY = 'sk-or-mock_key_for_testing';

  // 1. Valid JD + Valid Resume
  await runScenario('1. valid JD + valid resume', (prompt) => {
    if (prompt.includes('Raw Job Description:')) {
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(mockValidJD) } }] }), text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify(mockValidJD) } }] }) } as any;
    }
    if (prompt.includes('Candidate Facts (Prioritized):')) {
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(mockValidMatcher) } }] }), text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify(mockValidMatcher) } }] }) } as any;
    }
    if (prompt.includes('Identify weak bullet points')) {
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(mockValidRewrites) } }] }), text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify(mockValidRewrites) } }] }) } as any;
    }
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "{}" } }] }), text: async () => JSON.stringify({ choices: [{ message: { content: "{}" } }] }) } as any;
  }, priyaJd);

  // 2. Empty/invalid JD
  await runScenario('2. empty/invalid JD', (prompt) => {
    if (prompt.includes('Raw Job Description:')) {
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({title:"", company:"", requirements:[]}) } }] }), text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({title:"", company:"", requirements:[]}) } }] }) } as any;
    }
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "{}" } }] }), text: async () => JSON.stringify({ choices: [{ message: { content: "{}" } }] }) } as any;
  }, ' ');

  // 3. Simulated provider failure
  await runScenario('3. simulated provider failure', (prompt) => {
    return { ok: false, status: 503, statusText: 'Service Unavailable', json: async () => ({}), text: async () => 'Service Unavailable' } as any;
  }, priyaJd);

  // 4. Malformed model JSON
  await runScenario('4. malformed model JSON', (prompt) => {
    if (prompt.includes('Raw Job Description:')) {
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "This is not json at all." } }] }), text: async () => JSON.stringify({ choices: [{ message: { content: "This is not json at all." } }] }) } as any;
    }
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "{}" } }] }), text: async () => JSON.stringify({ choices: [{ message: { content: "{}" } }] }) } as any;
  }, priyaJd);

  // 5. Empty model requirement response
  await runScenario('5. empty model requirement response', (prompt) => {
    if (prompt.includes('Raw Job Description:')) {
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({title:"Role", company:"Co", requirements:[]}) } }] }), text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({title:"Role", company:"Co", requirements:[]}) } }] }) } as any;
    }
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "{}" } }] }), text: async () => JSON.stringify({ choices: [{ message: { content: "{}" } }] }) } as any;
  }, priyaJd);
}

main().catch(console.error);
