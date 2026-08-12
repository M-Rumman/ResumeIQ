import { extractCandidateProfile } from './api/_lib/analysis-engine/resumeExtraction.js';
import { parseJobDescription } from './api/_lib/analysis-engine/jdParser.js';
import { runFullAnalysisPipeline } from './api/_lib/analysis-engine/pipeline.js';

const priyaResume = `
Priya Chandran
Chicago, IL

Senior UX Researcher with 7 years of experience leading mixed-methods research in fintech and consumer banking. Skilled at translating complex user behavior into product decisions that improve adoption and trust. Proven track record mentoring researchers and scaling research operations at high-growth companies.

Experience

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

Education
M.S. in Human-Computer Interaction — DePaul University, 2018
B.A. in Psychology — University of Illinois Urbana-Champaign, 2016
`;

const priyaJd = `
Senior UX Researcher — Northlight Financial
Chicago, IL (Hybrid — 3 days onsite)

We are looking for a Senior UX Researcher to join our growing product team at Northlight Financial. You will lead research initiatives that directly impact how consumers manage their money, save for the future, and interact with our digital platforms.

What You'll Do:
- Lead end-to-end research (generative and evaluative) for core consumer finance products.
- Partner closely with Product, Design, and Data Science to define product strategy and UX roadmaps.
- Conduct both qualitative (interviews, diary studies, usability testing) and quantitative (surveys) research.
- Present research findings and strategic recommendations to executive stakeholders.
- Mentor junior researchers and help mature our research operations.

Qualifications:
- 6+ years of experience in UX Research, preferably in fintech, banking, or complex enterprise software.
- Deep expertise in both qualitative and quantitative methods.
- Strong executive presence and experience presenting to C-level stakeholders.
- Track record of conducting research at scale (e.g., managing large panels, analyzing high-volume survey data).
- Experience working with data science to combine behavioral data (analytics) with attitudinal data.
- Bachelor's degree in Psychology, HCI, Cognitive Science, or related field (Master's preferred).
`;

async function testRewrites() {
  const candidate = await extractCandidateProfile(priyaResume);
  const jd = await parseJobDescription(priyaJd);
  
  const result = await runFullAnalysisPipeline(candidate, jd);
  console.log(JSON.stringify(result.improvedBulletPoints, null, 2));
}

testRewrites().catch(console.error);
