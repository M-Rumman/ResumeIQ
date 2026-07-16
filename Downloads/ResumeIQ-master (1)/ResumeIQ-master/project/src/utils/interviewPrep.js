/**
 * ResuV — Local Interview Preparation Engine
 * ----------------------------------------------
 * Generates role-aware interview content from role, experience level, and skills.
 * Template-driven and modular; add roles in ROLE_REGISTRY or questions in QUESTION_BANK.
 */

import { FREE_INTERVIEW_QUESTIONS_PER_CATEGORY } from '../lib/planConfig.js';

// ---------------------------------------------------------------------------
// Role registry (normalize user input → canonical role key)
// ---------------------------------------------------------------------------

export const ROLE_KEYS = {
  FRONTEND: 'frontend_developer',
  BACKEND: 'backend_developer',
  DATA_SCIENTIST: 'data_scientist',
  UI_UX: 'ui_ux_designer',
  MARKETING: 'marketing',
  SOFTWARE_ENGINEER: 'general_software_engineer',
};

/**
 * Map free-text role input to a canonical role id.
 * @param {string} roleInput
 * @returns {string} ROLE_KEYS value
 */
export function normalizeRole(roleInput) {
  const value = (roleInput || '').toLowerCase().trim();

  if (/front[\s-]?end|react|vue|angular/.test(value)) return ROLE_KEYS.FRONTEND;
  if (/back[\s-]?end|api|node|java|python\s*api/.test(value)) return ROLE_KEYS.BACKEND;
  if (/data\s*sci|machine\s*learning|ml\b|analytics/.test(value)) return ROLE_KEYS.DATA_SCIENTIST;
  if (/ui\/?ux|designer|product\s*design|figma/.test(value)) return ROLE_KEYS.UI_UX;
  if (/marketing|growth|seo|content\s*market/.test(value)) return ROLE_KEYS.MARKETING;
  if (/software|developer|engineer|full[\s-]?stack|swe/.test(value)) return ROLE_KEYS.SOFTWARE_ENGINEER;

  return ROLE_KEYS.SOFTWARE_ENGINEER;
}

export const EXPERIENCE_LEVELS = ['entry', 'mid', 'senior'];

/**
 * @param {string} level
 * @returns {'entry'|'mid'|'senior'}
 */
export function normalizeExperienceLevel(level) {
  const value = (level || 'mid').toLowerCase().trim();
  if (EXPERIENCE_LEVELS.includes(value)) return value;
  if (/junior|intern|graduate|entry/.test(value)) return 'entry';
  if (/senior|lead|principal|staff/.test(value)) return 'senior';
  return 'mid';
}

/**
 * Parse comma-separated or array skills into trimmed list.
 * @param {string|string[]} skillsInput
 * @returns {string[]}
 */
export function parseSkills(skillsInput) {
  if (Array.isArray(skillsInput)) {
    return skillsInput.map((s) => s.trim()).filter(Boolean);
  }
  return (skillsInput || '')
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
}

// ---------------------------------------------------------------------------
// Shared question pools (extend QUESTION_BANK per category)
// ---------------------------------------------------------------------------

const UNIVERSAL_HR = [
  {
    question: 'Tell me about yourself.',
    tip: 'Summarize your role, years of experience, top skills, and why this position fits your goals in 60–90 seconds.',
  },
  {
    question: 'Why do you want this role?',
    tip: 'Connect your strengths and career direction to the team’s mission and the role’s responsibilities.',
  },
  {
    question: 'What are your salary expectations?',
    tip: 'Research market ranges for your level and location. Give a range or ask about their band first.',
  },
];

const UNIVERSAL_BEHAVIORAL = [
  {
    question: 'Describe a challenging problem you solved.',
    tip: 'Use STAR: Situation, Task, Action, Result — emphasize your specific contribution.',
  },
  {
    question: 'Tell me about a time you received critical feedback.',
    tip: 'Show humility, what you changed, and the positive outcome afterward.',
  },
  {
    question: 'Describe a time you worked under a tight deadline.',
    tip: 'Highlight prioritization, communication, and how you delivered quality on time.',
  },
];

const UNIVERSAL_COMMUNICATION = [
  'Speak in short paragraphs; pause briefly before answering complex questions.',
  'Repeat the question in your own words if you need a moment to structure your answer.',
  'Use concrete examples instead of general claims whenever possible.',
  'Ask one clarifying question if the prompt is ambiguous — it shows thoughtful communication.',
];

