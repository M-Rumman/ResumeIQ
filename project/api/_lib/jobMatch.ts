import { parseResumeText } from './resumeParser.js';

export type JobSource = 'adzuna' | 'arbeitnow' | 'remoteok';
export type NormalizedJob = { id: string; source: JobSource; title: string; company: string; location: string; remoteType: 'Remote' | 'Hybrid' | 'Onsite' | 'Unknown'; salary: string; description: string; tags: string[]; applyUrl: string; employmentType: string };
export type CandidateProfile = { education: string[]; experienceLevel: string; yearsExperience: number | null; technicalSkills: string[]; programmingLanguages: string[]; frameworks: string[]; softSkills: string[]; industries: string[]; preferredLocations: string[]; remotePreference: string; employmentPreference: string; jobTitles: string[]; careerLevel: string; projects: string[]; certifications: string[] };
export type RankedJob = NormalizedJob & { matchPercent: number; reasons: string[]; missingSkills: string[]; strengths: string[]; potentialSalaryFit: string; careerGrowth: string; likelihoodOfInterview: string };
export type WorkPreference = 'remote' | 'hybrid' | 'onsite' | 'both';
const COUNTRIES: Record<string, { code: string; names: string[] }> = {
  pakistan: { code: 'pk', names: ['pakistan', 'islamabad', 'rawalpindi', 'lahore', 'karachi', 'peshawar', 'faisalabad', 'multan'] },
  usa: { code: 'us', names: ['usa', 'united states', 'america', 'new york', 'san francisco', 'los angeles', 'seattle', 'austin', 'boston', 'chicago', 'california', 'texas'] },
  uk: { code: 'gb', names: ['uk', 'united kingdom', 'britain', 'england', 'london', 'manchester', 'birmingham', 'edinburgh', 'glasgow'] },
  uae: { code: 'ae', names: ['uae', 'united arab emirates', 'dubai', 'abu dhabi', 'sharjah'] },
  germany: { code: 'de', names: ['germany', 'deutschland', 'berlin', 'munich', 'münchen', 'hamburg', 'frankfurt', 'cologne', 'köln', 'stuttgart', 'düsseldorf'] },
  canada: { code: 'ca', names: ['canada', 'toronto', 'vancouver', 'montreal', 'ottawa'] },
  australia: { code: 'au', names: ['australia', 'sydney', 'melbourne', 'brisbane', 'perth'] },
  france: { code: 'fr', names: ['france', 'paris', 'lyon', 'marseille'] }
};
const COUNTRY_SELECTION_TERMS: Record<string, string[]> = {
  pakistan: ['pakistan', 'pk'], usa: ['usa', 'united states', 'america'], uk: ['uk', 'united kingdom', 'britain', 'england'],
  uae: ['uae', 'united arab emirates'], germany: ['germany', 'deutschland'], canada: ['canada'], australia: ['australia'], france: ['france']
};
export function resolveLocation(input: string) {
  const normalized = input.toLowerCase().trim();
  const remoteOnly = normalized === 'remote';
  const matchedEntry = Object.entries(COUNTRIES).find(([, country]) => country.names.some((name) => normalized.includes(name)));
  const matchKey = matchedEntry?.[0];
  const match = matchedEntry?.[1];
  // Country selections may include all known cities in that country; a specific
  // city selection must stay specific (Islamabad must not admit Karachi).
  const isCountrySelection = Boolean(matchKey && COUNTRY_SELECTION_TERMS[matchKey].some((term) => normalized.includes(term)));
  const terms = isCountrySelection ? match!.names : (normalized ? [normalized] : []);
  return {
    input,
    countryCode: match?.code || '',
    remoteOnly,
    isMatch: (value: string) => !normalized || terms.some((term) => value.toLowerCase().includes(term))
  };
}

const clean = (value: unknown) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const REJECTED_JOB_TITLE = /\b(?:customer|support|representative|community|operations|caretaker|caregiver|nurse|teacher|sales|marketing|business|accountant|finance|\bhr\b|human resources|social media|recruiter|receptionist|cashier|waiter|chef|cook|cleaner|driver|lawyer|psychologist|consultant|call center|store|retail|hotel|hospital|security|executive|manager)\b/i;
const ENGINEERING_MANAGER = /\b(?:engineering|software|technical|manufacturing|hardware)\s+manager\b/i;
const ENGINEERING_CATEGORY = /\b(?:engineering|engineer|software|embedded|electronics?|electrical|mechanical|automation|robotics|industrial|manufacturing|control systems?|firmware|hardware|pcb|mechatronics)\b/i;
const SOFTWARE_ROLE = /\b(?:software|firmware|embedded)\s+(?:developer|engineer)|\b(?:c\+\+|python|java|javascript|typescript)\s+developer\b/i;
/**
 * Jobs do not expose one consistent category field across the three providers.
 * Treat the title as the authoritative category when possible, and only use
 * tags/description as supporting evidence for otherwise ambiguous titles.
 */
