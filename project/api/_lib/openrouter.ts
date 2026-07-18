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
import { validateAiResumeOutput, validateHiringManagerAssessment } from './aiValidation.js';
import {
  planInterviewRecommendations,
  planResumeRecommendations,
} from './recommendationPlanner.js';
import { rankMissingSkills } from './missingSkillRanking.js';
import {
  logAiEvent,
  textMetadata,
  type AiObservabilityContext,
} from './aiObservability.js';
import type { ValidationTelemetry } from './aiValidation.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** Paid primary model with a compatible paid fallback. */
const DEFAULT_MODEL = 'google/gemma-4-31b-it';

const MODEL_FALLBACKS = [
  'google/gemma-4-26b-a4b-it',
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
  keywordRecommendations: KeywordRecommendation[];
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
  recommendationPriorities: {
    critical: string[];
    important: string[];
    optional: string[];
  };
  atsScoreExplanation: {
    strengths: string[];
    missingElements: string[];
    formattingIssues: string[];
    keywordIssues: string[];
    whatIncreasedScore: string[];
    whatReducedScore: string[];
    topImprovements: string[];
    estimatedScoreImprovement: number;
    potentialAtsScore: number;
  };
  jobMatchExplanation: {
    strongMatches: string[];
    partialMatches: string[];
    missingSkills: string[];
  };
  hiringManagerAssessment: HiringManagerAssessment;
}

export type HiringDecision = 'Strong Match' | 'Good Match' | 'Potential Match' | 'Weak Match' | 'Poor Match';

export interface HiringManagerAssessment {
  overallDecision: HiringDecision;
  recruiterSummary: string;
  topReasonsToInterview: string[];
  topReasonsForRejection: string[];
  estimatedInterviewProbability: number;
  biggestImprovements: { text: string; estimatedImpact: number }[];
  confidence: 'High' | 'Medium' | 'Low';
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

export type AiPipelineStage = 'parser' | 'analyzer' | 'rewriter' | 'validation' | 'planner';

/** A safe, structured failure that can cross the API boundary without provider details. */
export class AiPipelineError extends Error {
  constructor(
    public readonly stage: AiPipelineStage,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AiPipelineError';
  }
}

export async function callOpenRouter(
  messages: ChatMessage[],
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    observability?: AiObservabilityContext;
    stage?: string;
  } = {},
): Promise<string> {
  logOpenRouterDiagnostics('callOpenRouter');
  const apiKey = resolveOpenRouterApiKey();
  const models = getModelCandidates(options.model);
  let lastError: Error | null = null;
  const prompt = messages.map((message) => message.content).join('\n');

  console.info('[openrouter] request start', {
    modelCandidates: models.slice(0, 3),
    keyMasked: maskApiKey(apiKey),
    referer: getAppBaseUrl(),
  });
  logAiEvent(options.observability, 'openrouter_request_started', {
    stage: options.stage || 'unknown',
    modelCandidates: models,
    maxTokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.25,
    ...textMetadata(prompt),
  });

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const requestStartedAt = Date.now();
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
        });
        logAiEvent(options.observability, 'openrouter_request_failed', {
          stage: options.stage || 'unknown',
          model,
          status: response.status,
          latencyMs: Date.now() - requestStartedAt,
          retryAttempt: i + 1,
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
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
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
      logAiEvent(options.observability, 'openrouter_request_completed', {
        stage: options.stage || 'unknown',
        model,
        status: response.status,
        latencyMs: Date.now() - requestStartedAt,
        promptTokens: data.usage?.prompt_tokens ?? null,
        completionTokens: data.usage?.completion_tokens ?? null,
        totalTokens: data.usage?.total_tokens ?? null,
      });
      return content;
    } catch (err: any) {
      console.error('[openrouter] fetch throw', { model, errorType: err instanceof Error ? err.name : 'unknown' });
      logAiEvent(options.observability, 'openrouter_request_exception', {
        stage: options.stage || 'unknown',
        model,
        latencyMs: Date.now() - requestStartedAt,
        retryAttempt: i + 1,
        errorType: err instanceof Error ? err.name : 'unknown',
      });
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
3. "gapAnalysis": Deterministic requirement-by-requirement comparison with status, resume evidence, and safe recommendation guidance.

JOB-SPECIFIC RECRUITER OPERATING RULE:
- Act as an experienced recruiter hiring ONLY for the supplied job, not as a generic resume reviewer.
- The gapAnalysis is the PRIMARY source for every later ATS observation, missing-skill result, score explanation, and recommendation. Preserve its MATCHED, PARTIALLY MATCHED, MISSING, and NOT APPLICABLE classifications unless the supplied resume evidence directly proves it wrong.
- Every recommendation MUST explicitly connect BOTH sides of the comparison: (1) a named job requirement, responsibility, or role-specific priority and (2) the exact resume section, bullet, project, skill, or absence that supports the observation.
- Use this reasoning pattern: "The [job title/requirement] requires or emphasizes [requirement]. Your [resume evidence/section] [shows, partially shows, or does not show] [connection]." Do not emit the pattern mechanically, but preserve both facts in every recommendation.
- For a MISSING item, recommend only truthful coursework, projects, or experience the candidate can add if applicable. For a PARTIALLY MATCHED item, recommend making the listed evidence explicit; never upgrade it to a full match without direct evidence.
- Complete all job-specific recommendations first. Generic resume advice is allowed only after no additional job-specific observation remains, and it must be placed last in its output array. Never prioritize generic advice over a role-specific gap.

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
   - Compute "matchScore" (0-100). The backend calculates "atsScore" deterministically from Resume Structure, Keyword Alignment, and Experience Alignment; do not attempt to adjust that score.
   - Explain the score drivers using the structured fields below. Do not invent score factors.
   - "atsScoreExplanation.strengths" must contain resume-specific positive observations; "missingElements" must contain absent resume elements; "formattingIssues" must contain concrete formatting/structure observations; and "keywordIssues" must contain missing technical requirements.
   - ATS explanation: "whatIncreasedScore" must identify the actual matched skills, sections, or evidence that raised the CURRENT ATS score. "whatReducedScore" must identify the actual missing requirement, missing section, weak bullet, or formatting issue that reduced it. Do not use generic advice or claim a score factor that is absent from the supplied data.
   - "jobMatchExplanation.strongMatches" must contain technical skills evidenced in both the resume and job data; "partialMatches" must contain relevant but incomplete evidence; and "missingSkills" must contain absent technical job requirements.
   - Detect present and missing standard resume sections ("detectedSections", "missingSections").
   - Produce exactly two non-overlapping recommendation sections using the existing fields:
     1. "improvementSuggestions" = Job-Specific Improvements only. Every item must explain why it matters for THIS target job and cite both a job requirement/responsibility and the relevant resume evidence or absence.
     2. "optimizationRecommendations" = General Resume Improvements only. Use this only for grammar, formatting, weak bullets, section ordering, or professional wording that remains after all job-specific observations are covered.
   - Keep "atsIssues" job-specific and keep "formattingIssues" / "formattingSuggestions" general. Never mix general advice into "improvementSuggestions" or job-specific gap advice into "optimizationRecommendations".
   - Exhaustive recommendation coverage: enumerate EVERY distinct, meaningful improvement supported by the supplied resume and job data. Do not stop at 3–5 suggestions and do not apply an arbitrary target or maximum. If the resume supports 12 unique improvements, return all 12; if it supports only 4, return 4. Always complete Job-Specific Improvements first; general advice must never dominate the report.
   - Treat each concrete observation as one candidate improvement: summary coverage, each weak experience/project entry, missing or weak sections, formatting/ordering, job-requirement alignment, and non-duplicated technical keyword gaps. Keep each observation in its most appropriate output field and never repeat it in another field.
   - Every recommendation must name BOTH the job-specific reason and the resume-specific evidence/absence. For example: "The Embedded Engineer role requires firmware development in C/C++. Although C++ appears in Skills, no project bullet demonstrates firmware development." Never use generic advice such as "Improve your resume" or "Use action verbs" without this two-sided comparison.
   - Within every recommendation array, list direct MISSING and PARTIALLY MATCHED job gaps first, then weaker job-alignment observations, and place any remaining generic polish last.
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
    "keywordIssues": ["string"],
    "whatIncreasedScore": ["string"],
    "whatReducedScore": ["string"]
  },
  "jobMatchExplanation": {
    "strongMatches": ["string"],
    "partialMatches": ["string"],
    "missingSkills": ["string"]
  },
  "hiringManagerAssessment": {
    "recruiterSummary": "4-7 sentence recruiter-style evaluation for this exact job",
    "topReasonsToInterview": ["3-5 grounded resume-and-job-specific reasons"],
    "topReasonsForRejection": ["3-5 grounded concerns limited to job requirements"],
    "biggestImprovements": ["exactly 5 grounded hiring-impact improvements"]
  }
}

