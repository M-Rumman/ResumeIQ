import { callOpenRouter, AiPipelineError, isAiPipelineError, extractJsonFromText } from '../openrouter.js';
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
5. You MUST consistently extract seniority requirements (e.g., "Senior", "Lead") as category "seniority".
6. You MUST consistently extract location, hybrid/remote work mode, and work authorization constraints (e.g., "Chicago, IL Hybrid", "U.S. citizen") as category "location" or "other".
`;

export function validateAndProcessRequirements(parsedRequirements: any[], jobDescriptionText: string): JobRequirement[] {
  const validRequirements: JobRequirement[] = [];

  for (const req of parsedRequirements) {
    if (!req.normalized_name || typeof req.normalized_name !== 'string' || req.normalized_name.trim() === '') {
       console.warn(`[jdParser] Dropping blank requirement from LLM output`);
       continue;
    }

    // PROVENANCE VALIDATION: "Can I point to the exact supplied JD text that created this requirement?"
    const rawLower = jobDescriptionText.toLowerCase().replace(/\s+/g, ' ');
    const sourceLower = (req.source_text || req.original_text || '').toLowerCase().replace(/\s+/g, ' ');
    const origLower = (req.original_text || '').toLowerCase().replace(/\s+/g, ' ');
    
    let sourceSpan: [number, number] = [-1, -1];
    
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const getRegex = (text: string) => {
        if (!text) return null;
        // Only apply word boundary if it starts/ends with alphanumeric characters
        const prefix = /^[a-z0-9]/i.test(text) ? '\\b' : '';
        const suffix = /[a-z0-9]$/i.test(text) ? '\\b' : '';
        return new RegExp(`${prefix}${escapeRegex(text)}${suffix}`, 'i');
    };

    const sourceRegex = getRegex(sourceLower);
    const origRegex = getRegex(origLower);

    if (sourceRegex && sourceRegex.test(rawLower)) {
       const match = rawLower.match(sourceRegex)!;
       sourceSpan = [match.index!, match.index! + sourceLower.length];
    } else if (origRegex && origRegex.test(rawLower)) {
       const match = rawLower.match(origRegex)!;
       sourceSpan = [match.index!, match.index! + origLower.length];
    } else {
       // Fallback: Try matching after stripping leading/trailing non-alphanumeric characters
       const cleanSource = sourceLower.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '').trim();
       const cleanOrig = origLower.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '').trim();
       
       const cleanSourceRegex = cleanSource && cleanSource.length > 3 ? getRegex(cleanSource) : null;
       const cleanOrigRegex = cleanOrig && cleanOrig.length > 3 ? getRegex(cleanOrig) : null;

       if (cleanSourceRegex && cleanSourceRegex.test(rawLower)) {
         const match = rawLower.match(cleanSourceRegex)!;
         sourceSpan = [match.index!, match.index! + cleanSource.length];
       } else if (cleanOrigRegex && cleanOrigRegex.test(rawLower)) {
         const match = rawLower.match(cleanOrigRegex)!;
         sourceSpan = [match.index!, match.index! + cleanOrig.length];
       } else {
         // Fails provenance validation - discard it to prevent hallucination!
         console.warn(`[jdParser] Dropping hallucinated requirement: ${req.normalized_name}`);
         continue;
       }
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

const STOP_WORDS_AT_DEDUP = new Set([
  'and', 'or', 'of', 'to', 'in', 'with', 'a', 'the', 'for', 'on', 'at', 'by', 'an', 'is', 'are', 'experience', 'ability', 'knowledge', 'understanding', 'skills', 'demonstrated'
]);

export function getJaccardSimilarity(str1: string, str2: string): number {
  const getWords = (s: string) => new Set(
    s.toLowerCase()
     .split(/\s+/)
     .map(w => w.replace(/[^a-z0-9]/g, ''))
     .filter(w => w.length > 2 && !STOP_WORDS_AT_DEDUP.has(w))
  );
  
  const set1 = getWords(str1);
  const set2 = getWords(str2);
  
  if (set1.size === 0 || set2.size === 0) return 0;
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

export function getPrimaryConcept(name: string): string {
  const lower = name.toLowerCase();
  
  if (
    (/\b(?:qualitative|quantitative|mixed-method|usability|interview|survey|diary)\b/.test(lower) && /\b(?:method|research|test|study|studies)\b/.test(lower)) ||
    (/\bdesign\b/.test(lower) && /\bconduct\b/.test(lower) && /\bresearch\b/.test(lower)) ||
    (/\busability\s+testing\b/.test(lower))
  ) {
    return 'qualitative_quantitative_research_methods';
  }
  
  if (
    (/\b(?:present|findings|communicate|communication|storytelling|report|presentation)\b/.test(lower) && /\b(?:leadership|stakeholder|executive|c-suite|vp|senior|management)\b/.test(lower)) ||
    (/\bstakeholder\s+communication\b/.test(lower))
  ) {
    return 'stakeholder_communication_presenting_findings';
  }

  if (
    /\b(?:panel|participant|repository|operations|recruit|recruitment|ops)\b/.test(lower) &&
    /\b(?:research|recruit|panel|repository)\b/.test(lower)
  ) {
    return 'research_operations_participant_panel';
  }

  if (
    /\b(?:data\s+science|analytics|clickstream|triangulate|quantitative\s+insights)\b/.test(lower)
  ) {
    return 'partner_with_data_science_analytics';
  }

  if (
    /\b(?:mentor|mentorship|junior|train|coaching)\b/.test(lower)
  ) {
    return 'mentorship_coaching';
  }

  return name;
}

export function deduplicateRequirements(requirements: JobRequirement[]): JobRequirement[] {
  const conceptMap = new Map<string, JobRequirement>();
  const deduped: JobRequirement[] = [];

  for (const req of requirements) {
    const concept = getPrimaryConcept(req.normalized_name);
    if (conceptMap.has(concept)) {
      const existing = conceptMap.get(concept)!;
      if (req.priority === 'required' || existing.priority === 'required') {
        existing.priority = 'required';
      } else if (req.priority === 'preferred' || existing.priority === 'preferred') {
        existing.priority = 'preferred';
      }
      if (req.source_text && !existing.source_text.includes(req.source_text)) {
        existing.source_text = `${existing.source_text} | ${req.source_text}`;
      }
      if (concept === 'qualitative_quantitative_research_methods') {
        existing.normalized_name = 'Qualitative and Quantitative Research Methods';
      } else if (concept === 'stakeholder_communication_presenting_findings') {
        existing.normalized_name = 'Stakeholder Communication & Presenting Findings';
      } else if (concept === 'research_operations_participant_panel') {
        existing.normalized_name = 'Research Operations & Participant Panel';
      } else if (concept === 'partner_with_data_science_analytics') {
        existing.normalized_name = 'Partner with Data Science & Analytics';
      } else if (concept === 'mentorship_coaching') {
        existing.normalized_name = 'Mentorship & Team Coaching';
      }
    } else {
      conceptMap.set(concept, req);
      deduped.push(req);
    }
  }

  const finalDeduped: JobRequirement[] = [];
  for (const req of deduped) {
    let isDuplicate = false;
    for (const existing of finalDeduped) {
      if (getJaccardSimilarity(req.normalized_name, existing.normalized_name) > 0.6) {
        isDuplicate = true;
        if (req.priority === 'required') existing.priority = 'required';
        if (req.source_text && !existing.source_text.includes(req.source_text)) {
          existing.source_text = `${existing.source_text} | ${req.source_text}`;
        }
        break;
      }
    }
    if (!isDuplicate) {
      finalDeduped.push(req);
    }
  }

  return finalDeduped;
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
        maxTokens: 8000,
        temperature: 0.1,
        observability: options.observability,
        stage: 'parser'
      }
    );

    let parsed: Record<string, any>;
    try {
      parsed = extractJsonFromText(rawJson) as Record<string, any>;
    } catch (e) {
      throw new AiPipelineError('parser', 'MALFORMED_JSON_OUTPUT', 'Could not parse JSON from model output');
    }

    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.requirements)) {
      throw new AiPipelineError('parser', 'MALFORMED_JSON_OUTPUT', 'Invalid JSON structure returned by LLM.');
    }

    const validRequirements = validateAndProcessRequirements(parsed.requirements, jobDescriptionText);
    const dedupedRequirements = deduplicateRequirements(validRequirements);

    return {
      title: parsed.title || 'Unknown Title',
      company: parsed.company || null,
      requirements: dedupedRequirements,
    };

  } catch (error) {
    console.error('[jdParser] Failed to parse Job Description', error);
    if (isAiPipelineError(error)) {
      throw error;
    }
    // Only wrap truly unexpected generic errors in JD_PARSING_FAILED
    throw new AiPipelineError(
      'parser',
      'JD_PARSING_FAILED',
      error instanceof Error ? error.message : 'Unknown parsing failure'
    );
  }
}
