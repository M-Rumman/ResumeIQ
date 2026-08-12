import { runAnalysisPipeline } from './api/_lib/analysis-engine/pipeline.js';
import { extractCandidateProfile } from './api/_lib/analysis-engine/resumeExtraction.js';

const priyaResume = `Priya Chandran
Chicago, IL | priya.c@example.com | (312) 555-0192

SUMMARY
Senior UX Researcher with 7 years of experience specializing in qualitative and quantitative research methods. Proven track record of turning complex user behaviors into actionable product insights. Strong background in building research operations from the ground up and mentoring junior researchers.

EXPERIENCE
Brightledger Bank, 2021–Present
Senior UX Researcher
- Led a mixed-methods research initiative combining longitudinal diary studies with 5,000-person participant panel surveys to map the end-to-end user journey for a new wealth management dashboard.
- Partnered closely with data science to triangulate qualitative usability findings with quantitative funnel drop-off metrics, resulting in a 22% increase in dashboard adoption.
- Built and maintained the organization's first centralized research repository, improving cross-functional access to historical insights and reducing duplicative research by 30%.
- Regularly present findings to VP and C-suite stakeholders, directly influencing the Q3 product roadmap.
- Managed and mentored 3 junior researchers, establishing standardized qualitative coding frameworks.

EDUCATION
M.S. in Human-Computer Interaction
Georgia Institute of Technology
B.A. in Psychology
University of Michigan

SKILLS
Qualitative Methods: Usability Testing, Contextual Inquiry, Diary Studies, Journey Mapping, Affinity Mapping`;

const northlightJD = `Senior UX Researcher — Northlight Financial
Location: Chicago, IL (Hybrid — 3 days onsite)

We're looking for a Senior UX Researcher to lead mixed-methods research that shapes the future of our institutional trading platform. You'll partner closely with product, design, and data science teams to deliver insights that drive business impact.

Requirements:
- Bachelor's degree in Psychology, HCI, Cognitive Science, or related field (Master's preferred)
- 5+ years of applied UX research experience in a product environment
- Strong command of both qualitative and quantitative research methods
- Experience running research at scale (research repositories, participant panels)
- Ability to triangulate qualitative insights with behavioral data
- Excellent stakeholder communication and storytelling skills
- Present findings to senior leadership and influence product strategy
- Familiarity with the financial services or fintech sector is a strong plus`;

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  const prompt = body.messages[body.messages.length - 1].content;
  if (prompt.includes('extract_job_profile') || prompt.includes('category:')) {
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ 
      title: 'Senior UX Researcher', 
      company: 'Northlight Financial',
      requirements: [{
        id: 'req_loc',
        category: 'location',
        requirement_type: 'location',
        normalized_name: 'Chicago, IL (Hybrid)',
        original_text: 'Location: Chicago, IL (Hybrid — 3 days onsite)',
        source_section: 'Requirements',
        source_span: [0, 50],
        source_text: 'Company: Northlight Financial Location: Chicago, IL (Hybrid — 3 days onsite)',
        priority: 'required',
        confidence: 0.9
      },
      {
        id: 'req_edu',
        category: 'education',
        requirement_type: 'education',
        normalized_name: 'Bachelor degree in Psychology',
        original_text: 'Bachelor degree in Psychology',
        source_section: 'Requirements',
        source_span: [0, 50],
        source_text: 'Bachelor degree in Psychology',
        priority: 'required',
        confidence: 0.9
      }]
    }) } }] }) };
  }
  if (prompt.includes('match_requirements') || prompt.includes('classification')) {
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ 
      matches: [
        { requirementId: 'req_loc', classification: 'EXACT_MATCH', explanation: 'Location matches' },
        { requirementId: 'req_edu', classification: 'EXACT_MATCH', explanation: 'Education matches' }
      ]
    }) } }] }) };
  }
  if (prompt.includes('jobGapFocus')) {
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ weakBullets: [], improvedBulletPoints: [] }) } }] }) };
  }
  return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ title: 'fallback', requirements: [] }) } }] }) };
};

process.env.OPENROUTER_API_KEY = 'sk-or-mock_key_for_testing';

async function test() {
  const engineResult = await runAnalysisPipeline({
    resumeText: priyaResume,
    jobDescriptionText: northlightJD,
    includePremium: true,
    candidateProfile: extractCandidateProfile(priyaResume)
  });
  console.log(JSON.stringify(engineResult.legacyReport.atsScoreExplanation, null, 2));
}

test().catch(console.error).finally(() => { globalThis.fetch = originalFetch; });
