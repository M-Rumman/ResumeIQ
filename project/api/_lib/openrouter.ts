import {
  logOpenRouterDiagnostics,
  maskApiKey,
  readOpenRouterKeyFromEnv,
} from './openrouterDiagnostics.js';
import { getAppBaseUrl } from './appUrl.js';
import {
  normalizeSectionHeading,
  parseResumeText,
  sanitizeResumeContentLine,
  type StructuredResume,
} from './resumeParser.js';
import { validateAiResumeOutput, type RewritePair } from './aiValidation.js';
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
const DEFAULT_OPENROUTER_REQUEST_TIMEOUT_MS = 55_000;
const MIN_OPENROUTER_REQUEST_TIMEOUT_MS = 30_000;
const MAX_OPENROUTER_REQUEST_TIMEOUT_MS = 60_000;

/** Paid primary model with a compatible paid fallback. */
const DEFAULT_MODEL = 'google/gemini-1.5-flash';

const MODEL_FALLBACKS = [
  'google/gemma-2-9b-it:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'microsoft/phi-3-mini-128k-instruct:free',
  'openrouter/free',
] as const;

function hasSourceSummaryHeader(resumeText: string): boolean {
  const summaryHeaders = new Set([
    'summary', 'professional summary', 'career summary', 'career profile',
    'profile', 'professional profile', 'objective', 'career objective', 'about', 'about me',
  ]);
  return String(resumeText || '').split(/\r?\n/)
    .some((line) => summaryHeaders.has(normalizeSectionHeading(line)));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openRouterRequestTimeoutMs(): number {
  const configured = Number(process.env.OPENROUTER_REQUEST_TIMEOUT_MS);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_OPENROUTER_REQUEST_TIMEOUT_MS;
  return Math.min(MAX_OPENROUTER_REQUEST_TIMEOUT_MS, Math.max(MIN_OPENROUTER_REQUEST_TIMEOUT_MS, configured));
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
  // A deployment-level model choice must take effect immediately. The default
  // and fallback models remain available only when that configured model fails.
  const candidates = [preferred, fromEnv, DEFAULT_MODEL, ...MODEL_FALLBACKS].filter(
    (m): m is string => Boolean(m),
  );
  return [...new Set(candidates)];
}

function isRetryableProviderError(status: number, body: string): boolean {
  const lower = body.toLowerCase();
  if (status === 400) return true; // Retry on 400 (e.g., deprecated model, context length limit on specific model)
  if (status === 404) return true; // Always retry on 404, if a fallback model is removed/deprecated we should try the next one
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

export interface Gap {
  id: string;
  requirement: string;
  whyItMatters: string;
  whereToAdd: string;
  evidenceStatus: string;
  fabricationWarning: string;
  priority: 'critical' | 'important' | 'optional';
  type: 'missing_skill' | 'weak_bullet' | 'formatting' | 'missing_section';
}

export interface JobMatchContextItem {
  requirement: string;
  context: string;
  tag?: 'Addressable by rewording' | 'Genuine gap';
}

export interface AiResumeAnalysisFull {
  tier: 'premium';
  parsed: ParsedResume;
  atsScore: number;
  matchScore: number;
  existingSkills: string[];
  missingSkills: string[];
  missingKeywords: string[];
  analysisFailedSkills: string[];
  candidateBulletsCount?: number;
  keywordRecommendations: KeywordRecommendation[];
  keywordGaps: string[];
  missingRequiredSkills: string[];
  educationAlignment: EducationAlignmentItem[];
  detectedSections: string[];
  missingSections: string[];
  formattingIssues: string[];
  formattingSuggestions: string[];
  weakBullets: string[];
  improvedBulletPoints: RewritePair[];
  improvementSuggestions: string[];
  optimizationRecommendations: string[];
  keywordSuggestions: string[];
  atsIssues: string[];
  recommendationPriorities: {
    critical: string[];
    important: string[];
    optional: string[];
  };
  actionPlan: Gap[];
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
    strongMatches: JobMatchContextItem[];
    partialMatches: JobMatchContextItem[];
    missingSkills: JobMatchContextItem[];
  };
  keywordCompatibility: KeywordCompatibility;
  requirementBreakdown: any[];
  coachingReport: CoachingReportSection[];
  atsBreakdown: AtsDisplayBreakdownItem[];
  roleStrengths: string[];
  hiringManagerAssessment: HiringManagerAssessment;
  matchScoreDetails?: any;
}

export type HiringDecision = 'Strong Match' | 'Good Match' | 'Potential Match' | 'Weak Match' | 'Poor Match' | 'Analysis Incomplete';

export interface HiringManagerAssessment {
  overallDecision: HiringDecision;
  recruiterSummary: string;
  topReasonsToInterview: string[];
  topReasonsForRejection: string[];
  estimatedInterviewProbability?: number;
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

export type AiPipelineStage = 'parser' | 'verification' | 'analyzer' | 'rewriter' | 'validation' | 'planner';

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

export function isAiPipelineError(err: unknown): err is AiPipelineError {
  return typeof err === 'object' && err !== null && 'name' in err && (err as Error).name === 'AiPipelineError';
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

  const geminiKeys = (process.env.GEMINI_API_KEY || process.env.GEMINI_JOB_MATCH_KEYS || '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

  if (geminiKeys.length > 0 && models[0]?.startsWith('google/')) {
    const geminiKey = geminiKeys[Math.floor(Math.random() * geminiKeys.length)];
    const geminiModel = models[0].replace('google/', '').replace(':free', '');
    try {
      console.info(`[openrouter] trying native Gemini API for ${geminiModel} to bypass OpenRouter...`);
      const systemMessage = messages.find(m => m.role === 'system');
      const userMessages = messages.filter(m => m.role !== 'system');
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined,
          contents: userMessages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          })),
          generationConfig: {
            maxOutputTokens: options.maxTokens ?? 8000,
            temperature: options.temperature ?? 0.25,
            responseMimeType: 'application/json'
          }
        }),
        signal: AbortSignal.timeout(openRouterRequestTimeoutMs() + 10000)
      });
      
      if (response.ok) {
        const body = await response.json() as any;
        const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          console.info('[openrouter] native Gemini success', { model: geminiModel });
          return text;
        }
      } else {
        const text = await response.text();
        console.warn(`[openrouter] native Gemini failed (${response.status}), falling back to OpenRouter: ${text.slice(0, 100)}`);
      }
    } catch (e) {
      console.warn('[openrouter] native Gemini threw exception, falling back to OpenRouter', e);
    }
  }

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const requestStartedAt = Date.now();
    const controller = new AbortController();
    const requestTimeoutMs = openRouterRequestTimeoutMs();
    let requestTimedOut = false;
    const requestTimeout = setTimeout(() => {
      requestTimedOut = true;
      controller.abort();
    }, requestTimeoutMs);
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
        signal: controller.signal,
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
        const stage = (options.stage as AiPipelineStage) || 'analyzer';
        if (response.status === 401 || response.status === 403) {
          throw new AiPipelineError(
            stage,
            'UNAUTHORIZED_API_KEY',
            `OpenRouter rejected your API key (${response.status}). Create a new key at openrouter.ai/keys. On Vercel, set OPENROUTER_API_KEY under Project Settings → Environment Variables and redeploy. Ensure Site URL restrictions allow ${getAppBaseUrl()}.`
          );
        }
        
        let errorCode = 'PROVIDER_ERROR';
        if (response.status === 429) errorCode = 'PROVIDER_RATE_LIMIT';
        else if (response.status === 402) errorCode = 'PROVIDER_INSUFFICIENT_CREDITS';
        else if (response.status === 400) errorCode = 'PROVIDER_BAD_REQUEST';
        else if (response.status === 404) errorCode = 'PROVIDER_MODEL_NOT_FOUND';
        
        lastError = new AiPipelineError(stage, errorCode, `OpenRouter error ${response.status}: ${text.slice(0, 280)}`);
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
        const stage = (options.stage as AiPipelineStage) || 'analyzer';
        lastError = new AiPipelineError(stage, 'PROVIDER_ERROR', `Empty OpenRouter response from model ${model}`);
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
        timedOut: requestTimedOut,
        requestTimeoutMs,
      });
      const stage = (options.stage as AiPipelineStage) || 'analyzer';
      const errorCode = requestTimedOut ? 'PROVIDER_TIMEOUT' : 'PROVIDER_NETWORK_ERROR';
      lastError = isAiPipelineError(err) ? err : new AiPipelineError(stage, errorCode, err instanceof Error ? err.message : String(err));
      if (i < models.length - 1) {
        await sleep(500);
        continue;
      }
    } finally {
      clearTimeout(requestTimeout);
    }
  }

  throw (
    lastError ||
    new AiPipelineError(
      (options.stage as AiPipelineStage) || 'analyzer',
      'PROVIDER_ERROR',
      'All configured AI providers are currently unavailable. Please try again shortly.'
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
    // Attempt to extract by finding matching open/close pairs.
    // We try to find the outermost complete JSON object or array.
    const extractAttempt = (startChar: string, endChar: string) => {
      let firstIdx = candidate.indexOf(startChar);
      
      while (firstIdx >= 0) {
        let lastIdx = candidate.lastIndexOf(endChar);
        while (lastIdx > firstIdx) {
          try {
            const slice = candidate.slice(firstIdx, lastIdx + 1);
            return JSON.parse(slice);
          } catch {
            // Shrink from the right
            lastIdx = candidate.lastIndexOf(endChar, lastIdx - 1);
          }
        }
        // Shrink from the left
        firstIdx = candidate.indexOf(startChar, firstIdx + 1);
      }
      return null;
    };

    let result = extractAttempt('{', '}');
    if (result !== null) return result;

    result = extractAttempt('[', ']');
    if (result !== null) return result;

    throw new Error('Could not parse JSON from model output');
  }
}

// ---------------------------------------------------------------------------
// SYSTEM PROMPTS (MODULAR PIPELINE ARCHITECTURE)
// ---------------------------------------------------------------------------

const RESUME_PARSER_SYSTEM_PROMPT = `You are a precise resume and job description parser.
You receive a structured resume JSON object and job description text. Return JSON only.
The resume includes an additive "understanding" object with normalized entities, source sections, confidence, and evidence. Use it to understand content-led sections, synonyms, projects, education, and experience; its cited evidence remains the source of truth. Preserve supplied content and never invent projects, technologies, companies, metrics, certifications, or links.

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
3. "jobProfile": Ranked Job Profile: required skills, preferred skills, responsibilities, and priority order.
4. "gapAnalysis": Deterministic requirement-by-requirement comparison with status, resume evidence, and safe recommendation guidance.

JOB-SPECIFIC RECRUITER OPERATING RULE:
- Act as an experienced recruiter hiring ONLY for the supplied job, not as a generic resume reviewer.
- Before writing every recommendation, internally ask: "If I were recruiting for this exact job today, what would stop me from interviewing this candidate?" Omit advice that does not answer that question or does not materially improve the hiring decision.
- Order recommendations by hiring impact: Critical interview blockers first (missing required skills, absent practical evidence, or sections that prevent evaluation), then Important partial alignment, and only then minor formatting or wording polish.
- Complete the deterministic requirement-verification pass before producing any ATS, Job Match, keyword, recommendation, interview, or hiring-summary conclusion. Its exclusive evidence tiers are authoritative: Strong Match, Exceeded Requirement, Equivalent Match, Related Match, Weak Evidence, or Missing. Preserve the underlying MATCHED, PARTIALLY MATCHED, MISSING, and NOT APPLICABLE compatibility statuses unless the supplied resume evidence directly proves them wrong.
- Treat jobProfile as the source of priority. Required requirements are Critical, preferred requirements are Important, and responsibilities are Supporting role context. Do not let generic resume-review heuristics outrank a Critical or Important job requirement.
- Follow this reasoning order exactly: (1) identify the target role and its ranked priorities; (2) compare each priority with resume evidence; (3) use gapAnalysis to classify the comparison; (4) explain ATS and job match through that comparison; (5) generate job-specific improvements; and only then (6) generate remaining general resume improvements.
- The same resume paired with a different jobProfile must produce meaningfully different missing skills, match explanation, recommendation order, formatting priorities, and recruiter assessment. Do not reuse generic advice across roles.
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
   - The backend calculates both "atsScore" and "matchScore" deterministically from the supplied resume and jobProfile; do not attempt to adjust either score.
   - Explain the score drivers through the target jobProfile and its gapAnalysis. Do not invent score factors.
   - "atsScoreExplanation.strengths" must contain resume-specific positive observations; "missingElements" must contain absent resume elements; "formattingIssues" must contain concrete formatting/structure observations; and "keywordIssues" must contain missing technical requirements.
   - ATS explanation: "whatIncreasedScore" must identify the actual matched skills, sections, or evidence that raised the CURRENT ATS score. "whatReducedScore" must identify the actual missing requirement, missing section, weak bullet, or formatting issue that reduced it. Do not use generic advice or claim a score factor that is absent from the supplied data.
   - "jobMatchExplanation.strongMatches" must contain technical skills evidenced in both the resume and job data; "partialMatches" must contain relevant but incomplete evidence; and "missingSkills" must contain absent technical job requirements.
   - Detect present and missing standard resume sections ("detectedSections", "missingSections").
   - Produce exactly two non-overlapping recommendation sections using the existing fields:
     1. "improvementSuggestions" = Job-Specific Improvements only. Generate 6-10 whenever the resume and jobProfile support that many distinct observations. Every MISSING and PARTIALLY MATCHED Critical or Important requirement must receive its own recommendation before broader alignment advice. Every item must explain why it matters for THIS target job and cite both a job requirement/responsibility and the relevant resume evidence or absence.
     2. "optimizationRecommendations" = General Resume Improvements only. Generate 3-5 only when genuine grammar, formatting, weak-bullet, section-ordering, or section-naming issues exist after job-specific observations are complete. Each item must still explain why the affected resume section makes the candidate easier or harder to assess for THIS jobProfile; do not produce advice that could apply to any role.
   - Keep "atsIssues" job-specific. FormattingIssues / formattingSuggestions may address general structure, but must prioritize sections that obscure the jobProfile's Critical or Important evidence. Never emit generic formatting advice without naming the affected resume section and target-role consequence.
   - Exhaustive recommendation coverage: enumerate EVERY distinct, meaningful improvement supported by the supplied resume and job data. Do not stop at 3–5 suggestions and do not apply an arbitrary target or maximum. If the resume supports 12 unique improvements, return all 12; if it supports only 4, return 4. Always complete Job-Specific Improvements first; general advice must never dominate the report.
   - Treat each concrete observation as one candidate improvement: summary coverage, each weak experience/project entry, missing or weak sections, formatting/ordering, job-requirement alignment, and non-duplicated technical keyword gaps. Keep each observation in its most appropriate output field and never repeat it in another field.
   - Every recommendation must name BOTH the job-specific reason and the resume-specific evidence/absence. For example: "The Embedded Engineer role requires firmware development in C/C++. Although C++ appears in Skills, no project bullet demonstrates firmware development." Never use generic advice such as "Improve your resume" or "Use action verbs" without this two-sided comparison.
   - Within every recommendation array, list direct MISSING requirements that could block an interview first, then PARTIALLY MATCHED requirements, then weaker job-alignment observations, and place minor formatting or wording polish last. Every item must state the hiring consequence for this role.
   - For every suggestion/issue, you MUST assign a confidence score: "High" (directly supported by resume evidence), "Medium" (strong inference), or "Low" (general ATS best practice).
   - Resume-specific observations ONLY: Every observation must cite or clearly derive from supplied resume or job data. Do not claim a project, technology, company, certification, or metric exists unless it appears in the input.
   - When suggesting a measurable result for a bullet or recommendation, use placeholders such as "[X]%", "[X] users", or "[X] requests" unless that exact metric is in the supplied resume.
   - Global planning: Ensure no suggestion is duplicated or repeated across different categories. Each suggestion should be unique.
   - Create "coachingReport" as the primary Resume Improvements report. Use only the listed categories. Include a category only when the resume and target job support a meaningful observation; each included category must contain 1-3 distinct recommendations. Cover Summary, Experience, Projects, Skills, Education, ATS Formatting, Keyword Usage, Technical Depth, Action Verbs, Quantification, Missing Evidence, and Job Alignment whenever each is applicable.
   - This is coaching, not a checklist: each recommendation must explain the observed resume evidence or absence, the target-job consequence, and a specific truthful action the candidate can take. For example, a Projects observation should distinguish tasks from outcomes; a Skills observation may recommend grouping existing tools by technical domain; a Technical Depth observation should identify where engineering reasoning, method, or improvement is not visible. Never claim the candidate has an unlisted qualification or metric.

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
  "coachingReport": [
    {
      "category": "Summary | Experience | Projects | Skills | Education | ATS Formatting | Keyword Usage | Technical Depth | Action Verbs | Quantification | Missing Evidence | Job Alignment",
      "recommendations": [{ "text": "string", "confidence": "High" | "Medium" }]
    }
  ],
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
- Categorize topReasonsForRejection explicitly into: "Actual hiring risk", "ATS discoverability opportunity", or "Optional wording improvement". Do not say "No material job requirement is marked as not evidenced" if you are simultaneously listing optimization opportunities without clarifying this distinction.
- Return exactly 5 biggest improvements. Each must be specific to the target role and focus on actual candidate value, not just lexical similarity. Do not recommend wording changes for STRONG_SEMANTIC_MATCH or EXACT_MATCH requirements unless there is a genuine clarity problem. Changing the resume should provide meaningful benefit.
- Do not assign scores, probabilities, decisions, or confidence: the backend derives those deterministically.

Respond with valid JSON only.`;