function engineeringConfidence(job: NormalizedJob): number {
  const title = job.title || '';
  if (REJECTED_JOB_TITLE.test(title) && !ENGINEERING_MANAGER.test(title)) return 0;

  const categoryInTitle = ENGINEERING_CATEGORY.test(title) || SOFTWARE_ROLE.test(title);
  if (categoryInTitle) return 90;

  const supportingText = `${job.tags.join(' ')} ${job.description.slice(0, 1200)}`;
  const categoryInTags = ENGINEERING_CATEGORY.test(job.tags.join(' '));
  const categoryInDescription = ENGINEERING_CATEGORY.test(supportingText);
  return categoryInTags && categoryInDescription ? 70 : 0;
}
const remoteType = (job: Pick<NormalizedJob, 'location' | 'tags' | 'title' | 'description'>): NormalizedJob['remoteType'] => /hybrid/i.test(`${job.location} ${job.tags.join(' ')} ${job.description}`) ? 'Hybrid' : /remote|worldwide|anywhere/i.test(`${job.location} ${job.tags.join(' ')} ${job.title} ${job.description}`) ? 'Remote' : job.location ? 'Onsite' : 'Unknown';
const dedupe = (jobs: NormalizedJob[]) => Object.values(jobs.reduce<Record<string, NormalizedJob>>((out, job) => { const key = `${job.title}|${job.company}|${job.location}`.toLowerCase().replace(/\W/g, ''); if (!out[key] || job.description.length > out[key].description.length) out[key] = job; return out; }, {}));

