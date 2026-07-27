import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from './_lib/auth.js';
import { fallbackRank, localProfile, searchJobs } from './_lib/jobMatch.js';
import { understandAndRank } from './_lib/geminiJobMatch.js';
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!await getUserFromRequest(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { resumeText = '', location = '', title = '' } = req.body || {}; if (String(resumeText).trim().length < 50) return res.status(400).json({ error: 'Resume text is too short.' });
  try { const profile = localProfile(String(resumeText)); const query = String(title || profile.jobTitles[0] || profile.technicalSkills.slice(0, 3).join(' ') || 'graduate'); const found = await searchJobs(query, String(location)); if (!found.jobs.length) return res.status(200).json({ profile, jobs: [], sources: found.sources }); try { const ranked = await understandAndRank(String(resumeText), profile, found.jobs); return res.status(200).json({ ...ranked, sources: found.sources, rankingMode: 'gemini' }); } catch (error) { console.error('[job-match] gemini ranking fallback', { message: error instanceof Error ? error.message : 'unknown', configuredKeys: [process.env.GEMINI_KEY_1, process.env.GEMINI_KEY_2, process.env.GEMINI_KEY_3].filter(Boolean).length }); return res.status(200).json({ profile, jobs: fallbackRank(profile, found.jobs), sources: found.sources, rankingMode: 'fallback' }); } } catch (error) { console.error('[job-match] request failed', { message: error instanceof Error ? error.message : 'unknown' }); return res.status(502).json({ error: 'Job sources are temporarily unavailable. Please try again shortly.' }); }
}
