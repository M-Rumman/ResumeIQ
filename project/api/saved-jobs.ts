import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from './_lib/auth.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await getUserFromRequest(req); if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const db = getSupabaseAdmin();
  if (req.method === 'GET') { const { data, error } = await db.from('saved_jobs').select('*').eq('user_id', user.id).order('saved_at', { ascending: false }); return error ? res.status(500).json({ error: 'Could not load saved jobs.' }) : res.status(200).json({ jobs: data || [] }); }
  if (req.method === 'POST') { const b = req.body || {}; if (!b.job_id || !b.job_title || !b.apply_url) return res.status(400).json({ error: 'Incomplete job data.' }); const { data, error } = await db.from('saved_jobs').upsert({ user_id: user.id, job_id: String(b.job_id), job_title: String(b.job_title), company: String(b.company || ''), location: String(b.location || ''), salary: String(b.salary || ''), match_score: Number(b.match_score) || 0, apply_url: String(b.apply_url), source: String(b.source || '') }, { onConflict: 'user_id,job_id' }).select().single(); return error ? res.status(500).json({ error: 'Could not save this job.' }) : res.status(201).json({ job: data }); }
  if (req.method === 'DELETE') { const id = String(req.query.id || ''); const { error } = await db.from('saved_jobs').delete().eq('id', id).eq('user_id', user.id); return error ? res.status(500).json({ error: 'Could not remove this job.' }) : res.status(204).end(); }
  return res.status(405).json({ error: 'Method not allowed' });
}
