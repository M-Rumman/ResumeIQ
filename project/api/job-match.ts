import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from './_lib/auth.js';
import { fallbackRank, filterByResumeRelevance, localProfile, mergeAndNormalizeJobs, relevanceLabel, searchJobs, type NormalizedJob, type RankedJob } from './_lib/jobMatch.js';
import { understandAndRank } from './_lib/geminiJobMatch.js';
import { generateJobSearchIntent } from './_lib/jobSearchIntent.js';
import { loadJobMatchMemory, recordJobMatchSearch } from './_lib/jobSearchMemory.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await getUserFromRequest(req); if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (req.query.action === 'saved') {
    const db = getSupabaseAdmin();
    if (req.method === 'GET') { const { data, error } = await db.from('saved_jobs').select('*').eq('user_id', user.id).order('saved_at', { ascending: false }); return error ? res.status(500).json({ error: 'Could not load saved jobs.' }) : res.status(200).json({ jobs: data || [] }); }
    if (req.method === 'POST') { const b = req.body || {}; if (!b.job_id || !b.job_title || !b.apply_url) return res.status(400).json({ error: 'Incomplete job data.' }); const { data, error } = await db.from('saved_jobs').upsert({ user_id: user.id, job_id: String(b.job_id), job_title: String(b.job_title), company: String(b.company || ''), location: String(b.location || ''), salary: String(b.salary || ''), match_score: Number(b.match_score) || 0, apply_url: String(b.apply_url), source: String(b.source || '') }, { onConflict: 'user_id,job_id' }).select().single(); return error ? res.status(500).json({ error: 'Could not save this job.' }) : res.status(201).json({ job: data }); }
    if (req.method === 'DELETE') { const id = String(req.query.id || ''); const { error } = await db.from('saved_jobs').delete().eq('id', id).eq('user_id', user.id); return error ? res.status(500).json({ error: 'Could not remove this job.' }) : res.status(204).end(); }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { resumeText = '', location = '', workPreference = 'both' } = req.body || {}; if (String(resumeText).trim().length < 50) return res.status(400).json({ error: 'Resume text is too short.' });
  try {
    const profile = localProfile(String(resumeText));
    const memory = await loadJobMatchMemory(user.id);
    const searchIntent = generateJobSearchIntent(profile);
    const queries = searchIntent.job_titles.length ? searchIntent.job_titles : [profile.primary_domain];
    // Search every generated role title in small parallel batches. Provider
    // calls already run in parallel per title; batching avoids a long serial
    // chain while ensuring the result set is not dominated by one role name.
    const searches: Awaited<ReturnType<typeof searchJobs>>[] = [];
    let retrieved: NormalizedJob[] = [];
    let relevant = [] as ReturnType<typeof filterByResumeRelevance>;
    let queryIndex = 0;
    while (queryIndex < queries.length) {
      const batch = queries.slice(queryIndex, queryIndex + 3);
      queryIndex += batch.length;
      const outcomes = await Promise.all(batch.map(async (query) => {
        try {
          return { query, search: await searchJobs(query, String(location), workPreference, profile) };
        } catch (error) {
          // A malformed response or transient provider error for one title
          // must not cancel searches for the other candidate role titles.
          console.error('[job-match] query-search-failed', {
            query,
            message: error instanceof Error ? error.message : 'unknown'
          });
          return { query, search: null };
        }
      }));
      outcomes.forEach(({ search }) => {
        if (!search) return;
        searches.push(search);
        retrieved = mergeAndNormalizeJobs([...retrieved, ...search.jobs]);
      });
      relevant = filterByResumeRelevance(profile, retrieved, String(location));
      console.info('[job-match] query-validation', {
        queries: batch,
        queryIndex,
        retrieved: retrieved.length,
        validated: relevant.length,
        continuing: queryIndex < queries.length
      });
    }
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
    if (!shortlisted.length) {
      await recordJobMatchSearch(user.id, profile, String(location), workPreference, queries, 0);
      return res.status(200).json({ profile, search_intent: searchIntent, jobs: [], sources: allSources });
    }

    try {
      const ranked = await understandAndRank(profile, shortlisted, String(location), workPreference, memory);
      const jobs = applyGeminiRerank(ranked.jobs).slice(0, 30);
      await recordJobMatchSearch(user.id, profile, String(location), workPreference, queries, jobs.length);
      return res.status(200).json({ ...ranked, search_intent: searchIntent, jobs, sources: allSources, rankingMode: 'gemini' });
    } catch (error) {
      console.error('[job-match] gemini ranking fallback', { message: error instanceof Error ? error.message : 'unknown', configuredKeys: [process.env.GEMINI_KEY_1, process.env.GEMINI_KEY_2, process.env.GEMINI_KEY_3].filter(Boolean).length });
      const jobs = applyDeterministicScore(fallbackRank(profile, shortlisted, String(location))).slice(0, 30);
      await recordJobMatchSearch(user.id, profile, String(location), workPreference, queries, jobs.length);
      return res.status(200).json({ profile, search_intent: searchIntent, jobs, sources: allSources, rankingMode: 'fallback' });
    }
  } catch (error) { console.error('[job-match] request failed', { message: error instanceof Error ? error.message : 'unknown' }); return res.status(502).json({ error: 'Job sources are temporarily unavailable. Please try again shortly.' }); }
}
