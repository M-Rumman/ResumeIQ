import { getSupabaseAdmin } from './supabaseAdmin.js';
import type { CandidateProfile, WorkPreference } from './jobMatch.js';

export type JobMatchMemory = {
  previousSearches: number;
  preferredTitles: string[];
  preferredLocations: string[];
  preferredWorkModes: string[];
  preferredCompanies: string[];
  careerPaths: string[];
};

const unique = (values: string[]) => [...new Set(values.filter(Boolean))].slice(0, 10);
const emptyMemory: JobMatchMemory = { previousSearches: 0, preferredTitles: [], preferredLocations: [], preferredWorkModes: [], preferredCompanies: [], careerPaths: [] };

export async function loadJobMatchMemory(userId: string): Promise<JobMatchMemory> {
  const db = getSupabaseAdmin();
  const [{ data: searches, error: searchesError }, { data: saved, error: savedError }] = await Promise.all([
    db.from('job_match_searches').select('job_titles, location, work_preference, primary_domain').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    db.from('saved_jobs').select('job_title, company, location').eq('user_id', userId).order('saved_at', { ascending: false }).limit(30),
  ]);
  if (searchesError || savedError) return emptyMemory;
  const history = searches || [];
  return {
    previousSearches: history.length,
    preferredTitles: unique([...(saved || []).map((item: any) => String(item.job_title || '')), ...history.flatMap((item: any) => Array.isArray(item.job_titles) ? item.job_titles.map(String) : [])]),
    preferredLocations: unique([...(saved || []).map((item: any) => String(item.location || '')), ...history.map((item: any) => String(item.location || ''))]),
    preferredWorkModes: unique(history.map((item: any) => String(item.work_preference || ''))),
    preferredCompanies: unique((saved || []).map((item: any) => String(item.company || ''))),
    careerPaths: unique(history.map((item: any) => String(item.primary_domain || ''))),
  };
}

export async function recordJobMatchSearch(userId: string, profile: CandidateProfile, location: string, workPreference: WorkPreference, jobTitles: string[], resultCount: number): Promise<void> {
  const { error } = await getSupabaseAdmin().from('job_match_searches').insert({
    user_id: userId,
    primary_domain: profile.primary_domain,
    career_level: profile.career_level,
    location,
    work_preference: workPreference,
    job_titles: jobTitles,
    industries: profile.industries,
    result_count: resultCount,
  });
  if (error) console.error('[job-match] search-history-write-failed', { code: error.code });
}
