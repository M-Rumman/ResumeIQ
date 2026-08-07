import { runAnalysisPipeline } from './api/_lib/analysis-engine/pipeline.js';

const resumeText = `Priya Chandran
Chicago, IL

Senior UX Researcher with 7 years of experience leading mixed-methods research in fintech and consumer banking.

Experience:

2021–Present Senior UX Researcher, Cardstack Financial
- Led generative and evaluative research across mobile banking redesign
- Mentored 3 junior researchers
- Partnered with data science to triangulate clickstream analytics
- Regularly presented findings to VP and C-suite stakeholders
- Research findings directly shaped a budgeting tool and product roadmap

2019–2021 UX Researcher, Brightledger Bank

2018–2019 Associate UX Researcher, Lending Co

Education:
M.S. in Human-Computer Interaction — DePaul University, 2018
B.A. in Psychology — University of Illinois, 2016

Skills:
Qualitative & quantitative research methods, mixed-methods research, centralized research repository.
`;

const jdText = `The JD includes:

- 6+ years UX research
- fintech or banking industry experience
- mixed-methods UX research
- Master's Degree
- Lead end-to-end research studies
- Design and conduct research
- Translate findings into insights
- Mentor junior researchers
- Partner with data science
- Present findings to senior leadership
- Chicago, IL (Hybrid — 3 days onsite)
`;

async function test() {
  const result = await runAnalysisPipeline({
    resumeText,
    jobDescriptionText: jdText,
    includePremium: true
  });

  const report = result.legacyReport as any;
  for (const match of report.requirementBreakdown) {
    console.log(`\nRequirement: ${match.requirement.normalized_name}`);
    console.log(`Classification: ${match.classification}`);
    console.log(`Explanation: ${match.explanation}`);
    console.log(`Evidence:`, match.evidence);
  }
}

test().catch(console.error);