const REWRITER_SYSTEM_PROMPT = `You are an expert resume editor. Identify weak bullet points in the provided experience and projects list and rewrite them.
The input contains experience and project content, a target-job context, ranked rewrite priorities, and evidence-backed job-gap focus. Identify "weakBullets" only from the supplied experience and project arrays. Target-job data is priority context only, never independent evidence for a rewrite.
Generate only the safe before/after pairs supported by the supplied bullets. Every item listed in "weakBullets" MUST have exactly one matching pair in "improvedBulletPoints" whose "before" value is that original bullet. Do not list a weak bullet unless you can also provide its grounded improved version; return fewer than four pairs when the resume does not support more.

Rules:
- ONLY rewrite supplied experience or project bullets. Never add a new bullet based on information outside those arrays.
- Rewrite for the supplied target job, not for a generic role. When a bullet already evidences a target-job requirement, naturally foreground the overlapping job terminology and technical contribution.
- Start by comparing each individual bullet with "rewritePriorities" and "jobGapFocus". Use Critical required terms before Important terms. A bullet may be tailored only to a priority that its own text directly supports; never borrow evidence from a different bullet.
- When the target role emphasizes a specific competency (e.g., UX research, B2B sales, firmware development), foreground it only when the bullet explicitly describes an equivalent concrete activity.
- Prefer the employer's terminology when it is truthful to the original bullet. For example, an original "user interviews" bullet may foreground "UX research" or "journey mapping" only when those activities are concretely supported by that bullet.
- A target-job term may appear in an "after" bullet ONLY when the original bullet directly supports that term, an equivalent named skill/technology, or the same concrete professional activity. A MISSING requirement is never permission to add the skill, tool, responsibility, metric, or outcome to a bullet.
- When a supplied bullet truthfully supports a MATCHED or PARTIALLY MATCHED job requirement in the optional gap focus list, make that existing connection clearer. For example, preserve an explicit methodology, tool, framework, or target detail when it is already in the bullet and relevant to the target job.
- If the target job does not overlap with a bullet's supported evidence, improve clarity and impact only; do not force unrelated job terminology into it.
- Every "after" bullet MUST begin with a strong, specific action verb. Prefer verbs relevant to the field (e.g., Developed, Designed, Researched, Negotiated, Analyzed, Managed) when they are truthful to the original bullet.
- Produce a materially stronger bullet, not a light paraphrase. Improve the sentence's clarity, professional tone, domain specificity, and readable action-to-contribution structure while preserving the original meaning.
- You may improve the professional tone, action verbs, and sentence structure even if you cannot add new details. A clearer, more active phrasing is a valid improvement for a weak bullet. When the original bullet is already strong, make only minor edits or leave it unchanged.
- STRICT GROUNDING RULE: You MUST NOT invent an objective, outcome, purpose, business impact, user impact, scope, stakeholder involvement, methodology, or tool. Do not invent metrics, ownership, or responsibilities.
- Do NOT add phrases like "to identify...", "to improve...", "resulting in...", or "in order to..." unless that exact purpose or outcome is explicitly stated in the source resume facts.
- Do not infer "designed" from "ran" unless the resume explicitly supports design ownership. Do not exaggerate ownership.
- If the source bullet does not state a purpose or outcome, the rewritten bullet MUST NOT state one. A conservative, safe rewrite is always preferred over an impressive but unsupported hallucination.
- Prefer this truthful structure when the source supports it: strong action verb + specific professional work + named methodology/tool.
- Return an inference type: EXPLICITLY_STATED only when every material detail is directly stated in the original bullet; STRONGLY_SUPPORTED_INFERENCE when the rewrite is a conservative wording inference from the original; UNSUPPORTED when adding information that is not present.
- Return a confidence level: High only for EXPLICITLY_STATED; Medium for STRONGLY_SUPPORTED_INFERENCE; Low for UNSUPPORTED.
- Surface technical contribution only when the original bullet explicitly provides the relevant technologies, tools, components, methods, or domain context. Do not add technical detail that is not in the supplied bullet.
- Do not reduce the impact of the original bullet. Preserve all quantified metrics (e.g., 34%, 5,000-person) and original factual strength exactly as provided.
- You may improve clarity using metrics, outcomes, or information from elsewhere in the candidate's resume ONLY when the relationship is unambiguous and the resulting statement remains factually supported by the resume as a whole. Do NOT invent or exaggerate metrics not found in the resume.
- Keep each rewrite to one concise resume bullet. Do not add explanations, section headings, contact information, URLs, emails, phone numbers, or LinkedIn references.
- NEVER claim a bullet is weak if no meaningful supported improvement exists. Do not generate a fake rewrite simply to produce an improvement.
- If a stronger rewrite cannot be safely generated without hallucinating unsupported details, simply omit the bullet entirely. Do not list it in weakBullets.

Required JSON Schema:
{
  "weakBullets": ["string"],
  "improvedBulletPoints": [
    { "before": "string", "after": "string", "whyItIsWeak": "string", "whatInformationIsMissing": "string", "whyThisIsStronger": "string", "inferenceType": "EXPLICITLY_STATED" | "STRONGLY_SUPPORTED_INFERENCE" | "UNSUPPORTED", "confidence": "High" | "Medium" | "Low" }
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
    // Source-aware understanding gives the LLM normalized entities and their
    // local evidence without exposing raw contact data inside content fields.
    understanding: {
      inferredProfiles: resume.understanding.inferredProfiles,
      entities: resume.understanding.entities,
      educationDetails: resume.understanding.educationDetails,
      experienceDetails: resume.understanding.experienceDetails,
      projectUnderstanding: resume.understanding.projectUnderstanding,
    },
  };
}

export interface AiResumeAnalysisFree {
  tier: 'free';
  parsed: ParsedResume;
  atsScore: number;
  detectedSections: string[];
  missingSections: string[];
  basicFeedback: string[];
}

export type GapStatus = 'MATCHED' | 'PARTIALLY MATCHED' | 'MISSING' | 'NOT APPLICABLE';
export type SkillMatchClassification = 'EXACT_MATCH' | 'EXCEEDED_REQUIREMENT' | 'EQUIVALENT_MATCH' | 'RELATED_MATCH' | 'WEAK_EVIDENCE' | 'NOT_EVIDENCED' | 'NOT_APPLICABLE';
export type EvidenceLevel = 'Exact Match' | 'Strong Match' | 'Related Match' | 'Missing';

/** A source-specific resume excerpt that supports a deterministic job match. */
export type ResumeEvidenceSpan = {
  section: 'Summary' | 'Skills' | 'Languages' | 'Experience' | 'Projects' | 'Education' | 'Certifications' | 'Awards';
  /** The original parser entry containing the support. */
  text: string;
  /** Character offsets within text for the matched term or related phrase. */
  start: number;
  end: number;
  /** Exact text at the span, retained for traceable ATS explanations. */
  matchedText: string;
  /** Deterministic lexical/semantic support score used before a citation is shown. */
  confidence: number;
  /** Project title when the evidence is inside a structured project entry. */
  context?: string;
};

const MIN_CITATION_CONFIDENCE = 0.72;

export type JobGapItem = {
  skill: string;
  requirementType: 'education' | 'skill';
  status: GapStatus;
  /** Four-level evidence decision used by all new matching conclusions. */
  evidenceLevel: EvidenceLevel;
  /** Deterministic confidence from explicitness and evidence source quality. */
  evidenceConfidence: number;
  evidenceQuality: 'High' | 'Medium' | 'Low' | 'None';
  /** Exclusive deterministic tier; never derived from model certainty. */
  matchTier: 'Strong Match' | 'Exceeded Requirement' | 'Equivalent Match' | 'Related Match' | 'Weak Evidence' | 'Missing' | 'Not Applicable';
  /** Debuggable threshold responsible for the tier. */
  matchTrigger: 'normalized_exact' | 'recognized_synonym' | 'qualification_exceeds_requirement' | 'credential_subsumption' | 'related_evidence' | 'weak_evidence' | 'no_evidence' | 'not_applicable';
  /** Distinguishes an exact tool match from transferable parent/family evidence. */
  matchClassification: SkillMatchClassification;
  matchReason: string;
  /** Legacy text-only evidence retained for existing consumers. */
  evidence: string[];
  /** Source-aware support for matched and partially matched requirements. */
  evidenceSpans: ResumeEvidenceSpan[];
  /** Ordered verification question that produced this final classification. */
  verificationStep: 1 | 2 | 3 | 4 | 5 | 6 | 0;
  recommendation: string;
};

export type EducationAlignmentItem = {
  requirement: string;
  status: 'Direct Match' | 'Related Match' | 'Missing';
  evidence: ResumeEvidenceSpan[];
  confidence: number;
  reason: string;
};

/** Evidence for a job responsibility. Responsibilities are assessed separately
 * from skills so they can inform role fit without being presented as skills. */
export type ResponsibilityGapItem = {
  responsibility: string;
  status: GapStatus;
  matchClassification: 'EXACT_PRACTICAL_EVIDENCE' | 'IMPLIED_PRACTICAL_EVIDENCE' | 'NOT_EVIDENCED';
  matchReason: string;
  evidence: string[];
};

export type JobGapAnalysis = {
  verificationCompleted: true;
  items: JobGapItem[];
  responsibilities: ResponsibilityGapItem[];
};

/** A normalized, ranked view of the supplied role used by all analysis stages. */
export type JobProfile = {
  title: string;
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  priorities: { requirement: string; priority: 'Critical' | 'Important' | 'Supporting'; source: 'required' | 'preferred' | 'responsibility' }[];
};

export type AtsDimensionBreakdown = {
  structure: { score: number; reasons: string[] };
  technicalSkillCoverage: { score: number; reasons: string[] };
  experienceRelevance: { score: number; reasons: string[] };
  keywordCoverage: { score: number; reasons: string[] };
  sectionQuality: { score: number; reasons: string[] };
  readability: { score: number; reasons: string[] };
  evidenceStrength: { score: number; reasons: string[] };
  total: number;
};

export type AtsDisplayBreakdownItem = {
  label: 'Section Recognition' | 'Readability & Formatting' | 'Impact & Metrics' | 'Resume Quality';
  score: number;
  maximum: number;
  explanation: string;
};

export type JobMatchBreakdown = {
  requiredSkills: number;
  requiredExperience: number;
  preferredSkills: number;
  industryRelevance: number;
  projectRelevance: number;
  roleSimilarity: number;
  educationAlignment: number;
  keywordCoverage: number;
  weights: {
    requiredSkills: number;
    preferredSkills: number;
    requiredExperience: number;
    industryRelevance: number;
    projectRelevance: number;
    roleSimilarity: number;
    educationAlignment: number;
    keywordCoverage: number;
  };
  total: number;
  topStrengths: string[];
  topGaps: string[];
};

export type KeywordRecommendation = {
  keyword: string;
  priority: 'Critical' | 'Important' | 'Nice-to-Have';
  whyItMatters: string;
  recommendedSection: 'Skills' | 'Experience' | 'Projects';
};

/** ATS-facing keyword coverage, deliberately separate from ATS and Job Match scores. */
export type KeywordCompatibility = {
  overallMatch: number;
  exactMatches: string[];
  semanticMatches: string[];
  underExpressed: string[];
  missing: string[];
  analysisFailed: string[];
};

export const COACHING_REPORT_CATEGORIES = [
  'Summary', 'Experience', 'Projects', 'Skills', 'Education', 'ATS Formatting',
  'Keyword Usage', 'Technical Depth', 'Action Verbs', 'Quantification',
  'Missing Evidence', 'Job Alignment',
] as const;

export type CoachingReportCategory = typeof COACHING_REPORT_CATEGORIES[number];
export type CoachingReportSection = {
  category: CoachingReportCategory;
  recommendations: string[];
};

type GapRule = { direct: string[]; partial: string[] };

type SkillFamily = {
  id: string;
  requirementAliases: string[];
  members: string[];
  parentEvidence: string[];
};

/**
 * Reusable technology families prevent one tool from being described as both
 * absent and evidenced through its transferable parent capability.
 */
const SKILL_FAMILIES: SkillFamily[] = [
  {
    id: 'microcontroller-embedded-hardware',
    requirementAliases: ['microcontroller', 'microcontrollers', 'arduino', 'esp32', 'stm32', 'pic', 'avr', 'raspberry pi'],
    members: ['arduino', 'esp32', 'stm32', 'pic', 'avr', 'raspberry pi'],
    parentEvidence: ['microcontroller', 'microcontroller based', 'embedded hardware', 'embedded systems', 'embedded programming'],
  },
];

const GAP_RULES: Record<string, GapRule> = {
  'control systems': { direct: ['control systems', 'pid control', 'pid controller', 'pid'], partial: ['automation', 'robotics', 'motion control'] },
  'sensor integration': { direct: ['sensor integration', 'sensor interfacing', 'interfacing sensors', 'sensor interface'], partial: ['sensor', 'lidar', 'plc', 'bldc', 'motor'] },
  'firmware development': { direct: ['firmware', 'firmware development'], partial: ['embedded programming', 'embedded systems', 'microcontroller'] },
  'embedded programming': { direct: ['embedded programming'], partial: ['embedded systems', 'firmware', 'microcontroller', 'arduino'] },
  'embedded systems': { direct: ['embedded systems', 'arduino', 'esp32', 'stm32', 'microcontroller interfacing'], partial: ['firmware', 'embedded programming', 'microcontroller'] },
  'c programming': { direct: ['c programming', 'embedded c'], partial: ['c++'] },
  'finite element analysis': { direct: ['finite element analysis', 'ansys', 'structural analysis'], partial: ['simulation'] },
  '3d cad modeling': { direct: ['3d cad modeling', 'solidworks', 'autocad', 'cad design'], partial: ['mechanical design'] },
  'cad design': { direct: ['cad design', 'autocad', 'solidworks'], partial: ['mechanical design', '3d modeling'] },
  microcontrollers: { direct: ['microcontroller', 'arduino', 'stm32', 'esp32'], partial: ['embedded systems'] },
  'pcb testing': { direct: ['pcb testing', 'board testing', 'pcb validation'], partial: ['altium', 'pcb design'] },
  'pcb design': { direct: ['pcb design', 'pcb layout'], partial: ['circuit design', 'circuit validation', 'altium', 'proteus'] },
  'circuit validation': { direct: ['circuit validation', 'circuit testing'], partial: ['circuit design', 'proteus', 'ltspice', 'simulation'] },
  'mechanical design': { direct: ['mechanical design', 'solidworks', 'cad design', 'autocad'], partial: ['assembly design', '3d modeling'] },
  'technical documentation': { direct: ['technical documentation', 'test report', 'design document', 'documentation'], partial: ['report', 'presented'] },
  'sensors and actuators': { direct: ['sensor', 'actuator', 'motor'], partial: ['lidar', 'blcd', 'robotic arm'] },
  'c cplusplus': { direct: ['c++', 'c programming', 'cplusplus'], partial: [] },
  proteus: { direct: ['proteus'], partial: ['circuit simulation', 'ltspice'] },
  stm32: { direct: ['stm32'], partial: ['microcontroller', 'arduino', 'esp32'] },
  esp32: { direct: ['esp32'], partial: ['microcontroller', 'arduino', 'stm32'] },
  mechatronics: { direct: ['mechatronics'], partial: ['electrical engineering', 'electronics engineering'] },
  python: { direct: ['python'], partial: [] },
  javascript: { direct: ['javascript', 'js'], partial: ['typescript'] },
  typescript: { direct: ['typescript'], partial: ['javascript'] },
  java: { direct: ['java'], partial: [] },
  sql: { direct: ['sql', 'postgresql', 'mysql', 'sqlite'], partial: ['database'] },
  react: { direct: ['react'], partial: ['reactjs', 'react js'] },
  'node js': { direct: ['node js', 'nodejs'], partial: ['javascript', 'typescript'] },
  'machine learning': { direct: ['machine learning', 'ml'], partial: ['tensorflow', 'pytorch', 'scikit learn', 'model training'] },
  tensorflow: { direct: ['tensorflow'], partial: ['machine learning', 'pytorch'] },
  pytorch: { direct: ['pytorch'], partial: ['machine learning', 'tensorflow'] },
  'data pipelines': { direct: ['data pipeline', 'etl pipeline'], partial: ['etl', 'data engineering', 'airflow'] },
  aws: { direct: ['aws', 'amazon web services'], partial: ['cloud', 'azure', 'google cloud'] },
  azure: { direct: ['azure'], partial: ['cloud', 'aws', 'google cloud'] },
  'google cloud': { direct: ['google cloud', 'gcp'], partial: ['cloud', 'aws', 'azure'] },
  docker: { direct: ['docker'], partial: ['container', 'kubernetes'] },
  kubernetes: { direct: ['kubernetes', 'k8s'], partial: ['container', 'docker'] },
  'network security': { direct: ['network security', 'networking security'], partial: ['firewall', 'networking', 'security'] },
  splunk: { direct: ['splunk'], partial: ['siem', 'soc', 'log analysis'] },
  wazuh: { direct: ['wazuh'], partial: ['siem', 'soc', 'security monitoring'] },
  siem: { direct: ['siem'], partial: ['splunk', 'wazuh', 'security monitoring'] },
  'incident response': { direct: ['incident response'], partial: ['security incident', 'threat investigation', 'forensics'] },
  'penetration testing': { direct: ['penetration testing', 'pen testing'], partial: ['vulnerability assessment', 'ethical hacking'] },
  ros: { direct: ['ros', 'ros2'], partial: ['robot operating system', 'robotics'] },
};

/**
 * Indirect context is deliberately kept separate from the closely related
 * terminology above. It can support a cautious observation, never a claim
 * that the exact requirement has been demonstrated.
 */
const WEAK_EVIDENCE_RULES: Record<string, string[]> = {
  'strong swimmer': ['scientific diver', 'open water research', 'open water diving', 'diving'],
};

/**
 * Domain concepts let responsibility matching use observable work concepts
 * instead of coincidental word overlap (for example, "testing" or "systems").
 */
const RESPONSIBILITY_CONCEPTS: Record<string, string[]> = {
  embedded: ['embedded', 'firmware', 'microcontroller', 'arduino', 'stm32', 'esp32'],
  sensors: ['sensor', 'lidar', 'actuator', 'motor', 'plc'],
  testing: ['test', 'testing', 'validation', 'debug', 'troubleshoot', 'qa'],
  hardware: ['hardware', 'pcb', 'circuit', 'board', 'electronics'],
  software: ['software', 'application', 'api', 'backend', 'frontend'],
  cloud: ['cloud', 'aws', 'azure', 'gcp', 'docker', 'kubernetes'],
  security: ['security', 'siem', 'soc', 'incident', 'vulnerability', 'firewall'],
  data: ['data', 'database', 'etl', 'analytics', 'machine learning', 'model'],
  automation: ['automation', 'automated', 'robotics', 'robotic', 'control'],
  assembly: ['assembly', 'assemble', 'breadboard', 'prototype', 'prototyping', 'hardware integration'],
  calibration: ['calibration', 'calibrate', 'sensor testing', 'testing', 'test', 'validation', 'debug'],
  integration: ['integration', 'interface', 'interfacing', 'sensor interface', 'hardware interface'],
  documentation: ['documentation', 'document', 'report', 'technical writing'],
};

function normalizeGapTerm(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/\bpadi\s+aow\b/g, 'padi advanced open water')
    .replace(/c\+\+/g, 'cplusplus')
    .replace(/c#/g, 'csharp')
    .replace(/[^a-z0-9+\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // Job parsers and PDFs commonly separate the ESP32 model token. Keep all
    // visible forms in one canonical representation before hierarchy lookup.
    .replace(/\besp\s+32\b/g, 'esp32');
}

type DegreeRequirement = { level: number; fields: string[] };

function isEducationRequirement(value: string): boolean {
  const normalized = normalizeGapTerm(value);
  return Boolean(degreeLevel(value)) || /\b(?:degree|undergraduate|bachelors?|masters?|phd|doctorate|qualification)\b/.test(normalized);
}

const RELATED_ENGINEERING_FIELDS = new Set([
  'mechatronics', 'mechanical', 'electrical', 'electronics', 'robotics', 'computer engineering',
]);

function degreeLevel(value: string): number {
  const normalized = normalizeGapTerm(value);
  if (/\b(?:phd|doctorate|doctoral|doctor of)\b/.test(normalized)) return 3;
  if (/\b(?:master|msc|m sc|m s|meng|m eng|ma)\b/.test(normalized)) return 2;
  if (/\b(?:bachelor|bsc|b sc|b s|beng|b eng|ba)\b/.test(normalized)) return 1;
  return 0;
}

function degreeRequirement(value: string): DegreeRequirement | null {
  const level = degreeLevel(value);
  if (!level) return null;
  const rawNormalized = normalizeGapTerm(value);
  const knownFields = [...RELATED_ENGINEERING_FIELDS]
    .filter((field) => containsNormalizedPhrase(rawNormalized, field));
  if (knownFields.length) return { level, fields: knownFields };
  const normalized = rawNormalized
    .replace(/\b(?:bachelor(?:s|\s+s)?|master(?:s|\s+s)?|bsc|b sc|b s|beng|b eng|msc|m sc|m s|meng|m eng|ma|phd|doctorate|doctoral|doctor of|degree|science|arts|engineering)\b/g, ' ')
    .replace(/\b(?:in|of|or related field|related field)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const fields = normalized.split(/\s+or\s+|\//).map((field) => field.trim()).filter((field) => field.length >= 3);
  // A fieldless requirement (for example, "Bachelor's degree") is still a
  // valid education requirement and can be satisfied by any explicit degree.
  return { level, fields };
}

/**
 * Matches complete normalized tokens/phrases only. This deliberately rejects
 * substring coincidences such as the requirement "CAD" inside "academic".
 */
function containsNormalizedPhrase(source: string, term: string): boolean {
  const normalizedSource = normalizeGapTerm(source);
  const normalizedTerm = normalizeGapTerm(term);
  if (!normalizedTerm) return false;
  if (` ${normalizedSource} `.includes(` ${normalizedTerm} `)) return true;

  // Preserve common resume wording variants ("data pipeline" / "data
  // pipelines") without falling back to character-substring matching.
  const sourceTokens = normalizedSource.split(' ').filter(Boolean);
  const termTokens = normalizedTerm.split(' ').filter(Boolean);
  if (!termTokens.length || sourceTokens.length < termTokens.length) return false;
  const pluralOf = (token: string) => token.endsWith('y')
    ? `${token.slice(0, -1)}ies`
    : `${token}s`;
  return sourceTokens.some((_, start) => termTokens.every((token, index) => {
    const sourceToken = sourceTokens[start + index];
    return sourceToken === token || (index === termTokens.length - 1 && sourceToken === pluralOf(token));
  }));
}

function gapRuleForSkill(normalizedSkill: string): GapRule {
  const family = SKILL_FAMILIES.find((candidate) =>
    candidate.requirementAliases.some((alias) => normalizeGapTerm(alias) === normalizedSkill),
  );
  if (!family) {
    return GAP_RULES[normalizedSkill] || {
      direct: [normalizedSkill],
      partial: normalizedSkill.split(' ').filter((word) => word.length > 3),
    };
  }

  const isParentRequirement = ['microcontroller', 'microcontrollers'].includes(normalizedSkill);
  const existing = GAP_RULES[normalizedSkill];
  return {
    // A generic microcontroller requirement is fully met by a named family
    // member. A specific tool remains an exact match only to itself.
    direct: uniqueGapEvidence([
      ...(isParentRequirement ? [...family.members, 'microcontroller', 'microcontrollers'] : [normalizedSkill]),
      ...(existing?.direct || []),
    ]),
    partial: uniqueGapEvidence([
      ...(isParentRequirement ? family.parentEvidence : [
        ...family.members.filter((member) => member !== normalizedSkill),
        ...family.parentEvidence,
      ]),
      ...(existing?.partial || []),
    ]).filter((term) => !containsNormalizedPhrase(term, normalizedSkill)),
  };
}

function weakEvidenceTermsForSkill(normalizedSkill: string): string[] {
  return WEAK_EVIDENCE_RULES[normalizedSkill] || [];
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

export type ResumeEvidenceSource = {
  section: ResumeEvidenceSpan['section'];
  text: string;
  context?: string;
};

export type ResumeEvidenceIndexEntry = {
  canonical: string;
  kind: 'education' | 'certification' | 'skill' | 'language' | 'experience' | 'project' | 'summary' | 'award' | 'other';
  section: ResumeEvidenceSpan['section'];
  text: string;
  confidence: number;
  reason: string;
  context?: string;
};

export type ResumeEvidenceIndex = {
  sources: ResumeEvidenceSource[];
  entries: ResumeEvidenceIndexEntry[];
};

const EVIDENCE_SEARCH_SCOPE = 'Certifications, Education, Skills, Languages, Experience, Projects, Summary, and Awards';

/** Formats the exact deterministic evidence behind a requirement conclusion. */
function requirementEvidenceCitation(item: JobGapItem): string {
  const span = item.evidenceSpans[0];
  if (span) {
    const context = span.context ? `${span.context}: ` : '';
    return `Requirement: ${item.skill}. Evidence: ${span.section} — "${context}${span.text}". Classification: ${item.matchTier}.`;
  }
  return `Requirement: ${item.skill}. Evidence searched: ${EVIDENCE_SEARCH_SCOPE}; no matching resume evidence was found. Classification: Missing.`;
}

function requirementEvidenceCitationList(items: JobGapItem[], limit = 3): string[] {
  return items.slice(0, limit).map(requirementEvidenceCitation);
}

function uniqueEvidenceSpans(values: ResumeEvidenceSpan[]): ResumeEvidenceSpan[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = [value.section, value.text, value.start, value.end, value.context || ''].join('|').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Returns the actual span inside a parser entry. Normalized matching is used
 * for classification, while this function retains a readable original-text
 * offset for explanations and downstream auditability.
 */
function evidenceSpanFor(source: ResumeEvidenceSource, term: string, confidence: number): ResumeEvidenceSpan {
  const normalizedTerm = normalizeGapTerm(term);
  const lowerText = source.text.toLowerCase();
  const directIndex = lowerText.indexOf(term.toLowerCase());
  const originalTokens = term.match(/[A-Za-z0-9+#]+/g) || [];
  const anchor = originalTokens.find((token) => token.length > 1) || originalTokens[0] || term;
  const anchorIndex = lowerText.indexOf(anchor.toLowerCase());
  const start = directIndex >= 0 ? directIndex : anchorIndex >= 0 ? anchorIndex : 0;
  const end = directIndex >= 0 ? start + term.length : anchorIndex >= 0 ? start + anchor.length : source.text.length;
  return {
    section: source.section,
    text: source.text,
    start,
    end,
    matchedText: source.text.slice(start, end) || normalizedTerm,
    confidence,
    ...(source.context ? { context: source.context } : {}),
  };
}

function matchingEvidenceSpans(sources: ResumeEvidenceSource[], terms: string[], confidence: number): ResumeEvidenceSpan[] {
  return uniqueEvidenceSpans(sources.flatMap((source) => {
    const matchedTerm = terms.find((term) => {
      return containsNormalizedPhrase(source.text, term);
    });
    return matchedTerm ? [evidenceSpanFor(source, matchedTerm, confidence)] : [];
  }));
}

/**
 * Some engineering requirements have a stable, concrete wording equivalence
 * that is stronger than a loose related-skill inference. Keep it explicit so
 * only observable terms in the same resume entry can earn direct credit.
 */
function recognizedDirectEvidenceSpans(
  sources: ResumeEvidenceSource[],
  normalizedSkill: string,
): ResumeEvidenceSpan[] {
  if (normalizedSkill !== 'sensor integration') return [];
  return uniqueEvidenceSpans(sources.flatMap((source) => {
    const text = normalizeGapTerm(source.text);
    const hasSensor = /\b(?:sensor|sensors|lidar)\b/.test(text);
    const hasIntegrationAction = /\b(?:interface|interfacing|integration|integrated|plc|bldc|motor)\b/.test(text);
    return hasSensor && hasIntegrationAction
      ? [evidenceSpanFor(source, hasSensor ? 'sensor' : 'integration', 0.95)]
      : [];
  }));
}

/** A higher/equal degree in the requested or listed alternate field satisfies an education requirement. */
function credentialSubsumptionEvidenceSpans(
  sources: ResumeEvidenceSource[],
  requirement: string,
): ResumeEvidenceSpan[] {
  const degree = degreeRequirement(requirement);
  if (!degree) return [];
  const sectionPriority: Record<ResumeEvidenceSpan['section'], number> = {
    Education: 0, Summary: 1, Experience: 2, Skills: 9, Languages: 9,
    Projects: 9, Certifications: 9, Awards: 9,
  };
  return uniqueEvidenceSpans([...sources]
    .sort((left, right) => sectionPriority[left.section] - sectionPriority[right.section])
    .flatMap((source) => {
    // Degrees are only valid when explicitly stated in Education first,
    // followed by Summary and then Experience. Certifications and institution
    // names must never satisfy an education requirement.
    if (!['Education', 'Summary', 'Experience'].includes(source.section) || degreeLevel(source.text) < degree.level) return [];
    if (degree.fields.length === 0) return [evidenceSpanFor(source, source.text, 1)];
    const field = degree.fields.find((candidate) => containsNormalizedPhrase(source.text, candidate));
    return field ? [evidenceSpanFor(source, field, 1)] : [];
  }));
}

/** Distinguishes a higher degree from an equal-level degree equivalence. */
function qualificationExceedsRequirement(
  sources: ResumeEvidenceSource[],
  requirement: string,
): boolean {
  const degree = degreeRequirement(requirement);
  if (!degree) return false;
  return sources.some((source) =>
    ['Education', 'Summary', 'Experience'].includes(source.section)
    && degreeLevel(source.text) > degree.level
    && (degree.fields.length === 0 || degree.fields.some((field) => containsNormalizedPhrase(source.text, field))),
  );
}

/** Related engineering disciplines may receive related—not direct—credit. */
function relatedDegreeEvidenceSpans(
  sources: ResumeEvidenceSource[],
  requirement: string,
): ResumeEvidenceSpan[] {
  const degree = degreeRequirement(requirement);
  if (!degree || degree.fields.length === 0) return [];
  const allowedSections = new Set<ResumeEvidenceSpan['section']>(['Education', 'Summary', 'Experience']);
  const priority: Record<ResumeEvidenceSpan['section'], number> = {
    Education: 0, Summary: 1, Experience: 2, Skills: 9, Languages: 9,
    Projects: 9, Certifications: 9, Awards: 9,
  };
  return uniqueEvidenceSpans([...sources]
    .sort((left, right) => priority[left.section] - priority[right.section])
    .flatMap((source) => {
      if (!allowedSections.has(source.section) || degreeLevel(source.text) < degree.level) return [];
      const documentedField = [...RELATED_ENGINEERING_FIELDS]
        .find((field) => containsNormalizedPhrase(source.text, field));
      return documentedField && !degree.fields.includes(documentedField)
        ? [evidenceSpanFor(source, documentedField, 0.68)]
        : [];
    }));
}

function buildEducationAlignment(items: JobGapItem[]): EducationAlignmentItem[] {
  return items
    .filter((item) => item.requirementType === 'education')
    .map((item) => ({
      requirement: item.skill,
      status: item.status === 'MATCHED' ? 'Direct Match' : item.status === 'PARTIALLY MATCHED' ? 'Related Match' : 'Missing',
      evidence: item.evidenceSpans,
      confidence: item.status === 'MATCHED' ? 100 : item.status === 'PARTIALLY MATCHED' ? 68 : 0,
      reason: item.status === 'MATCHED'
        ? `The resume explicitly satisfies this qualification. ${requirementEvidenceCitation(item)}`
        : item.status === 'PARTIALLY MATCHED'
          ? `The resume shows a related qualification. ${requirementEvidenceCitation(item)}`
          : `No explicit degree evidence was found in Education, Summary, or Experience for this qualification.`,
    }));
}

function buildResumeEvidenceSources(
  resume: Pick<StructuredResume, 'summary' | 'experience' | 'projects' | 'skills' | 'education' | 'certifications' | 'awards'>
    & Partial<Pick<StructuredResume, 'projectDetails' | 'languages'>>,
): ResumeEvidenceSource[] {
  const sourceList = (section: ResumeEvidenceSpan['section'], values: string[]): ResumeEvidenceSource[] =>
    values.filter((value) => typeof value === 'string' && Boolean(value.trim())).map((text) => ({ section, text }));
  const structuredProjectSources = (resume.projectDetails || []).flatMap((project) => {
    const context = project.title.trim();
    return [project.description, ...project.bullets, ...project.technologies, ...project.outcomes]
      .filter((text) => typeof text === 'string' && Boolean(text.trim()))
      .map((text) => ({ section: 'Projects' as const, text, ...(context ? { context } : {}) }));
  });

  // Explicit evidence sources are deliberately ordered before practical and
  // inferred evidence. This order is the source of truth for exact citations.
  return [
    ...sourceList('Certifications', resume.certifications),
    ...sourceList('Education', resume.education),
    ...sourceList('Skills', resume.skills),
    ...sourceList('Languages', resume.languages || []),
    ...sourceList('Experience', resume.experience),
    ...structuredProjectSources,
    ...sourceList('Projects', resume.projects),
    ...(resume.summary.trim() ? [{ section: 'Summary' as const, text: resume.summary }] : []),
    ...sourceList('Awards', resume.awards),
  ];
}

function canonicalEvidenceValue(value: string): string {
  const normalized = normalizeGapTerm(value);
  if (/\bpadi\s+(?:advanced\s+open\s+water|aow)\b/.test(normalized)) return 'padi advanced open water certification';
  if (/\bsolidworks?\b/.test(normalized)) return 'solidworks';
  return normalized;
}

/**
 * Builds one global, source-aware view before requirement matching. The index
 * keeps the original text and section so a later explanation cites the same
 * span that produced its Strong/Partial/Missing decision.
 */
export function buildResumeEvidenceIndex(
  resume: Pick<StructuredResume, 'summary' | 'experience' | 'projects' | 'skills' | 'education' | 'certifications' | 'awards'>
    & Partial<Pick<StructuredResume, 'projectDetails' | 'languages'>>,
): ResumeEvidenceIndex {
  const sources = buildResumeEvidenceSources(resume);
  const kindFor = (section: ResumeEvidenceSpan['section']): ResumeEvidenceIndexEntry['kind'] => ({
    Education: 'education', Certifications: 'certification', Skills: 'skill', Experience: 'experience',
    Projects: 'project', Summary: 'summary', Awards: 'award', Languages: 'language',
  }[section] || 'other') as ResumeEvidenceIndexEntry['kind'];
  const entries = sources.map((source) => ({
    canonical: canonicalEvidenceValue(source.text),
    kind: kindFor(source.section),
    section: source.section,
    text: source.text,
    confidence: 1,
    reason: `Explicit ${source.section.toLowerCase()} evidence indexed from the parsed resume.`,
    ...(source.context ? { context: source.context } : {}),
  }));
  return { sources, entries };
}

/** Finds the first highest-priority source that explicitly supports a term. */
function indexedExactEvidenceSpans(index: ResumeEvidenceIndex, terms: string[]): ResumeEvidenceSpan[] {
  for (const source of index.sources) {
    const term = terms.find((candidate) => containsNormalizedPhrase(source.text, candidate));
    if (term) return [evidenceSpanFor(source, term, 1)];
  }
  return [];
}

function jobTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => {
      const key = normalizeGapTerm(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

const RAW_JOB_TECHNICAL_TERMS = [
  'C++', 'C#', 'Python', 'Java', 'JavaScript', 'TypeScript', 'SQL', 'React', 'Angular', 'Node.js',
  'Docker', 'Kubernetes', 'Terraform', 'AWS', 'Azure', 'Google Cloud', 'PostgreSQL', 'MongoDB',
  'TensorFlow', 'PyTorch', 'Machine Learning', 'Data Pipelines', 'Firmware Development',
  'Embedded Programming', 'Arduino', 'STM32', 'ESP32', 'PCB Testing', 'Circuit Validation',
  'Proteus', 'LTSpice', 'ROS', 'ROS2', 'Sensor Integration', 'Splunk', 'Wazuh', 'SIEM',
  'SOC', 'Network Security', 'Incident Response', 'Penetration Testing', 'Linux', 'Git',
  'MATLAB', 'SolidWorks', 'AutoCAD', 'ANSYS', 'Finite Element Analysis', 'Control Systems',
  'CAD Design', '3D CAD Modeling', 'Embedded C', 'C Programming',
] as const;

/** Splits an explicit JD alternative ("Python, C++, or MATLAB") into choices. */
function requirementAlternatives(requirement: string): string[] {
  const normalized = normalizeGapTerm(requirement);
  if (!/\b(?:or|such as|either)\b/.test(normalized)) return [requirement];
  const candidates = RAW_JOB_TECHNICAL_TERMS
    .filter((term) => containsNormalizedPhrase(requirement, term));
  return candidates.length >= 2 ? uniqueGapEvidence(candidates) : [requirement];
}

function evidenceConfidenceFor(level: EvidenceLevel, spans: ResumeEvidenceSpan[]): number {
  const section = spans[0]?.section;
  if (level === 'Exact Match') return section === 'Education' || section === 'Certifications' ? 98 : 96;
  if (level === 'Strong Match') return 85;
  if (level === 'Related Match') return 68;
  return 0;
}

function evidenceQualityFor(level: EvidenceLevel): JobGapItem['evidenceQuality'] {
  if (level === 'Exact Match') return 'High';
  if (level === 'Strong Match') return 'Medium';
  if (level === 'Related Match') return 'Low';
  return 'None';
}

function jobTermAppearsInSource(term: string, jobDescription: string): boolean {
  const normalizedTerm = normalizeGapTerm(term);
  return Boolean(normalizedTerm) && normalizeGapTerm(jobDescription).includes(normalizedTerm);
}

function rawJobTermIsPreferred(term: string, jobDescription: string): boolean {
  const normalizedTerm = normalizeGapTerm(term);
  const lines = String(jobDescription || '').split(/\r?\n/);
  const index = lines.findIndex((line) => normalizeGapTerm(line).includes(normalizedTerm));
  if (index < 0) return false;
  const context = normalizeGapTerm([lines[index - 1], lines[index]].filter(Boolean).join(' '));
  return /\b(?:preferred|bonus|nice to have|plus|desirable)\b/.test(context)
    && !/\b(?:required|must have|mandatory|essential|requirements?)\b/.test(context);
}

/**
 * Recovers visible responsibility bullets directly from the supplied job text.
 * LLM-parsed responsibilities are accepted only when they occur in that text,
 * so an invented responsibility cannot change a score or recommendation.
 */
function extractSourceResponsibilities(jobDescription: string): string[] {
  const lines = String(jobDescription || '').replace(/\r\n/g, '\n').split('\n');
  const responsibilities: string[] = [];
  let inResponsibilities = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    const normalized = normalizeGapTerm(line);
    if (!normalized) continue;
    if (/^(?:responsibilities|what you will do|duties|key duties|role responsibilities)$/.test(normalized)) {
      inResponsibilities = true;
      continue;
    }
    if (/^(?:requirements|qualifications|skills|preferred|nice to have|education|about the role)$/.test(normalized)) {
      inResponsibilities = false;
      continue;
    }
    if (!inResponsibilities) continue;
    const cleaned = line.replace(/^(?:[-*â€¢]+|\d+[.)])\s*/, '').trim();
    if (cleaned.length >= 8 && cleaned.length <= 260) responsibilities.push(cleaned);
  }
  return jobTextList(responsibilities);
}

/**
 * Validates AI-parsed job requirements against the original job description
 * and recovers recognised technical requirements that the parser omitted.
 */
export function validateAndEnrichParsedJob(
  rawJob: Record<string, unknown>,
  jobDescription: string,
): { title: string; requiredSkills: string[]; preferredSkills: string[]; responsibilities: string[] } {
  const sourceRequired = jobTextList(rawJob.requiredSkills).filter((term) => jobTermAppearsInSource(term, jobDescription));
  const sourcePreferred = jobTextList(rawJob.preferredSkills).filter((term) => jobTermAppearsInSource(term, jobDescription));
  const sourceResponsibilities = jobTextList(rawJob.responsibilities)
    .filter((term) => jobTermAppearsInSource(term, jobDescription));
  const recoveredTerms = RAW_JOB_TECHNICAL_TERMS.filter((term) => jobTermAppearsInSource(term, jobDescription));
  const requiredSkills = uniqueGapEvidence([
    ...sourceRequired,
    ...recoveredTerms.filter((term) => !rawJobTermIsPreferred(term, jobDescription)),
  ]);
  const preferredSkills = uniqueGapEvidence([
    ...sourcePreferred,
    ...recoveredTerms.filter((term) => rawJobTermIsPreferred(term, jobDescription)),
  ]).filter((term) => !requiredSkills.some((required) => normalizeGapTerm(required) === normalizeGapTerm(term)));
  const titleFromSource = jobDescription.match(/(?:job\s*title|position|role)\s*:\s*([^\n]+)/i)?.[1]?.trim() || '';
  const parsedTitle = typeof rawJob.title === 'string' ? rawJob.title.trim() : '';
  return {
    title: titleFromSource || parsedTitle || 'Target Role',
    requiredSkills,
    preferredSkills,
    responsibilities: uniqueGapEvidence([
      ...sourceResponsibilities,
      ...extractSourceResponsibilities(jobDescription),
    ]),
  };
}

/**
 * Converts the parsed job description into a stable job-led reasoning model.
 * Required requirements outrank preferred requirements; responsibilities add
 * role context without being misrepresented as candidate skills.
 */
export function buildJobProfile(job: {
  title?: unknown;
  requiredSkills?: unknown;
  preferredSkills?: unknown;
  responsibilities?: unknown;
}): JobProfile {
  const requiredSkills = jobTextList(job.requiredSkills);
  const preferredSkills = jobTextList(job.preferredSkills)
    .filter((skill) => !requiredSkills.some((required) => normalizeGapTerm(required) === normalizeGapTerm(skill)));
  const responsibilities = jobTextList(job.responsibilities);
  return {
    title: typeof job.title === 'string' && job.title.trim() ? job.title.trim() : 'Target Role',
    requiredSkills,
    preferredSkills,
    responsibilities,
    priorities: [
      ...requiredSkills.map((requirement) => ({ requirement, priority: 'Critical' as const, source: 'required' as const })),
      ...preferredSkills.map((requirement) => ({ requirement, priority: 'Important' as const, source: 'preferred' as const })),
      ...responsibilities.map((requirement) => ({ requirement, priority: 'Supporting' as const, source: 'responsibility' as const })),
    ],
  };
}

/**
 * Ordered verification pass. It must complete before any downstream ATS,
 * Job Match, keyword, interview, hiring-summary, or recommendation logic can
 * consume a requirement conclusion.
 */
export function buildJobGapAnalysis(
  resume: Pick<StructuredResume, 'summary' | 'experience' | 'projects' | 'skills' | 'education' | 'certifications' | 'awards'>,
  job: { requiredSkills?: unknown; responsibilities?: unknown },
  suppliedEvidenceIndex?: ResumeEvidenceIndex,
): JobGapAnalysis {
  const requiredSkills = Array.isArray(job.requiredSkills)
    ? job.requiredSkills.filter((skill): skill is string => typeof skill === 'string' && Boolean(skill.trim()))
    : [];
  const evidenceIndex = suppliedEvidenceIndex || buildResumeEvidenceIndex(resume);
  const evidenceSources = evidenceIndex.sources;

  const items = requiredSkills.map((skill) => {
      const normalizedSkill = normalizeGapTerm(skill);
      const requirementType = isEducationRequirement(skill) ? 'education' as const : 'skill' as const;
      if (!normalizedSkill || /^(?:n a|not applicable)$/i.test(normalizedSkill)) {
        return {
          skill,
          requirementType,
          status: 'NOT APPLICABLE' as const,
          matchTier: 'Not Applicable' as const,
          matchTrigger: 'not_applicable' as const,
          matchClassification: 'NOT_APPLICABLE' as const,
          evidenceLevel: 'Missing' as const,
          evidenceConfidence: 0,
          evidenceQuality: 'None' as const,
          matchReason: 'No comparison is required for this non-applicable requirement.',
          evidence: [],
          evidenceSpans: [],
          verificationStep: 0 as const,
          recommendation: 'No resume action is needed for this non-applicable requirement.',
        };
      }

      const alternatives = requirementAlternatives(skill);
      // A JD phrase joined with "or" is one alternative requirement, not a
      // checklist. Select the first directly evidenced option for comparison.
      const comparisonSkill = alternatives.find((alternative) => {
        const alternativeRule = gapRuleForSkill(normalizeGapTerm(alternative));
        return indexedExactEvidenceSpans(evidenceIndex, [alternative]).length > 0
          || indexedExactEvidenceSpans(evidenceIndex, alternativeRule.direct).length > 0
          || recognizedDirectEvidenceSpans(evidenceSources, normalizeGapTerm(alternative)).length > 0;
      }) || alternatives[0] || skill;
      const comparisonNormalizedSkill = normalizeGapTerm(comparisonSkill);
      const rule = gapRuleForSkill(comparisonNormalizedSkill);
      // Exact normalized phrase matching runs before hierarchy/related terms.
      // A literal or normalized abbreviation match is a Strong Match and no
      // later fuzzy/related stage is allowed to downgrade it.
      const exactEvidenceSpans = indexedExactEvidenceSpans(evidenceIndex, [comparisonSkill]);
      const subsumptionEvidenceSpans = exactEvidenceSpans.length === 0
        ? credentialSubsumptionEvidenceSpans(evidenceSources, comparisonSkill)
        : [];
      const exceedsQualification = subsumptionEvidenceSpans.length > 0
        && qualificationExceedsRequirement(evidenceSources, comparisonSkill);
      const recognizedDirectSpans = exactEvidenceSpans.length || subsumptionEvidenceSpans.length
        ? []
        : recognizedDirectEvidenceSpans(evidenceSources, comparisonNormalizedSkill);
      const directEvidenceSpans = exactEvidenceSpans.length || subsumptionEvidenceSpans.length
        ? uniqueEvidenceSpans([...exactEvidenceSpans, ...subsumptionEvidenceSpans])
        : uniqueEvidenceSpans([
          ...indexedExactEvidenceSpans(evidenceIndex, rule.direct),
          ...recognizedDirectSpans,
        ]);
      // Qualification matching is deliberately isolated from generic skill
      // similarity. An unrelated degree cannot become "related" merely
      // because both entries contain words such as "degree" or "engineering".
      const relatedEvidenceSpans = requirementType === 'education'
        ? []
        : matchingEvidenceSpans(evidenceSources, rule.partial, 0.75);
      const educationRelatedEvidenceSpans = requirementType === 'education' && directEvidenceSpans.length === 0
        ? relatedDegreeEvidenceSpans(evidenceSources, comparisonSkill)
        : [];
      const weakEvidenceSpans = requirementType === 'education'
        ? []
        : relatedEvidenceSpans.length === 0
        && educationRelatedEvidenceSpans.length === 0
        ? matchingEvidenceSpans(evidenceSources, weakEvidenceTermsForSkill(comparisonNormalizedSkill), 0.4)
        : [];
      // Citations always come from the same spans that established the tier.
      // Do not append loosely related snippets after a direct match.
      const evidenceSpans = directEvidenceSpans.length > 0
        ? directEvidenceSpans
        : relatedEvidenceSpans.length > 0
          ? relatedEvidenceSpans
          : educationRelatedEvidenceSpans.length > 0
            ? educationRelatedEvidenceSpans
            : weakEvidenceSpans;
      const evidence = uniqueGapEvidence(evidenceSpans.map((span) => span.text));

      const status: GapStatus = directEvidenceSpans.length > 0
        ? 'MATCHED'
        : relatedEvidenceSpans.length > 0 || educationRelatedEvidenceSpans.length > 0 || weakEvidenceSpans.length > 0
          ? 'PARTIALLY MATCHED'
          : 'MISSING';
      const hasRecognizedSynonym = !exactEvidenceSpans.length && !subsumptionEvidenceSpans.length && directEvidenceSpans.length > 0;
      const exactDegreeEvidence = subsumptionEvidenceSpans.length > 0 && !exceedsQualification;
      const evidenceLevel: EvidenceLevel = exactEvidenceSpans.length > 0 || exactDegreeEvidence || recognizedDirectSpans.length > 0
        ? 'Exact Match'
        : hasRecognizedSynonym || exceedsQualification
          ? 'Strong Match'
          : relatedEvidenceSpans.length > 0 || educationRelatedEvidenceSpans.length > 0 || weakEvidenceSpans.length > 0
            ? 'Related Match'
            : 'Missing';
      const matchClassification: SkillMatchClassification = exactEvidenceSpans.length || hasRecognizedSynonym
        ? 'EXACT_MATCH'
        : exceedsQualification
          ? 'EXCEEDED_REQUIREMENT'
        : subsumptionEvidenceSpans.length > 0
          ? 'EQUIVALENT_MATCH'
          : relatedEvidenceSpans.length > 0 || educationRelatedEvidenceSpans.length > 0
            ? 'RELATED_MATCH'
            : weakEvidenceSpans.length > 0
              ? 'WEAK_EVIDENCE'
              : 'NOT_EVIDENCED';
      const matchTier = matchClassification === 'EXACT_MATCH'
        ? 'Strong Match' as const
        : matchClassification === 'EXCEEDED_REQUIREMENT'
          ? 'Exceeded Requirement' as const
        : matchClassification === 'EQUIVALENT_MATCH'
          ? 'Equivalent Match' as const
          : matchClassification === 'RELATED_MATCH'
            ? 'Related Match' as const
            : matchClassification === 'WEAK_EVIDENCE'
              ? 'Weak Evidence' as const
              : 'Missing' as const;
      const matchTrigger = exactEvidenceSpans.length > 0
        ? 'normalized_exact' as const
        : exceedsQualification
          ? 'qualification_exceeds_requirement' as const
        : subsumptionEvidenceSpans.length > 0
          ? 'credential_subsumption' as const
          : hasRecognizedSynonym
            ? 'recognized_synonym' as const
          : relatedEvidenceSpans.length > 0 || educationRelatedEvidenceSpans.length > 0
            ? 'related_evidence' as const
            : weakEvidenceSpans.length > 0
              ? 'weak_evidence' as const
            : 'no_evidence' as const;
      const relatedSkillLabels = uniqueGapEvidence([...relatedEvidenceSpans, ...educationRelatedEvidenceSpans].map((span) => span.matchedText));
      const weakEvidenceLabels = uniqueGapEvidence(weakEvidenceSpans.map((span) => span.matchedText));
      const matchReason = matchClassification === 'EXACT_MATCH'
        ? `Exact ${skill} evidence is documented in the resume.`
        : matchClassification === 'EXCEEDED_REQUIREMENT'
          ? `A higher qualification exceeds ${skill}.`
        : matchClassification === 'EQUIVALENT_MATCH'
          ? `A higher or equivalent qualification satisfies ${skill}.`
        : matchClassification === 'RELATED_MATCH'
          ? `Related skill evidenced: ${relatedSkillLabels.join(', ')}; the resume does not explicitly name ${skill}.`
        : matchClassification === 'WEAK_EVIDENCE'
            ? `Indirect evidence (${weakEvidenceLabels.join(', ')}) may relate to ${skill}; the requirement is not explicitly named in the resume.`
          : `${skill} is not explicitly evidenced in the resume.`;
      const recommendation = status === 'MATCHED'
        ? `Keep the existing ${skill} evidence prominent in the most relevant experience or project entry.`
        : matchClassification === 'RELATED_MATCH'
          ? `Make the existing related evidence explicitly connect to ${skill}, but only if that connection is accurate.`
          : matchClassification === 'WEAK_EVIDENCE'
            ? `Clarify whether the existing indirect evidence demonstrates ${skill}; do not claim it unless accurate.`
          : `${skill} is not explicitly evidenced in the resume. Mention coursework, project work, or practical exposure only if it genuinely applies.`;

      const verificationStep = matchClassification === 'EXACT_MATCH'
        ? 1 as const
        : matchClassification === 'EXCEEDED_REQUIREMENT'
          ? 2 as const
        : matchClassification === 'EQUIVALENT_MATCH'
          ? 3 as const
        : matchClassification === 'RELATED_MATCH'
          ? 4 as const
        : matchClassification === 'WEAK_EVIDENCE'
          ? 5 as const
          : 6 as const;

      return {
        skill,
        requirementType,
        status,
        evidenceLevel,
        evidenceConfidence: evidenceConfidenceFor(evidenceLevel, evidenceSpans),
        evidenceQuality: evidenceQualityFor(evidenceLevel),
        matchTier,
        matchTrigger,
        matchClassification,
        matchReason: alternatives.length > 1 && status === 'MATCHED'
          ? `The job accepts one of ${alternatives.join(', ')}. The resume directly demonstrates ${comparisonSkill}.`
          : matchReason,
        evidence,
        evidenceSpans,
        verificationStep,
        recommendation,
      };
    });

  const responsibilities = jobTextList(job.responsibilities);
  const practicalEvidenceSources = [...resume.experience, ...resume.projects]
    .filter((source) => typeof source === 'string' && Boolean(source.trim()));
  const conceptsIn = (value: string) => new Set(
    Object.entries(RESPONSIBILITY_CONCEPTS)
      .filter(([, terms]) => {
        const normalized = normalizeGapTerm(value);
        return terms.some((term) => normalized.includes(normalizeGapTerm(term)));
      })
      .map(([concept]) => concept),
  );
  const responsibilityItems = responsibilities.map((responsibility) => {
    const requiredConcepts = conceptsIn(responsibility);
    const evidence = practicalEvidenceSources.filter((source) => {
      const sourceConcepts = conceptsIn(source);
      return [...requiredConcepts].some((concept) => sourceConcepts.has(concept));
    });
    const requirementTokens = normalizeGapTerm(responsibility).split(' ')
      .filter((token) => token.length > 3 && !['assist', 'support', 'work', 'using', 'with', 'that', 'this', 'from'].includes(token));
    const tokenEvidence = practicalEvidenceSources.filter((source) => {
      const normalizedSource = normalizeGapTerm(source);
      const overlap = requirementTokens.filter((token) => normalizedSource.includes(token)).length;
      return overlap >= Math.min(2, Math.max(1, Math.ceil(requirementTokens.length * 0.4)));
    });
    const combinedEvidence = uniqueGapEvidence([...evidence, ...tokenEvidence]);
    const requiresHandsOnDetail = /\b(?:assembly|assemble|calibration|calibrate)\b/i.test(responsibility);
    const hasExplicitHandsOnTerm = combinedEvidence.some((source) => /\b(?:assembly|assemble|calibration|calibrate)\b/i.test(source));
    const impliedPracticalEvidence = practicalEvidenceSources.filter((source) =>
      /\b(?:physical\s+robot|autonomous\s+robot|sensor\s+interfac(?:e|ing)|hardware\s+prototyp(?:e|ing)|breadboard|testing|validation)\b/i.test(source),
    );
    const impliedOnly = requiresHandsOnDetail && !hasExplicitHandsOnTerm && impliedPracticalEvidence.length > 0;
    const conceptCoverage = requiredConcepts.size === 0 ? 0 : [...requiredConcepts].filter((concept) =>
      combinedEvidence.some((source) => conceptsIn(source).has(concept)),
    ).length / requiredConcepts.size;
    const status: GapStatus = impliedOnly
      ? 'PARTIALLY MATCHED'
      : combinedEvidence.length === 0
      ? 'MISSING'
      : conceptCoverage >= 0.75 || (requiredConcepts.size === 0 && tokenEvidence.length > 0)
        ? 'MATCHED'
        : 'PARTIALLY MATCHED';
    const matchClassification: ResponsibilityGapItem['matchClassification'] = impliedOnly
      ? 'IMPLIED_PRACTICAL_EVIDENCE'
      : status === 'MISSING' ? 'NOT_EVIDENCED' : 'EXACT_PRACTICAL_EVIDENCE';
    const finalEvidence = impliedOnly ? uniqueGapEvidence([...combinedEvidence, ...impliedPracticalEvidence]) : combinedEvidence;
    const matchReason = impliedOnly
      ? 'Implied but not explicitly stated: related hands-on robot, sensor-interface, hardware-prototyping, or testing evidence is present.'
      : status === 'MISSING'
        ? 'Not explicitly evidenced in the resume.'
        : 'Practical responsibility evidence is documented in the resume.';
    return { responsibility, status, matchClassification, matchReason, evidence: finalEvidence };
  });

  return { verificationCompleted: true, items, responsibilities: responsibilityItems };
}

/**
 * Produces a focused ATS-keyword view from the same semantic matching rules
 * used by requirement comparison. It has no effect on either score.
 */
export function buildKeywordCompatibility(
  resume: Pick<StructuredResume, 'summary' | 'experience' | 'projects' | 'skills' | 'education' | 'certifications' | 'awards'>,
  jobProfile: Pick<JobProfile, 'requiredSkills' | 'preferredSkills'>,
  evidenceIndex?: ResumeEvidenceIndex,
): KeywordCompatibility {
  const requirements = uniqueGapEvidence([
    ...jobProfile.requiredSkills,
    ...jobProfile.preferredSkills,
  ]);
  // The pipeline passes its pre-built index here so the keyword view cites the
  // same prioritized evidence as the primary JD gap analysis. Callers outside
  // the pipeline remain supported because buildJobGapAnalysis builds one when
  // it is not supplied.
  const comparison = buildJobGapAnalysis(resume, { requiredSkills: requirements }, evidenceIndex);
  // Education qualifications are evaluated separately and are never keywords.
  const items = comparison.items.filter((item) => item.requirementType === 'skill' && item.status !== 'NOT APPLICABLE');
  const strongMatches = items
    .filter((item) => item.matchClassification === 'EXACT_MATCH' || item.matchClassification === 'EXCEEDED_REQUIREMENT' || item.matchClassification === 'EQUIVALENT_MATCH')
    .map((item) => item.skill);
  const partialMatches = items
    .filter((item) => item.matchClassification === 'RELATED_MATCH' || item.matchClassification === 'WEAK_EVIDENCE')
    .map((item) => item.skill);
  const missing = items
    .filter((item) => item.matchClassification === 'NOT_EVIDENCED')
    .map((item) => item.skill);
  const overallMatch = items.length === 0 ? 0 : Math.round(
    (strongMatches.length + partialMatches.length * 0.5) / items.length * 100,
  );
  return { overallMatch, exactMatches: strongMatches, semanticMatches: partialMatches, underExpressed: [], missing, analysisFailed: [] };
}

/**
 * Deterministic, job-specific ATS calculation. The fixed weights are the
 * product contract; every earned point comes from parsed resume/job evidence.
 */
export function calculateJobSpecificAtsScore(
  resume: Pick<StructuredResume, 'summary' | 'experience' | 'projects' | 'skills' | 'education' | 'certifications' | 'awards' | 'languages'>,
  gapAnalysis: JobGapAnalysis,
  jobContext: { title?: unknown } = {},
): AtsDimensionBreakdown {
  const structureReasons: string[] = [];
  let structure = 0;
  const structureChecks: [boolean, number, string][] = [
    [Boolean(resume.summary.trim()), 4, 'summary'],
    [resume.experience.length > 0 || resume.projects.length > 0, 5, 'practical experience or projects'],
    [resume.skills.length > 0, 5, 'skills'],
    [resume.education.length > 0, 4, 'education'],
    [resume.certifications.length > 0, 2, 'certifications'],
    [resume.awards.length > 0 || resume.languages.length > 0, 2, 'awards or languages'],
    [resume.experience.length + resume.projects.length >= 3, 3, 'multiple evidence bullets'],
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
  const technicalCoverageFraction = applicableGaps.length === 0
    ? 0
    : (matched.length + partial.length * 0.5) / applicableGaps.length;
  const technicalSkillCoverage = Math.round(technicalCoverageFraction * 30);
  const matchedEvidenceReasons = matched.flatMap((item) => item.evidenceSpans.slice(0, 1).map((span) =>
    `${item.skill} evidenced by ${span.context ? `${span.context}: ` : ''}${span.text}`,
  )).slice(0, 3);

  const educationText = [...resume.education, resume.summary].join(' ');
  const roleTitle = typeof jobContext.title === 'string' ? jobContext.title : '';
  const isStudentResume = /\b(?:student|undergraduate|pursuing|bachelor|bsc|bs)\b/i.test(educationText);
  const isEarlyCareerRole = /\b(?:intern|internship|graduate|junior|entry[ -]?level|trainee)\b/i.test(roleTitle);
  const studentAwareEvaluation = isStudentResume || isEarlyCareerRole;
  const leadershipPattern = /\b(?:leadership|society|club|committee|captain|volunteer|extracurricular|positions? of responsibility)\b/i;
  const competitionPattern = /\b(?:competition|contest|challenge|hackathon|olympiad|tournament)\b/i;
  const academicWorkPattern = /\b(?:academic|coursework|course project|university|thesis|capstone|final year project)\b/i;
  const engineeringProjectPattern = /\b(?:engineering|embedded|robot|automation|software|hardware|firmware|circuit|pcb|simulation|prototype|design|control|sensor|programming|system)\b/i;
  const leadershipEvidence = resume.experience.filter((item) => leadershipPattern.test(item));
  const competitionEvidence = [...resume.experience, ...resume.projects, ...resume.awards]
    .filter((item) => competitionPattern.test(item));
  const academicWorkEvidence = [...resume.projects, ...resume.education]
    .filter((item) => academicWorkPattern.test(item));
  const engineeringProjectEvidence = resume.projects.filter((item) => engineeringProjectPattern.test(item));
  // Leadership and competitions can be parsed under Experience, but they are
  // student practical work rather than employment history for ATS purposes.
  const employmentEvidence = new Set(resume.experience
    .filter((item) => !leadershipPattern.test(item) && !competitionPattern.test(item))
    .map((item) => normalizeGapTerm(item)));
  const projectEvidence = new Set(resume.projects.map((item) => normalizeGapTerm(item)));
  const studentPracticalEvidence = new Set([
    ...engineeringProjectEvidence,
    ...competitionEvidence,
    ...academicWorkEvidence,
    ...leadershipEvidence,
  ].map((item) => normalizeGapTerm(item)));
  const hasEmploymentHistory = employmentEvidence.size > 0;
  const hasMultipleEngineeringProjects = engineeringProjectEvidence.length >= 2;
  const studentPracticalDepth = studentAwareEvaluation && !hasEmploymentHistory
    ? Math.min(0.2, (hasMultipleEngineeringProjects ? 0.12 : 0) + (competitionEvidence.length ? 0.04 : 0) + (academicWorkEvidence.length ? 0.02 : 0) + (leadershipEvidence.length ? 0.02 : 0))
    : 0;
  const experienceApplicable = applicableGaps.filter(
    (item) => !/\b(?:bachelor|degree|mechatronics|electrical|electronics)\b/i.test(item.skill),
  );
  const experienceFraction = experienceApplicable.length === 0
    ? 0
    : experienceApplicable.reduce((total, item) => {
      const inEmployment = item.evidence.some((evidence) => employmentEvidence.has(normalizeGapTerm(evidence)));
      const inProjects = item.evidence.some((evidence) => projectEvidence.has(normalizeGapTerm(evidence)));
      const inStudentPracticalWork = item.evidence.some((evidence) => studentPracticalEvidence.has(normalizeGapTerm(evidence)));
      const practicalEvidence = inEmployment || (studentAwareEvaluation && (inProjects || inStudentPracticalWork));
      // With no employment history, multiple substantive student activities
      // provide modest supporting credit, but never replace skill-specific
      // project or work evidence.
      if (item.status === 'MATCHED') return total + (practicalEvidence ? 1 : 0.5 + studentPracticalDepth);
      if (item.status === 'PARTIALLY MATCHED') return total + (practicalEvidence ? 0.55 : 0.25 + studentPracticalDepth);
      return total;
    }, 0) / experienceApplicable.length;
  const experienceRelevance = Math.round(experienceFraction * 20);

  const keywordEvidence = new Set([
    ...resume.skills,
    ...resume.experience,
    ...resume.projects,
    resume.summary,
  ].map((item) => normalizeGapTerm(item)));
  const keywordCoverageFraction = applicableGaps.length === 0 ? 0 : applicableGaps.reduce((total, item) => {
    const exactRequirementMention = keywordEvidence.has(normalizeGapTerm(item.skill));
    if (item.status === 'MATCHED') return total + (exactRequirementMention ? 1 : 0.8);
    if (item.status === 'PARTIALLY MATCHED') return total + 0.35;
    return total;
  }, 0) / applicableGaps.length;
  const keywordCoverage = Math.round(keywordCoverageFraction * 15);
  // These two rows partition the existing 15-point keyword-evidence component.
  // This preserves the ATS total while making it clear whether terms are visible
  // to an ATS and how strongly they are supported by resume evidence.
  const readability = Math.round(keywordCoverageFraction * 10);
  const evidenceStrength = keywordCoverage - readability;

  const sectionQualityChecks: [boolean, number, string][] = [
    [Boolean(resume.summary.trim()), 2, 'targetable summary'],
    [resume.skills.length >= 3, 2, 'substantive skills section'],
    [resume.education.length > 0, 2, 'education detail'],
    [resume.experience.length + resume.projects.length >= 2, 3, 'multiple practical examples'],
    [resume.certifications.length > 0 || resume.awards.length > 0, 1, 'additional qualification detail'],
  ];
  const sectionQualityReasons = sectionQualityChecks.filter(([present]) => present).map(([, , reason]) => reason);
  const sectionQuality = sectionQualityChecks.reduce((total, [present, points]) => total + (present ? points : 0), 0);

  return {
    structure: {
      score: structure,
      reasons: structureReasons,
    },
    technicalSkillCoverage: {
      score: technicalSkillCoverage,
      reasons: [
        `${matched.length} matched requirement${matched.length === 1 ? '' : 's'}`,
        `${partial.length} partially matched`,
        `${missing.length} missing`,
        ...matchedEvidenceReasons,
      ],
    },
    experienceRelevance: {
      score: experienceRelevance,
      reasons: [
        `${experienceApplicable.length} applicable technical requirement${experienceApplicable.length === 1 ? '' : 's'} assessed against practical evidence`,
        studentAwareEvaluation
          ? `student-aware evaluation: ${engineeringProjectEvidence.length} engineering project entr${engineeringProjectEvidence.length === 1 ? 'y' : 'ies'}, ${competitionEvidence.length} competition entr${competitionEvidence.length === 1 ? 'y' : 'ies'}, ${academicWorkEvidence.length} academic-work entr${academicWorkEvidence.length === 1 ? 'y' : 'ies'}, and ${leadershipEvidence.length} leadership entr${leadershipEvidence.length === 1 ? 'y' : 'ies'} considered before employment history`
          : 'projects treated as supporting evidence; employment evidence receives primary credit',
        studentAwareEvaluation && !hasEmploymentHistory && hasMultipleEngineeringProjects
          ? 'multiple engineering projects count as practical experience because no employment history is documented'
          : 'employment history evaluated when documented',
      ],
    },
    keywordCoverage: {
      score: keywordCoverage,
      reasons: [`${Math.round(keywordCoverageFraction * applicableGaps.length)} requirement${Math.round(keywordCoverageFraction * applicableGaps.length) === 1 ? '' : 's'} explicitly or directly represented in resume content`],
    },
    sectionQuality: {
      score: sectionQuality,
      reasons: sectionQualityReasons,
    },
    readability: {
      score: readability,
      reasons: [`${Math.round(keywordCoverageFraction * applicableGaps.length)} job requirement${Math.round(keywordCoverageFraction * applicableGaps.length) === 1 ? '' : 's'} use ATS-readable wording in the resume`],
    },
    evidenceStrength: {
      score: evidenceStrength,
      reasons: [`${matched.length} requirement${matched.length === 1 ? '' : 's'} have direct evidence and ${partial.length} have related evidence`],
    },
    total: structure + technicalSkillCoverage + experienceRelevance + keywordCoverage + sectionQuality,
  };
}

function buildAtsDisplayBreakdown(breakdown: AtsDimensionBreakdown): AtsDisplayBreakdownItem[] {
  const explain = (reasons: string[], fallback: string) => reasons.length ? reasons.slice(0, 2).join('; ') : fallback;
  return [
    { label: 'Section Recognition', score: breakdown.structure.score, maximum: 25, explanation: explain(breakdown.structure.reasons, 'Standard resume sections need more detail.') },
    { label: 'Readability & Formatting', score: breakdown.technicalSkillCoverage.score, maximum: 25, explanation: explain(breakdown.technicalSkillCoverage.reasons, 'Formatting artifacts detected.') },
    { label: 'Impact & Metrics', score: breakdown.experienceRelevance.score, maximum: 25, explanation: explain(breakdown.experienceRelevance.reasons, 'Lack of quantified metrics.') },
    { label: 'Resume Quality', score: breakdown.sectionQuality.score, maximum: 25, explanation: explain(breakdown.sectionQuality.reasons, 'Action verbs and clarity could be improved.') }
  ];
}

function evidenceGroundAtsBreakdown(
  breakdown: AtsDisplayBreakdownItem[],
  resume: StructuredResume,
  gapAnalysis: JobGapAnalysis,
): AtsDisplayBreakdownItem[] {
  const matched = gapAnalysis.items.filter((item) => item.status === 'MATCHED');
  const partial = gapAnalysis.items.filter((item) => item.status === 'PARTIALLY MATCHED');
  const missing = gapAnalysis.items.filter((item) => item.status === 'MISSING');
  const structuralEvidence = [
    resume.summary && `Summary — "${resume.summary}"`,
    resume.education[0] && `Education — "${resume.education[0]}"`,
    resume.skills[0] && `Skills — "${resume.skills[0]}"`,
    resume.experience[0] && `Experience — "${resume.experience[0]}"`,
    resume.projects[0] && `Projects — "${resume.projects[0]}"`,
  ].find(Boolean) || 'No populated parsed resume section was available.';
  const evidenceFor = (items: JobGapItem[]) => requirementEvidenceCitationList(items, 1)[0] || structuralEvidence;

  return breakdown.map((item) => {
    const evidence = item.label === 'Readability & Formatting' || item.label === 'Impact & Metrics'
      ? evidenceFor([...matched, ...partial, ...missing])
      : item.label === 'Resume Quality'
        ? evidenceFor([...matched, ...partial])
        : structuralEvidence;
    return { ...item, explanation: `${item.explanation} Evidence: ${evidence}` };
  });
}

/** Domain classification replaces generic token overlap for role similarity. */
function roleDomains(value: string): Set<string> {
  const normalized = normalizeGapTerm(value);
  return new Set(
    Object.entries(RESPONSIBILITY_CONCEPTS)
      .filter(([, terms]) => terms.some((term) => normalized.includes(normalizeGapTerm(term))))
      .map(([domain]) => domain),
  );
}

function responsibilityFraction(items: ResponsibilityGapItem[]): number {
  const applicable = items.filter((item) => item.status !== 'NOT APPLICABLE');
  return applicable.length === 0 ? 0 : applicable.reduce((total, item) =>
    total + (item.status === 'MATCHED' ? 1 : item.status === 'PARTIALLY MATCHED' ? 0.5 : 0), 0,
  ) / applicable.length;
}

/**
 * Deterministic job-match calculation. Each dimension is derived from the
 * supplied role profile and parsed resume evidence so different jobs yield
 * materially different scores and explanations.
 */
export function calculateJobMatchScore(
  resume: Pick<StructuredResume, 'summary' | 'experience' | 'projects' | 'skills' | 'education' | 'certifications' | 'awards'>,
  profile: JobProfile,
  requiredGaps: JobGapAnalysis,
): JobMatchBreakdown {
  const required = requiredGaps.items.filter((item) => item.status !== 'NOT APPLICABLE');
  const preferredGaps = buildJobGapAnalysis(resume, { requiredSkills: profile.preferredSkills }).items
    .filter((item) => item.status !== 'NOT APPLICABLE');
  const fraction = (items: JobGapItem[]) => items.length === 0
    ? 0
    : items.reduce((total, item) => total + (item.status === 'MATCHED' ? 1 : item.status === 'PARTIALLY MATCHED' ? 0.5 : 0), 0) / items.length;
  // When no preferred criteria were supplied, their points are reassigned to
  // required skills. A candidate never receives free preferred-skill credit.
  const requiredSkillWeight = profile.preferredSkills.length === 0 ? 40 : 30;
  const preferredSkillWeight = profile.preferredSkills.length === 0 ? 0 : 10;
  const requiredSkills = Math.round(fraction(required) * requiredSkillWeight);
  const preferredSkills = Math.round(fraction(preferredGaps) * preferredSkillWeight);

  const experienceEvidence = new Set([...resume.experience, ...resume.projects].map(normalizeGapTerm));
  const projectEvidence = new Set(resume.projects.map(normalizeGapTerm));
  const technicalRequirements = required.filter((item) => !/\b(?:bachelor|degree|mechatronics|electrical|electronics)\b/i.test(item.skill));
  const technicalExperienceFraction = technicalRequirements.length === 0 ? 0 :
    technicalRequirements.reduce((total, item) => {
      const inPracticalWork = item.evidence.some((evidence) => experienceEvidence.has(normalizeGapTerm(evidence)));
      if (item.status === 'MATCHED') return total + (inPracticalWork ? 1 : 0.45);
      if (item.status === 'PARTIALLY MATCHED') return total + (inPracticalWork ? 0.5 : 0.2);
      return total;
    }, 0) / technicalRequirements.length;
  const responsibilityCoverage = responsibilityFraction(requiredGaps.responsibilities);
  const requiredExperience = Math.round((technicalExperienceFraction * 0.8 + responsibilityCoverage * 0.2) * 20);
  const technicalProjectFraction = technicalRequirements.length === 0 ? 0 :
    technicalRequirements.reduce((total, item) => {
      const inProject = item.evidence.some((evidence) => projectEvidence.has(normalizeGapTerm(evidence)));
      return total + (inProject && item.status === 'MATCHED' ? 1 : inProject && item.status === 'PARTIALLY MATCHED' ? 0.5 : 0);
    }, 0) / technicalRequirements.length;
  const projectResponsibilityFraction = responsibilityFraction(requiredGaps.responsibilities.map((item) => ({
    ...item,
    evidence: item.evidence.filter((evidence) => projectEvidence.has(normalizeGapTerm(evidence))),
    status: item.evidence.some((evidence) => projectEvidence.has(normalizeGapTerm(evidence))) ? item.status : 'MISSING' as GapStatus,
  })));
  const projectRelevance = Math.round((technicalProjectFraction * 0.75 + projectResponsibilityFraction * 0.25) * 10);

  // Responsibilities describe the actual work expected in this job. Their
  // evidence is therefore the industry-relevance signal, not word coincidence.
  const industryRelevance = requiredGaps.responsibilities.length === 0
    ? 5
    : Math.round(responsibilityCoverage * 10);
  const jobDomains = roleDomains([profile.title, ...profile.requiredSkills, ...profile.responsibilities].join(' '));
  const resumeDomains = roleDomains([
    resume.summary,
    ...resume.experience,
    ...resume.projects,
    ...resume.skills,
  ].join(' '));
  const roleSimilarity = jobDomains.size === 0
    ? 0
    : Math.round([...jobDomains].filter((domain) => resumeDomains.has(domain)).length / jobDomains.size * 10);

  const educationRequirements = profile.requiredSkills.filter((skill) => /\b(?:bachelor|degree|mechatronics|electrical|electronics|computer science|software engineering)\b/i.test(skill));
  const educationText = normalizeGapTerm(resume.education.join(' '));
  const educationAlignment = educationRequirements.length === 0
    ? (resume.education.length > 0 ? 5 : 0)
    : Math.round(educationRequirements.reduce((total, requirement) => total + (educationText.includes(normalizeGapTerm(requirement)) ? 1 : 0), 0) / educationRequirements.length * 5);

  const keywordRequirements = [...profile.requiredSkills, ...profile.preferredSkills];
  const resumeKeywordText = normalizeGapTerm([
    resume.summary,
    ...resume.skills,
    ...resume.experience,
    ...resume.projects,
  ].join(' '));
  const keywordCoverage = keywordRequirements.length === 0 ? 0 : Math.round(
    keywordRequirements.reduce((total, requirement) => total + (resumeKeywordText.includes(normalizeGapTerm(requirement)) ? 1 : 0), 0) / keywordRequirements.length * 5,
  );
  const matchedNames = required.filter((item) => item.status === 'MATCHED').map((item) => item.skill);
  const partialItems = required.filter((item) => item.status === 'PARTIALLY MATCHED');
  const missingNames = required.filter((item) => item.status === 'MISSING').map((item) => item.skill);
  const matchedResponsibilities = requiredGaps.responsibilities.filter((item) => item.status === 'MATCHED').map((item) => item.responsibility);
  const missingResponsibilities = requiredGaps.responsibilities.filter((item) => item.status === 'MISSING').map((item) => item.responsibility);

  return {
    requiredSkills,
    requiredExperience,
    preferredSkills,
    industryRelevance,
    projectRelevance,
    roleSimilarity,
    educationAlignment,
    keywordCoverage,
    weights: {
      requiredSkills: requiredSkillWeight,
      preferredSkills: preferredSkillWeight,
      requiredExperience: 20,
      industryRelevance: 10,
      projectRelevance: 10,
      roleSimilarity: 10,
      educationAlignment: 5,
      keywordCoverage: 5,
    },
    total: requiredSkills + requiredExperience + preferredSkills + industryRelevance + projectRelevance + roleSimilarity + educationAlignment + keywordCoverage,
    topStrengths: [
      ...matchedNames.slice(0, 4).map((skill) => `Required skill matched: ${skill}`),
      ...matchedResponsibilities.slice(0, 2).map((responsibility) => `Role responsibility evidenced: ${responsibility}`),
      ...(projectRelevance >= 6 ? [`Projects provide practical evidence for the ${profile.title} role.`] : []),
      ...(industryRelevance >= 6 ? [`Resume context aligns with the role's responsibilities.`] : []),
    ].slice(0, 5),
    topGaps: [
      ...missingNames.slice(0, 4).map((skill) => `Required skill not evidenced: ${skill}`),
      ...partialItems.slice(0, 3).map((item) =>
        item.matchClassification === 'RELATED_MATCH' || item.matchClassification === 'WEAK_EVIDENCE'
          ? item.matchReason
          : `Required skill only partially evidenced: ${item.skill}`,
      ),
      ...missingResponsibilities.slice(0, 2).map((responsibility) => `Role responsibility not evidenced: ${responsibility}`),
      ...(projectRelevance < 4 && technicalRequirements.length > 0 ? ['Projects do not clearly demonstrate enough target-role requirements.'] : []),
    ].slice(0, 5),
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
 * Produces a transparent resume-competitiveness estimate for the final
 * assessment card. It is deliberately not a promise of an interview: the
 * estimate uses only the supplied resume, target job, and validated analysis.
 */