const UNIVERSAL_PREP = [
  'Research the company’s product, customers, and recent news.',
  'Prepare 3–5 STAR stories you can adapt to behavioral questions.',
  'Test your camera, mic, and internet if the interview is remote.',
  'Prepare 2 thoughtful questions to ask the interviewer about the team and role.',
];

/** Extra questions added for Pro (premium interview sets). */
const PREMIUM_HR_QUESTIONS = [
  {
    question: 'How do you handle competing priorities from multiple stakeholders?',
    tip: 'Show alignment frameworks, communication cadence, and a recent example with a clear trade-off decision.',
  },
  {
    question: 'What would you accomplish in your first 90 days?',
    tip: 'Break into learn, contribute, and scale phases tied to role metrics.',
  },
];

const PREMIUM_BEHAVIORAL_QUESTIONS = [
  {
    question: 'Tell me about a time you influenced without authority.',
    tip: 'Focus on data, empathy, and the business outcome — not politics.',
  },
  {
    question: 'Describe a project where you had to learn a new technology quickly.',
    tip: 'Explain your learning plan, resources used, and delivery timeline.',
  },
];

const PREMIUM_COMMUNICATION_TIPS = [
  'Mirror the interviewer’s communication style while staying concise and structured.',
  'End strong: thank them and restate your interest with one specific reason tied to the role.',
];

const PREMIUM_PREP_SUGGESTIONS = [
  'Prepare a one-page cheat sheet of metrics and project outcomes you can reference mentally.',
  'Run a mock interview aloud and time answers to stay within 90–120 seconds per behavioral response.',
];

const FREE_QUESTIONS_PER_CATEGORY = FREE_INTERVIEW_QUESTIONS_PER_CATEGORY;
const FREE_TIPS_LIMIT = 2;
const FREE_STAR_TIPS_LIMIT = 4;

/**
 * Apply Free vs Pro limits to generated prep content.
 * @param {object} prep - full prep object from engine
 * @param {'free'|'pro'} tier
 */
export function applyInterviewTier(prep, tier) {
  if (tier === 'pro') {
    return {
      ...prep,
      hrQuestions: [...prep.hrQuestions, ...PREMIUM_HR_QUESTIONS],
      behavioralQuestions: [...prep.behavioralQuestions, ...PREMIUM_BEHAVIORAL_QUESTIONS],
      communicationTips: [...prep.communicationTips, ...PREMIUM_COMMUNICATION_TIPS],
      preparationSuggestions: [...prep.preparationSuggestions, ...PREMIUM_PREP_SUGGESTIONS],
    };
  }

  return {
    ...prep,
    technicalQuestions: prep.technicalQuestions.slice(0, FREE_QUESTIONS_PER_CATEGORY),
    hrQuestions: prep.hrQuestions.slice(0, FREE_QUESTIONS_PER_CATEGORY),
    behavioralQuestions: prep.behavioralQuestions.slice(0, FREE_QUESTIONS_PER_CATEGORY),
    communicationTips: prep.communicationTips.slice(0, FREE_TIPS_LIMIT),
    preparationSuggestions: prep.preparationSuggestions.slice(0, FREE_TIPS_LIMIT),
    starTips: prep.starTips.slice(0, FREE_STAR_TIPS_LIMIT),
  };
}

