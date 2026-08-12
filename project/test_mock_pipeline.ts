import { runAnalysisPipeline } from './api/_lib/analysis-engine/pipeline.js';
import { extractCandidateProfile } from './api/_lib/analysis-engine/resumeExtraction.js';

const priyaResume = `
Priya Chandran
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

Cardstack Financial, 2019–2021
UX Researcher
- Conducted remote and in-person usability testing for a consumer credit card mobile app, delivering findings that reduced task completion time by 15%.
- Facilitated co-design workshops with product managers and engineers to align on user needs before development cycles began.
- Developed screener questionnaires and managed participant recruitment for 4 concurrent product pods.

Meterly, 2018–2019
UX Research Coordinator
- Scheduled and coordinated logistics for over 150 user interviews and contextual inquiries.
- Assisted lead researchers with qualitative data synthesis, affinity mapping, and report generation.

EDUCATION
M.S. in Human-Computer Interaction
Georgia Institute of Technology
B.A. in Psychology
University of Michigan

SKILLS
Qualitative Methods: Usability Testing, Contextual Inquiry, Diary Studies, Journey Mapping, Affinity Mapping
Quantitative Methods: Survey Design, A/B Testing, Descriptive Statistics, Funnel Analysis
Tools: Qualtrics, UserTesting, Figma, Dovetail, SPSS, Mixpanel
Soft Skills: Stakeholder Communication, Mentorship, Cross-functional Collaboration
`;

const northlightJD = `
Senior UX Researcher — Northlight Financial
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
- Familiarity with the financial services or fintech sector is a strong plus
`;

// Mock global fetch to return deterministic results
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  const prompt = body.messages[body.messages.length - 1].content;
  
  if (prompt.includes('extract_job_profile')) {
    // Return JD Parse
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          title: 'Senior UX Researcher',
          company: 'Northlight Financial',
          requirements: [
            {
              id: 'req_1',
              category: 'education',
              normalized_name: 'Bachelor\'s degree in Psychology, HCI, Cognitive Science, or related field',
              priority: 'required',
              requirement_type: 'education',
              confidence: 0.9,
              original_text: 'Bachelor\'s degree in Psychology, HCI, Cognitive Science, or related field (Master\'s preferred)',
              source_section: 'Requirements',
              source_span: [0, 50],
              source_text: 'Bachelor\'s degree in Psychology, HCI, Cognitive Science, or related field (Master\'s preferred)'
            }
          ]
        }) } }]
      })
    };
  }
  
  if (prompt.includes('match_requirements')) {
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ matches: [] }) } }]
      })
    };
  }

  if (prompt.includes('jobGapFocus')) {
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ weakBullets: [], improvedBulletPoints: [] }) } }]
      })
    };
  }

  return { ok: true, json: async () => ({ choices: [{ message: { content: '{}' } }] }) };
};

process.env.OPENROUTER_API_KEY = 'sk-or-mock_key_for_testing';

async function test() {
  console.log('1. Frontend runs preprocess on Priya Resume');
  const preprocessedProfile = extractCandidateProfile(priyaResume);

  console.log('2. Frontend calls fetchAiResumeAnalysis(resumeText, jobDescription, preprocessedProfile)');
  console.log('3. Backend receives the request and runs runAnalysisPipeline');
  
  const engineResult = await runAnalysisPipeline({
    resumeText: priyaResume,
    jobDescriptionText: northlightJD,
    includePremium: true,
    candidateProfile: preprocessedProfile
  });
  
  const report = engineResult.legacyReport;
  console.log('Detected sections:', report.detectedSections);
  console.log('Missing sections:', report.missingSections);
  console.log('Strengths:', report.atsScoreExplanation?.strengths);
  console.log('Weaknesses:', report.atsScoreExplanation?.weaknesses);
}

test().catch(console.error).finally(() => { globalThis.fetch = originalFetch; });