export function calculateInterviewReadinessScore(
  resume: Pick<StructuredResume, 'summary' | 'experience' | 'projects' | 'skills' | 'education'>,
  gapAnalysis: JobGapAnalysis,
  atsScore: number,
  matchScore: number,
  planned: Record<string, any>,
): number {
  const structureChecks = [
    Boolean(resume.summary.trim()),
    resume.skills.length > 0,
    resume.education.length > 0,
    resume.experience.length + resume.projects.length > 0,
  ];
  const structureScore = structureChecks.filter(Boolean).length / structureChecks.length * 100;
  const practicalEvidenceScore = Math.min(100, (resume.experience.length + resume.projects.length) / 4 * 100);
  const unresolvedWeakBullets = Array.isArray(planned.weakBullets) ? planned.weakBullets.length : 0;
  const validatedRewrites = Array.isArray(planned.improvedBulletPoints) ? planned.improvedBulletPoints.length : 0;
  const bulletQualityScore = Math.max(0, Math.min(100,
    70 + Math.min(4, validatedRewrites) * 5 - Math.min(5, unresolvedWeakBullets) * 12,
  ));
  const missingRequirements = gapAnalysis.items.filter((item) => item.status === 'MISSING').length;
  const partialRequirements = gapAnalysis.items.filter((item) => item.status === 'PARTIALLY MATCHED').length;
  const missingKeywordPenalty = Math.min(18, missingRequirements * 4 + partialRequirements * 2);

  return Math.max(0, Math.min(100, Math.round(
    matchScore * 0.42
      + atsScore * 0.28
      + structureScore * 0.10
      + practicalEvidenceScore * 0.10
      + bulletQualityScore * 0.10
      - missingKeywordPenalty,
  )));
}