/** Role-specific content templates */
export const ROLE_REGISTRY = {
  [ROLE_KEYS.FRONTEND]: {
    label: 'Frontend Developer',
    technical: [
      { question: 'Explain the React component lifecycle / hooks model.', tip: 'Cover rendering, state, effects, and when to memoize.' },
      { question: 'How do you improve Core Web Vitals (LCP, CLS, INP)?', tip: 'Mention lazy loading, image sizing, code splitting, and profiling.' },
      { question: 'What is your approach to accessible UI development?', tip: 'Reference semantic HTML, ARIA, keyboard nav, and contrast.' },
    ],
    behavioral: [
      { question: 'Tell me about a UI bug that was hard to reproduce.', tip: 'Explain debugging steps, browser tools, and how you prevented recurrence.' },
    ],
    prep: ['Review your portfolio or GitHub for 2–3 projects you can demo in depth.'],
  },
  [ROLE_KEYS.BACKEND]: {
    label: 'Backend Developer',
    technical: [
      { question: 'How do you design RESTful APIs?', tip: 'Discuss resources, status codes, versioning, and error handling.' },
      { question: 'Explain database indexing and when it helps.', tip: 'Cover query plans, composite indexes, and trade-offs on writes.' },
      { question: 'How do you handle authentication and authorization?', tip: 'Mention JWT/sessions, OAuth, RBAC, and security best practices.' },
    ],
    behavioral: [
      { question: 'Describe an outage or performance issue you helped resolve.', tip: 'Focus on monitoring, root cause, and post-incident improvements.' },
    ],
    prep: ['Be ready to discuss scaling, caching, and one system design diagram on a whiteboard.'],
  },
  [ROLE_KEYS.DATA_SCIENTIST]: {
    label: 'Data Scientist',
    technical: [
      { question: 'Walk through a machine learning project end to end.', tip: 'Cover problem framing, data, model choice, metrics, and deployment.' },
      { question: 'How do you handle imbalanced datasets?', tip: 'Discuss resampling, class weights, and appropriate metrics.' },
      { question: 'Explain bias–variance tradeoff.', tip: 'Use a simple example and how you tune models.' },
    ],
    behavioral: [
      { question: 'Tell me about a time your analysis changed a business decision.', tip: 'Quantify impact and how you communicated uncertainty.' },
    ],
    prep: ['Prepare to explain one notebook or analysis with clear business outcomes.'],
  },
  [ROLE_KEYS.UI_UX]: {
    label: 'UI/UX Designer',
    technical: [
      { question: 'Walk through your design process from research to handoff.', tip: 'Include discovery, wireframes, prototyping, and developer collaboration.' },
      { question: 'How do you validate designs with users?', tip: 'Mention usability tests, interviews, and iteration based on feedback.' },
      { question: 'How do you maintain design systems?', tip: 'Cover components, tokens, documentation, and consistency.' },
    ],
    behavioral: [
      { question: 'Describe a time you had to push back on a stakeholder request.', tip: 'Show user advocacy, data, and collaborative resolution.' },
    ],
    prep: ['Have a case study ready: problem, process, solution, and measurable results.'],
  },
  [ROLE_KEYS.MARKETING]: {
    label: 'Marketing',
    technical: [
      { question: 'How do you measure campaign success?', tip: 'Discuss KPIs: CTR, conversion, CAC, ROAS, and attribution basics.' },
      { question: 'Describe your experience with SEO or content strategy.', tip: 'Mention keyword research, content pillars, and performance tracking.' },
      { question: 'What tools have you used for analytics and automation?', tip: 'Name platforms you know and how you used them in campaigns.' },
    ],
    behavioral: [
      { question: 'Tell me about a campaign that underperformed and what you did next.', tip: 'Show analysis, iteration, and learning — not blame.' },
    ],
    prep: ['Bring 1–2 campaign examples with goals, tactics, and results.'],
  },
  [ROLE_KEYS.SOFTWARE_ENGINEER]: {
    label: 'Software Engineer',
    technical: [
      { question: 'Explain a recent project and your technical decisions.', tip: 'Cover requirements, architecture, trade-offs, and outcomes.' },
      { question: 'How do you approach debugging production issues?', tip: 'Logs, reproduction, isolation, fix, test, and postmortem.' },
      { question: 'Describe your experience with version control and code review.', tip: 'Mention branching strategy, PR quality, and collaboration.' },
    ],
    behavioral: [
      { question: 'Tell me about a time you mentored or unblocked a teammate.', tip: 'Emphasize collaboration and team impact.' },
    ],
    prep: ['Review fundamentals for your stack plus one system design topic.'],
  },
};

// ---------------------------------------------------------------------------
// Experience-level modifiers (adjust depth of questions & tips)
// ---------------------------------------------------------------------------

const LEVEL_PREFIX = {
  entry: 'As an entry-level candidate, ',
  mid: '',
  senior: 'As a senior candidate, ',
};

/**
 * Tailor a question/tip pair for experience level.
 * @param {{ question: string, tip: string }} item
 * @param {'entry'|'mid'|'senior'} level
 */
export function tailorForLevel(item, level) {
  const prefix = LEVEL_PREFIX[level] || '';
  if (level === 'entry') {
    return {
      question: item.question,
      tip: `${prefix}${item.tip} Highlight coursework, internships, or personal projects if work history is limited.`,
    };
  }
  if (level === 'senior') {
    return {
      question: item.question,
      tip: `${prefix}${item.tip} Emphasize leadership, scope, and cross-team impact in your examples.`,
    };
  }
  return { ...item };
}

/**
 * Generate skill-specific technical questions from user-provided skills.
 * @param {string[]} skills
 * @param {string} roleKey
 */
