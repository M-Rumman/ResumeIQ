import { parseResumeText } from './resumeParser.js';
import { extractResumeIntelligence, type ResumeIntelligenceProfile } from './resumeIntelligence.js';

export type JobSource = 'adzuna' | 'arbeitnow' | 'remoteok';
export type NormalizedJob = { id: string; source: JobSource; title: string; company: string; location: string; remoteType: 'Remote' | 'Hybrid' | 'Onsite' | 'Unknown'; salary: string; description: string; tags: string[]; applyUrl: string; employmentType: string };
export type CandidateProfile = ResumeIntelligenceProfile;
export type JobMatchEvidence = { matched: string[]; missing: string[] };
export type RankedJob = NormalizedJob & { matchPercent: number; relevanceScore: number; matchLabel: 'Excellent Match' | 'Strong Match' | 'Moderate Match' | 'Weak Match'; matchEvidence: JobMatchEvidence; reasons: string[]; missingSkills: string[]; strengths: string[]; potentialSalaryFit: string; careerGrowth: string; likelihoodOfInterview: string };
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
// Arbeitnow's public endpoint returns a broad European feed. It does expose a
// `remote` flag, so preserve that provider fact and enforce geography locally.
export async function fetchArbeitnow(): Promise<NormalizedJob[]> { const r = await fetch('https://www.arbeitnow.com/api/job-board-api', { signal: AbortSignal.timeout(9000) }); if (!r.ok) throw new Error(`Arbeitnow ${r.status}`); const d = await r.json() as { data?: any[] }; return (d.data || []).map((x) => { const job = { id: `arbeitnow:${x.slug || x.url}`, source: 'arbeitnow' as const, title: clean(x.title), company: clean(x.company_name), location: clean(x.location), salary: '', description: clean(x.description), tags: Array.isArray(x.tags) ? x.tags.map(clean) : [], applyUrl: String(x.url || ''), employmentType: clean(x.job_types?.join(' ') || '') }; return { ...job, remoteType: x.remote === true ? 'Remote' as const : remoteType(job) }; }); }
// RemoteOK's feed can contain location-bound postings. Do not mark every item
// as worldwide remote merely because it originated from RemoteOK.
export async function fetchRemoteOk(): Promise<NormalizedJob[]> { const r = await fetch('https://remoteok.com/api', { headers: { 'User-Agent': 'ResuV Job Match' }, signal: AbortSignal.timeout(9000) }); if (!r.ok) throw new Error(`RemoteOK ${r.status}`); const d = await r.json() as any[]; return (d || []).filter((x) => x?.position).map((x) => { const job = { id: `remoteok:${x.id || x.url}`, source: 'remoteok' as const, title: clean(x.position), company: clean(x.company), location: clean(x.location || ''), salary: clean(x.salary), description: clean(x.description), tags: Array.isArray(x.tags) ? x.tags.map(clean) : [], applyUrl: String(x.url || ''), employmentType: 'Full Time' }; return { ...job, remoteType: remoteType(job) }; }); }
const matchesWorkPreference = (job: NormalizedJob, preference: WorkPreference) => preference === 'both' || job.remoteType.toLowerCase() === preference;
const matchesLocation = (job: NormalizedJob, location: ReturnType<typeof resolveLocation>, preference: WorkPreference) => {
  if (!matchesWorkPreference(job, preference)) return false;
  const remoteScope = `${job.location} ${job.tags.join(' ')} ${job.description}`;
  const explicitlyWorldwide = /\b(?:worldwide|work from anywhere|anywhere|global remote)\b/i.test(remoteScope);
  const genericRemote = /^\s*remote\s*$/i.test(job.location) || !job.location.trim();
  if (job.remoteType === 'Remote') {
    if (!location.input.trim() || location.remoteOnly) return true;
    // A London- or Berlin-restricted remote job is not a Pakistan match. Only
    // accept Pakistan-local, generic remote, or explicitly worldwide remote.
    return location.isMatch(job.location) || genericRemote || explicitlyWorldwide;
  }
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
  const scopedByProvider = Object.fromEntries((['adzuna', 'arbeitnow', 'remoteok'] as JobSource[]).map((source) => [source, scoped.filter((job) => job.source === source).length]));
  console.info('[job-match] provider-results', { adzuna: settled[0].status === 'fulfilled' ? settled[0].value.length : 0, arbeitnow: settled[1].status === 'fulfilled' ? settled[1].value.length : 0, remoteok: settled[2].status === 'fulfilled' ? settled[2].value.length : 0, rejectedBeforeGemini: collected.length - engineeringOnly.length, rejectedByLocation: engineeringOnly.length - scoped.length, engineeringScoped: scoped.length, scopedByProvider });
  return { jobs: dedupe(scoped).slice(0, 75), location: resolved, sources: settled.map((item, i) => ({ source: ['adzuna', 'arbeitnow', 'remoteok'][i], available: item.status === 'fulfilled' })) };
}
export function localProfile(resumeText: string): CandidateProfile { return extractResumeIntelligence(parseResumeText(resumeText), resumeText); }
export type ResumeRelevantJob = { job: NormalizedJob; relevanceScore: number; matchLabel: RankedJob['matchLabel']; matchEvidence: JobMatchEvidence };
export type JobValidationResult = {
  allowed: boolean;
  relevanceScore: number;
  reasons: Array<'category' | 'career' | 'experience' | 'education' | 'domain' | 'relevance'>;
};
const DOMAIN_TERMS = ['embedded', 'robotics', 'automation', 'firmware', 'hardware', 'pcb', 'electronics', 'electrical', 'mechanical', 'industrial', 'manufacturing', 'control systems', 'software', 'mechatronics', 'cybersecurity', 'finance', 'accounting', 'marketing', 'human resources', 'legal', 'healthcare', 'marine biology', 'construction', 'education'];
const normalizeMatchText = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').replace(/\s+/g, ' ').trim();
const containsPhrase = (text: string, phrase: string) => new RegExp(`(?:^|\\s)${normalizeMatchText(phrase).replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}(?:$|\\s)`, 'i').test(text);
const unique = <T>(items: T[]) => [...new Set(items)];

