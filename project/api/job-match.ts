import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from './_lib/auth.js';
import { fallbackRank, filterByResumeRelevance, localProfile, searchJobs, type NormalizedJob } from './_lib/jobMatch.js';
import { understandAndRank } from './_lib/geminiJobMatch.js';
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!await getUserFromRequest(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { resumeText = '', location = '', workPreference = 'both' } = req.body || {}; if (String(resumeText).trim().length < 50) return res.status(400).json({ error: 'Resume text is too short.' });
  try {
    const profile = localProfile(String(resumeText));
    const queries = profile.jobTitles.length ? profile.jobTitles : ['Embedded Systems Intern'];
    const first = await searchJobs(queries[0], String(location), workPreference);
    let retrieved = first.jobs;
    let relevant = filterByResumeRelevance(profile, retrieved);
    const additionalSources = [] as typeof first.sources;

    // A narrow first query can legitimately have few local results. Expand only
    // with additional resume-derived engineering titles; never with generic roles.
    if (relevant.length < 5) {
      const additional = queries.slice(1, 3);
      const expansions = await Promise.all(additional.map((query) => searchJobs(query, String(location), workPreference)));
      retrieved = [...retrieved, ...expansions.flatMap((result) => result.jobs)].filter((job, index, all) => all.findIndex((candidate) => candidate.id === job.id) === index) as NormalizedJob[];
      relevant = filterByResumeRelevance(profile, retrieved);
      additionalSources.push(...expansions.flatMap((result) => result.sources));
    }

    // Gemini receives only the highest deterministic matches, already sorted by
    // the six weighted resume relevance dimensions and gated at 60/100.
    const shortlisted = relevant.slice(0, 20).map(({ job }) => job);
    console.info('[job-match] relevance-gate', { retrieved: retrieved.length, accepted: relevant.length, rejected: retrieved.length - relevant.length, sentToGemini: shortlisted.length });
    if (!shortlisted.length) return res.status(200).json({ profile, jobs: [], sources: [...first.sources, ...additionalSources] });

    try {
      const ranked = await understandAndRank(String(resumeText), profile, shortlisted, String(location), workPreference);
      return res.status(200).json({ ...ranked, jobs: ranked.jobs.slice(0, 20), sources: [...first.sources, ...additionalSources], rankingMode: 'gemini' });
    } catch (error) {
      console.error('[job-match] gemini ranking fallback', { message: error instanceof Error ? error.message : 'unknown', configuredKeys: [process.env.GEMINI_KEY_1, process.env.GEMINI_KEY_2, process.env.GEMINI_KEY_3].filter(Boolean).length });
      return res.status(200).json({ profile, jobs: fallbackRank(profile, shortlisted, String(location)).slice(0, 20), sources: [...first.sources, ...additionalSources], rankingMode: 'fallback' });
    }
  } catch (error) { console.error('[job-match] request failed', { message: error instanceof Error ? error.message : 'unknown' }); return res.status(502).json({ error: 'Job sources are temporarily unavailable. Please try again shortly.' }); }
}
