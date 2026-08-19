import { scoreBulletQuality } from '../api/_lib/analysis-engine/bulletScoring.js';

const targetKeywords = [
  'UX research',
  'fintech',
  'consumer banking',
  'generative research',
  'evaluative research',
  'mobile banking',
  'usability tests',
  'interviews',
  'surveys',
];

const bullets = [
  "Led generative and evaluative research across mobile banking redesign, informing a roadmap that increased feature adoption by 34%",
  "Built and managed a 5,000-person participant panel and centralized research repository, cutting study recruitment time by 50%",
  "Ran longitudinal diary studies on financial stress and money management habits, directly shaping a new budgeting tool",
  "Mentored 3 junior researchers and established research operations best practices adopted company-wide",
  "Regularly presented findings to VP and C-suite stakeholders, directly influencing quarterly product strategy",
  "Conducted 100+ usability tests and interviews across web and mobile lending products",
  "Designed and fielded quarterly surveys (NPS, CSAT) reaching 10,000+ customers"
];

bullets.forEach(b => {
  const score = scoreBulletQuality(b, targetKeywords);
  console.log(`\nBullet: ${b}`);
  console.log(`Score: ${score.total}`, score.breakdown);
});
