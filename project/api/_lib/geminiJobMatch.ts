import type { CandidateProfile, NormalizedJob, RankedJob, WorkPreference } from './jobMatch.js';

const keys = () => [process.env.GEMINI_KEY_1, process.env.GEMINI_KEY_2, process.env.GEMINI_KEY_3].filter((key): key is string => Boolean(key));
function json(text: string) { const match = text.match(/\{[\s\S]*\}/); return JSON.parse(match?.[0] || text); }
const requirementsFrom = (description: string) => description.split(/(?<=[.!?])\s+/)
  .filter((sentence) => /\b(?:required|must have|must|mandatory|essential|preferred|nice to have|qualification|experience with)\b/i.test(sentence))
  .slice(0, 12);

/** Gemini reranks only deterministic top candidates; it cannot add a new job. */
export async function understandAndRank(baseProfile: CandidateProfile, jobs: NormalizedJob[], requestedLocation = '', workPreference: WorkPreference = 'both'): Promise<{ profile: CandidateProfile; jobs: RankedJob[] }> {
  const prompt = `Return JSON only. Rerank only the supplied jobs for the supplied structured resume profile. Do not invent jobs, requirements, skills, companies, locations, or evidence. Every ranking id must be an id from the supplied jobs. Score each supplied job from 0 to 100 using role/domain fit, explicit skills, education, experience level, and location/work-mode fit. Return only this schema: {"rankings":[{"id":"","score":0,"reason":""}]}. Structured Resume: ${JSON.stringify(baseProfile)}. Requested location: "${requestedLocation || 'any'}". Requested work preference: "${workPreference}". Jobs: ${JSON.stringify(jobs.map(({ id, title, company, location, description, tags, employmentType }) => ({ id, jobTitle: title, company, location, employmentType, requirements: requirementsFrom(description), jobDescription: description.slice(0, 1800), tags })) )}`;
  let last: unknown;
  if (!keys().length) throw new Error('No Gemini API keys are configured');
  const model = process.env.GEMINI_JOB_MATCH_MODEL || 'gemini-2.5-pro';
  for (const key of keys()) try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } }), signal: AbortSignal.timeout(45000) });
    if (!response.ok) { const detail = (await response.text()).slice(0, 300); console.error('[gemini-job-match] provider response', { status: response.status, model, detail }); last = new Error(`Gemini ${response.status}`); if (response.status === 429 || response.status >= 500) continue; throw last; }
    const body = await response.json() as any;
    const parsed = json(body.candidates?.[0]?.content?.parts?.[0]?.text || '') as any;
    const byId = new Map<string, any>((parsed.rankings || []).filter((ranking: any) => jobs.some((job) => job.id === ranking.id)).map((ranking: any) => [ranking.id, ranking]));
    return { profile: baseProfile, jobs: jobs.map((job) => ({ ...job, matchPercent: Math.max(0, Math.min(100, Number(byId.get(job.id)?.score) || 0)), relevanceScore: 0, matchLabel: 'Weak Match' as const, matchEvidence: { matched: [], missing: [] }, reasons: byId.get(job.id)?.reason ? [String(byId.get(job.id).reason)] : [], missingSkills: [], strengths: [], potentialSalaryFit: job.salary ? 'Salary listed; compare it with your target range.' : 'Salary not listed.', careerGrowth: 'Review role scope', likelihoodOfInterview: 'Not assessed' })) };
  } catch (error) { last = error; }
  throw last instanceof Error ? last : new Error('Gemini ranking unavailable');
}
