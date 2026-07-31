import type { CandidateProfile, NormalizedJob, RankedJob, WorkPreference } from './jobMatch.js';
import type { JobMatchMemory } from './jobSearchMemory.js';

export type AiJobSuggestions = {
  skills: string[];
  estimatedMatchIncrease: number;
  resumeEdits: string[];
  certifications: string[];
  projects: string[];
  companies: string[];
  careerPaths: string[];
};

const keys = () => [process.env.GEMINI_KEY_1, process.env.GEMINI_KEY_2, process.env.GEMINI_KEY_3].filter((key): key is string => Boolean(key));
function json(text: string) { const match = text.match(/\{[\s\S]*\}/); return JSON.parse(match?.[0] || text); }
const textList = (value: unknown, maximum = 3) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string').map((item) => item.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, maximum)
  : [];
const suggestionsFrom = (value: unknown): AiJobSuggestions => {
  const candidate = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const skills = textList(candidate.skills, 4);
  return {
    skills,
    estimatedMatchIncrease: skills.length ? Math.max(0, Math.min(30, Number(candidate.estimatedMatchIncrease) || 0)) : 0,
    resumeEdits: textList(candidate.resumeEdits),
    certifications: textList(candidate.certifications),
    projects: textList(candidate.projects),
    companies: textList(candidate.companies),
    careerPaths: textList(candidate.careerPaths),
  };
};
const requirementsFrom = (description: string) => description.split(/(?<=[.!?])\s+/)
  .filter((sentence) => /\b(?:required|must have|must|mandatory|essential|preferred|nice to have|qualification|experience with)\b/i.test(sentence))
  .slice(0, 12);

/** Gemini reranks only deterministic top candidates; it cannot add a new job. */
export async function understandAndRank(baseProfile: CandidateProfile, jobs: NormalizedJob[], requestedLocation = '', workPreference: WorkPreference = 'both', memory?: JobMatchMemory): Promise<{ profile: CandidateProfile; jobs: RankedJob[]; suggestions: AiJobSuggestions }> {
  const prompt = `Return JSON only. Compare the structured candidate resume profile against EACH supplied job. Do not use raw keyword count as the decision method: assess role/domain fit, transferable project experience, demonstrated technical stack, education, experience level, and location/work-mode fit together. Do not invent jobs, requirements, skills, companies, locations, or evidence. Every claim must be supported by the supplied candidate profile or supplied job description. Every ranking id must be an id from the supplied jobs. Previous search memory is preference context only: use it to break ties among already suitable jobs, never to override the current resume, current location, or current work preference. Return only this schema: {"rankings":[{"id":"","score":0,"reasons":[""],"strengths":[""],"missingSkills":[""],"weaknesses":[""]}],"suggestions":{"skills":[""],"estimatedMatchIncrease":0,"resumeEdits":[""],"certifications":[""],"projects":[""],"companies":[""],"careerPaths":[""]}}. score is 0-100. reasons: up to 3 concise explanations of this match. strengths: up to 3 documented candidate strengths relevant to this role. missingSkills: up to 3 requirements in this job not shown by the candidate profile. weaknesses: up to 3 role-specific gaps, distinct from strengths. suggestions: use the recurring requirements across the supplied jobs; skills contains at most 4 job-required skills absent from the candidate profile; estimatedMatchIncrease is a conservative 0-30 estimate if these skills are genuinely acquired and evidenced, not a guarantee; resumeEdits must describe truthful edits to existing evidence; certifications must be explicitly required or relevant in the supplied jobs; projects must be learning-project ideas, never claimed candidate experience; companies must be companies from supplied jobs aligned with the profile or saved-company preferences; careerPaths must be evidence-backed paths from the supplied jobs and candidate profile. Use empty arrays when there is no grounded item. Structured Resume: ${JSON.stringify(baseProfile)}. Previous search memory: ${JSON.stringify(memory || {})}. Requested location: "${requestedLocation || 'any'}". Requested work preference: "${workPreference}". Jobs: ${JSON.stringify(jobs.map(({ id, title, company, location, description, tags, employmentType }) => ({ id, jobTitle: title, company, location, employmentType, requirements: requirementsFrom(description), jobDescription: description.slice(0, 1800), tags })) )}`;
  let last: unknown;
  if (!keys().length) throw new Error('No Gemini API keys are configured');
  const model = process.env.GEMINI_JOB_MATCH_MODEL || 'gemini-2.5-pro';
  for (const key of keys()) try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } }), signal: AbortSignal.timeout(45000) });
    if (!response.ok) { const detail = (await response.text()).slice(0, 300); console.error('[gemini-job-match] provider response', { status: response.status, model, detail }); last = new Error(`Gemini ${response.status}`); if (response.status === 429 || response.status >= 500) continue; throw last; }
    const body = await response.json() as any;
    const parsed = json(body.candidates?.[0]?.content?.parts?.[0]?.text || '') as any;
    const byId = new Map<string, any>((parsed.rankings || []).filter((ranking: any) => jobs.some((job) => job.id === ranking.id)).map((ranking: any) => [ranking.id, ranking]));
    return { profile: baseProfile, suggestions: suggestionsFrom(parsed.suggestions), jobs: jobs.map((job) => {
      const assessment = byId.get(job.id) || {};
      return {
        ...job,
        matchPercent: Math.max(0, Math.min(100, Number(assessment.score) || 0)),
        relevanceScore: 0,
        matchLabel: 'Weak Match' as const,
        matchEvidence: { matched: [], missing: [] },
        reasons: textList(assessment.reasons),
        missingSkills: textList(assessment.missingSkills),
        strengths: textList(assessment.strengths),
        weaknesses: textList(assessment.weaknesses),
        potentialSalaryFit: job.salary ? 'Salary listed; compare it with your target range.' : 'Salary not listed.',
        careerGrowth: 'Review role scope',
        likelihoodOfInterview: 'Not assessed',
      };
    }) };
  } catch (error) { last = error; }
  throw last instanceof Error ? last : new Error('Gemini ranking unavailable');
}
