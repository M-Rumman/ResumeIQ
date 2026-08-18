import { scoreBulletQuality, FLUFF_WORDS, WEAK_VERBS, STRONG_VERBS } from './project/api/_lib/analysis-engine/bulletScoring.js';
import { extractCandidateProfile } from './project/api/_lib/analysis-engine/resumeExtraction.js';

const priyaResume = `
Priya Chandran
Chicago, IL | priya.c@example.com | (312) 555-0192

SUMMARY
Senior UX Researcher with 7 years of experience specializing in qualitative and quantitative research methods. Proven track record of turning complex user behaviors into actionable product insights. Strong background in building research operations from the ground up and mentoring junior researchers.

EXPERIENCE
Brightledger Bank, 2021—Present
Senior UX Researcher
- Led a mixed-methods research initiative combining longitudinal diary studies with 5,000-person participant panel surveys to map the end-to-end user journey for a new wealth management dashboard.
- Partnered closely with data science to triangulate qualitative usability findings with quantitative funnel drop-off metrics, resulting in a 22% increase in dashboard adoption.
- Built and maintained the organization's first centralized research repository, improving cross-functional access to historical insights and reducing duplicative research by 30%.
- Regularly present findings to VP and C-suite stakeholders, directly influencing the Q3 product roadmap.
- Managed and mentored 3 junior researchers, establishing standardized qualitative coding frameworks.

Cardstack Financial, 2019—2021
UX Researcher
- Conducted remote and in-person usability testing for a consumer credit card mobile app, delivering findings that reduced task completion time by 15%.
- Facilitated co-design workshops with product managers and engineers to align on user needs before development cycles began.
- Developed screener questionnaires and managed participant recruitment for 4 concurrent product pods.

Meterly, 2018—2019
UX Research Coordinator
- Scheduled and coordinated logistics for over 150 user interviews and contextual inquiries.
- Assisted lead researchers with qualitative data synthesis, affinity mapping, and report generation.
- Helped with UX research and did some testing.

`;

const profile = extractCandidateProfile(priyaResume);
const candidateBullets = profile.facts
    .filter(f => f.type === 'experience' || f.type === 'project')
    .flatMap(f => f.evidence.split('\n'))
    .map(text => text.replace(/^[•\-\*·\s]+/, '').trim())
    .filter(text => {
      if (text.length < 30) return false;
      if (/\b(?:19|20)\d{2}\b/.test(text)) return false; 
      if (text.includes('|') || text.includes('—')) return false; 
      return true;
    });

console.log("Candidate Bullets and Scores:");
for (const b of candidateBullets) {
    const s = scoreBulletQuality(b, []);
    console.log(`\nScore: ${s.total} (${JSON.stringify(s.breakdown)})`);
    console.log(`Text: ${b}`);
}