/**
 * Estimates confidence in the evidence behind the hiring assessment, rather
 * than confidence in the candidate or in the model. A high label is only
 * possible when direct requirement matches are backed by renderable,
 * high-confidence citations. Transferable skills and implied responsibilities
 * remain useful evidence, but deliberately lower certainty until the resume
 * states the requirement more explicitly.
 */
export function calculateAssessmentConfidence(
  resume: Pick<StructuredResume, 'experience' | 'projects'>,
  gapAnalysis: JobGapAnalysis,
): HiringManagerAssessment['confidence'] {
  const applicableSkills = gapAnalysis.items.filter((item) => item.status !== 'NOT APPLICABLE');
  if (applicableSkills.length === 0) return 'Low';

  const exactSkills = applicableSkills.filter((item) =>
    item.matchClassification === 'EXACT_MATCH' || item.matchClassification === 'EXCEEDED_REQUIREMENT' || item.matchClassification === 'EQUIVALENT_MATCH',
  );
  const relatedSkills = applicableSkills.filter((item) => item.matchClassification === 'RELATED_MATCH');
  const weakEvidenceSkills = applicableSkills.filter((item) => item.matchClassification === 'WEAK_EVIDENCE');
  const missingSkills = applicableSkills.filter((item) => item.matchClassification === 'NOT_EVIDENCED');
  const exactSkillsWithValidCitation = exactSkills.filter((item) =>
    item.evidenceSpans.some((span) => span.confidence >= MIN_CITATION_CONFIDENCE),
  ).length;
  const citationCoverage = exactSkills.length === 0
    ? 0
    : exactSkillsWithValidCitation / exactSkills.length;
  const skillEvidenceCoverage = (exactSkills.length + relatedSkills.length * 0.5 + weakEvidenceSkills.length * 0.25) / applicableSkills.length;

  const responsibilities = gapAnalysis.responsibilities;
  const exactResponsibilities = responsibilities.filter((item) => item.matchClassification === 'EXACT_PRACTICAL_EVIDENCE').length;
  const impliedResponsibilities = responsibilities.filter((item) => item.matchClassification === 'IMPLIED_PRACTICAL_EVIDENCE').length;
  const missingResponsibilities = responsibilities.filter((item) => item.matchClassification === 'NOT_EVIDENCED').length;
  const responsibilityEvidenceCoverage = responsibilities.length === 0
    ? 1
    : (exactResponsibilities + impliedResponsibilities * 0.45) / responsibilities.length;

  const totalComparableRequirements = applicableSkills.length + responsibilities.length;
  const ambiguousOrMissing = relatedSkills.length + weakEvidenceSkills.length + missingSkills.length + impliedResponsibilities + missingResponsibilities;
  const ambiguityRate = totalComparableRequirements === 0 ? 1 : ambiguousOrMissing / totalComparableRequirements;
  const practicalEntryCount = resume.experience.length + resume.projects.length;

  // "High" means the estimate is well-supported by direct, citable evidence;
  // it does not mean the applicant is highly likely to receive an interview.
  if (
    applicableSkills.length >= 3
    && exactSkills.length >= 2
    && citationCoverage >= 0.9
    && skillEvidenceCoverage >= 0.75
    && responsibilityEvidenceCoverage >= 0.75
    && ambiguityRate <= 0.25
    && practicalEntryCount >= 2
  ) return 'High';

  // A related skill or implied hands-on responsibility is enough to make the
  // estimate useful, but it cannot justify a high-confidence label.
  if (
    practicalEntryCount >= 1
    && skillEvidenceCoverage >= 0.3
    && responsibilityEvidenceCoverage >= 0.35
    && (exactSkillsWithValidCitation > 0 || relatedSkills.length > 0 || impliedResponsibilities > 0)
  ) return 'Medium';

  return 'Low';
}