HIRING MANAGER ASSESSMENT:
- Evaluate the candidate only for the supplied job. This is a recruiter opinion, not a generic resume review.
- The deterministic gapAnalysis, ATS drivers, and resume evidence are authoritative. Mention a missing skill only when it is a supplied job requirement and the gapAnalysis marks it MISSING or PARTIALLY MATCHED.
- The summary must state the candidate's role alignment, biggest hiring advantage, and biggest hiring concern, with both strengths and weaknesses. Do not invent candidate facts, metrics, employers, projects, or technologies.
- Every interview/rejection reason must connect a named job requirement or responsibility to exact resume evidence, related evidence, or a documented absence.
- Return exactly 5 biggest improvements. Each must be specific to the target role and resume evidence. Do not assign scores, probabilities, decisions, or confidence: the backend derives those deterministically.

Respond with valid JSON only.`;

const REWRITER_SYSTEM_PROMPT = `You are an expert resume editor. Identify weak bullet points in the provided experience and projects list and rewrite them.
The input contains experience and project content, a target-job context, and an optional job-gap focus list. Identify "weakBullets" only from the supplied experience and project arrays. The target-job context and job-gap focus list are priority context only, never evidence for a rewrite.
Generate "improvedBulletPoints" as before/after pairs (MINIMUM 4 pairs).

Rules:
- ONLY rewrite supplied experience or project bullets. Never add a new bullet based on information outside those arrays.
- Rewrite for the supplied target job, not for a generic role. When a bullet already evidences a target-job requirement, naturally foreground the overlapping job terminology and technical contribution.
- A target-job term may appear in an "after" bullet ONLY when the original bullet directly supports that term, an equivalent named technology, or the same concrete technical activity. A MISSING requirement is never permission to add the skill, technology, tool, responsibility, metric, or outcome to a bullet.
- When a supplied bullet truthfully supports a MATCHED or PARTIALLY MATCHED job requirement in the optional gap focus list, make that existing connection clearer. For example, preserve an explicit sensor, Arduino, LiDAR, PID, microcontroller, or motor detail when it is already in the bullet and relevant to the target job.
- If the target job does not overlap with a bullet's supported evidence, improve clarity and impact only; do not force unrelated job terminology into it.
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

export type GapStatus = 'MATCHED' | 'PARTIALLY MATCHED' | 'MISSING' | 'NOT APPLICABLE';