const RELATED_DOMAIN_TERMS: Record<string, string[]> = {
  'Mechatronics Engineering': ['embedded', 'robotics', 'automation', 'control systems', 'electronics', 'mechanical'],
  'Embedded Systems': ['firmware', 'embedded', 'microcontroller', 'hardware', 'iot', 'electronics'],
  'Mechanical Engineering': ['mechanical', 'cad', 'manufacturing', 'product design', 'fea'],
  'Electrical Engineering': ['electrical', 'electronics', 'circuit', 'pcb', 'power systems'],
  'Computer Science': ['software', 'backend', 'application development', 'programming'],
  Cybersecurity: ['cybersecurity', 'security operations', 'information security', 'soc'],
  Finance: ['finance', 'financial analysis', 'risk', 'investment', 'valuation'],
  Accounting: ['accounting', 'audit', 'tax', 'financial reporting'],
  Marketing: ['marketing', 'seo', 'content', 'digital marketing'],
  'Human Resources': ['human resources', 'recruitment', 'talent acquisition', 'people operations'],
  Law: ['legal', 'compliance', 'contract', 'litigation'],
  Healthcare: ['healthcare', 'clinical', 'patient care', 'medical'],
  'Marine Biology': ['marine', 'aquatic', 'oceanography', 'conservation'],
  'Construction Management': ['construction', 'site engineering', 'quantity surveying', 'project controls'],
  Education: ['education', 'teaching', 'curriculum', 'instructional'],
  Sales: ['sales', 'business development', 'account management'],
};
const REQUIREMENT_CONCEPTS = ['Arduino', 'STM32', 'ESP32', 'PLC', 'ROS', 'ROS2', 'MATLAB', 'SolidWorks', 'AutoCAD', 'ANSYS', 'Proteus', 'Altium', 'LTSpice', 'C++', 'Python', 'Java', 'JavaScript', 'TypeScript', 'SQL', 'AWS', 'Azure', 'Docker', 'Kubernetes', 'Embedded Systems', 'Firmware Development', 'Control Systems', 'PID Control', 'Sensor Integration', 'PCB Design', 'Circuit Design', 'Cybersecurity', 'SIEM', 'Financial Modeling', 'Microsoft Excel', 'SEO', 'Google Analytics', 'Legal Research', 'Patient Care', 'GIS', 'Field Research'];
const sentenceMatches = (text: string, pattern: RegExp) => text.split(/(?<=[.!?])\s+/).filter((sentence) => pattern.test(sentence));
const hasAny = (text: string, terms: string[]) => terms.some((term) => containsPhrase(text, term));
const skillMatchScore = (skills: string[], text: string, maximum: number) => {
  if (!text.trim()) return 0;
  const matches = skills.filter((skill) => containsPhrase(text, skill));
  return matches.length ? Math.min(maximum, Math.round(maximum * Math.min(1, matches.length / 2))) : 0;
};
export const relevanceLabel = (score: number): RankedJob['matchLabel'] => score >= 85 ? 'Excellent Match' : score >= 70 ? 'Strong Match' : score >= 55 ? 'Moderate Match' : 'Weak Match';

