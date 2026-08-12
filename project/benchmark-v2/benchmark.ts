import { loadReranker } from './localModels.js';
import { parseJdV2 } from './jdParserV2.js';
import { parseResumeV2 } from './resumeParserV2.js';

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
`;

async function runBenchmark() {
  console.log('--- Starting V2 Architecture Benchmark ---');
  
  const startTime = Date.now();
  console.log('1. Loading Local Models (Cold Start Test)...');
  const reranker = await loadReranker();
  const modelLoadTime = Date.now() - startTime;
  console.log(`Models loaded in ${modelLoadTime}ms`);

  console.log('2. Parsing JD (Deterministic V2)...');
  const jdParseStart = Date.now();
  const parsedJd = parseJdV2(priyaJd);
  console.log(`JD Parsed in ${Date.now() - jdParseStart}ms`);
  console.log(`Extracted ${parsedJd.requirements.length} requirements.`);

  console.log('3. Parsing Resume (Deterministic + NER V2)...');
  const resumeParseStart = Date.now();
  const candidate = await parseResumeV2(priyaResume);
  console.log(`Resume Parsed in ${Date.now() - resumeParseStart}ms`);
  console.log(`Extracted ${candidate.facts.length} facts.`);
  
  console.log('4. Matching Requirements via Local BGE Reranker...');
  const matchStart = Date.now();
  
  for (const req of parsedJd.requirements) {
    let bestScore = -Infinity;
    let bestFact = null;
    
    for (const fact of candidate.facts) {
      const score = await reranker(req.source_text, fact.rawText);
      if (score > bestScore) {
        bestScore = score;
        bestFact = fact;
      }
    }
    
    let classification = 'MISSING';
    if (bestScore > 0.7) classification = 'EXACT_MATCH';
    else if (bestScore > 0.4) classification = 'STRONG_SEMANTIC_MATCH';
    else if (bestScore > 0.2) classification = 'PARTIAL_MATCH';
    else if (bestScore > 0) classification = 'RELATED_MATCH';
    
    console.log(`\nRequirement: "${req.source_text}"`);
    console.log(`-> Classification: ${classification} (Score: ${bestScore.toFixed(3)})`);
    if (bestFact) {
        console.log(`-> Best Evidence: "${bestFact.rawText}"`);
    }
  }
  
  console.log(`\nMatching completed in ${Date.now() - matchStart}ms`);
  console.log(`Total Benchmark Pipeline Latency (Warm): ${Date.now() - jdParseStart}ms`);
}

runBenchmark().catch(console.error);