export type JobGapItem = {
  skill: string;
  status: GapStatus;
  evidence: string[];
  recommendation: string;
};

export type JobGapAnalysis = { items: JobGapItem[] };

export type AtsDimensionBreakdown = {
  structure: { score: number; reasons: string[] };
  keywordAlignment: { score: number; reasons: string[] };
  experienceAlignment: { score: number; reasons: string[] };
  total: number;
};

export type KeywordRecommendation = {
  keyword: string;
  priority: 'Critical' | 'Important' | 'Optional';
  whyItMatters: string;
  recommendedSection: 'Skills' | 'Experience' | 'Projects';
};

type GapRule = { direct: string[]; partial: string[] };

const GAP_RULES: Record<string, GapRule> = {
  'firmware development': { direct: ['firmware', 'firmware development'], partial: ['embedded programming', 'embedded systems', 'microcontroller'] },
  'embedded programming': { direct: ['embedded programming'], partial: ['embedded systems', 'firmware', 'microcontroller', 'arduino'] },
  microcontrollers: { direct: ['microcontroller', 'arduino', 'stm32', 'esp32'], partial: ['embedded systems'] },
  'pcb testing': { direct: ['pcb testing', 'board testing', 'pcb validation'], partial: ['altium', 'pcb design'] },
  'circuit validation': { direct: ['circuit validation', 'circuit testing'], partial: ['circuit design', 'proteus', 'ltspice', 'simulation'] },
  'technical documentation': { direct: ['technical documentation', 'test report', 'design document', 'documentation'], partial: ['report', 'presented'] },
  'sensors and actuators': { direct: ['sensor', 'actuator', 'motor'], partial: ['lidar', 'blcd', 'robotic arm'] },
  'c cplusplus': { direct: ['c++', 'c programming', 'cplusplus'], partial: [] },
  proteus: { direct: ['proteus'], partial: ['circuit simulation', 'ltspice'] },
  stm32: { direct: ['stm32'], partial: ['microcontroller', 'arduino', 'esp32'] },
  esp32: { direct: ['esp32'], partial: ['microcontroller', 'arduino', 'stm32'] },
  mechatronics: { direct: ['mechatronics'], partial: ['electrical engineering', 'electronics engineering'] },
};

