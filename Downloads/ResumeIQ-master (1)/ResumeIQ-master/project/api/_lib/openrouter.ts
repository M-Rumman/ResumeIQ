import {
  logOpenRouterDiagnostics,
  maskApiKey,
  readOpenRouterKeyFromEnv,
} from './openrouterDiagnostics.js';
import { getAppBaseUrl } from './appUrl.js';
import {
  parseResumeText,
  sanitizeResumeContentLine,
  type StructuredResume,
} from './resumeParser.js';
import { validateAiResumeOutput } from './aiValidation.js';
import {
  planInterviewRecommendations,
  planResumeRecommendations,
} from './recommendationPlanner.js';
import { rankMissingSkills } from './missingSkillRanking.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** Less popular free models first — avoids shared Llama 3.3 70B rate limits. */
const DEFAULT_MODEL = 'qwen/qwen3-235b-a22b:free';

const MODEL_FALLBACKS = [
  'google/gemma-4-26b-a4b-it:free',
  'openai/gpt-oss-20b:free',
  'liquid/lfm-2.5-1.2b-instruct:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'z-ai/glm-4.5-air:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'qwen/qwen3-coder:free',
  'google/gemma-4-31b-it:free',
  'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
  'openai/gpt-oss-120b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-3.1-8b-instruct',
] as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Trim whitespace/quotes — common copy-paste mistakes in Vercel env vars. */
function resolveOpenRouterApiKey(): string {
  const key = readOpenRouterKeyFromEnv();

  if (!key) {
    throw new Error(
      'OPENROUTER_API_KEY is not configured. On Vercel: Project Settings → Environment Variables → add OPENROUTER_API_KEY (no VITE_ prefix), then redeploy Production.',
    );
  }

  if (!key.startsWith('sk-or-')) {
    throw new Error(
      'OPENROUTER_API_KEY looks invalid (should start with sk-or-). Create a new key at openrouter.ai/keys.',
    );
  }

  return key;
}

function getModelCandidates(preferred?: string): string[] {
  const fromEnv = process.env.OPENROUTER_MODEL?.trim();
  const candidates = [preferred, DEFAULT_MODEL, ...MODEL_FALLBACKS, fromEnv].filter(
    (m): m is string => Boolean(m),
  );
  return [...new Set(candidates)];
}

/** Try the next model when a provider is missing or temporarily overloaded. */
function isRetryableProviderError(status: number, body: string): boolean {
  const lower = body.toLowerCase();
  if (status === 404 && /no endpoints found/i.test(body)) return true;
  if (status === 429) return true;
  if (status === 503) return true;
  if (/rate.?limit|temporarily rate-limited|overloaded|capacity|try again/i.test(lower)) {
    return true;
  }
  return false;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ParsedResume {
  name: string;
  email: string;
  phone: string;
  location: string;
  education: string[];
  skills: string[];
  experience: string[];
  projects: string[];
  certifications: string[];
  summary?: string;
  awards?: string[];
  publications?: string[];
  links?: { url: string; anchorText: string }[];
}

export interface AiResumeAnalysisFull {
  parsed: ParsedResume;
  atsScore: number;
  matchScore: number;
  existingSkills: string[];
  missingSkills: string[];
  missingKeywords: string[];
  keywordGaps: string[];
  missingRequiredSkills: string[];
  detectedSections: string[];
  missingSections: string[];
  formattingIssues: string[];
  formattingSuggestions: string[];
  weakBullets: string[];
  improvedBulletPoints: { before: string; after: string }[];
  improvementSuggestions: string[];
  optimizationRecommendations: string[];
  keywordSuggestions: string[];
  atsIssues: string[];
  atsScoreExplanation: {
    strengths: string[];
    missingElements: string[];
    formattingIssues: string[];
    keywordIssues: string[];
  };
  jobMatchExplanation: {
    strongMatches: string[];
    partialMatches: string[];
    missingSkills: string[];
  };
}

export interface AiInterviewQuestionFull {
  question: string;
  idealAnswer: string;
  tip: string;
  followUpQuestions: string[];
}

export interface AiInterviewPrepFull {
  technicalQuestions: AiInterviewQuestionFull[];
  behavioralQuestions: AiInterviewQuestionFull[];
  hrQuestions: AiInterviewQuestionFull[];
  preparationRoadmap: string[];
  communicationTips: string[];
  preparationSuggestions: string[];
}

export async function callOpenRouter(
  messages: ChatMessage[],
  options: { model?: string; maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  logOpenRouterDiagnostics('callOpenRouter');
  const apiKey = resolveOpenRouterApiKey();
  const models = getModelCandidates(options.model);
  let lastError: Error | null = null;

  console.info('[openrouter] request start', {
    modelCandidates: models.slice(0, 3),
    keyMasked: maskApiKey(apiKey),
    referer: getAppBaseUrl(),
  });

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': getAppBaseUrl(),
          'X-Title': 'ResuV',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: options.maxTokens ?? 4096,
          temperature: options.temperature ?? 0.25,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('[openrouter] response error', {
          model,
          status: response.status,
          bodyPreview: text.slice(0, 200),
        });
        if (response.status === 401) {
          throw new Error(
            'OpenRouter rejected your API key (401). Create a new key at openrouter.ai/keys. On Vercel, set OPENROUTER_API_KEY under Project Settings → Environment Variables and redeploy.',
          );
        }
        lastError = new Error(`OpenRouter error ${response.status}: ${text.slice(0, 280)}`);
        const hasMoreModels = i < models.length - 1;
        if (hasMoreModels && isRetryableProviderError(response.status, text)) {
          await sleep(response.status === 429 ? 1500 + i * 500 : 400);
          continue;
        }
        throw lastError;
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        lastError = new Error(`Empty OpenRouter response from model ${model}`);
        if (i < models.length - 1) {
          await sleep(400);
          continue;
        }
        continue;
      }

      console.info('[openrouter] success', { model, status: response.status });
      return content;
    } catch (err: any) {
      console.error('[openrouter] fetch throw', { model, err: err?.message || err });
      lastError = err instanceof Error ? err : new Error(String(err));
      if (i < models.length - 1) {
        await sleep(500);
        continue;
      }
    }
  }

  throw (
    lastError ||
    new Error(
      'All free AI models are busy (rate limited). Wait 1–2 minutes and try again.',
    )
  );
}

