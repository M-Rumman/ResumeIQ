import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callOpenRouter } from './_lib/openrouter.js';
import { BODY_LIMITS, INPUT_LIMITS, rejectOversizedBody } from './_lib/requestLimits.js';
import { getUserFromRequest } from './_lib/auth.js';
import { enforceAiRateLimit } from './_lib/rateLimit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (rejectOversizedBody(req, res, BODY_LIMITS.AI)) {
    return;
  }

  const user = await getUserFromRequest(req);
  if (user) {
    const rate = await enforceAiRateLimit(user.id);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfter));
      return res.status(429).json({
        error: 'Too many requests. Please wait a moment and try again.',
      });
    }
  }

  const body = req.body as { resumeText?: string; jobDescription?: string; mode?: 'strategic_keywords' | 'ats_max_score' };
  const resumeText = (body.resumeText || '').trim().slice(0, INPUT_LIMITS.RESUME_TEXT_MAX);
  const jobDescription = (body.jobDescription || '').trim().slice(0, INPUT_LIMITS.JOB_DESCRIPTION_MAX);
  const mode = body.mode || 'ats_max_score';

  if (!resumeText || !jobDescription) {
    return res.status(400).json({ error: 'Both resumeText and jobDescription are required.' });
  }

  let systemPrompt = '';
  let userPrompt = '';

  if (mode === 'ats_max_score') {
    systemPrompt = `# Role and Objective
You are an expert resume optimization engineer specializing in beating strict ATS scoring algorithms (like Jobscan, Teal, or Resume Worded). Your task is to rewrite the provided resume bullets to achieve maximum scores in "Impact", "Style", and "Brevity" against the target Job Description, strictly adhering to algorithmic grading rules.

# Algorithmic Scoring Rules to Satisfy:
1. IMPACT (Target: 22+/25): 
   - Every single project and role must include a quantifiable metric, scope, scale, time saved, or performance benchmark. If an exact percentage is unknown, use safe engineering approximations (e.g., "reducing processing overhead by ~20%", "handling over 100+ instances", "achieving sub-centimeter / 7cm precision").
2. STYLE & POWER VERBS (Target: 22+/25):
   - Every bullet point MUST start with a high-impact, active power verb (e.g., "Engineered", "Architected", "Optimized", "Spearheaded", "Synthesized", "Deployed"). Never use passive words, duties ("responsible for"), or weak verbs ("worked on", "made", "used").
   - Uniform Formatting: Convert every single section into clean, consistent bullet points (•) with zero paragraph-style hybrid blocks.
3. BREVITY (Target: 23+/25):
   - Keep every bullet point strictly between 12 to 25 words. Make them punchy, dense with technical keywords, and free of fluff.

# Strict Guardrails
- ZERO FABRICATION: Do not invent new core tools, roles, dates, or fake jobs. Only reframe and inject quantifiable context into the real work already provided.

# Output Format
Respond ONLY with a valid JSON object matching the following structure:
{
  "summaryOfAddedKeywords": [
    {
      "keyword": "string (the power verb, metric, or keyword injected)",
      "category": "hard_skill" | "domain_terminology" | "conceptual_keyword",
      "location": "string (e.g. Work Experience or Project Bullet)",
      "reason": "string (e.g. Injected active power verb and quantifiable benchmark ~25% to maximize Impact and Style)"
    }
  ],
  "finalizedResumeText": "string (the complete, fully rewritten, ATS-compliant markdown resume)"
}`;

    userPrompt = `# Inputs
- **TARGET JD:**
${jobDescription}

- **CURRENT RESUME:**
${resumeText}`;

  } else {
    systemPrompt = `# Role and Objective
You are an expert HR strategist, technical recruiter, and senior resume optimizer specializing in engineering, robotics, and software domains. Your goal is to analyze a candidate's existing resume against a provided Job Description (JD), identify high-impact missing keywords, and strategically weave them into the resume text.

# Core Constraints & Guardrails (STRICT)
1. ZERO FABRICATION: Do not invent, alter, or exaggerate any experience, project names, technical stacks, tools, metrics, dates, institutions, or educational backgrounds.
2. CONTEXT PRESERVATION: The candidate's actual work history, hardware used, and accomplishments must remain strictly factual and untouched.
3. PRECISE REPHRASING ONLY: You are only permitted to rephrase existing sentences, add contextually aligned terminology to current bullet points, or incorporate missing domain-specific keywords into the Summary and Skills sections where the underlying work genuinely supports it.
4. ATS COMPLIANCE: Ensure standard, clean markdown formatting that avoids parser-breaking elements while maintaining professional tone and readability.

# Execution Workflow
Step 1: Gap Analysis
- Compare the input Resume text against the input Job Description (JD).
- Extract critical hard skills, domain terminologies, and conceptual keywords present in the JD that are absent or poorly represented in the resume.

Step 2: Strategic Mapping
- Determine the most natural integration points for these keywords (e.g., Summary, Skills section, or subtly woven into existing project/internship description bullets).
- Ensure any added keyword logically maps to a project the candidate has already worked on (e.g., adding "sensor integration" or "benchmarking" only where sensors or navigation stacks are already described).

Step 3: Text Re-rendering
- Output the fully updated, polished resume incorporating the targeted changes without breaking any original constraints.

# Output Format
Respond ONLY with a valid JSON object matching the following structure:
{
  "summaryOfAddedKeywords": [
    {
      "keyword": "string",
      "category": "hard_skill" | "domain_terminology" | "conceptual_keyword",
      "location": "string (e.g. Professional Summary, Skills Section, or Work Experience)",
      "reason": "string (why this keyword was added and how the underlying work genuinely supports it)"
    }
  ],
  "finalizedResumeText": "string (the complete, fully rendered, ATS-compliant markdown resume)"
}`;

    userPrompt = `# Input Format
- **JOB DESCRIPTION (JD):**
${jobDescription}

- **EXISTING RESUME:**
${resumeText}`;
  }

  try {
    const rawResponse = await callOpenRouter([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      temperature: 0.2,
      maxTokens: 4000,
      stage: mode === 'ats_max_score' ? 'ats_algorithmic_scoring' : 'strategic_optimization'
    });

    let parsed: any = null;
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        // Fallback if parsing failed
      }
    }

    if (parsed && parsed.finalizedResumeText) {
      return res.status(200).json({
        summaryOfAddedKeywords: parsed.summaryOfAddedKeywords || [],
        finalizedResumeText: parsed.finalizedResumeText,
        rawOutput: rawResponse,
        executionSource: 'ai_api'
      });
    }

    return res.status(200).json({
      summaryOfAddedKeywords: [],
      finalizedResumeText: rawResponse,
      rawOutput: rawResponse,
      executionSource: 'ai_api'
    });

  } catch (error) {
    console.warn('[optimize-resume] API invocation error, client should use local fallback:', error);
    return res.status(503).json({
      error: 'AI service currently unavailable. Please use the local strategic optimizer engine.',
      canFallback: true
    });
  }
}