export function buildSkillQuestions(skills, roleKey) {
  if (!skills.length) return [];

  return skills.slice(0, 4).map((skill) => ({
    question: `What is your experience with ${skill}?`,
    tip: `Prepare one project example where you used ${skill}, including challenges and measurable results.`,
  }));
}

/**
 * STAR method tips (shared across roles).
 */
export function getStarTips(level) {
  const base = [
    'Situation: Set the context briefly — 1–2 sentences max.',
    'Task: Describe your specific responsibility in that situation.',
    'Action: Explain what YOU did step by step. Focus on your actions, not the team.',
    'Result: Share a quantifiable outcome. Use numbers (%, $, time saved) where possible.',
    'Keep STAR answers between 90–120 seconds when spoken aloud.',
    'Prepare 5–7 STAR stories that can be adapted to different questions.',
  ];

  if (level === 'entry') {
    base.push('Include academic, internship, or volunteer examples if work history is limited.');
  }
  if (level === 'senior') {
    base.push('Include examples of mentoring, technical direction, or stakeholder alignment.');
  }

  return base;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Generate full interview preparation content.
 *
 * @param {object} input
 * @param {string} input.role - Target role (free text or canonical label)
 * @param {string} [input.experienceLevel='mid'] - entry | mid | senior
 * @param {string|string[]} [input.skills=''] - Comma-separated or array
 * @param {'free'|'pro'} [input.tier='free'] - Plan tier for question sets
 * @returns {object} Structured interview prep payload
 */
export function generateInterviewPrep(input = {}) {
  const roleInput = input.role || '';
  const experienceLevel = normalizeExperienceLevel(input.experienceLevel);
  const skills = parseSkills(input.skills);
  const tier = input.tier === 'pro' ? 'pro' : 'free';
  const roleKey = normalizeRole(roleInput);
  const rolePack = ROLE_REGISTRY[roleKey] || ROLE_REGISTRY[ROLE_KEYS.SOFTWARE_ENGINEER];

  const technical = [
    ...rolePack.technical.map((q) => tailorForLevel(q, experienceLevel)),
    ...buildSkillQuestions(skills, roleKey).map((q) => tailorForLevel(q, experienceLevel)),
  ];

  const hr = UNIVERSAL_HR.map((q) => tailorForLevel(q, experienceLevel));

  const behavioral = [
    ...UNIVERSAL_BEHAVIORAL.map((q) => tailorForLevel(q, experienceLevel)),
    ...(rolePack.behavioral || []).map((q) => tailorForLevel(q, experienceLevel)),
  ];

  const communicationTips = [...UNIVERSAL_COMMUNICATION];
  if (skills.length) {
    communicationTips.push(
      `When discussing ${skills.slice(0, 3).join(', ')}, link each skill to a specific project story.`,
    );
  }

  const preparationSuggestions = [
    ...UNIVERSAL_PREP,
    ...(rolePack.prep || []),
    `Target role: ${roleInput.trim() || rolePack.label} (${experienceLevel} level).`,
  ];

  if (skills.length) {
    preparationSuggestions.push(`Review fundamentals for: ${skills.join(', ')}.`);
  }

  const fullPrep = {
    role: roleInput.trim() || rolePack.label,
    roleKey,
    roleLabel: rolePack.label,
    experienceLevel,
    skills,
    technicalQuestions: technical,
    hrQuestions: hr,
    behavioralQuestions: behavioral,
    communicationTips,
    preparationSuggestions,
    starTips: getStarTips(experienceLevel),
    meta: {
      generatedAt: new Date().toISOString(),
      engine: 'interviewPrep-local-v1',
      tier,
    },
  };

  return applyInterviewTier(fullPrep, tier);
}

/**
 * Map engine output to InterviewPrepPage / Supabase shape.
 * @param {ReturnType<typeof generateInterviewPrep>} prep
 */
/**
 * @param {{ question: string; tip: string; idealAnswer?: string; followUps?: string[] }} q
 */
function enrichInterviewQuestion(q) {
  return {
    ...q,
    idealAnswer:
      q.idealAnswer ||
      `Structure your response clearly. ${q.tip} Include a specific example and at least one measurable outcome.`,
    followUps: q.followUps || [],
  };
}

export function toInterviewDisplayResults(prep) {
  return {
    hr: prep.hrQuestions.map(enrichInterviewQuestion),
    technical: prep.technicalQuestions.map(enrichInterviewQuestion),
    behavioral: prep.behavioralQuestions.map(enrichInterviewQuestion),
    starTips: prep.starTips,
    communicationTips: prep.communicationTips,
    preparationSuggestions: prep.preparationSuggestions,
    engine: prep,
  };
}