export function extractJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error('Could not parse JSON from model output');
  }
}

// ---------------------------------------------------------------------------
// SYSTEM PROMPTS (MODULAR PIPELINE ARCHITECTURE)
// ---------------------------------------------------------------------------

const RESUME_PARSER_SYSTEM_PROMPT = `You are a precise resume and job description parser.
You receive a structured resume JSON object and job description text. Return JSON only.
Use the provided resume values as source evidence. Preserve their content, categorize it structurally, and never invent projects, technologies, companies, metrics, certifications, or links.

Required JSON Schema:
{
  "resume": {
    "contact": {
      "name": "string",
      "email": "string",
      "phone": "string",
      "location": "string"
    },
    "summary": "string",
    "experience": ["string - exact experience bullets/lines from the resume"],
    "projects": ["string - exact project lines/descriptions from the resume"],
    "skills": ["string - list of skills from the resume"],
    "education": ["string - education details"],
    "certifications": ["string - certifications"],
    "awards": ["string - honors/awards"],
    "publications": ["string - publications"],
    "links": [
      { "url": "string", "anchorText": "string" }
    ]
  },
  "job": {
    "title": "string",
    "requiredSkills": ["string"],
    "preferredSkills": ["string"],
    "responsibilities": ["string"]
  }
}

Rules:
- Use the supplied contact and links fields for contact information. Never copy email addresses, phone numbers, URLs, or LinkedIn links into "experience", "projects", "skills", or "summary".
- Preserve supplied LinkedIn link data in the "links" array with anchorText: "LinkedIn" when available.

Respond with valid JSON only.`;

