import { runAnalysisPipeline } from '../api/_lib/analysis-engine/pipeline.js';
import { extractCandidateProfile } from '../api/_lib/analysis-engine/resumeExtraction.js';

const priyaResume = `Priya Chandran
Chicago, IL | priya.c@example.com | (312) 555-0192

SUMMARY
Senior UX Researcher with 7 years of experience specializing in qualitative and quantitative research methods. Proven track record of turning complex user behaviors into actionable product insights. Strong background in building research operations from the ground up and mentoring junior researchers.

EXPERIENCE
Brightledger Bank, 2021–Present
Senior UX Researcher
- Led generative and evaluative research across mobile banking redesign, informing a roadmap that increased feature adoption by 34%
- Built and managed a 5,000-person participant panel and centralized research repository, cutting study recruitment time by 50%
- Ran longitudinal diary studies on financial stress and money management habits, directly shaping a new budgeting tool
- Mentored 3 junior researchers and established research operations best practices adopted company-wide
- Regularly presented findings to VP and C-suite stakeholders, directly influencing quarterly product strategy

Meterly, 2018-2019
Associate UX Researcher
- Conducted 100+ usability tests and interviews across web and mobile lending products
- Designed and fielded quarterly surveys (NPS, CSAT) reaching 10,000+ customers

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

process.env.OPENROUTER_API_KEY = 'sk-or-dummy';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_JOB_MATCH_KEYS;

async function test() {
  const engineResult = await runAnalysisPipeline({
    resumeText: priyaResume,
    jobDescriptionText: northlightJD,
    includePremium: true,
    candidateProfile: extractCandidateProfile(priyaResume)
  });
  console.log('--- IMPROVED BULLETS ---');
  console.log(JSON.stringify(engineResult.legacyReport.improvedBulletPoints, null, 2));
}

test().catch(console.error);
