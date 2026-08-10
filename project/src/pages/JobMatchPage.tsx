import { useState } from 'react';
import { Briefcase, ExternalLink, MapPin, RefreshCw } from 'lucide-react';
import { apiPost } from '../lib/api/client.js';

type Job = {
  id: string; title: string; company: string; location: string; remoteType: string; salary: string; applyUrl: string; employmentType: string;
  matchPercent: number; relevanceScore: number; matchLabel: string; reasons: string[]; missingSkills: string[]; strengths: string[]; weaknesses: string[];
  matchEvidence: { matched: string[]; missing: string[] }; tags: string[]; description: string;
  potentialSalaryFit: string; careerGrowth: string; likelihoodOfInterview: string;
};
type Suggestions = { skills: string[]; estimatedMatchIncrease: number; resumeEdits: string[]; certifications: string[]; projects: string[]; companies: string[]; careerPaths: string[] };

export default function JobMatchPage() {
  const [resumeText, setResumeText] = useState('');
  const [location, setLocation] = useState('');
  const [title, setTitle] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [workPreference, setWorkPreference] = useState<'both' | 'remote' | 'hybrid' | 'onsite'>('both');
  const [careerLevel, setCareerLevel] = useState<'all' | 'internship' | 'graduate' | 'junior' | 'mid' | 'senior'>('all');
  const [minimumSalary, setMinimumSalary] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [saved, setSaved] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);

  const search = async () => {
    setLoading(true); setError('');
    try {
      const data = await apiPost<{ jobs: Job[]; suggestions?: Suggestions }>('/api/job-match', { resumeText, location, title, workPreference });
      setJobs(data.jobs); setSuggestions(data.suggestions || null); setHasSearched(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not find jobs.');
    } finally { setLoading(false); }
  };
  const save = async (job: Job) => {
    try {
      await apiPost('/api/saved-jobs', { job_id: job.id, job_title: job.title, company: job.company, location: job.location, salary: job.salary, match_score: job.relevanceScore, apply_url: job.applyUrl, source: job.id.split(':')[0] });
      setSaved((values) => [...values, job.id]);
    } catch { setError('Could not save this job.'); }
  };
  const visible = jobs.filter((job) => {
    const jobText = `${job.title} ${job.employmentType}`.toLowerCase();
    const industryText = `${job.title} ${job.tags.join(' ')} ${job.description}`.toLowerCase();
    const highestSalary = Math.max(0, ...(job.salary.match(/\d[\d,]*/g) || []).map((value) => Number(value.replace(/,/g, ''))));
    return (workPreference === 'both' || job.remoteType.toLowerCase() === workPreference)
      && (careerLevel === 'all' || (careerLevel === 'internship' ? /intern|trainee/.test(jobText) : new RegExp(`\\b${careerLevel}\\b`).test(jobText)))
      && (!location.trim() || job.remoteType === 'Remote' || job.location.toLowerCase().includes(location.trim().toLowerCase()))
      && (!minimumSalary || highestSalary >= Number(minimumSalary))
      && (!companyFilter.trim() || job.company.toLowerCase().includes(companyFilter.trim().toLowerCase()))
      && (!industryFilter.trim() || industryText.includes(industryFilter.trim().toLowerCase()));
  });

  return <main className="min-h-screen bg-[#f8fafc] px-4 py-12 sm:px-6"><div className="mx-auto max-w-6xl">
    <div className="flex items-center gap-3"><Briefcase className="h-8 w-8 text-[#3c4a59]"/><div><h1 className="text-3xl font-extrabold text-gray-900">AI Job Match</h1><p className="text-gray-700">Find roles that match your evidence—not just your keywords.</p></div></div>
    <section className="mt-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"><textarea value={resumeText} onChange={(event) => setResumeText(event.target.value)} placeholder="Paste your resume text" className="min-h-40 w-full rounded-xl border border-gray-200 p-4 text-sm text-gray-900"/>
      <div className="mt-4 grid gap-3 md:grid-cols-4"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Target title or keywords" className="rounded-xl border border-gray-200 px-4 py-3"/><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Country or preferred location" className="rounded-xl border border-gray-200 px-4 py-3"/><select value={workPreference} onChange={(event) => setWorkPreference(event.target.value as typeof workPreference)} className="rounded-xl border border-gray-200 px-4 py-3 text-gray-900"><option value="both">Remote, hybrid & onsite</option><option value="remote">Remote only</option><option value="hybrid">Hybrid only</option><option value="onsite">Onsite only</option></select><button onClick={search} disabled={loading} className="btn-primary inline-flex items-center justify-center gap-2">{loading ? <><RefreshCw className="h-4 w-4 animate-spin"/>Searching & ranking…</> : <>Find matching jobs</>}</button></div>
      {hasSearched && <div className="mt-3 grid gap-3 border-t border-gray-100 pt-3 md:grid-cols-4"><select aria-label="Career level" value={careerLevel} onChange={(event) => setCareerLevel(event.target.value as typeof careerLevel)} className="rounded-xl border border-gray-200 px-4 py-3 text-gray-900"><option value="all">All experience levels</option><option value="internship">Internship</option><option value="graduate">Graduate</option><option value="junior">Junior</option><option value="mid">Mid</option><option value="senior">Senior</option></select><input type="number" min="0" value={minimumSalary} onChange={(event) => setMinimumSalary(event.target.value)} placeholder="Minimum listed salary" className="rounded-xl border border-gray-200 px-4 py-3"/><input value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)} placeholder="Filter by company" className="rounded-xl border border-gray-200 px-4 py-3"/><input value={industryFilter} onChange={(event) => setIndustryFilter(event.target.value)} placeholder="Filter by industry" className="rounded-xl border border-gray-200 px-4 py-3"/></div>}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
    <div className="mt-8 grid gap-5">{hasSearched && !loading && !error && !visible.length && <p className="rounded-2xl border border-gray-200 bg-white p-6 text-center font-medium text-gray-700">No matching jobs found.</p>}{visible.map((job) => <article key={job.id} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-extrabold text-gray-900">{job.title}</h2><p className="mt-1 font-medium text-gray-700">{job.company} · <MapPin className="inline h-4 w-4"/>{job.location || 'Location not listed'}</p><span className="mt-3 inline-block rounded-full bg-[#e8eef7] px-3 py-1 text-xs font-bold text-[#3c4a59]">{job.remoteType} {job.employmentType && `· ${job.employmentType}`}</span></div><div className="text-right"><p className="text-3xl font-extrabold text-[#3c4a59]">{Math.round(job.relevanceScore)}%</p><p className="text-xs font-bold text-gray-600">{job.matchLabel}</p>{job.salary && <p className="mt-2 text-sm font-semibold text-gray-800">{job.salary}</p>}</div></div>
      <p className="mt-4 text-sm text-gray-700">{job.reasons.slice(0, 3).join(' ')}</p>
      {(job.matchEvidence.matched.length > 0 || job.matchEvidence.missing.length > 0) && <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <div><p className="font-bold text-gray-900">Matched because</p>{job.matchEvidence.matched.length > 0 ? <ul className="mt-2 space-y-1 text-emerald-800">{job.matchEvidence.matched.slice(0, 5).map((item) => <li key={item}>✓ {item}</li>)}</ul> : <p className="mt-2 text-gray-600">No direct skill match identified.</p>}</div>
        <div><p className="font-bold text-gray-900">Missing</p>{job.matchEvidence.missing.length > 0 ? <ul className="mt-2 space-y-1 text-rose-800">{job.matchEvidence.missing.slice(0, 5).map((item) => <li key={item}>✗ {item}</li>)}</ul> : <p className="mt-2 text-gray-600">No explicit requirement gaps identified.</p>}</div>
      </div>}
      {job.strengths.length > 0 && <p className="mt-3 text-sm text-emerald-800"><strong>Strengths:</strong> {job.strengths.join(', ')}</p>}
      {job.missingSkills.length > 0 && <p className="mt-3 text-sm text-amber-800"><strong>Missing skills:</strong> {job.missingSkills.join(', ')}</p>}
      {job.weaknesses.length > 0 && <p className="mt-2 text-sm text-rose-800"><strong>Weaknesses:</strong> {job.weaknesses.join(', ')}</p>}
      <div className="mt-5 flex flex-wrap gap-3"><a href={job.applyUrl} target="_blank" rel="noreferrer" className="btn-primary inline-flex items-center gap-2">Apply <ExternalLink className="h-4 w-4"/></a><button onClick={() => save(job)} disabled={saved.includes(job.id)} className="btn-ghost">{saved.includes(job.id) ? 'Saved' : 'Save job'}</button></div>
    </article>)}</div>
    {suggestions && (suggestions.skills.length > 0 || suggestions.resumeEdits.length > 0 || suggestions.certifications.length > 0 || suggestions.projects.length > 0) && <section className="mt-8 rounded-2xl border border-[#d7e2f0] bg-white p-6 shadow-sm"><h2 className="text-xl font-extrabold text-gray-900">AI Suggestions to Improve Your Match</h2>{suggestions.skills.length > 0 && <p className="mt-2 text-sm text-gray-700">These {suggestions.skills.length} skills could improve your match by an estimated <strong>+{suggestions.estimatedMatchIncrease}%</strong> when genuinely acquired and evidenced.</p>}<div className="mt-5 grid gap-5 md:grid-cols-2">{suggestions.skills.length > 0 && <div><h3 className="font-bold text-gray-900">Priority skills</h3><ul className="mt-2 space-y-1 text-sm text-gray-700">{suggestions.skills.map((item) => <li key={item}>• {item}</li>)}</ul></div>}{suggestions.resumeEdits.length > 0 && <div><h3 className="font-bold text-gray-900">Recommended resume edits</h3><ul className="mt-2 space-y-1 text-sm text-gray-700">{suggestions.resumeEdits.map((item) => <li key={item}>• {item}</li>)}</ul></div>}{suggestions.certifications.length > 0 && <div><h3 className="font-bold text-gray-900">Relevant certifications</h3><ul className="mt-2 space-y-1 text-sm text-gray-700">{suggestions.certifications.map((item) => <li key={item}>• {item}</li>)}</ul></div>}{suggestions.projects.length > 0 && <div><h3 className="font-bold text-gray-900">Learning project ideas</h3><ul className="mt-2 space-y-1 text-sm text-gray-700">{suggestions.projects.map((item) => <li key={item}>• {item}</li>)}</ul></div>}</div></section>}
    {suggestions && (suggestions.companies.length > 0 || suggestions.careerPaths.length > 0) && <section className="mt-5 rounded-2xl border border-[#d7e2f0] bg-white p-6 shadow-sm"><h2 className="text-xl font-extrabold text-gray-900">Based on Your Previous Searches</h2><div className="mt-4 grid gap-5 md:grid-cols-2">{suggestions.companies.length > 0 && <div><h3 className="font-bold text-gray-900">Companies to watch</h3><p className="mt-2 text-sm text-gray-700">{suggestions.companies.join(', ')}</p></div>}{suggestions.careerPaths.length > 0 && <div><h3 className="font-bold text-gray-900">Career paths to explore</h3><p className="mt-2 text-sm text-gray-700">{suggestions.careerPaths.join(', ')}</p></div>}</div></section>}
  </div></main>;
}
