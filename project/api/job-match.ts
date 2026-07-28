import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from './_lib/auth.js';
import { fallbackRank, filterByResumeRelevance, localProfile, relevanceLabel, searchJobs, type NormalizedJob, type RankedJob } from './_lib/jobMatch.js';
import { understandAndRank } from './_lib/geminiJobMatch.js';
import { generateJobSearchIntent } from './_lib/jobSearchIntent.js';
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!await getUserFromRequest(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { resumeText = '', location = '', workPreference = 'both' } = req.body || {}; if (String(resumeText).trim().length < 50) return res.status(400).json({ error: 'Resume text is too short.' });
  try {
    const profile = localProfile(String(resumeText));
    const searchIntent = generateJobSearchIntent(profile);
    const queries = searchIntent.job_titles.length ? searchIntent.job_titles : [profile.primary_domain];
    // Start with the highest-confidence intent, then expand one role at a time
    // only while fewer than 20 validated jobs are available. This prevents an
    // API's broad first page from filling the UI with merely adjacent roles.
    const searches: Awaited<ReturnType<typeof searchJobs>>[] = [];
    const retrievedById = new Map<string, NormalizedJob>();
    let relevant = [] as ReturnType<typeof filterByResumeRelevance>;
    let queryIndex = 0;
    while (queryIndex < queries.length && relevant.length < 20) {
      const query = queries[queryIndex++];
      const search = await searchJobs(query, String(location), workPreference);
      searches.push(search);
      search.jobs.forEach((job) => retrievedById.set(job.id, job));
      relevant = filterByResumeRelevance(profile, [...retrievedById.values()], String(location));
      console.info('[job-match] query-validation', {
        query,
        queryIndex,
        retrieved: retrievedById.size,
        validated: relevant.length,
        continuing: relevant.length < 20 && queryIndex < queries.length
      });
    }
    const retrieved = [...retrievedById.values()];
    const allSources = searches.flatMap((result) => result.sources);

    // Gemini receives only the highest deterministic matches, already sorted by
    // the deterministic candidate-fit validation and relevance dimensions.
    const shortlistedEntries = relevant.slice(0, 30);
    const shortlisted = shortlistedEntries.map(({ job }) => job);
    const deterministicScores = new Map(shortlistedEntries.map((entry) => [entry.job.id, entry]));
    const applyGeminiRerank = (jobs: RankedJob[]) => jobs.map((job) => {
      const deterministic = deterministicScores.get(job.id);
      const score = job.matchPercent || deterministic?.relevanceScore || 0;
      return { ...job, matchPercent: score, relevanceScore: score, matchLabel: relevanceLabel(score), matchEvidence: deterministic?.matchEvidence || job.matchEvidence };
    }).sort((left, right) => right.relevanceScore - left.relevanceScore);
    const applyDeterministicScore = (jobs: RankedJob[]) => jobs.map((job) => {
      const score = deterministicScores.get(job.id);
      return score ? { ...job, matchPercent: score.relevanceScore, relevanceScore: score.relevanceScore, matchLabel: score.matchLabel, matchEvidence: score.matchEvidence } : job;
    }).sort((left, right) => right.relevanceScore - left.relevanceScore);
    console.info('[job-match] relevance-gate', { queriesSearched: queries.slice(0, queryIndex), retrieved: retrieved.length, accepted: relevant.length, rejected: retrieved.length - relevant.length, sentToGemini: shortlisted.length });
    if (!shortlisted.length) return res.status(200).json({ profile, search_intent: searchIntent, jobs: [], sources: allSources });

    try {
      const ranked = await understandAndRank(profile, shortlisted, String(location), workPreference);
      return res.status(200).json({ ...ranked, search_intent: searchIntent, jobs: applyGeminiRerank(ranked.jobs).slice(0, 30), sources: allSources, rankingMode: 'gemini' });
    } catch (error) {
      console.error('[job-match] gemini ranking fallback', { message: error instanceof Error ? error.message : 'unknown', configuredKeys: [process.env.GEMINI_KEY_1, process.env.GEMINI_KEY_2, process.env.GEMINI_KEY_3].filter(Boolean).length });
      return res.status(200).json({ profile, search_intent: searchIntent, jobs: applyDeterministicScore(fallbackRank(profile, shortlisted, String(location))).slice(0, 30), sources: allSources, rankingMode: 'fallback' });
    }
  } catch (error) { console.error('[job-match] request failed', { message: error instanceof Error ? error.message : 'unknown' }); return res.status(502).json({ error: 'Job sources are temporarily unavailable. Please try again shortly.' }); }
}
