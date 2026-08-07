import { callOpenRouter, AiPipelineError, extractJsonFromText } from '../openrouter.js';
import type { AiObservabilityContext } from '../aiObservability.js';
import type { JobProfile, JobRequirement } from './types.js';
import { randomUUID } from 'node:crypto';

const JD_PARSER_SYSTEM_PROMPT = `You are an expert Job Description (JD) analyzer.
Your task is to extract a strictly structured profile of the job requirements from the provided raw JD text.
You must return a valid JSON object matching this schema exactly, with NO markdown formatting, NO backticks, and NO commentary.

{
  "title": "Exact job title",
  "company": "Company name if present, or null",
  "requirements": [
    {
      "category": "hard skill" | "soft skill" | "experience" | "education" | "domain" | "responsibility" | "tool" | "methodology" | "seniority" | "years" | "location" | "certification" | "language" | "other",
      "requirement_type": "The specific type (e.g., 'experience', 'education')",
      "normalized_name": "A concise, canonical name",
      "original_text": "The exact phrase from the JD",
      "source_section": "The heading under which this appeared (e.g., 'Requirements')",
      "source_text": "A larger surrounding sentence/bullet to prove context",
      "priority": "required" | "preferred" | "bonus",
      "confidence": 0.0 to 1.0,
      "domain": "Optional. E.g. 'UX research'",
      "minimum_years": "Optional. Minimum years required",
      "degree_level": "Optional. 'bachelor', 'master', 'phd', etc.",
      "fields": ["Optional. Fields of study"]
    }
  ]
}

CRITICAL INSTRUCTIONS:
1. Extract ALL explicitly stated requirements. Do NOT invent requirements.
2. If the JD does not mention a technology (e.g., Git, ROS), it MUST NOT become a job requirement.
3. Clearly distinguish REQUIRED from PREFERRED / NICE TO HAVE. Never treat preferred qualifications as mandatory requirements.
4. "original_text" and "source_text" MUST be exact quotes from the provided JD.
`;

export function validateAndProcessRequirements(parsedRequirements: any[], jobDescriptionText: string): JobRequirement[] {
  const validRequirements: JobRequirement[] = [];

  for (const req of parsedRequirements) {
    // PROVENANCE VALIDATION: "Can I point to the exact supplied JD text that created this requirement?"
    const rawLower = jobDescriptionText.toLowerCase().replace(/\s+/g, ' ');
    const sourceLower = (req.source_text || req.original_text || '').toLowerCase().replace(/\s+/g, ' ');
    const origLower = (req.original_text || '').toLowerCase().replace(/\s+/g, ' ');
    
    let sourceSpan: [number, number] = [-1, -1];
    
    // Use word boundaries to prevent substring matching (e.g. "git" inside "longitudinal")
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sourceRegex = sourceLower ? new RegExp(`\\b${escapeRegex(sourceLower)}\\b`, 'i') : null;
    const origRegex = origLower ? new RegExp(`\\b${escapeRegex(origLower)}\\b`, 'i') : null;

    if (sourceRegex && sourceRegex.test(rawLower)) {
       const match = rawLower.match(sourceRegex)!;
       sourceSpan = [match.index!, match.index! + sourceLower.length];
    } else if (origRegex && origRegex.test(rawLower)) {
       const match = rawLower.match(origRegex)!;
       sourceSpan = [match.index!, match.index! + origLower.length];
    } else {
       // Fails provenance validation - discard it to prevent hallucination!
       console.warn(`[jdParser] Dropping hallucinated requirement: ${req.normalized_name}`);
       continue;
    }

    validRequirements.push({
      id: randomUUID(),
      category: req.category || 'other',
      requirement_type: req.requirement_type || req.category || 'other',
      normalized_name: req.normalized_name || '',
      original_text: req.original_text || '',
      source_section: req.source_section || 'Unknown',
      source_span: sourceSpan,
      source_text: req.source_text || req.original_text || '',
      priority: req.priority || 'required',
      confidence: typeof req.confidence === 'number' ? req.confidence : 0.9,
      domain: req.domain,
      minimum_years: req.minimum_years,
      degree_level: req.degree_level,
      fields: req.fields,
    });
  }

  return validRequirements;
}

export async function parseJobDescription(
  jobDescriptionText: string,
  options: { observability?: AiObservabilityContext } = {}
): Promise<JobProfile> {
  const prompt = `Raw Job Description:\n${jobDescriptionText}`;
  
  let rawJson = '';
  try {
    rawJson = await callOpenRouter(
      [
        { role: 'system', content: JD_PARSER_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      {
        maxTokens: 4000,
        temperature: 0.1,
        observability: options.observability,
        stage: 'parser'
      }
    );

    const parsed = extractJsonFromText(rawJson) as Record<string, any>;

    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.requirements)) {
      throw new Error('Invalid JSON structure returned by LLM.');
    }

    const validRequirements = validateAndProcessRequirements(parsed.requirements, jobDescriptionText);

    return {
      title: parsed.title || 'Unknown Title',
      company: parsed.company || null,
      requirements: validRequirements,
    };

  } catch (error) {
    console.error('[jdParser] Failed to parse Job Description', error);
    if (error instanceof Error && error.message.includes('401')) {
      throw new AiPipelineError('parser', 'UNAUTHORIZED_API_KEY', error.message);
    }
    if (error instanceof AiPipelineError) {
      throw error;
    }
    throw new AiPipelineError('parser', 'JD_PARSING_FAILED', 'Failed to extract structured requirements from the job description.');
  }
}