/**
 * Keeps the recruiter decision and interview probability reproducible. The AI
 * supplies the recruiter language; the decision uses the independently
 * calculated ATS and job-match scores, with explicit penalties for documented
 * blockers. This avoids counting requirement coverage a second time.
 */
function buildHiringManagerAssessment(
  resume: StructuredResume,
  job: { title?: unknown },
  gapAnalysis: JobGapAnalysis,
  atsScore: number,
  matchScore: number,
  planned: Record<string, any>,
): HiringManagerAssessment {
  const title = typeof job.title === 'string' && job.title.trim() ? job.title.trim() : 'target role';
  const applicable = gapAnalysis.items.filter((item) => item.status !== 'NOT APPLICABLE');
  const matched = applicable.filter((item) => item.status === 'MATCHED');
  const partial = applicable.filter((item) => item.status === 'PARTIALLY MATCHED');
  const missing = applicable.filter((item) => item.status === 'MISSING');
  const missingResponsibilities = gapAnalysis.responsibilities.filter((item) => item.matchClassification === 'NOT_EVIDENCED');
  const clarificationReasons = [
    ...partial.map((item) => `Area to clarify: ${requirementEvidenceCitation(item)}`),
    ...gapAnalysis.responsibilities
      .filter((item) => item.matchClassification === 'IMPLIED_PRACTICAL_EVIDENCE')
      .map((item) => `Area to clarify for ${item.responsibility}: ${item.matchReason}`),
  ];
  // This is a transparent estimate, not an outcome-calibrated prediction.
  // Production calibration requires real recruiter outcome data.
  const estimatedInterviewProbability = calculateInterviewReadinessScore(
    resume,
    gapAnalysis,
    atsScore,
    matchScore,
    planned,
  );
  const overallDecision: HiringDecision = profile.requiredSkills.length === 0 ? 'Analysis Incomplete'
    : matchScore >= 82 && missing.length <= 1 ? 'Strong Match'
    : matchScore >= 68 && missing.length <= 2 ? 'Good Match'
      : matchScore >= 52 ? 'Potential Match'
        : matchScore >= 36 ? 'Weak Match'
          : 'Poor Match';
  const confidence = calculateAssessmentConfidence(resume, gapAnalysis);

  const fallbackInterviewReasons = [
    ...matched.map(requirementEvidenceCitation),
    ...partial.map(requirementEvidenceCitation),
  ];
  const fallbackRejectionReasons = [
    ...missing.map(requirementEvidenceCitation),
    ...missingResponsibilities.map((item) =>
      `Requirement: ${item.responsibility} for the ${title} role. Evidence searched: Experience and Projects; no matching practical-resume evidence was found. Classification: Missing.`,
    ),
  ];
  const firstComparable = matched[0] || partial[0] || missing[0];
  const strongestEvidence = firstComparable
    ? requirementEvidenceCitation(firstComparable)
    : `Evidence searched: ${EVIDENCE_SEARCH_SCOPE}; the supplied job contains no comparable technical requirement.`;
  const primaryGapEvidence = missing[0] ? requirementEvidenceCitation(missing[0]) : partial[0] ? requirementEvidenceCitation(partial[0]) : strongestEvidence;
  const fallbackSummary = `Hiring summary for ${title}: ${strongestEvidence} Primary gap: ${primaryGapEvidence} Overall decision: ${overallDecision}, based on the cited requirement evidence.`;
  const plannedImprovements = [
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

  const summaryWithClarifications = clarificationReasons.length
    ? `${fallbackSummary} ${clarificationReasons.slice(0, 2).join(' ')}`
    : fallbackSummary;
  return {
    overallDecision,
    recruiterSummary: summaryWithClarifications,
    // These lists are intentionally deterministic. Each item names both a
    // supplied job requirement and the resume evidence (or documented absence)
    // behind the hiring signal; model-only wording cannot become a reason.
    topReasonsToInterview: uniqueAssessmentItems(fallbackInterviewReasons).slice(0, 3),
    // Do not let an LLM-only absence claim become a rejection reason. This
    // list is intentionally limited to deterministic NOT_EVIDENCED gaps.
    topReasonsForRejection: uniqueAssessmentItems(fallbackRejectionReasons).slice(0, 3),
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
  const naturalSectionFor = (skill: string): KeywordRecommendation['recommendedSection'] => {
    const normalized = normalizeGapTerm(skill);
    if (/\b(?:sensor integration|microcontroller interfacing)\b/.test(normalized)) return 'Experience';
    if (/\b(?:ros|control systems|pid|pcb design|mechanical design|cad)\b/.test(normalized)) return 'Projects';
    if (/\b(?:communication|leadership)\b/.test(normalized)) return 'Experience';
    return 'Skills';
  };

  const toRecommendation = (
    item: JobGapItem,
    source: 'required' | 'preferred',
  ): KeywordRecommendation | null => {
    if (item.requirementType === 'education') return null;
    if (item.status === 'MATCHED' || item.status === 'NOT APPLICABLE') return null;
    const key = normalizeGapTerm(item.skill);
    if (!key || seen.has(key)) return null;
    seen.add(key);

    const appearsRepeatedly = normalizedDescription.split(key).length - 1 > 1;
    const priority: KeywordRecommendation['priority'] = source === 'required' && item.status === 'MISSING'
      ? 'Critical'
      : source === 'required' || appearsRepeatedly
        ? 'Important'
        : 'Nice-to-Have';
    const recommendedSection: KeywordRecommendation['recommendedSection'] = item.evidence.some((evidence) => experienceEvidence.has(normalizeGapTerm(evidence)))
      ? 'Experience'
      : item.evidence.some((evidence) => projectEvidence.has(normalizeGapTerm(evidence)))
        ? 'Projects'
        : naturalSectionFor(item.skill);
    const evidenceContext = item.status === 'PARTIALLY MATCHED'
      ? ` ${requirementEvidenceCitation(item)} Make that connection explicit only if accurate.`
      : ` ${requirementEvidenceCitation(item)} Do not add it unless you can support it with genuine coursework, project work, or practical exposure.`;
    const whyItMatters = source === 'required'
      ? item.status === 'MISSING'
        ? `${item.skill} is required for the ${title} role.${evidenceContext}`
        : `${item.skill} is required for the ${title} role, but the resume shows only related evidence rather than an explicit match.${evidenceContext}`
      : `${item.skill} is preferred for the ${title} role and is not strongly represented in the resume.${evidenceContext}`;
    return { keyword: item.skill, priority, whyItMatters, recommendedSection };
  };

  const recommendations = [
    ...requiredGapAnalysis.items.map((item) => toRecommendation(item, 'required')),
    ...preferredGapAnalysis.items.map((item) => toRecommendation(item, 'preferred')),
  ].filter((item): item is KeywordRecommendation => Boolean(item));
  const priorityRank = { Critical: 0, Important: 1, 'Nice-to-Have': 2 } as const;
  return recommendations.sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority] || left.keyword.localeCompare(right.keyword));
}