const ANALYZER_SYSTEM_PROMPT = `You are a senior ATS optimization and resume compliance system.
You are given a structured resume and a structured job description.
Perform the following analysis tasks and return valid JSON only. Ground every observation and suggestion in the supplied resume and job data. Never invent projects, technologies, companies, metrics, certifications, or other candidate facts.

INPUT DATA STRUCTURE:
You will receive JSON input containing:
1. "resume": Structured Resume (with "contact" and "links" stripped to avoid leaks).
2. "job": Structured Job Requirements.

TASKS TO PERFORM:

1. KEYWORD MATCHING & EXTRACTION:
   - Identify "existingSkills" and "missingSkills" first. "existingSkills" contains discrete technical skills directly evidenced in BOTH the structured resume and job requirements. "missingSkills" contains discrete technical job requirements absent from the structured resume.
   - Set "missingKeywords" equal to "missingSkills". Use "keywordSuggestions" and "keywordGaps" only for additional, non-duplicated missing technical skills.
   - A keyword may ONLY be a Programming Language, Framework, Library, Cloud Platform, Embedded Platform, Microcontroller, Protocol, Hardware technology, Software product, Tool, CAD Software, Simulation Software, Certification, or Technical Skill.
   - Each keyword must be a discrete 1-3 word proper technical term. Standard technical tokens such as "C++" and "C#" are allowed; otherwise do not use punctuation.
   - Never output sentence fragments, clauses, verbs, job duties, soft skills, or generic phrases. Reject forms such as "currently pursuing", "understanding of", "responsible for", "ability to", "knowledge of", and "familiar with".
   - Valid examples include "Firmware Development", "PCB Testing", "Arduino", "STM32", "ESP32", "Circuit Validation", "Sensor Integration", "Embedded Programming", "C++", "Proteus", and "LTSpice".
   - A skill already present in the structured resume MUST appear only in "existingSkills" and never in any missing-skill field. Do not invent candidate qualifications.

2. ATS & FORMATTING ANALYSIS:
   - Compute "atsScore" (0-100) and "matchScore" (0-100).
   - Explain the unchanged scores using the structured fields below. Do not alter either score to fit an explanation.
   - "atsScoreExplanation.strengths" must contain resume-specific positive observations; "missingElements" must contain absent resume elements; "formattingIssues" must contain concrete formatting/structure observations; and "keywordIssues" must contain missing technical requirements.
   - "jobMatchExplanation.strongMatches" must contain technical skills evidenced in both the resume and job data; "partialMatches" must contain relevant but incomplete evidence; and "missingSkills" must contain absent technical job requirements.
   - Detect present and missing standard resume sections ("detectedSections", "missingSections").
   - List formatting issues ("formattingIssues"), suggestions ("formattingSuggestions"), ATS compatibility issues ("atsIssues"), improvements ("improvementSuggestions"), and optimizations ("optimizationRecommendations").
   - For every suggestion/issue, you MUST assign a confidence score: "High" (directly supported by resume evidence), "Medium" (strong inference), or "Low" (general ATS best practice).
   - Resume-specific observations ONLY: Every observation must cite or clearly derive from supplied resume or job data. Do not claim a project, technology, company, certification, or metric exists unless it appears in the input.
   - When suggesting a measurable result for a bullet or recommendation, use placeholders such as "[X]%", "[X] users", or "[X] requests" unless that exact metric is in the supplied resume.
   - Global planning: Ensure no suggestion is duplicated or repeated across different categories. Each suggestion should be unique.

Required JSON output schema:
{
  "atsScore": number,
  "matchScore": number,
  "existingSkills": ["string"],
  "missingSkills": ["string"],
  "missingKeywords": ["string"],
  "keywordSuggestions": ["string"],
  "keywordGaps": ["string"],
  "missingRequiredSkills": ["string"],
  "detectedSections": ["string"],
  "missingSections": ["string"],
  "formattingIssues": [{ "text": "string", "confidence": "High" | "Medium" | "Low" }],
  "formattingSuggestions": [{ "text": "string", "confidence": "High" | "Medium" | "Low" }],
  "improvementSuggestions": [{ "text": "string", "confidence": "High" | "Medium" | "Low" }],
  "optimizationRecommendations": [{ "text": "string", "confidence": "High" | "Medium" | "Low" }],
  "atsIssues": [{ "text": "string", "confidence": "High" | "Medium" | "Low" }],
  "atsScoreExplanation": {
    "strengths": ["string"],
    "missingElements": ["string"],
    "formattingIssues": ["string"],
    "keywordIssues": ["string"]
  },
  "jobMatchExplanation": {
    "strongMatches": ["string"],
    "partialMatches": ["string"],
    "missingSkills": ["string"]
  }
}

Respond with valid JSON only.`;

const REWRITER_SYSTEM_PROMPT = `You are an expert resume editor. Identify weak bullet points in the provided experience and projects list and rewrite them.
The input contains ONLY experience and project content, plus an optional job title. Identify "weakBullets" only from those supplied content arrays.
Generate "improvedBulletPoints" as before/after pairs (MINIMUM 4 pairs).

Rules:
- ONLY rewrite supplied experience or project bullets. Never add a new bullet based on information outside those arrays.
- Every "after" bullet MUST begin with a strong, specific action verb. Prefer verbs such as Developed, Integrated, Implemented, Designed, Built, Optimized, Automated, Analyzed, Delivered, or Presented when they are truthful to the original bullet.
- Produce a materially stronger bullet, not a light paraphrase. Improve the sentence's clarity, professional tone, technical specificity, and readable action-to-contribution structure while preserving the original meaning.
- Surface technical contribution only when the original bullet explicitly provides the relevant technologies, tools, components, methods, or domain context. Do not add technical detail that is not in the supplied bullet.
- Strict Grounding: Do NOT invent or exaggerate projects, technologies, tools, employers, companies, certifications, scope, seniority, ownership, outcomes, or metrics.
- If quantification would materially improve a bullet but no supported metric exists, you MAY use one clearly marked placeholder such as [X]%, [X] users, [X] components, or [X] requests. Never fabricate a number, percentage, duration, or scale.
- Keep each rewrite to one concise resume bullet. Do not add explanations, section headings, contact information, URLs, emails, phone numbers, or LinkedIn references.
- If a bullet cannot be safely strengthened from its supplied content, omit it instead of inventing detail.

Required JSON Schema:
{
  "weakBullets": ["string"],
  "improvedBulletPoints": [
    { "before": "string", "after": "string" }
  ]
}

Respond with valid JSON only.`;

