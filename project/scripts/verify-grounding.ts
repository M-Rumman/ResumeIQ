import { extractCandidateProfile } from '../api/_lib/analysis-engine/resumeExtraction.js';
import { validateRewrites } from '../api/_lib/aiValidation.js';

const priyaResume = `
Priya Chandran
Chicago, IL

SUMMARY
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

async function run() {
  const candidateProfile = await extractCandidateProfile(priyaResume);

  const candidateContexts = candidateProfile.facts
    .filter(f => f.type === 'experience' || f.type === 'project')
    .flatMap(f => f.evidence.split('\n').map(line => ({
      text: line.replace(/^[•\-\*·\s]+/, '').trim(),
      sourceContext: f.rawText
    })))
    .filter(b => {
      const text = b.text;
      if (text.length < 30) return false;
      if (/\b(?:19|20)\d{2}\b/.test(text)) return false; 
      if (text.includes('|') || text.includes('—')) return false; 
      return true;
    });

  const rawAiOutput = [
    {
      before: 'Supported research for a personal finance app, conducting interviews and moderated usability testing',
      // The LLM maliciously transfers the 100+ metric from Cardstack Financial
      after: 'Conducted 100+ user interviews and moderated usability tests for a personal finance app, uncovering key pain points in budgeting workflows',
      confidence: 'High'
    },
    {
      before: 'Supported research for a personal finance app, conducting interviews and moderated usability testing ',
      // A legitimate rewrite using facts from the SAME Meterly bullet block
      after: 'Conducted interviews and moderated usability testing for a personal finance app, synthesizing findings into personas and journey maps used across design and product teams',
      confidence: 'High'
    }
  ];

  const validatedMalicious = validateRewrites([rawAiOutput[0]], priyaResume, [], candidateContexts);
  const validatedLegitimate = validateRewrites([rawAiOutput[1]], priyaResume, [], candidateContexts);

  console.log("--- BULLET REWRITE VALIDATION REPORT ---");
  for (const v of [...validatedMalicious, ...validatedLegitimate]) {
    const ctx = candidateContexts.find(c => c.text === v.before);
    console.log(`\nOriginal: ${v.before}`);
    console.log(`Context: ${ctx?.sourceContext.split('\\n')[0]}`); // Print just the header for brevity
    console.log(`Generated: ${v.after}`);
    
    const beforeMetrics = (v.before.match(/\\b\\d+(?:\\.\\d+)?%?\\b/g) || []);
    const afterMetrics = (v.after.match(/\\b\\d+(?:\\.\\d+)?%?\\b/g) || []);
    console.log(`Metrics Used: ${afterMetrics.length ? afterMetrics.join(', ') : 'None'}`);
    
    if (v.after === v.before) {
       console.log(`Grounding Result: REJECTED (Fallback to original)`);
       console.log(`Suggestion Displayed: No`);
    } else {
       console.log(`Grounding Result: ACCEPTED`);
       console.log(`Suggestion Displayed: Yes`);
    }
    console.log(`Grounding Confidence: ${v.groundingConfidence}`);
  }
}

run();