export function jobMatchEvidence(profile: CandidateProfile, job: NormalizedJob): JobMatchEvidence {
  const jobText = normalizeMatchText(`${job.title} ${job.tags.join(' ')} ${job.description}`);
  const requiredText = normalizeMatchText(sentenceMatches(job.description, /\b(?:required|must have|must|mandatory|essential|minimum qualification|need to)\b/i).join(' '));
  const candidateItems = unique([...profile.technical_skills, ...profile.software_tools, ...profile.keywords]);
  const matched = candidateItems.filter((item) => item.length > 1 && containsPhrase(jobText, item)).slice(0, 8).map((item) => `${item} found`);
  if (/\b(?:bachelor|master|degree|bsc|bs |beng|be )\b/i.test(jobText) && profile.education) {
    matched.push(`${profile.major || 'Relevant'} degree found`);
  }
  const missing = REQUIREMENT_CONCEPTS.filter((concept) => containsPhrase(requiredText, concept)
    && !candidateItems.some((item) => normalizeMatchText(item) === normalizeMatchText(concept)))
    .slice(0, 8);
  return { matched: unique(matched), missing: unique(missing) };
}

/** Deterministic 100-point relevance score. Gemini never contributes points. */
export function resumeRelevanceScore(profile: CandidateProfile, job: NormalizedJob, selectedLocation = ''): number {
  const jobText = normalizeMatchText(`${job.title} ${job.tags.join(' ')} ${job.description}`);
  const profileText = normalizeMatchText([profile.education, profile.major, profile.technical_skills.join(' '), profile.software_tools.join(' '), profile.industries.join(' '), profile.job_titles.join(' ')].join(' '));
  const domainTerms = RELATED_DOMAIN_TERMS[profile.primary_domain] || [profile.primary_domain, ...profile.secondary_domains, ...profile.industries];
  const domain = hasAny(jobText, domainTerms) ? 40 : hasAny(jobText, profile.secondary_domains) || hasAny(jobText, profile.industries) ? 25 : 0;
  const requiredText = sentenceMatches(job.description, /\b(?:required|must have|must|mandatory|essential|minimum qualification|need to)\b/i).join(' ');
  const preferredText = sentenceMatches(job.description, /\b(?:preferred|nice to have|bonus|advantage|desirable|plus)\b/i).join(' ');
  const candidateSkills = unique([...profile.technical_skills, ...profile.software_tools])
    .map(normalizeMatchText)
    .filter((skill) => skill.length >= 2 && !/^(?:teamwork|communication|leadership|problem solving)$/.test(skill));
  const requiredSkills = skillMatchScore(candidateSkills, normalizeMatchText(requiredText || job.description), 20);
  const preferredSkills = skillMatchScore(candidateSkills, normalizeMatchText(preferredText), 5);
  const jobRequiresDegree = /\b(?:bachelor|master|degree|bsc|bs |beng|be )\b/i.test(jobText);
  const candidateHasDegree = /\b(?:bachelor|master|degree|bsc|bs |beng|be )\b/i.test(profileText);
  const education = !jobRequiresDegree ? 15 : candidateHasDegree && (hasAny(jobText, [profile.major, profile.primary_domain]) || !profile.major) ? 15 : candidateHasDegree ? 9 : 0;
  const entryRole = /\b(?:intern|internship|graduate|junior|entry level|trainee)\b/i.test(jobText);
  const seniorRole = /\b(?:senior|lead|principal|manager|director|[3-9]\+? years)\b/i.test(jobText);
  const experience = !entryRole && !seniorRole ? 10 : entryRole && /student|intern|graduate|junior/i.test(profile.career_level) ? 10 : seniorRole && !/mid|senior|principal|director/i.test(profile.career_level) ? 0 : 7;
  const resolved = resolveLocation(selectedLocation);
  const location = !selectedLocation.trim() ? 10 : resolved.isMatch(job.location) || job.remoteType === 'Remote' ? 10 : 0;
  return Math.min(100, domain + requiredSkills + education + experience + location + preferredSkills);
}