/** Produces recruiter-facing strengths only from matched or related job-gap evidence. */
export function buildRoleStrengths(
  resume: StructuredResume,
  job: { title?: unknown },
  gapAnalysis: JobGapAnalysis,
): string[] {
  const title = typeof job.title === 'string' && job.title.trim() ? job.title.trim() : 'target role';
  const strengths: string[] = [];

  for (const item of gapAnalysis.items) {
    // Partial requirements are intentionally reserved for missing-keyword and
    // improvement guidance so this positive section never repeats them.
    if (item.matchClassification !== 'EXACT_MATCH' && item.matchClassification !== 'EXCEEDED_REQUIREMENT' && item.matchClassification !== 'EQUIVALENT_MATCH') continue;
    for (const span of item.evidenceSpans.filter((span) => span.confidence >= MIN_CITATION_CONFIDENCE)) {
      const evidence = span.context ? `${span.context}: ${span.text}` : span.text;
      strengths.push(
        `The ${span.section} evidence “${evidence}” demonstrates ${item.skill}, directly matching the ${title} role's requirement.`,
      );
    }
  }

  return uniqueAssessmentItems(strengths).slice(0, 10);
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

function normalizeResumeAnalysis(raw: any): AiResumeAnalysisFull {
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
    ? (o.improvedBulletPoints as RewritePair[])
        .filter((b) => b?.before && b?.after)
        .map((b) => ({
          ...b,
          before: String(b.before),
          after: String(b.after),
        }))
    : [];

  const atsScore = Math.max(0, Math.min(100, Number(o.atsScore) || 0));
  const matchScore = Math.max(0, Math.min(100, Number(o.matchScore) || 0));

  // Keyword extraction clean logic
  const missingKeywords = validateAndCleanKeywords(arr(o.missingKeywords));
  const existingSkills = validateAndCleanKeywords(arr(o.existingSkills));
  const missingSkills = validateAndCleanKeywords(arr(o.missingSkills));
  const keywordSuggestions = validateAndCleanKeywords(arr(o.keywordSuggestions));
  const keywordGaps = validateAndCleanKeywords(arr(o.keywordGaps));
  const rawKeywordCompatibility = o.keywordCompatibility || {};
  const keywordCompatibility: KeywordCompatibility = {
    overallMatch: Math.max(0, Math.min(100, Number(rawKeywordCompatibility.overallMatch) || 0)),
    exactMatches: validateAndCleanKeywords(arr(rawKeywordCompatibility.exactMatches)),
    semanticMatches: validateAndCleanKeywords(arr(rawKeywordCompatibility.semanticMatches)),
    underExpressed: validateAndCleanKeywords(arr(rawKeywordCompatibility.underExpressed)),
    missing: validateAndCleanKeywords(arr(rawKeywordCompatibility.missing)),
    analysisFailed: validateAndCleanKeywords(arr(rawKeywordCompatibility.analysisFailed)),
  };
  const coachingReport: CoachingReportSection[] = Array.isArray(o.coachingReport)
    ? o.coachingReport.flatMap((section: unknown): CoachingReportSection[] => {
      if (!section || typeof section !== 'object') return [];
      const candidate = section as Record<string, unknown>;
      const category = String(candidate.category || '') as CoachingReportCategory;
      if (!COACHING_REPORT_CATEGORIES.includes(category)) return [];
      const recommendations = mapWithConfidence(candidate.recommendations).slice(0, 3);
      return recommendations.length ? [{ category, recommendations }] : [];
    })
    : [];
  const atsBreakdown: AtsDisplayBreakdownItem[] = Array.isArray(o.atsBreakdown)
    ? o.atsBreakdown.flatMap((item: unknown): AtsDisplayBreakdownItem[] => {
      if (!item || typeof item !== 'object') return [];
      const candidate = item as Record<string, unknown>;
      const label = String(candidate.label || '') as AtsDisplayBreakdownItem['label'];
      const maximum = Number(candidate.maximum);
      const score = Number(candidate.score);
      const explanation = typeof candidate.explanation === 'string' ? candidate.explanation.trim() : '';
      const labels: AtsDisplayBreakdownItem['label'][] = ['Section Recognition', 'Readability & Formatting', 'Impact & Metrics', 'Resume Quality'];
      return labels.includes(label) && Number.isFinite(score) && Number.isFinite(maximum) && explanation
        ? [{ label, score: Math.max(0, Math.min(maximum, score)), maximum, explanation }]
        : [];
    })
    : [];
  const keywordRecommendations = Array.isArray(o.keywordRecommendations)
    ? o.keywordRecommendations.flatMap((item: unknown): KeywordRecommendation[] => {
        if (!item || typeof item !== 'object') return [];
        const candidate = item as Record<string, unknown>;
        const keyword = typeof candidate.keyword === 'string' ? candidate.keyword.trim() : '';
        const whyItMatters = typeof candidate.whyItMatters === 'string' ? candidate.whyItMatters.trim() : '';
        const priority = candidate.priority;
        const recommendedSection = candidate.recommendedSection;
        if (!keyword || !whyItMatters
          || !['Critical', 'Important', 'Nice-to-Have'].includes(String(priority))
          || !['Skills', 'Experience', 'Projects'].includes(String(recommendedSection))) return [];
        return [{
          keyword,
          whyItMatters,
          priority: priority as KeywordRecommendation['priority'],
          recommendedSection: recommendedSection as KeywordRecommendation['recommendedSection'],
        }];
      })
    : [];
  const educationAlignment: EducationAlignmentItem[] = Array.isArray(o.educationAlignment)
    ? o.educationAlignment.flatMap((item: unknown): EducationAlignmentItem[] => {
      if (!item || typeof item !== 'object') return [];
      const candidate = item as Record<string, unknown>;
      const requirement = typeof candidate.requirement === 'string' ? candidate.requirement.trim() : '';
      const status = candidate.status;
      if (!requirement || !['Direct Match', 'Related Match', 'Missing'].includes(String(status))) return [];
      const evidence = Array.isArray(candidate.evidence)
        ? candidate.evidence.filter((span): span is ResumeEvidenceSpan => Boolean(span && typeof span === 'object' && typeof (span as ResumeEvidenceSpan).text === 'string'))
        : [];
      return [{
        requirement,
        status: status as EducationAlignmentItem['status'],
        evidence,
        confidence: Math.max(0, Math.min(100, Number(candidate.confidence) || 0)),
        reason: typeof candidate.reason === 'string' ? candidate.reason.trim() : '',
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
    tier: 'premium',
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
    analysisFailedSkills: [],
    educationAlignment,
    detectedSections: arr(o.detectedSections),
    missingSections: arr(o.missingSections),
    formattingSuggestions: mapWithConfidence(o.formattingSuggestions),
    formattingIssues: mapWithConfidence(o.formattingIssues),
    weakBullets: arr(o.weakBullets),
    // Rewrites have already passed the central validation layer. Do not run a
    // second, divergent sanitizer that can turn a rejected rewrite into an
    // unchanged bullet and make it appear as a valid suggestion.
    improvedBulletPoints: bullets,
    improvementSuggestions: mapWithConfidence(o.improvementSuggestions),
    optimizationRecommendations: mapWithConfidence(o.optimizationRecommendations),
    atsIssues: mapWithConfidence(o.atsIssues),
    recommendationPriorities: {
      critical: priorityItems(priorityGroups.critical),
      important: priorityItems(priorityGroups.important),
      optional: priorityItems(priorityGroups.optional),
    },
    actionPlan: Array.isArray(o.actionPlan) ? o.actionPlan : [],
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
      strongMatches: arr(jobMatchExplanation.strongMatches).map(req => ({ requirement: req, context: 'Grounded match from requirements' })),
      partialMatches: arr(jobMatchExplanation.partialMatches).map(req => ({ requirement: req, context: 'Partial match from requirements' })),
      missingSkills: arr(jobMatchExplanation.missingSkills).map(req => ({ requirement: req, context: 'No explicit evidence found in your resume.', tag: 'Genuine gap' as const })),
    },
    keywordCompatibility,
    coachingReport,
    atsBreakdown,
    roleStrengths: arr(o.roleStrengths),
    hiringManagerAssessment: o.hiringManagerAssessment as HiringManagerAssessment,
    requirementBreakdown: o.requirementBreakdown || [],
  };

  if (result.atsScoreExplanation.strengths.length === 0) {
    result.atsScoreExplanation.strengths = result.roleStrengths;
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
    result.jobMatchExplanation.strongMatches = result.existingSkills.map(req => ({ requirement: req, context: 'Derived from extracted technical skills' }));
  }
  if (result.jobMatchExplanation.missingSkills.length === 0) {
    const missing = result.missingSkills.length > 0 ? result.missingSkills : result.missingKeywords;
    result.jobMatchExplanation.missingSkills = missing.map(req => ({ requirement: req, context: 'Missing core requirement', tag: 'Genuine gap' as const }));
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

/**
 * A provider may occasionally stop before closing a JSON object. Retry that
 * stage once with an explicit compact-JSON instruction instead of surfacing a
 * partial model response as a completed analysis.
 */
async function callStructuredStage(
  stage: Extract<AiPipelineStage, 'parser' | 'analyzer' | 'rewriter'>,
  messages: ChatMessage[],
  options: { maxTokens: number; temperature: number; observability?: AiObservabilityContext },
): Promise<Record<string, any>> {
  const request = async (retry: boolean) => {
    const stageMessages: ChatMessage[] = retry
      ? [...messages, {
        role: 'user',
        content: 'Return only one complete, valid JSON object. Keep each array concise and close every JSON array and object; do not add markdown or commentary.',
      }]
      : messages;
    const raw = await callOpenRouter(stageMessages, {
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      observability: options.observability,
      stage,
    });
    return parseStageJson(raw, stage, options.observability);
  };

  try {
    return await request(false);
  } catch (error) {
    if (!isAiPipelineError(error) || error.code !== 'INVALID_JSON') throw error;
    logAiEvent(options.observability, 'structured_stage_retry', { stage, reason: 'invalid_json' });
    return request(true);
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
  options: { observability?: AiObservabilityContext; includePremium?: boolean } = {},
): Promise<AiResumeAnalysisFull | AiResumeAnalysisFree> {
  const observability = options.observability;
  logAiEvent(observability, 'pipeline_started', {
    resume: textMetadata(resumeText),
    jobDescription: textMetadata(jobDescription),
  });
  // Step 1: deterministic parsing establishes safe sections before the LLM enriches them.
  const localResume = parseResumeText(resumeText);
  logAiEvent(observability, 'structured_parser_completed', {
    // Privacy-safe diagnostic: lets us distinguish an extraction/header-loss
    // issue from a section-classification issue without logging resume text.
    sourceSummaryHeaderDetected: hasSourceSummaryHeader(resumeText),
    parsedSummaryPresent: Boolean(localResume.summary),
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
  
  const parsedJson = await callStructuredStage(
    'parser',
    [
      { role: 'system', content: RESUME_PARSER_SYSTEM_PROMPT },
      { role: 'user', content: parserUserContent },
    ],
    { maxTokens: 8000, temperature: 0.1, observability }
  );
  if (!parsedJson.resume || typeof parsedJson.resume !== 'object' || !parsedJson.job || typeof parsedJson.job !== 'object') {
    throw new AiPipelineError('parser', 'INVALID_SCHEMA', 'The parser response is missing resume or job data.');
  }

  parsedJson.resume = mergeParsedResume(parsedJson.resume, localResume);
  parsedJson.job = validateAndEnrichParsedJob(parsedJson.job, jobDescription);
  const jobProfile = buildJobProfile(parsedJson.job);
  const evidenceIndex = buildResumeEvidenceIndex(parsedJson.resume);
  const gapAnalysis = buildJobGapAnalysis(parsedJson.resume, jobProfile, evidenceIndex);
  if (!gapAnalysis.verificationCompleted) {
    throw new AiPipelineError('verification', 'VERIFICATION_INCOMPLETE', 'The resume requirements could not be verified.');
  }
  const atsBreakdown = calculateJobSpecificAtsScore(parsedJson.resume, gapAnalysis, jobProfile);
  const jobMatchBreakdown = calculateJobMatchScore(parsedJson.resume, jobProfile, gapAnalysis);
  const keywordCompatibility = buildKeywordCompatibility(parsedJson.resume, jobProfile, evidenceIndex);
  logAiEvent(observability, 'gap_analysis_completed', {
    jobTitlePresent: Boolean(jobProfile.title),
    requiredSkillCount: jobProfile.requiredSkills.length,
    preferredSkillCount: jobProfile.preferredSkills.length,
    responsibilityCount: jobProfile.responsibilities.length,
    matched: gapAnalysis.items.filter((item) => item.status === 'MATCHED').length,
    partiallyMatched: gapAnalysis.items.filter((item) => item.status === 'PARTIALLY MATCHED').length,
    missing: gapAnalysis.items.filter((item) => item.status === 'MISSING').length,
    notApplicable: gapAnalysis.items.filter((item) => item.status === 'NOT APPLICABLE').length,
    matchTriggerCounts: gapAnalysis.items.reduce<Record<string, number>>((counts, item) => {
      counts[item.matchTrigger] = (counts[item.matchTrigger] || 0) + 1;
      return counts;
    }, {}),
    evidenceIndex: {
      sourceCount: evidenceIndex.sources.length,
      entryCount: evidenceIndex.entries.length,
      sections: evidenceIndex.entries.reduce<Record<string, number>>((counts, entry) => {
        counts[entry.section] = (counts[entry.section] || 0) + 1;
        return counts;
      }, {}),
    },
  });

  // Free users receive a deterministic ATS/structure preview only. Do not run
  // the analyzer, bullet rewriter, validation, or recommendation planner here:
  // those stages produce the paid report and must never enter a free response.
  if (!options.includePremium) {
    const detectedSections = [
      parsedJson.resume.summary && 'Summary',
      parsedJson.resume.experience.length > 0 && 'Experience',
      parsedJson.resume.projects.length > 0 && 'Projects',
      parsedJson.resume.skills.length > 0 && 'Skills',
      parsedJson.resume.education.length > 0 && 'Education',
      parsedJson.resume.certifications.length > 0 && 'Certifications',
    ].filter((section): section is string => Boolean(section));
    const expectedSections = ['Summary', 'Experience', 'Projects', 'Skills', 'Education'];
    const missingSections = expectedSections.filter((section) => !detectedSections.includes(section));
    const basicFeedback = [
      ...missingSections.slice(0, 3).map((section) => `Add a clearly labeled ${section} section to improve resume structure.`),
      ...atsBreakdown.structure.reasons.slice(0, 2),
    ].filter(Boolean).slice(0, 3);

    logAiEvent(observability, 'free_preview_completed', {
      totalDurationMs: observability ? Date.now() - observability.startedAt : null,
      premiumStagesSkipped: true,
    });
    return {
      tier: 'free',
      parsed: parsedJson.resume,
      atsScore: atsBreakdown.total,
      detectedSections,
      missingSections,
      basicFeedback,
    };
  }

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
    jobProfile,
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
    rewritePriorities: jobProfile.priorities,
    jobGapFocus: gapAnalysis.items.map(({ skill, status, evidence }) => ({ skill, status, evidence })),
  }, null, 2);

  console.info('[pipeline] Running Step 2 & 3: Parallel Analyzer and Rewriter');
  
  const [analysisJson, rewriterJson] = await Promise.all([
    callStructuredStage(
      'analyzer',
      [
        { role: 'system', content: ANALYZER_SYSTEM_PROMPT },
        { role: 'user', content: analysisUserContent }
      ],
      { maxTokens: 8000, temperature: 0.2, observability }
    ),
    callStructuredStage(
      'rewriter',
      [
        { role: 'system', content: REWRITER_SYSTEM_PROMPT },
        { role: 'user', content: rewriterUserContent }
      ],
      { maxTokens: 8000, temperature: 0.3, observability }
    )
  ]);

  const missingStructure = [
    !parsedJson.resume.summary && 'summary',
    parsedJson.resume.experience.length === 0 && 'experience',
    parsedJson.resume.projects.length === 0 && 'projects',
    parsedJson.resume.skills.length === 0 && 'skills',
    parsedJson.resume.education.length === 0 && 'education',
  ].filter((value): value is string => Boolean(value));
  const missingGapSkills = gapAnalysis.items.filter((item) => item.status === 'MISSING').map((item) => item.skill);
  const relatedSkillGaps = gapAnalysis.items.filter((item) =>
    item.matchClassification === 'RELATED_MATCH' || item.matchClassification === 'WEAK_EVIDENCE',
  );
  const weakExperienceSkills = gapAnalysis.items
    .filter((item) => item.matchClassification === 'NOT_EVIDENCED')
    .filter((item) => !item.evidence.some((evidence) => [
      ...parsedJson.resume.experience,
      ...parsedJson.resume.projects,
    ].some((source) => normalizeGapTerm(source) === normalizeGapTerm(evidence))))
    .map((item) => item.skill);
  const deterministicAtsExplanation = {
    whatIncreasedScore: [
      `Resume Structure and Section Quality: ${atsBreakdown.structure.score}/25 and ${atsBreakdown.sectionQuality.score}/10 — ${atsBreakdown.structure.reasons.join(', ') || 'no standard sections detected'}; ${atsBreakdown.sectionQuality.reasons.join(', ') || 'limited supporting section detail'}.`,
      `Technical Skill and Keyword Coverage: ${atsBreakdown.technicalSkillCoverage.score}/30 and ${atsBreakdown.keywordCoverage.score}/15 — ${atsBreakdown.technicalSkillCoverage.reasons.join(', ')}; ${atsBreakdown.keywordCoverage.reasons.join(', ')}.`,
      `Experience Relevance: ${atsBreakdown.experienceRelevance.score}/20 — ${atsBreakdown.experienceRelevance.reasons.join(', ')}.`,
    ],
    whatReducedScore: [
      ...(missingStructure.length ? [`Resume Structure lost points because ${missingStructure.join(', ')} ${missingStructure.length === 1 ? 'is' : 'are'} absent.`] : []),
      ...(missingGapSkills.length ? [`Keyword Alignment lost points because ${missingGapSkills.join(', ')} ${missingGapSkills.length === 1 ? 'is' : 'are'} missing.`] : []),
      ...(relatedSkillGaps.length ? [`Related Skill Alignment: ${relatedSkillGaps.slice(0, 3).map((item) => item.matchReason).join(' ')}`] : []),
      ...(weakExperienceSkills.length ? [`Experience Alignment lost points because ${weakExperienceSkills.join(', ')} ${weakExperienceSkills.length === 1 ? 'is' : 'are'} not demonstrated in Experience or Projects.`] : []),
    ],
  };
  const deterministicJobMatchExplanation = {
    strongMatches: jobMatchBreakdown.topStrengths,
    partialMatches: [
      `Required Skills: ${jobMatchBreakdown.requiredSkills}/${jobMatchBreakdown.weights.requiredSkills}; Required Experience: ${jobMatchBreakdown.requiredExperience}/${jobMatchBreakdown.weights.requiredExperience}; Preferred Skills: ${jobMatchBreakdown.preferredSkills}/${jobMatchBreakdown.weights.preferredSkills}.`,
      `Industry Relevance: ${jobMatchBreakdown.industryRelevance}/${jobMatchBreakdown.weights.industryRelevance}; Project Relevance: ${jobMatchBreakdown.projectRelevance}/${jobMatchBreakdown.weights.projectRelevance}; Role Similarity: ${jobMatchBreakdown.roleSimilarity}/${jobMatchBreakdown.weights.roleSimilarity}.`,
      `Education Alignment: ${jobMatchBreakdown.educationAlignment}/${jobMatchBreakdown.weights.educationAlignment}; Keyword Coverage: ${jobMatchBreakdown.keywordCoverage}/${jobMatchBreakdown.weights.keywordCoverage}.`,
    ],
    missingSkills: jobMatchBreakdown.topGaps,
  };
  // Model prose is not used for score or match conclusions. These evidence
  // citations are the sole final explanation source for those conclusions.
  const evidenceGroundedAtsExplanation = {
    whatIncreasedScore: requirementEvidenceCitationList(
      gapAnalysis.items.filter((item) => item.status === 'MATCHED'),
      3,
    ).map((citation) => `ATS score increased through ${citation}`),
    whatReducedScore: [
      ...requirementEvidenceCitationList(
        gapAnalysis.items.filter((item) => item.status !== 'MATCHED' && item.status !== 'NOT APPLICABLE'),
        3,
      ).map((citation) => `ATS score was reduced through ${citation}`),
      ...(missingStructure.length ? [`ATS structure review: parsed resume sections missing ${missingStructure.join(', ')}. Evidence: parsed section inventory.`] : []),
    ],
  };
  const evidenceGroundedJobMatchExplanation = {
    strongMatches: gapAnalysis.items.filter((item) => item.status === 'MATCHED').slice(0, 5).map(item => ({
      requirement: item.skill,
      context: item.matchReason || 'Matches requirement',
    })),
    partialMatches: gapAnalysis.items.filter((item) => item.status === 'PARTIALLY MATCHED').slice(0, 5).map(item => ({
      requirement: item.skill,
      context: item.matchReason || 'Partial match',
      tag: 'Addressable by rewording' as const
    })),
    missingSkills: gapAnalysis.items.filter((item) => item.status === 'MISSING').slice(0, 5).map(item => ({
      requirement: item.skill,
      context: item.matchReason || 'Missing core requirement',
      tag: 'Genuine gap' as const
    })),
  };
  // Keyword and missing-skill fields are derived from the same deterministic
  // gap analysis that drives ATS, Job Match, and recommendations. Model-sent
  // keyword lists are intentionally not allowed to become a second source.
  const deterministicExistingSkills = gapAnalysis.items
    .filter((item) => item.requirementType === 'skill' && item.status === 'MATCHED')
    .map((item) => item.skill);
  const deterministicMissingSkills = gapAnalysis.items
    .filter((item) => item.requirementType === 'skill' && item.status === 'MISSING')
    .map((item) => item.skill);

  // Combine and validate final structure
  const combinedRaw = {
    tier: 'premium' as const,
    parsed: parsedJson.resume,
    atsScore: atsBreakdown.total,
    matchScore: jobMatchBreakdown.total,
    existingSkills: deterministicExistingSkills,
    missingSkills: deterministicMissingSkills,
    missingKeywords: deterministicMissingSkills,
    keywordSuggestions: [],
    keywordGaps: [],
    missingRequiredSkills: deterministicMissingSkills,
    educationAlignment: buildEducationAlignment(gapAnalysis.items),
    detectedSections: analysisJson.detectedSections || [],
    missingSections: analysisJson.missingSections || [],
    formattingIssues: analysisJson.formattingIssues || [],
    formattingSuggestions: analysisJson.formattingSuggestions || [],
    weakBullets: rewriterJson.weakBullets || analysisJson.weakBullets || [],
    improvedBulletPoints: rewriterJson.improvedBulletPoints || [],
    improvementSuggestions: analysisJson.improvementSuggestions || [],
    optimizationRecommendations: analysisJson.optimizationRecommendations || [],
    atsIssues: analysisJson.atsIssues || [],
    coachingReport: analysisJson.coachingReport || [],
    atsBreakdown: evidenceGroundAtsBreakdown(buildAtsDisplayBreakdown(atsBreakdown), parsedJson.resume, gapAnalysis),
    atsScoreExplanation: {
      strengths: requirementEvidenceCitationList(gapAnalysis.items.filter((item) => item.status === 'MATCHED'), 5),
      missingElements: [
        ...requirementEvidenceCitationList(gapAnalysis.items.filter((item) => item.status === 'MISSING'), 5),
        ...(missingStructure.length ? [`Evidence: parsed section inventory shows ${missingStructure.join(', ')} ${missingStructure.length === 1 ? 'is' : 'are'} absent.`] : []),
      ],
      formattingIssues: [`Evidence: parsed section inventory contains ${[parsedJson.resume.summary && 'Summary', parsedJson.resume.skills.length && 'Skills', parsedJson.resume.education.length && 'Education', parsedJson.resume.experience.length && 'Experience', parsedJson.resume.projects.length && 'Projects'].filter(Boolean).join(', ') || 'no populated standard section'}.`],
      keywordIssues: requirementEvidenceCitationList(gapAnalysis.items.filter((item) => item.status !== 'MATCHED' && item.status !== 'NOT APPLICABLE'), 5),
      whatIncreasedScore: evidenceGroundedAtsExplanation.whatIncreasedScore,
      whatReducedScore: evidenceGroundedAtsExplanation.whatReducedScore,
      topImprovements: requirementEvidenceCitationList(gapAnalysis.items.filter((item) => item.status !== 'MATCHED' && item.status !== 'NOT APPLICABLE'), 3),
      estimatedScoreImprovement: 0,
      potentialAtsScore: atsBreakdown.total,
    },
    jobMatchExplanation: {
      strongMatches: evidenceGroundedJobMatchExplanation.strongMatches,
      partialMatches: evidenceGroundedJobMatchExplanation.partialMatches,
      missingSkills: evidenceGroundedJobMatchExplanation.missingSkills,
    },
    keywordCompatibility,
    hiringManagerAssessment: analysisJson.hiringManagerAssessment,
  };

  let validated: Record<string, any>;
  const validationTelemetry: ValidationTelemetry = {
    acceptedRecommendations: 0,
    rejectedRecommendations: 0,
    rejectionReasons: {},
  };
  try {
    const targetKeywords = gapAnalysis.items.map((item) => item.skill).filter(Boolean);
    validated = validateAiResumeOutput(combinedRaw, resumeText, jobDescription, validationTelemetry, targetKeywords, [...parsedJson.resume.experience, ...parsedJson.resume.projects].map(text => ({ text, sourceContext: text })));
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
    planned = planResumeRecommendations(rankMissingSkills(validated, jobDescription), resumeText, gapAnalysis, jobProfile.title);
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
    jobProfile,
    jobDescription,
    gapAnalysis,
  );
  planned.roleStrengths = buildRoleStrengths(parsedJson.resume, jobProfile, gapAnalysis);
  planned.hiringManagerAssessment = buildHiringManagerAssessment(
    parsedJson.resume,
    parsedJson.job,
    gapAnalysis,
    atsBreakdown.total,
    jobMatchBreakdown.total,
    planned,
  );

  const result = normalizeResumeAnalysis(planned);
  logAiEvent(observability, 'pipeline_completed', {
    totalDurationMs: observability ? Date.now() - observability.startedAt : null,
  });
  return result;
}

export async function generateBulletRewritesWithAi(
  experience: string[],
  projects: string[],
  targetJob: { title: string; requiredSkills: string[]; preferredSkills: string[]; responsibilities: string[] },
  rewritePriorities: string[],
  jobGapFocus: { skill: string; status: string; evidence: string[] }[],
  observability?: AiObservabilityContext
): Promise<{ improvedBulletPoints: { before: string; after: string; confidence: 'High' | 'Medium' | 'Low' }[], weakBullets: string[] }> {
  const rewriterUserContent = JSON.stringify({
    experience,
    projects,
    targetJob,
    rewritePriorities,
    jobGapFocus,
  }, null, 2);

  try {
    const rewriterJson = await callStructuredStage(
      'rewriter',
      [
        { role: 'system', content: REWRITER_SYSTEM_PROMPT },
        { role: 'user', content: rewriterUserContent }
      ],
      { maxTokens: 8000, temperature: 0.3, observability }
    );
    return {
      improvedBulletPoints: Array.isArray(rewriterJson?.improvedBulletPoints) ? rewriterJson.improvedBulletPoints : [],
      weakBullets: Array.isArray(rewriterJson?.weakBullets) ? rewriterJson.weakBullets : []
    };
  } catch (err) {
    console.error('[openrouter] Rewriter stage failed', err);
    return { improvedBulletPoints: [], weakBullets: [] };
  }
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
    { maxTokens: 8000, temperature: 0.4 },
  );

  return normalizeInterviewPrep(planInterviewRecommendations(extractJsonFromText(raw) as Record<string, any>));
}
