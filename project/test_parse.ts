import { parseResumeText } from './api/_lib/resumeParser.js';

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

const res = parseResumeText(priyaResume);
console.log(JSON.stringify(res.skills, null, 2));
console.log(JSON.stringify(res.experience, null, 2));