/**
 * Deterministic candidate-fit gate. Providers have inconsistent categories, so
 * title, requirements and the structured resume profile are verified together
 * before a job can reach Gemini or the client.
 */
export function validateJobForCandidate(profile: CandidateProfile, job: NormalizedJob, selectedLocation = ''): JobValidationResult {
  const reasons: JobValidationResult['reasons'] = [];
  const jobText = normalizeMatchText(`${job.title} ${job.tags.join(' ')} ${job.description}`);
  const domainTerms = unique([
    ...(RELATED_DOMAIN_TERMS[profile.primary_domain] || [profile.primary_domain]),
    ...profile.secondary_domains,
    ...profile.industries
  ]).filter(Boolean);
  const candidateRoles = profile.job_titles.filter(Boolean);
  const entryCandidate = /student|intern|graduate|junior/i.test(profile.career_level);
  const seniorRole = /\b(?:senior|lead|principal|director|head of|manager|[3-9]\+? years)\b/i.test(jobText);
  const jobRequiresDegree = /\b(?:bachelor|master|phd|doctorate|degree|bsc|bs |beng|be )\b/i.test(jobText);
  const profileHasDegree = /\b(?:bachelor|master|phd|doctorate|degree|bsc|bs |beng|be )\b/i.test(normalizeMatchText(`${profile.education} ${profile.major}`));
  const domainEvidence = hasAny(jobText, domainTerms);
  const roleEvidence = hasAny(jobText, candidateRoles);
  const relevanceScore = resumeRelevanceScore(profile, job, selectedLocation);

  // Category is the hard safety boundary: non-engineering roles cannot leak
  // into a Mechatronics or other technical result set through broad API data.
  if (engineeringConfidence(job) < 70) reasons.push('category');
  // A title can be broadly engineering while still being unrelated to the
  // candidate (for example, a civil role for an embedded candidate).
  if (!domainEvidence && !roleEvidence) reasons.push('career', 'domain');
  if (entryCandidate && seniorRole) reasons.push('experience');
  if (jobRequiresDegree && !profileHasDegree) reasons.push('education');
  if (relevanceScore < 55) reasons.push('relevance');

  return { allowed: reasons.length === 0, relevanceScore, reasons: unique(reasons) };
}

export function filterByResumeRelevance(profile: CandidateProfile, jobs: NormalizedJob[], selectedLocation = ''): ResumeRelevantJob[] {
  return jobs.map((job) => {
    const validation = validateJobForCandidate(profile, job, selectedLocation);
    return { job, validation, relevanceScore: validation.relevanceScore, matchLabel: relevanceLabel(validation.relevanceScore), matchEvidence: jobMatchEvidence(profile, job) };
  }).filter(({ validation }) => validation.allowed)
    .map(({ job, relevanceScore, matchLabel, matchEvidence }) => ({ job, relevanceScore, matchLabel, matchEvidence }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}
export function fallbackRank(profile: CandidateProfile, jobs: NormalizedJob[], location = ''): RankedJob[] { const resolved = resolveLocation(location); return jobs.map((job) => { const text = `${job.title} ${job.description} ${job.tags.join(' ')}`.toLowerCase(); const matches = profile.technical_skills.filter((skill) => text.includes(skill.toLowerCase())); const locationBonus = resolved.isMatch(job.location) ? 20 : job.remoteType === 'Remote' ? 8 : 0; return { ...job, matchPercent: Math.min(95, 25 + matches.length * 12 + locationBonus), relevanceScore: 0, matchLabel: 'Weak Match' as const, matchEvidence: jobMatchEvidence(profile, job), reasons: [...(resolved.isMatch(job.location) ? ['Matches your requested location.'] : job.remoteType === 'Remote' ? ['Remote role available worldwide.'] : []), ...(matches.length ? [`Matches documented resume skills: ${matches.slice(0, 3).join(', ')}.`] : [])], missingSkills: [], strengths: matches.slice(0, 3), potentialSalaryFit: job.salary ? 'Salary listed; compare it with your target range.' : 'Salary not listed.', careerGrowth: 'Review role scope and responsibilities.', likelihoodOfInterview: matches.length >= 2 ? 'Potential match based on documented skills.' : 'More role-specific evidence may improve fit.' }; }).sort((a,b) => b.matchPercent-a.matchPercent); }