const INTERVIEW_SYSTEM_PROMPT = `You are a senior interview coach (like ChatGPT preparing someone for a job interview).
Respond with valid JSON only — no markdown.

Schema:
{
  "technicalQuestions": [{"question": "string", "idealAnswer": "string — 2-4 sentences", "tip": "string", "followUpQuestions": ["string"]}],
  "behavioralQuestions": [{"question": "string", "idealAnswer": "string — STAR format outline", "tip": "string", "followUpQuestions": ["string"]}],
  "hrQuestions": [{"question": "string", "idealAnswer": "string", "tip": "string", "followUpQuestions": ["string"]}],
  "preparationRoadmap": ["string — step-by-step prep plan, MINIMUM 5 steps"],
  "communicationTips": ["string — MINIMUM 4 tips"],
  "preparationSuggestions": ["string — MINIMUM 5 suggestions"]
}

Provide 5 questions per category tailored to the role and experience level.
idealAnswer must be complete and helpful — not one-liners.
followUpQuestions: 1-2 likely follow-ups per question.`;

// ---------------------------------------------------------------------------
// LOCAL & REGEX PARSING / EXTRACTION HELPERS
// ---------------------------------------------------------------------------

function extractLinksAndContactInfo(resumeText: string) {
  const links: { url: string; anchorText: string }[] = [];
  const emails = new Set<string>();
  const phones = new Set<string>();

  // Extract from the "Extracted Links:" section if appended by extractPdfText.js
  const extractedLinksMatch = resumeText.match(/Extracted Links:([\s\S]*)/i);
  if (extractedLinksMatch) {
    const section = extractedLinksMatch[1];
    const lines = section.split('\n').map(l => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('→ ')) {
        const url = lines[i].slice(2).trim();
        const anchorText = i > 0 && !lines[i - 1].startsWith('→ ') ? lines[i - 1] : url;
        links.push({ url, anchorText });
      }
    }
  }

  // Also scan the entire text for general URLs
  const urlRegex = /(https?:\/\/[^\s()<>]+)/gi;
  let match;
  while ((match = urlRegex.exec(resumeText)) !== null) {
    const url = match[1];
    if (!links.some(l => l.url === url)) {
      links.push({ url, anchorText: url });
    }
  }

  // Also check for case-insensitive "linkedin" anywhere in text
  const words = resumeText.split(/\s+/);
  for (const word of words) {
    if (/linkedin/i.test(word)) {
      const cleanWord = word.replace(/[()<>]/g, '').trim();
      if (!links.some(l => l.url.includes(cleanWord))) {
        links.push({ url: cleanWord, anchorText: 'LinkedIn' });
      }
    }
  }

  // Extract emails
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  while ((match = emailRegex.exec(resumeText)) !== null) {
    emails.add(match[0]);
  }

  // Extract phones
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3}[-.\s]?\d{3,4}(?:[-.\s]?\d{1,4})?/g;
  while ((match = phoneRegex.exec(resumeText)) !== null) {
    const phone = match[0].trim();
    if (phone.replace(/[-.\s()+]/g, '').length >= 7) {
      phones.add(phone);
    }
  }

  return { links, emails: [...emails], phones: [...phones] };
}

function toParserResumeInput(resume: StructuredResume) {
  return {
    contact: resume.contact,
    summary: resume.summary,
    experience: resume.experience,
    projects: resume.projects,
    skills: resume.skills,
    education: resume.education,
    certifications: resume.certifications,
    awards: resume.awards,
    languages: resume.languages,
    links: resume.links.items,
  };
}

function sanitizeContentArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(sanitizeResumeContentLine)
    .filter(Boolean);
}