export async function fetchAdzuna(query: string, location: string, countryCode: string): Promise<NormalizedJob[]> {
  const id = process.env.ADZUNA_APP_ID; const key = process.env.ADZUNA_APP_KEY;
  if (!id || !key) return [];
  // Adzuna requires a country path segment. Never silently substitute another
  // country when the user supplied a location we cannot map with certainty.
  if (location.trim() && !countryCode) return [];
  const country = countryCode || (process.env.ADZUNA_DEFAULT_COUNTRY || 'us').toLowerCase();
  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`);
  url.searchParams.set('app_id', id); url.searchParams.set('app_key', key); url.searchParams.set('what', query); if (location) url.searchParams.set('where', location); url.searchParams.set('results_per_page', '30');
  const response = await fetch(url, { signal: AbortSignal.timeout(9000) }); if (!response.ok) throw new Error(`Adzuna ${response.status}`);
  const data = await response.json() as { results?: any[] };
  return (data.results || []).map((item) => { const job = { id: `adzuna:${item.id}`, source: 'adzuna' as const, title: clean(item.title), company: clean(item.company?.display_name), location: clean(item.location?.display_name), salary: item.salary_min ? `${item.salary_min}${item.salary_max ? `–${item.salary_max}` : '+'}` : '', description: clean(item.description), tags: [], applyUrl: String(item.redirect_url || ''), employmentType: clean(item.contract_type || item.contract_time || '') }; return { ...job, remoteType: remoteType(job) }; });
}
export async function fetchArbeitnow(): Promise<NormalizedJob[]> { const r = await fetch('https://www.arbeitnow.com/api/job-board-api', { signal: AbortSignal.timeout(9000) }); if (!r.ok) throw new Error(`Arbeitnow ${r.status}`); const d = await r.json() as { data?: any[] }; return (d.data || []).map((x) => { const job = { id: `arbeitnow:${x.slug || x.url}`, source: 'arbeitnow' as const, title: clean(x.title), company: clean(x.company_name), location: clean(x.location), salary: '', description: clean(x.description), tags: Array.isArray(x.tags) ? x.tags.map(clean) : [], applyUrl: String(x.url || ''), employmentType: clean(x.job_types?.join(' ') || '') }; return { ...job, remoteType: remoteType(job) }; }); }
export async function fetchRemoteOk(): Promise<NormalizedJob[]> { const r = await fetch('https://remoteok.com/api', { headers: { 'User-Agent': 'ResuV Job Match' }, signal: AbortSignal.timeout(9000) }); if (!r.ok) throw new Error(`RemoteOK ${r.status}`); const d = await r.json() as any[]; return (d || []).filter((x) => x?.position).map((x) => { const job = { id: `remoteok:${x.id || x.url}`, source: 'remoteok' as const, title: clean(x.position), company: clean(x.company), location: clean(x.location || 'Remote'), salary: clean(x.salary), description: clean(x.description), tags: Array.isArray(x.tags) ? x.tags.map(clean) : [], applyUrl: String(x.url || ''), employmentType: 'Full Time' }; return { ...job, remoteType: 'Remote' as const }; }); }
const matchesWorkPreference = (job: NormalizedJob, preference: WorkPreference) => preference === 'both' || job.remoteType.toLowerCase() === preference;
const matchesLocation = (job: NormalizedJob, location: ReturnType<typeof resolveLocation>, preference: WorkPreference) => {
  if (!matchesWorkPreference(job, preference)) return false;
  if (job.remoteType === 'Remote') return preference === 'remote' || preference === 'both';
  return !location.input.trim() || location.isMatch(job.location);
};
export async function searchJobs(query: string, location: string, workPreference: WorkPreference = 'both') {
  const resolved = resolveLocation(location);
  const effectivePreference: WorkPreference = resolved.remoteOnly ? 'remote' : workPreference;
  console.info('[job-match] search', { receivedLocation: location, mappedCountryCode: resolved.countryCode || 'unmapped', workPreference: effectivePreference, query });
  const settled = await Promise.allSettled([fetchAdzuna(query, location, resolved.countryCode), fetchArbeitnow(), fetchRemoteOk()]);
  const collected = settled.flatMap((item) => item.status === 'fulfilled' ? item.value : []);
  const engineeringOnly = collected.filter((job) => engineeringConfidence(job) >= 70);
  const scoped = engineeringOnly.filter((job) => matchesLocation(job, resolved, effectivePreference));
  console.info('[job-match] provider-results', { adzuna: settled[0].status === 'fulfilled' ? settled[0].value.length : 0, arbeitnow: settled[1].status === 'fulfilled' ? settled[1].value.length : 0, remoteok: settled[2].status === 'fulfilled' ? settled[2].value.length : 0, rejectedBeforeGemini: collected.length - engineeringOnly.length, rejectedByLocation: engineeringOnly.length - scoped.length, engineeringScoped: scoped.length });
  return { jobs: dedupe(scoped).slice(0, 75), location: resolved, sources: settled.map((item, i) => ({ source: ['adzuna', 'arbeitnow', 'remoteok'][i], available: item.status === 'fulfilled' })) };
}
export function localProfile(resumeText: string): CandidateProfile { const r = parseResumeText(resumeText); const evidence = `${r.summary} ${r.skills.join(' ')} ${r.projects.join(' ')}`.toLowerCase(); const embedded = /embedded|arduino|stm32|esp32|firmware|microcontroller/.test(evidence); const robotics = /robot|lidar|sensor/.test(evidence); const automation = /plc|automation|control|pid/.test(evidence); const mechanical = /solidworks|cad|mechanical|ansys/.test(evidence); const titles = [embedded && 'Embedded Systems Intern', embedded && 'Embedded Software Engineer', robotics && 'Junior Robotics Engineer', automation && 'Automation Intern', automation && 'Control Systems Engineer', mechanical && 'Mechanical Design Engineer', /pcb|circuit|electronics/.test(evidence) && 'PCB Design Intern', 'Graduate Mechatronics Engineer'].filter(Boolean) as string[]; return { education: r.education, experienceLevel: r.experience.length ? 'Experienced' : 'Entry Level', yearsExperience: null, technicalSkills: r.skills, programmingLanguages: r.technicalKeywords.programmingLanguages, frameworks: r.technicalKeywords.frameworks, softSkills: r.skillCategories.softSkills, industries: r.understanding.inferredProfiles.map((x) => x.role), preferredLocations: [], remotePreference: 'Open', employmentPreference: 'Open', jobTitles: titles, careerLevel: r.experience.length ? 'Professional' : 'Intern / Entry Level / Graduate', projects: r.projects.slice(0, 10), certifications: r.certifications }; }
export type ResumeRelevantJob = { job: NormalizedJob; relevanceScore: number };
const DOMAIN_TERMS = ['embedded', 'robotics', 'automation', 'firmware', 'hardware', 'pcb', 'electronics', 'electrical', 'mechanical', 'industrial', 'manufacturing', 'control systems', 'software', 'mechatronics'];
const normalizeMatchText = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').replace(/\s+/g, ' ').trim();
const containsPhrase = (text: string, phrase: string) => new RegExp(`(?:^|\\s)${normalizeMatchText(phrase).replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}(?:$|\\s)`, 'i').test(text);
const unique = <T>(items: T[]) => [...new Set(items)];

/** Deterministic relevance gate used before an LLM can see a retrieved job. */
export function resumeRelevanceScore(profile: CandidateProfile, job: NormalizedJob): number {
  const jobText = normalizeMatchText(`${job.title} ${job.tags.join(' ')} ${job.description}`);
  const profileText = normalizeMatchText([profile.education.join(' '), profile.technicalSkills.join(' '), profile.programmingLanguages.join(' '), profile.frameworks.join(' '), profile.industries.join(' '), profile.projects.join(' '), profile.jobTitles.join(' ')].join(' '));
  const jobRequiresDegree = /\b(?:bachelor|master|degree|bsc|bs |beng|be )\b/i.test(jobText);
  const candidateHasDegree = /\b(?:bachelor|master|degree|bsc|bs |beng|be )\b/i.test(profileText);
  const degree = !jobRequiresDegree || candidateHasDegree ? 20 : 0;

  const jobDomains = DOMAIN_TERMS.filter((term) => containsPhrase(jobText, term));
  const matchedDomains = jobDomains.filter((term) => containsPhrase(profileText, term));
  const industry = !jobDomains.length ? 10 : Math.round((matchedDomains.length / jobDomains.length) * 20);

  const candidateSkills = unique([...profile.technicalSkills, ...profile.programmingLanguages, ...profile.frameworks])
    .map(normalizeMatchText)
    .filter((skill) => skill.length >= 2 && !/^(?:teamwork|communication|leadership|problem solving)$/.test(skill));
  const matchedSkills = candidateSkills.filter((skill) => containsPhrase(jobText, skill));
  const technicalSkills = Math.min(25, matchedSkills.length * 9);

  const normalizedJobTitle = normalizeMatchText(job.title);
  const titleOverlap = profile.jobTitles.map(normalizeMatchText).map((candidateTitle) => {
    if (candidateTitle === normalizedJobTitle) return 20;
    const shared = DOMAIN_TERMS.filter((term) => containsPhrase(candidateTitle, term) && containsPhrase(normalizedJobTitle, term)).length;
    return shared >= 2 ? 20 : shared === 1 ? 14 : 0;
  });
  const title = Math.max(0, ...titleOverlap);

  const entryRole = /\b(?:intern|internship|graduate|junior|entry level|trainee)\b/i.test(jobText);
  const seniorRole = /\b(?:senior|lead|principal|manager|director|[3-9]\+? years)\b/i.test(jobText);
  const experience = entryRole && /entry|intern|graduate/i.test(profile.careerLevel) ? 10 : seniorRole && profile.experienceLevel !== 'Experienced' ? 0 : 6;
  const keywords = matchedSkills.length > 0 || matchedDomains.length > 0 ? 5 : 0;
  return Math.min(100, degree + industry + technicalSkills + title + experience + keywords);
}

export function filterByResumeRelevance(profile: CandidateProfile, jobs: NormalizedJob[]): ResumeRelevantJob[] {
  return jobs.map((job) => ({ job, relevanceScore: resumeRelevanceScore(profile, job) }))
    .filter(({ relevanceScore }) => relevanceScore >= 60)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}
export function fallbackRank(profile: CandidateProfile, jobs: NormalizedJob[], location = ''): RankedJob[] { const resolved = resolveLocation(location); return jobs.map((job) => { const text = `${job.title} ${job.description} ${job.tags.join(' ')}`.toLowerCase(); const matches = profile.technicalSkills.filter((skill) => text.includes(skill.toLowerCase())); const locationBonus = resolved.isMatch(job.location) ? 20 : job.remoteType === 'Remote' ? 8 : 0; return { ...job, matchPercent: Math.min(95, 25 + matches.length * 12 + locationBonus), reasons: [...(resolved.isMatch(job.location) ? ['Matches your requested location.'] : job.remoteType === 'Remote' ? ['Remote role available worldwide.'] : []), ...(matches.length ? [`Matches documented resume skills: ${matches.slice(0, 3).join(', ')}.`] : [])], missingSkills: [], strengths: matches.slice(0, 3), potentialSalaryFit: job.salary ? 'Salary listed; compare it with your target range.' : 'Salary not listed.', careerGrowth: 'Review the role scope and responsibilities.', likelihoodOfInterview: matches.length >= 2 ? 'Potential match based on documented skills.' : 'More role-specific evidence may improve fit.' }; }).sort((a,b) => b.matchPercent-a.matchPercent); }