function normalizeGapTerm(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/c\+\+/g, 'cplusplus')
    .replace(/[^a-z0-9+\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueGapEvidence(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Compares the structured resume against the parsed job requirements before
 * any downstream recommendation is generated. It intentionally uses only
 * observable resume evidence and never infers unlisted candidate experience.
 */
export function buildJobGapAnalysis(
  resume: Pick<StructuredResume, 'summary' | 'experience' | 'projects' | 'skills' | 'education' | 'certifications' | 'awards'>,
  job: { requiredSkills?: unknown },
): JobGapAnalysis {
  const requiredSkills = Array.isArray(job.requiredSkills)
    ? job.requiredSkills.filter((skill): skill is string => typeof skill === 'string' && Boolean(skill.trim()))
    : [];
  const evidenceSources = [
    ...resume.skills,
    ...resume.experience,
    ...resume.projects,
    ...resume.education,
    ...resume.certifications,
    ...resume.awards,
    resume.summary,
  ].filter((value): value is string => typeof value === 'string' && Boolean(value.trim()));

  return {
    items: requiredSkills.map((skill) => {
      const normalizedSkill = normalizeGapTerm(skill);
      if (!normalizedSkill || /^(?:n a|not applicable)$/i.test(normalizedSkill)) {
        return {
          skill,
          status: 'NOT APPLICABLE' as const,
          evidence: [],
          recommendation: 'No resume action is needed for this non-applicable requirement.',
        };
      }

      const rule = GAP_RULES[normalizedSkill] || {
        direct: [normalizedSkill],
        partial: normalizedSkill.split(' ').filter((word) => word.length > 3),
      };
      const directEvidence = evidenceSources.filter((source) => {
        const normalizedSource = normalizeGapTerm(source);
        return rule.direct.some((term) => normalizedSource.includes(normalizeGapTerm(term)));
      });
      const partialEvidence = evidenceSources.filter((source) => {
        const normalizedSource = normalizeGapTerm(source);
        return rule.partial.some((term) => normalizedSource.includes(normalizeGapTerm(term)));
      });
      const evidence = uniqueGapEvidence([...directEvidence, ...partialEvidence]);

      const status: GapStatus = directEvidence.length > 0
        ? 'MATCHED'
        : partialEvidence.length > 0
          ? 'PARTIALLY MATCHED'
          : 'MISSING';
      const recommendation = status === 'MATCHED'
        ? `Keep the existing ${skill} evidence prominent in the most relevant experience or project entry.`
        : status === 'PARTIALLY MATCHED'
          ? `Make the existing related evidence explicitly connect to ${skill}, but only if that connection is accurate.`
          : `Mention ${skill} coursework, project work, or practical exposure only if it genuinely applies.`;

      return { skill, status, evidence, recommendation };
    }),
  };
}

/**
 * Deterministic, job-specific ATS calculation. The fixed weights are the
 * product contract; every earned point comes from parsed resume/job evidence.
 */
export function calculateJobSpecificAtsScore(
  resume: Pick<StructuredResume, 'summary' | 'experience' | 'projects' | 'skills' | 'education' | 'certifications' | 'awards' | 'languages'>,
  gapAnalysis: JobGapAnalysis,
): AtsDimensionBreakdown {
  const structureReasons: string[] = [];
  let structure = 0;
  const structureChecks: [boolean, number, string][] = [
    [Boolean(resume.summary.trim()), 4, 'summary'],
    [resume.experience.length > 0, 6, 'experience'],
    [resume.projects.length > 0, 5, 'projects'],
    [resume.skills.length > 0, 5, 'skills'],
    [resume.education.length > 0, 4, 'education'],
    [resume.certifications.length > 0, 2, 'certifications'],
    [resume.awards.length > 0 || resume.languages.length > 0, 2, 'awards or languages'],
    [resume.experience.length + resume.projects.length >= 3, 2, 'multiple evidence bullets'],
  ];
  for (const [present, points, label] of structureChecks) {
    if (present) {
      structure += points;
      structureReasons.push(label);
    }
  }

  const applicableGaps = gapAnalysis.items.filter((item) => item.status !== 'NOT APPLICABLE');
  const matched = applicableGaps.filter((item) => item.status === 'MATCHED');
  const partial = applicableGaps.filter((item) => item.status === 'PARTIALLY MATCHED');
  const missing = applicableGaps.filter((item) => item.status === 'MISSING');
  const keywordFraction = applicableGaps.length === 0
    ? 0
    : (matched.length + partial.length * 0.5) / applicableGaps.length;
  const keywordAlignment = Math.round(keywordFraction * 40);

  const experienceEvidence = new Set([
    ...resume.experience,
    ...resume.projects,
  ].map((item) => normalizeGapTerm(item)));
  const experienceApplicable = applicableGaps.filter(
    (item) => !/\b(?:bachelor|degree|mechatronics|electrical|electronics)\b/i.test(item.skill),
  );
  const experienceFraction = experienceApplicable.length === 0
    ? 0
    : experienceApplicable.reduce((total, item) => {
      const demonstratedInWork = item.evidence.some((evidence) => experienceEvidence.has(normalizeGapTerm(evidence)));
      if (item.status === 'MATCHED') return total + (demonstratedInWork ? 1 : 0.55);
      if (item.status === 'PARTIALLY MATCHED') return total + (demonstratedInWork ? 0.5 : 0.25);
      return total;
    }, 0) / experienceApplicable.length;
  const experienceAlignment = Math.round(experienceFraction * 30);

  return {
    structure: {
      score: structure,
      reasons: structureReasons,
    },
    keywordAlignment: {
      score: keywordAlignment,
      reasons: [
        `${matched.length} matched requirement${matched.length === 1 ? '' : 's'}`,
        `${partial.length} partially matched`,
        `${missing.length} missing`,
      ],
    },
    experienceAlignment: {
      score: experienceAlignment,
      reasons: [`${experienceApplicable.length} applicable technical requirement${experienceApplicable.length === 1 ? '' : 's'} assessed against experience and projects`],
    },
    total: structure + keywordAlignment + experienceAlignment,
  };
}

function uniqueAssessmentItems(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const text = value.trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Keeps the recruiter decision and interview probability reproducible. The AI
 * supplies the recruiter language; scores and gap evidence determine the
 * decision, confidence, and estimated hiring impact.
 */
function buildHiringManagerAssessment(
  raw: unknown,
  resume: StructuredResume,
  job: { title?: unknown },
  gapAnalysis: JobGapAnalysis,
  atsScore: number,
  matchScore: number,
  resumeText: string,
  jobDescription: string,
  planned: Record<string, any>,
): HiringManagerAssessment {
  const model = validateHiringManagerAssessment(raw, resumeText, jobDescription);
  const title = typeof job.title === 'string' && job.title.trim() ? job.title.trim() : 'target role';
  const applicable = gapAnalysis.items.filter((item) => item.status !== 'NOT APPLICABLE');
  const matched = applicable.filter((item) => item.status === 'MATCHED');
  const partial = applicable.filter((item) => item.status === 'PARTIALLY MATCHED');
  const missing = applicable.filter((item) => item.status === 'MISSING');
  const coverage = applicable.length ? (matched.length + partial.length * 0.5) / applicable.length : 0;
  const estimatedInterviewProbability = Math.max(0, Math.min(100, Math.round(
    atsScore * 0.4 + matchScore * 0.3 + coverage * 100 * 0.3,
  )));
  const overallDecision: HiringDecision = estimatedInterviewProbability >= 82 ? 'Strong Match'
    : estimatedInterviewProbability >= 68 ? 'Good Match'
      : estimatedInterviewProbability >= 52 ? 'Potential Match'
        : estimatedInterviewProbability >= 36 ? 'Weak Match'
          : 'Poor Match';
  const confidence: HiringManagerAssessment['confidence'] = applicable.length >= 3 && (resume.experience.length + resume.projects.length) >= 3
    ? 'High'
    : applicable.length > 0 && (resume.skills.length > 0 || resume.projects.length > 0)
      ? 'Medium'
      : 'Low';

  const fallbackInterviewReasons = matched.map((item) =>
    `${item.skill} is evidenced in ${item.evidence.slice(0, 2).join('; ')}, aligning with the ${title} requirement.`,
  );
  const fallbackRejectionReasons = [
    ...missing.map((item) => `${item.skill} is required for the ${title} role but is not evidenced in the resume.`),
    ...partial.map((item) => `${item.skill} is relevant to the ${title} role, but the resume shows only related rather than explicit evidence.`),
  ];
  const strengths = matched.slice(0, 2).map((item) => item.skill).join(', ') || 'the documented resume experience';
  const concern = missing[0]?.skill || partial[0]?.skill || 'the depth of role-specific evidence';
  const fallbackSummary = [
    `For the ${title} role, this candidate shows relevant evidence through ${strengths}.`,
    `The strongest hiring advantage is the direct alignment between the documented resume evidence and the matched job requirements.`,
    `The biggest hiring concern is ${concern}, which is not fully demonstrated in the submitted resume.`,
    `Overall, the candidate is a ${overallDecision.toLowerCase()} based on the current ATS, job-match, and requirement-gap evidence.`,
  ].join(' ');
  const plannedImprovements = [
    ...model.biggestImprovements,
    ...missing.map((item) => item.recommendation),
    ...partial.map((item) => item.recommendation),
    ...matched.map((item) => `Keep the documented ${item.skill} evidence prominent for the ${title} role.`),
    ...(planned.recommendationPriorities?.critical || []),
    ...(planned.recommendationPriorities?.important || []),
    ...(planned.recommendationPriorities?.optional || []),
    resume.summary
      ? `Align the existing summary more explicitly with the ${title} requirements using only documented experience.`
      : `Add a targeted summary that connects documented experience to the ${title} requirements.`,
    resume.skills.length > 0
      ? `Prioritize the resume's job-relevant technical skills for the ${title} role.`
      : `Add a skills section containing only technical skills evidenced by the resume for the ${title} role.`,
    resume.projects.length > 0
      ? `Make the most relevant project evidence easier to find for the ${title} role.`
      : `Add a project example only if genuine work exists that is relevant to the ${title} role.`,
    resume.experience.length > 0
      ? `Clarify how the documented experience supports the ${title} responsibilities.`
      : `Add experience evidence only if genuine work relevant to the ${title} role exists.`,
    resume.education.length > 0
      ? `Keep the documented education aligned with the ${title} requirements.`
      : `Add the candidate's completed or current education if it is relevant to the ${title} role.`,
  ].filter((item): item is string => typeof item === 'string');
  const improvements = uniqueAssessmentItems(plannedImprovements).slice(0, 5)
    .map((text, index) => ({ text, estimatedImpact: [8, 6, 5, 3, 2][index] }));

  return {
    overallDecision,
    recruiterSummary: model.recruiterSummary || fallbackSummary,
    topReasonsToInterview: uniqueAssessmentItems([...model.topReasonsToInterview, ...fallbackInterviewReasons]).slice(0, 5),
    topReasonsForRejection: uniqueAssessmentItems([...model.topReasonsForRejection, ...fallbackRejectionReasons]).slice(0, 5),
    estimatedInterviewProbability,
    biggestImprovements: improvements,
    confidence,
  };
}

/** Builds job-ranked keyword guidance from the deterministic gap analysis. */
export function buildKeywordRecommendations(
  resume: StructuredResume,
  job: { title?: unknown; requiredSkills?: unknown; preferredSkills?: unknown },
  jobDescription: string,
  requiredGapAnalysis: JobGapAnalysis,
): KeywordRecommendation[] {
  const title = typeof job.title === 'string' && job.title.trim() ? job.title.trim() : 'target role';
  const preferredGapAnalysis = buildJobGapAnalysis(resume, {
    requiredSkills: job.preferredSkills,
  });
  const normalizedDescription = normalizeGapTerm(jobDescription);
  const experienceEvidence = new Set(resume.experience.map((item) => normalizeGapTerm(item)));
  const projectEvidence = new Set(resume.projects.map((item) => normalizeGapTerm(item)));
  const seen = new Set<string>();

  const toRecommendation = (
    item: JobGapItem,
    source: 'required' | 'preferred',
  ): KeywordRecommendation | null => {
    if (item.status === 'MATCHED' || item.status === 'NOT APPLICABLE') return null;
    const key = normalizeGapTerm(item.skill);
    if (!key || seen.has(key)) return null;
    seen.add(key);

    const appearsRepeatedly = normalizedDescription.split(key).length - 1 > 1;
    const priority: KeywordRecommendation['priority'] = source === 'required' && item.status === 'MISSING'
      ? 'Critical'
      : source === 'required' || appearsRepeatedly
        ? 'Important'
        : 'Optional';
    const recommendedSection: KeywordRecommendation['recommendedSection'] = item.evidence.some((evidence) => experienceEvidence.has(normalizeGapTerm(evidence)))
      ? 'Experience'
      : item.evidence.some((evidence) => projectEvidence.has(normalizeGapTerm(evidence)))
        ? 'Projects'
        : 'Skills';
    const whyItMatters = source === 'required'
      ? item.status === 'MISSING'
        ? `${item.skill} is required for the ${title} role and is not evidenced in the resume.`
        : `${item.skill} is required for the ${title} role, but the resume shows only related evidence rather than an explicit match.`
      : `${item.skill} is preferred for the ${title} role and is not strongly represented in the resume.`;
    return { keyword: item.skill, priority, whyItMatters, recommendedSection };
  };

  const recommendations = [
    ...requiredGapAnalysis.items.map((item) => toRecommendation(item, 'required')),
    ...preferredGapAnalysis.items.map((item) => toRecommendation(item, 'preferred')),
  ].filter((item): item is KeywordRecommendation => Boolean(item));
  const priorityRank = { Critical: 0, Important: 1, Optional: 2 } as const;
  return recommendations.sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority] || left.keyword.localeCompare(right.keyword));
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
  const keywordRecommendations = Array.isArray(o.keywordRecommendations)
    ? o.keywordRecommendations.flatMap((item: unknown): KeywordRecommendation[] => {
        if (!item || typeof item !== 'object') return [];
        const candidate = item as Record<string, unknown>;
        const keyword = typeof candidate.keyword === 'string' ? candidate.keyword.trim() : '';
        const whyItMatters = typeof candidate.whyItMatters === 'string' ? candidate.whyItMatters.trim() : '';
        const priority = candidate.priority;
        const recommendedSection = candidate.recommendedSection;
        if (!keyword || !whyItMatters
          || !['Critical', 'Important', 'Optional'].includes(String(priority))
          || !['Skills', 'Experience', 'Projects'].includes(String(recommendedSection))) return [];
        return [{
          keyword,
          whyItMatters,
          priority: priority as KeywordRecommendation['priority'],
          recommendedSection: recommendedSection as KeywordRecommendation['recommendedSection'],
        }];
      })
    : [];
  const scoreExplanation = o.atsScoreExplanation || {};
  const jobMatchExplanation = o.jobMatchExplanation || {};
  const priorityGroups = o.recommendationPriorities || {};
  const priorityItems = (value: unknown): string[] => Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim())
    : [];

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
    keywordRecommendations,
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
    recommendationPriorities: {
      critical: priorityItems(priorityGroups.critical),
      important: priorityItems(priorityGroups.important),
      optional: priorityItems(priorityGroups.optional),
    },
    atsScoreExplanation: {
      strengths: arr(scoreExplanation.strengths),
      missingElements: arr(scoreExplanation.missingElements),
      formattingIssues: arr(scoreExplanation.formattingIssues),
      keywordIssues: arr(scoreExplanation.keywordIssues),
      whatIncreasedScore: arr(scoreExplanation.whatIncreasedScore),
      whatReducedScore: arr(scoreExplanation.whatReducedScore),
      topImprovements: [],
      estimatedScoreImprovement: 0,
      potentialAtsScore: atsScore,
    },
    jobMatchExplanation: {
      strongMatches: arr(jobMatchExplanation.strongMatches),
      partialMatches: arr(jobMatchExplanation.partialMatches),
      missingSkills: arr(jobMatchExplanation.missingSkills),
    },
    hiringManagerAssessment: o.hiringManagerAssessment as HiringManagerAssessment,
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
  if (result.atsScoreExplanation.whatIncreasedScore.length === 0) {
    result.atsScoreExplanation.whatIncreasedScore = [
      ...result.atsScoreExplanation.strengths,
      ...result.existingSkills.map((skill) => `Matches the job requirement: ${skill}`),
    ];
  }
  if (result.atsScoreExplanation.whatReducedScore.length === 0) {
    result.atsScoreExplanation.whatReducedScore = [
      ...result.atsScoreExplanation.missingElements,
      ...result.atsScoreExplanation.formattingIssues,
      ...result.atsScoreExplanation.keywordIssues,
    ];
  }

  const uniqueExplanationItems = (values: string[]) => {
    const seen = new Set<string>();
    return values.filter((value) => {
      const text = value.trim();
      const key = text.toLowerCase();
      if (!text || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  result.atsScoreExplanation.whatIncreasedScore = uniqueExplanationItems(result.atsScoreExplanation.whatIncreasedScore);
  result.atsScoreExplanation.whatReducedScore = uniqueExplanationItems(result.atsScoreExplanation.whatReducedScore);

  // Explanation-only projection. It never changes atsScore or its calculation;
  // it estimates the effect of the first three validated, planned improvements.
  const rankedImprovements = [
    ...result.recommendationPriorities.critical.map((text) => ({ text, impact: 4 })),
    ...result.recommendationPriorities.important.map((text) => ({ text, impact: 2 })),
    ...result.recommendationPriorities.optional.map((text) => ({ text, impact: 1 })),
  ];
  const selectedImprovements: { text: string; impact: number }[] = [];
  for (const candidate of rankedImprovements) {
    if (selectedImprovements.some((item) => item.text.toLowerCase() === candidate.text.toLowerCase())) continue;
    selectedImprovements.push(candidate);
    if (selectedImprovements.length === 3) break;
  }
  result.atsScoreExplanation.topImprovements = selectedImprovements.map((item) => item.text);
  result.atsScoreExplanation.estimatedScoreImprovement = Math.min(
    15,
    selectedImprovements.reduce((total, item) => total + item.impact, 0),
  );
  result.atsScoreExplanation.potentialAtsScore = Math.min(
    100,
    result.atsScore + result.atsScoreExplanation.estimatedScoreImprovement,
  );
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

function parseStageJson(
  raw: string,
  stage: Extract<AiPipelineStage, 'parser' | 'analyzer' | 'rewriter'>,
  observability?: AiObservabilityContext,
): Record<string, any> {
  try {
    const parsed = extractJsonFromText(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Expected a JSON object.');
    }
    logAiEvent(observability, 'raw_json_parse_completed', {
      stage,
      status: 'success',
      rawResponseChars: raw.length,
    });
    return parsed as Record<string, any>;
  } catch (error) {
    console.error(`[pipeline] ${stage} JSON parsing failed`, {
      errorType: error instanceof Error ? error.name : 'unknown',
    });
    logAiEvent(observability, 'raw_json_parse_completed', {
      stage,
      status: 'failed',
      rawResponseChars: raw.length,
    });
    throw new AiPipelineError(stage, 'INVALID_JSON', `The ${stage} returned an invalid response.`);
  }
}

function requiredScore(value: unknown, field: 'atsScore' | 'matchScore'): number {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new AiPipelineError('analyzer', 'INVALID_SCORE', `The analyzer returned an invalid ${field}.`);
  }
  return score;
}

function hasRecommendationOutput(value: Record<string, any>): boolean {
  const fields = [
    'atsIssues', 'formattingIssues', 'formattingSuggestions', 'improvementSuggestions',
    'optimizationRecommendations', 'weakBullets', 'improvedBulletPoints',
  ];
  return fields.some((field) => Array.isArray(value[field]) && value[field].length > 0);
}

function recommendationOutputCount(value: Record<string, any>): number {
  const fields = [
    'atsIssues', 'formattingIssues', 'formattingSuggestions', 'improvementSuggestions',
    'optimizationRecommendations', 'weakBullets', 'improvedBulletPoints',
  ];
  return fields.reduce(
    (count, field) => count + (Array.isArray(value[field]) ? value[field].length : 0),
    0,
  );
}

// ---------------------------------------------------------------------------
// CORE EXPORTED API PIPELINE HANDLERS
// ---------------------------------------------------------------------------

export async function analyzeResumeWithAi(
  resumeText: string,
  jobDescription: string,
  options: { observability?: AiObservabilityContext } = {},
): Promise<AiResumeAnalysisFull> {
  const observability = options.observability;
  logAiEvent(observability, 'pipeline_started', {
    resume: textMetadata(resumeText),
    jobDescription: textMetadata(jobDescription),
  });
  // Step 1: deterministic parsing establishes safe sections before the LLM enriches them.
  const localResume = parseResumeText(resumeText);
  logAiEvent(observability, 'structured_parser_completed', {
    sectionCounts: {
      summary: localResume.summary ? 1 : 0,
      experience: localResume.experience.length,
      projects: localResume.projects.length,
      skills: localResume.skills.length,
      education: localResume.education.length,
      certifications: localResume.certifications.length,
      awards: localResume.awards.length,
      languages: localResume.languages.length,
    },
    linkCount: localResume.links.items.length,
  });
  const parserResume = JSON.stringify(toParserResumeInput(localResume), null, 2);
  const parserUserContent = `Job Description:\n${jobDescription.slice(0, 6000)}\n\nStructured Resume JSON:\n${parserResume}`;
  console.info('[pipeline] Running Step 1: Resume & Job Parser');
  
  const parsedRaw = await callOpenRouter(
    [
      { role: 'system', content: RESUME_PARSER_SYSTEM_PROMPT },
      { role: 'user', content: parserUserContent },
    ],
    { maxTokens: 4000, temperature: 0.1, observability, stage: 'parser' }
  );

  const parsedJson = parseStageJson(parsedRaw, 'parser', observability);
  if (!parsedJson.resume || typeof parsedJson.resume !== 'object' || !parsedJson.job || typeof parsedJson.job !== 'object') {
    throw new AiPipelineError('parser', 'INVALID_SCHEMA', 'The parser response is missing resume or job data.');
  }

  parsedJson.resume = mergeParsedResume(parsedJson.resume, localResume);
  const gapAnalysis = buildJobGapAnalysis(parsedJson.resume, parsedJson.job);
  const atsBreakdown = calculateJobSpecificAtsScore(parsedJson.resume, gapAnalysis);
  logAiEvent(observability, 'gap_analysis_completed', {
    matched: gapAnalysis.items.filter((item) => item.status === 'MATCHED').length,
    partiallyMatched: gapAnalysis.items.filter((item) => item.status === 'PARTIALLY MATCHED').length,
    missing: gapAnalysis.items.filter((item) => item.status === 'MISSING').length,
    notApplicable: gapAnalysis.items.filter((item) => item.status === 'NOT APPLICABLE').length,
  });

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
    job: parsedJson.job,
    gapAnalysis,
  }, null, 2);

  const rewriterUserContent = JSON.stringify({
    experience: parsedJson.resume.experience,
    projects: parsedJson.resume.projects,
    targetJob: {
      title: parsedJson.job.title,
      requiredSkills: parsedJson.job.requiredSkills,
      preferredSkills: parsedJson.job.preferredSkills,
      responsibilities: parsedJson.job.responsibilities,
    },
    jobGapFocus: gapAnalysis.items.map(({ skill, status }) => ({ skill, status })),
  }, null, 2);

  console.info('[pipeline] Running Step 2 & 3: Parallel Analyzer and Rewriter');
  
  const [analysisRaw, rewriterRaw] = await Promise.all([
    callOpenRouter(
      [
        { role: 'system', content: ANALYZER_SYSTEM_PROMPT },
        { role: 'user', content: analysisUserContent }
      ],
      { maxTokens: 5000, temperature: 0.2, observability, stage: 'analyzer' }
    ),
    callOpenRouter(
      [
        { role: 'system', content: REWRITER_SYSTEM_PROMPT },
        { role: 'user', content: rewriterUserContent }
      ],
      { maxTokens: 3000, temperature: 0.3, observability, stage: 'rewriter' }
    )
  ]);

  const analysisJson = parseStageJson(analysisRaw, 'analyzer', observability);
  const rewriterJson = parseStageJson(rewriterRaw, 'rewriter', observability);

  const missingStructure = [
    !parsedJson.resume.summary && 'summary',
    parsedJson.resume.experience.length === 0 && 'experience',
    parsedJson.resume.projects.length === 0 && 'projects',
    parsedJson.resume.skills.length === 0 && 'skills',
    parsedJson.resume.education.length === 0 && 'education',
  ].filter((value): value is string => Boolean(value));
  const missingGapSkills = gapAnalysis.items.filter((item) => item.status === 'MISSING').map((item) => item.skill);
  const weakExperienceSkills = gapAnalysis.items
    .filter((item) => item.status !== 'MATCHED' && item.status !== 'NOT APPLICABLE')
    .filter((item) => !item.evidence.some((evidence) => [
      ...parsedJson.resume.experience,
      ...parsedJson.resume.projects,
    ].some((source) => normalizeGapTerm(source) === normalizeGapTerm(evidence))))
    .map((item) => item.skill);
  const deterministicAtsExplanation = {
    whatIncreasedScore: [
      `Resume Structure: ${atsBreakdown.structure.score}/30 — ${atsBreakdown.structure.reasons.join(', ') || 'no standard sections detected'}.`,
      `Keyword Alignment: ${atsBreakdown.keywordAlignment.score}/40 — ${atsBreakdown.keywordAlignment.reasons.join(', ')}.`,
      `Experience Alignment: ${atsBreakdown.experienceAlignment.score}/30 — ${atsBreakdown.experienceAlignment.reasons.join(', ')}.`,
    ],
    whatReducedScore: [
      ...(missingStructure.length ? [`Resume Structure lost points because ${missingStructure.join(', ')} ${missingStructure.length === 1 ? 'is' : 'are'} absent.`] : []),
      ...(missingGapSkills.length ? [`Keyword Alignment lost points because ${missingGapSkills.join(', ')} ${missingGapSkills.length === 1 ? 'is' : 'are'} missing.`] : []),
      ...(weakExperienceSkills.length ? [`Experience Alignment lost points because ${weakExperienceSkills.join(', ')} ${weakExperienceSkills.length === 1 ? 'is' : 'are'} not demonstrated in Experience or Projects.`] : []),
    ],
  };

  // Combine and validate final structure
  const combinedRaw = {
    parsed: parsedJson.resume,
    atsScore: atsBreakdown.total,
    matchScore: requiredScore(analysisJson.matchScore, 'matchScore'),
    existingSkills: analysisJson.existingSkills || [],
    missingSkills: analysisJson.missingSkills || analysisJson.missingKeywords || [],
    missingKeywords: analysisJson.missingSkills || analysisJson.missingKeywords || [],
    keywordSuggestions: analysisJson.keywordSuggestions || [],
    keywordGaps: analysisJson.keywordGaps || [],
    missingRequiredSkills: [
      ...(analysisJson.missingRequiredSkills || []),
      ...gapAnalysis.items.filter((item) => item.status === 'MISSING').map((item) => item.skill),
    ],
    detectedSections: analysisJson.detectedSections || [],
    missingSections: analysisJson.missingSections || [],
    formattingIssues: analysisJson.formattingIssues || [],
    formattingSuggestions: analysisJson.formattingSuggestions || [],
    weakBullets: rewriterJson.weakBullets || analysisJson.weakBullets || [],
    improvedBulletPoints: rewriterJson.improvedBulletPoints || [],
    improvementSuggestions: analysisJson.improvementSuggestions || [],
    optimizationRecommendations: analysisJson.optimizationRecommendations || [],
    atsIssues: analysisJson.atsIssues || [],
    atsScoreExplanation: {
      ...(analysisJson.atsScoreExplanation || {}),
      whatIncreasedScore: [
        ...deterministicAtsExplanation.whatIncreasedScore,
        ...((analysisJson.atsScoreExplanation?.whatIncreasedScore) || []),
      ],
      whatReducedScore: [
        ...deterministicAtsExplanation.whatReducedScore,
        ...((analysisJson.atsScoreExplanation?.whatReducedScore) || []),
      ],
    },
    jobMatchExplanation: analysisJson.jobMatchExplanation || {},
    hiringManagerAssessment: analysisJson.hiringManagerAssessment,
  };

  let validated: Record<string, any>;
  const validationTelemetry: ValidationTelemetry = {
    acceptedRecommendations: 0,
    rejectedRecommendations: 0,
    rejectionReasons: {},
  };
  try {
    validated = validateAiResumeOutput(combinedRaw, resumeText, jobDescription, validationTelemetry);
  } catch (error) {
    console.error('[pipeline] validation failed', {
      errorType: error instanceof Error ? error.name : 'unknown',
    });
    throw new AiPipelineError('validation', 'VALIDATION_FAILED', 'The analysis could not be validated.');
  }
  logAiEvent(observability, 'validation_completed', validationTelemetry);
  if (hasRecommendationOutput(combinedRaw) && !hasRecommendationOutput(validated)) {
    throw new AiPipelineError('validation', 'ALL_RECOMMENDATIONS_REJECTED', 'All generated recommendations failed validation.');
  }

  let planned: Record<string, any>;
  try {
    planned = planResumeRecommendations(rankMissingSkills(validated, jobDescription), resumeText, gapAnalysis);
  } catch (error) {
    console.error('[pipeline] planner failed', {
      errorType: error instanceof Error ? error.name : 'unknown',
    });
    throw new AiPipelineError('planner', 'PLANNING_FAILED', 'The analysis recommendations could not be planned.');
  }
  logAiEvent(observability, 'planner_completed', {
    inputRecommendationCount: recommendationOutputCount(validated),
    outputRecommendationCount: recommendationOutputCount(planned),
  });
  if (hasRecommendationOutput(validated) && !hasRecommendationOutput(planned)) {
    throw new AiPipelineError('planner', 'ALL_RECOMMENDATIONS_REMOVED', 'All recommendations were removed during planning.');
  }

  planned.keywordRecommendations = buildKeywordRecommendations(
    parsedJson.resume,
    parsedJson.job,
    jobDescription,
    gapAnalysis,
  );
  planned.hiringManagerAssessment = buildHiringManagerAssessment(
    analysisJson.hiringManagerAssessment,
    parsedJson.resume,
    parsedJson.job,
    gapAnalysis,
    atsBreakdown.total,
    requiredScore(analysisJson.matchScore, 'matchScore'),
    resumeText,
    jobDescription,
    planned,
  );

  const result = normalizeResumeAnalysis(planned, resumeText);
  logAiEvent(observability, 'pipeline_completed', {
    totalDurationMs: observability ? Date.now() - observability.startedAt : null,
  });
  return result;
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