/** Keeps locally extracted contact/link values separate from all content sections. */
function mergeParsedResume(modelResume: any, localResume: StructuredResume) {
  const model = modelResume && typeof modelResume === 'object' ? modelResume : {};
  const localOrModel = (
    key: keyof Pick<StructuredResume, 'experience' | 'projects' | 'skills' | 'education' | 'certifications' | 'awards' | 'languages'>,
  ) => localResume[key].length > 0 ? localResume[key] : sanitizeContentArray(model[key]);

  return {
    contact: localResume.contact,
    summary: localResume.summary || sanitizeResumeContentLine(String(model.summary || '')),
    experience: localOrModel('experience'),
    projects: localOrModel('projects'),
    skills: localOrModel('skills'),
    education: localOrModel('education'),
    certifications: localOrModel('certifications'),
    awards: localOrModel('awards'),
    languages: localOrModel('languages'),
    links: localResume.links.items,
  };
}

// ---------------------------------------------------------------------------
// VALIDATION & CLEANING FUNCTIONS (VALIDATION LAYER)
// ---------------------------------------------------------------------------

function validateAndCleanKeywords(keywords: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const forbiddenStarts = /^(?:currently pursuing|understanding of|responsible for|ability to|knowledge of|familiar with|worked|working|developed|developing|implemented|implementing|managed|managing|used|using)\b/i;
  const genericTerms = new Set([
    'ability', 'communication', 'experience', 'leadership', 'management', 'projects',
    'skills', 'teamwork', 'technology', 'work',
  ]);

  for (const kw of keywords) {
    if (!kw) continue;
    const cleaned = kw.trim();
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (!cleaned || words.length > 3 || !/^[A-Za-z0-9+# ]+$/.test(cleaned)) continue;
    const lower = cleaned.toLowerCase();
    if (cleaned.length < 2 || genericTerms.has(lower) || forbiddenStarts.test(cleaned)) continue;

    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(cleaned);
    }
  }

  return result;
}

function cleanRewrittenBullets(
  improvedBullets: { before: string; after: string }[],
  resumeText: string
): { before: string; after: string }[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const urlRegex = /https?:\/\/[^\s()<>]+/gi;
  const linkedinRegex = /linkedin/i;

  const result: { before: string; after: string }[] = [];
  const resumeLower = resumeText.toLowerCase();

  for (const pair of improvedBullets) {
    if (!pair || !pair.before || !pair.after) continue;
    let after = pair.after.trim();

    // 1. Check for email, URL, or LinkedIn in 'after' bullet
    const hasEmail = emailRegex.test(after);
    const hasUrl = urlRegex.test(after);
    const hasLinkedIn = linkedinRegex.test(after);

    if (hasEmail || hasUrl || hasLinkedIn) {
      after = pair.before;
    }

    // 2. Hallucination Guard: Ensure no numbers/percentages are fabricated
    const numRegex = /\b\d+(?:\.\d+)?%?\b/g;
    let match;
    let sanitizedAfter = after;
    numRegex.lastIndex = 0;
    while ((match = numRegex.exec(after)) !== null) {
      const numStr = match[0];
      if (!resumeText.includes(numStr)) {
        if (numStr.endsWith('%')) {
          sanitizedAfter = sanitizedAfter.replace(numStr, '[X]%');
        } else {
          sanitizedAfter = sanitizedAfter.replace(numStr, '[X]');
        }
      }
    }

    // 3. Grounding Guard: Capitalized Proper Nouns not in resume
    const words = sanitizedAfter.match(/\b[A-Z][a-zA-Z0-9+#.-]*\b/g) || [];
    let isFabricated = false;
    for (const word of words) {
      const commonWords = new Set(['The', 'A', 'An', 'I', 'Led', 'Developed', 'Delivered', 'Optimized', 'Implemented', 'Designed', 'Built', 'Created', 'Managed', 'In', 'On', 'At', 'With', 'By', 'For', 'And']);
      if (commonWords.has(word)) continue;
      if (!resumeLower.includes(word.toLowerCase())) {
        isFabricated = true;
        break;
      }
    }

    if (isFabricated) {
      sanitizedAfter = pair.before;
    }

    result.push({ before: pair.before, after: sanitizedAfter });
  }

  return result;
}

// ---------------------------------------------------------------------------
// SEMANTIC SIMILARITY & DEDUPLICATION (JS PLANNER LAYER)
// ---------------------------------------------------------------------------

export function isSemanticallySimilar(str1: string, str2: string): boolean {
  const words1 = new Set(
    str1
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
  const words2 = new Set(
    str2
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );

  if (words1.size === 0 || words2.size === 0) return false;

  let intersectionCount = 0;
  for (const w of words1) {
    if (words2.has(w)) {
      intersectionCount += 1;
    }
  }

  const similarity1 = intersectionCount / words1.size;
  const similarity2 = intersectionCount / words2.size;

  return similarity1 >= 0.75 || similarity2 >= 0.75;
}

function deduplicateAndPlanSuggestions(analysis: {
  formattingSuggestions: string[];
  formattingIssues: string[];
  weakBullets: string[];
  improvementSuggestions: string[];
  optimizationRecommendations: string[];
  atsIssues: string[];
}) {
  const seen = new Set<string>();

  const cleanAndFilter = (arr: string[]): string[] => {
    const result: string[] = [];
    for (const item of arr) {
      if (!item) continue;
      const trimmed = item.trim();
      if (!trimmed) continue;

      let isDuplicate = false;
      const lower = trimmed.toLowerCase();
      
      // Check exact
      if (seen.has(lower)) {
        continue;
      }

      // Check semantic similarity
      for (const existing of seen) {
        if (isSemanticallySimilar(existing, trimmed)) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        result.push(trimmed);
        seen.add(lower);
      }
    }
    return result;
  };

  analysis.atsIssues = cleanAndFilter(analysis.atsIssues);
  analysis.formattingIssues = cleanAndFilter(analysis.formattingIssues);
  analysis.weakBullets = cleanAndFilter(analysis.weakBullets);
  analysis.improvementSuggestions = cleanAndFilter(analysis.improvementSuggestions);
  analysis.optimizationRecommendations = cleanAndFilter(analysis.optimizationRecommendations);
  analysis.formattingSuggestions = cleanAndFilter(analysis.formattingSuggestions);
}

// ---------------------------------------------------------------------------
// NORMALIZATION LAYER
// ---------------------------------------------------------------------------

function normalizeResumeAnalysis(raw: any, resumeText: string): AiResumeAnalysisFull {
  const o = raw || {};
  const parsed = o.parsed || {
    name: '',
    email: '',
    phone: '',
    location: '',
    education: [],
    skills: [],
    experience: [],
    projects: [],
    certifications: [],
  };

  const arr = (v: any) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  const mapWithConfidence = (v: any) => {
    if (!Array.isArray(v)) return [];
    return v
      .filter((x: any) => {
        if (typeof x === 'string') return true;
        if (x && typeof x === 'object' && typeof x.text === 'string') {
          // Filter confidence: Only keep High and Medium
          const conf = String(x.confidence || 'High').toLowerCase();
          return conf === 'high' || conf === 'medium';
        }
        return false;
      })
      .map((x: any) => {
        if (typeof x === 'string') return x;
        return String(x.text);
      });
  };

  const bullets = Array.isArray(o.improvedBulletPoints)
    ? (o.improvedBulletPoints as { before?: string; after?: string }[])
        .filter((b) => b?.before && b?.after)
        .map((b) => ({ before: String(b.before), after: String(b.after) }))
    : [];

  const atsScore = Math.max(0, Math.min(100, Number(o.atsScore) || 0));
  const matchScore = Math.max(0, Math.min(100, Number(o.matchScore) || 0));

  // Keyword extraction clean logic
  const missingKeywords = validateAndCleanKeywords(arr(o.missingKeywords));
  const existingSkills = validateAndCleanKeywords(arr(o.existingSkills));
  const missingSkills = validateAndCleanKeywords(arr(o.missingSkills));
  const keywordSuggestions = validateAndCleanKeywords(arr(o.keywordSuggestions));
  const keywordGaps = validateAndCleanKeywords(arr(o.keywordGaps));
  const scoreExplanation = o.atsScoreExplanation || {};
  const jobMatchExplanation = o.jobMatchExplanation || {};

  const result: AiResumeAnalysisFull = {
    parsed: {
      name: String(parsed.name || ''),
      email: String(parsed.email || ''),
      phone: String(parsed.phone || ''),
      location: String(parsed.location || ''),
      education: arr(parsed.education),
      skills: arr(parsed.skills),
      experience: arr(parsed.experience),
      projects: arr(parsed.projects),
      certifications: arr(parsed.certifications),
    },
    atsScore,
    matchScore,
    existingSkills,
    missingSkills,
    missingKeywords,
    keywordSuggestions,
    keywordGaps,
    missingRequiredSkills: arr(o.missingRequiredSkills),
    detectedSections: arr(o.detectedSections),
    missingSections: arr(o.missingSections),
    formattingSuggestions: mapWithConfidence(o.formattingSuggestions),
    formattingIssues: mapWithConfidence(o.formattingIssues),
    weakBullets: arr(o.weakBullets),
    improvedBulletPoints: cleanRewrittenBullets(bullets, resumeText),
    improvementSuggestions: mapWithConfidence(o.improvementSuggestions),
    optimizationRecommendations: mapWithConfidence(o.optimizationRecommendations),
    atsIssues: mapWithConfidence(o.atsIssues),
    atsScoreExplanation: {
      strengths: arr(scoreExplanation.strengths),
      missingElements: arr(scoreExplanation.missingElements),
      formattingIssues: arr(scoreExplanation.formattingIssues),
      keywordIssues: arr(scoreExplanation.keywordIssues),
    },
    jobMatchExplanation: {
      strongMatches: arr(jobMatchExplanation.strongMatches),
      partialMatches: arr(jobMatchExplanation.partialMatches),
      missingSkills: arr(jobMatchExplanation.missingSkills),
    },
  };

  if (result.atsScoreExplanation.strengths.length === 0) {
    result.atsScoreExplanation.strengths = result.detectedSections.map((section) => `Detected ${section} section`);
  }
  if (result.atsScoreExplanation.missingElements.length === 0) {
    result.atsScoreExplanation.missingElements = result.missingSections;
  }
  if (result.atsScoreExplanation.formattingIssues.length === 0) {
    result.atsScoreExplanation.formattingIssues = result.formattingIssues;
  }
  if (result.atsScoreExplanation.keywordIssues.length === 0) {
    result.atsScoreExplanation.keywordIssues = result.missingKeywords;
  }
  if (result.jobMatchExplanation.strongMatches.length === 0) {
    result.jobMatchExplanation.strongMatches = result.existingSkills;
  }
  if (result.jobMatchExplanation.missingSkills.length === 0) {
    result.jobMatchExplanation.missingSkills = result.missingSkills.length > 0
      ? result.missingSkills
      : result.missingKeywords;
  }

  deduplicateAndPlanSuggestions(result);

  return result;
}

function normalizeInterviewPrep(raw: any): AiInterviewPrepFull {
  const o = raw || {};

  const mapQs = (v: any) => {
    if (!Array.isArray(v)) return [];
    return v
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const q = item as Record<string, any>;
        return {
          question: String(q.question || ''),
          idealAnswer: String(q.idealAnswer || ''),
          tip: String(q.tip || ''),
          followUpQuestions: Array.isArray(q.followUpQuestions)
            ? q.followUpQuestions.filter((f) => typeof f === 'string')
            : [],
        };
      })
      .filter((q) => q.question.length > 0);
  };

  const arr = (v: any) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

  return {
    technicalQuestions: mapQs(o.technicalQuestions),
    behavioralQuestions: mapQs(o.behavioralQuestions),
    hrQuestions: mapQs(o.hrQuestions),
    preparationRoadmap: arr(o.preparationRoadmap),
    communicationTips: arr(o.communicationTips),
    preparationSuggestions: arr(o.preparationSuggestions),
  };
}

// ---------------------------------------------------------------------------
// CORE EXPORTED API PIPELINE HANDLERS
// ---------------------------------------------------------------------------

export async function analyzeResumeWithAi(
  resumeText: string,
  jobDescription: string,
): Promise<AiResumeAnalysisFull> {
  // Step 1: deterministic parsing establishes safe sections before the LLM enriches them.
  const localResume = parseResumeText(resumeText);
  const parserResume = JSON.stringify(toParserResumeInput(localResume), null, 2);
  const parserUserContent = `Job Description:\n${jobDescription.slice(0, 6000)}\n\nStructured Resume JSON:\n${parserResume}`;
  console.info('[pipeline] Running Step 1: Resume & Job Parser');
  
  const parsedRaw = await callOpenRouter(
    [
      { role: 'system', content: RESUME_PARSER_SYSTEM_PROMPT },
      { role: 'user', content: parserUserContent },
    ],
    { maxTokens: 4000, temperature: 0.1 }
  );

  let parsedJson: any;
  try {
    parsedJson = extractJsonFromText(parsedRaw);
  } catch (err) {
    console.error('[pipeline] Parser failed, using default structure fallback', err);
    parsedJson = {
      resume: {
        contact: { name: '', email: '', phone: '', location: '' },
        summary: localResume.summary,
        experience: localResume.experience,
        projects: localResume.projects,
        skills: localResume.skills,
        education: localResume.education,
        certifications: localResume.certifications,
        awards: localResume.awards,
        languages: localResume.languages,
        links: []
      },
      job: {
        title: '',
        requiredSkills: [],
        preferredSkills: [],
        responsibilities: []
      }
    };
  }

  parsedJson.resume = mergeParsedResume(parsedJson.resume, localResume);

  // Step 2 & 3: Run Analyzer and Rewriter in Parallel
  // Strip contact and links from the rewriter/analyzer inputs to prevent leakage
  const safeResumeForAnalysis = {
    summary: parsedJson.resume.summary,
    experience: parsedJson.resume.experience,
    projects: parsedJson.resume.projects,
    skills: parsedJson.resume.skills,
    education: parsedJson.resume.education,
    certifications: parsedJson.resume.certifications,
    awards: parsedJson.resume.awards,
    publications: parsedJson.resume.publications,
  };

  const analysisUserContent = JSON.stringify({
    resume: safeResumeForAnalysis,
    job: parsedJson.job
  }, null, 2);

  const rewriterUserContent = JSON.stringify({
    experience: parsedJson.resume.experience,
    projects: parsedJson.resume.projects,
    jobTitle: parsedJson.job.title
  }, null, 2);

  console.info('[pipeline] Running Step 2 & 3: Parallel Analyzer and Rewriter');
  
  const [analysisRaw, rewriterRaw] = await Promise.all([
    callOpenRouter(
      [
        { role: 'system', content: ANALYZER_SYSTEM_PROMPT },
        { role: 'user', content: analysisUserContent }
      ],
      { maxTokens: 4000, temperature: 0.2 }
    ),
    callOpenRouter(
      [
        { role: 'system', content: REWRITER_SYSTEM_PROMPT },
        { role: 'user', content: rewriterUserContent }
      ],
      { maxTokens: 3000, temperature: 0.3 }
    )
  ]);

  let analysisJson: any = {};
  let rewriterJson: any = {};

  try {
    analysisJson = extractJsonFromText(analysisRaw);
  } catch (err) {
    console.error('[pipeline] Analysis JSON parsing failed', err);
  }

  try {
    rewriterJson = extractJsonFromText(rewriterRaw);
  } catch (err) {
    console.error('[pipeline] Rewriter JSON parsing failed', err);
  }

  // Combine and validate final structure
  const combinedRaw = {
    parsed: parsedJson.resume,
    atsScore: analysisJson.atsScore || 70,
    matchScore: analysisJson.matchScore || 50,
    existingSkills: analysisJson.existingSkills || [],
    missingSkills: analysisJson.missingSkills || analysisJson.missingKeywords || [],
    missingKeywords: analysisJson.missingSkills || analysisJson.missingKeywords || [],
    keywordSuggestions: analysisJson.keywordSuggestions || [],
    keywordGaps: analysisJson.keywordGaps || [],
    missingRequiredSkills: analysisJson.missingRequiredSkills || [],
    detectedSections: analysisJson.detectedSections || [],
    missingSections: analysisJson.missingSections || [],
    formattingIssues: analysisJson.formattingIssues || [],
    formattingSuggestions: analysisJson.formattingSuggestions || [],
    weakBullets: rewriterJson.weakBullets || analysisJson.weakBullets || [],
    improvedBulletPoints: rewriterJson.improvedBulletPoints || [],
    improvementSuggestions: analysisJson.improvementSuggestions || [],
    optimizationRecommendations: analysisJson.optimizationRecommendations || [],
    atsIssues: analysisJson.atsIssues || [],
    atsScoreExplanation: analysisJson.atsScoreExplanation || {},
    jobMatchExplanation: analysisJson.jobMatchExplanation || {},
  };

  return normalizeResumeAnalysis(
    planResumeRecommendations(
      rankMissingSkills(validateAiResumeOutput(combinedRaw, resumeText), jobDescription),
      resumeText,
    ),
    resumeText,
  );
}

export async function generateInterviewPrepWithAi(
  jobRole: string,
  experienceLevel: string,
  skills: string,
): Promise<AiInterviewPrepFull> {
  const user = `Role: ${jobRole}\nExperience level: ${experienceLevel}\nKey skills / focus: ${skills || 'general'}`;

  const raw = await callOpenRouter(
    [
      { role: 'system', content: INTERVIEW_SYSTEM_PROMPT },
      { role: 'user', content: user },
    ],
    { maxTokens: 4000, temperature: 0.4 },
  );

  return normalizeInterviewPrep(planInterviewRecommendations(extractJsonFromText(raw) as Record<string, any>));
}
