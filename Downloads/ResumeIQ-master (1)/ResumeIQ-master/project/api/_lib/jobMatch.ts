import { parseResumeText } from './resumeParser.js';
import { extractResumeIntelligence, type ResumeIntelligenceProfile } from './resumeIntelligence.js';

export type JobSource = 'adzuna' | 'arbeitnow' | 'remoteok' | 'greenhouse' | 'lever' | 'ashby' | 'rozee' | 'brightsypre' | 'mustakbil';
export type NormalizedJob = { id: string; source: JobSource; title: string; company: string; location: string; remoteType: 'Remote' | 'Hybrid' | 'Onsite' | 'Unknown'; salary: string; description: string; tags: string[]; applyUrl: string; employmentType: string };
export type CandidateProfile = ResumeIntelligenceProfile;
export type JobMatchEvidence = { matched: string[]; missing: string[] };
export type RankedJob = NormalizedJob & { matchPercent: number; relevanceScore: number; matchLabel: 'Excellent Match' | 'Strong Match' | 'Moderate Match' | 'Weak Match'; matchEvidence: JobMatchEvidence; reasons: string[]; missingSkills: string[]; strengths: string[]; weaknesses: string[]; potentialSalaryFit: string; careerGrowth: string; likelihoodOfInterview: string };
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
    countryKey: matchKey || '',
    countryCode: match?.code || '',
    remoteOnly,
    isMatch: (value: string) => !normalized || terms.some((term) => value.toLowerCase().includes(term))
  };
}

/** Source policy is separate from retrieval so regional behavior is auditable. */
export function getLocationProviderPlan(location: string): { countryCode: string; providers: JobSource[]; unavailablePublicSources: JobSource[] } {
  const resolved = resolveLocation(location);
  const providers: JobSource[] = ['adzuna', 'remoteok'];
  if (resolved.countryKey === 'germany') providers.push('arbeitnow');
  if (resolved.countryKey === 'usa') providers.push('greenhouse', 'lever', 'ashby');
  const unavailablePublicSources: JobSource[] = resolved.countryKey === 'pakistan' ? ['rozee', 'brightsypre', 'mustakbil'] : [];
  return { countryCode: resolved.countryCode, providers, unavailablePublicSources };
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
const normalizeComparable = (value: string) => clean(value).toLowerCase().replace(/[^a-z0-9+#]+/g, ' ').replace(/\s+/g, ' ').trim();
const normalizeSalary = (value: string) => clean(value).replace(/[–—]/g, '-').replace(/\s*-\s*/g, ' - ');
const normalizeUrl = (value: string) => {
  const candidate = clean(value);
  if (!candidate) return '';
  try {
    const url = new URL(candidate);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'source'].forEach((key) => url.searchParams.delete(key));
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return candidate;
  }
};
const normalizeSkills = (skills: string[]) => {
  const normalized = new Map<string, string>();
  for (const skill of skills.map(clean).filter(Boolean)) {
    const key = normalizeComparable(skill);
    if (!normalized.has(key)) normalized.set(key, skill);
  }
  return [...normalized.values()];
};
const normalizedJob = (job: NormalizedJob): NormalizedJob => {
  const normalized = {
    ...job,
    title: clean(job.title),
    company: clean(job.company),
    location: clean(job.location),
    salary: normalizeSalary(job.salary),
    description: clean(job.description),
    tags: normalizeSkills(job.tags),
    applyUrl: normalizeUrl(job.applyUrl),
    employmentType: clean(job.employmentType),
  };
  return { ...normalized, remoteType: remoteType(normalized) };
};
const mergeQuality = (job: NormalizedJob) => job.description.length + job.tags.length * 40 + (job.salary ? 30 : 0) + (job.applyUrl ? 20 : 0);
/** Normalize every provider record and retain the richest representation of a duplicate. */
export function mergeAndNormalizeJobs(jobs: NormalizedJob[]): NormalizedJob[] {
  const merged = new Map<string, NormalizedJob>();
  for (const input of jobs) {
    const job = normalizedJob(input);
    const key = job.applyUrl
      ? `url:${normalizeComparable(job.applyUrl)}`
      : `role:${normalizeComparable(job.title)}|${normalizeComparable(job.company)}|${normalizeComparable(job.location)}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, job);
      continue;
    }
    const preferred = mergeQuality(job) > mergeQuality(existing) ? job : existing;
    const supplementary = preferred === job ? existing : job;
    const combined = {
      ...preferred,
      title: preferred.title || supplementary.title,
      company: preferred.company || supplementary.company,
      location: preferred.location || supplementary.location,
      salary: preferred.salary || supplementary.salary,
      description: preferred.description.length >= supplementary.description.length ? preferred.description : supplementary.description,
      tags: normalizeSkills([...preferred.tags, ...supplementary.tags]),
      applyUrl: preferred.applyUrl || supplementary.applyUrl,
      employmentType: preferred.employmentType || supplementary.employmentType,
    };
    merged.set(key, { ...combined, remoteType: remoteType(combined) });
  }
  return [...merged.values()];
}

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
export type GreenhouseBoard = { company: string; boardName: string; country: string; industries: string[] };
export type LeverBoard = { company: string; siteName: string; country: string; industries: string[] };
export type AshbyBoard = { company: string; boardName: string; country: string; industries: string[] };
export type PakistanPublicFeed = { source: Extract<JobSource, 'rozee' | 'brightsypre' | 'mustakbil'>; url: string; format: 'rss' | 'json' };
const normalizeProviderValue = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function getGreenhouseBoardRegistry(): GreenhouseBoard[] {
  try {
    const parsed = JSON.parse(String(process.env.GREENHOUSE_BOARD_REGISTRY || '[]')) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): GreenhouseBoard[] => {
      if (!entry || typeof entry !== 'object') return [];
      const candidate = entry as Record<string, unknown>;
      const company = String(candidate.company || '').trim();
      const boardName = String(candidate.boardName || candidate.board_name || '').trim();
      const country = String(candidate.country || '').trim();
      const industries = Array.isArray(candidate.industries) ? candidate.industries.map((industry) => String(industry).trim()).filter(Boolean) : [];
      return company && boardName && country && industries.length ? [{ company, boardName, country, industries }] : [];
    });
  } catch {
    console.error('[job-match] greenhouse-registry-invalid-json');
    return [];
  }
}
export function relevantGreenhouseBoards(profile: CandidateProfile, countryCode: string): GreenhouseBoard[] {
  const profileTerms = [
    profile.primary_domain,
    ...profile.secondary_domains,
    ...profile.industries,
    ...profile.career_taxonomy.primary_path,
    ...profile.career_taxonomy.related_domains,
  ].map(normalizeProviderValue).filter(Boolean);
  const countryAliases = countryCode.toLowerCase() === 'us' ? ['us', 'usa', 'united states'] : [countryCode.toLowerCase()];
  return getGreenhouseBoardRegistry().filter((board) => {
    const boardCountry = normalizeProviderValue(board.country);
    const countryMatches = !countryCode || countryAliases.includes(boardCountry);
    const boardIndustries = board.industries.map(normalizeProviderValue);
    return countryMatches && boardIndustries.some((industry) => profileTerms.some((term) => term.includes(industry) || industry.includes(term)));
  });
}
export function getLeverBoardRegistry(): LeverBoard[] {
  try {
    const parsed = JSON.parse(String(process.env.LEVER_BOARD_REGISTRY || '[]')) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): LeverBoard[] => {
      if (!entry || typeof entry !== 'object') return [];
      const candidate = entry as Record<string, unknown>;
      const company = String(candidate.company || '').trim();
      const siteName = String(candidate.siteName || candidate.site_name || '').trim();
      const country = String(candidate.country || '').trim();
      const industries = Array.isArray(candidate.industries) ? candidate.industries.map((industry) => String(industry).trim()).filter(Boolean) : [];
      return company && siteName && country && industries.length ? [{ company, siteName, country, industries }] : [];
    });
  } catch {
    console.error('[job-match] lever-registry-invalid-json');
    return [];
  }
}
export function relevantLeverBoards(profile: CandidateProfile, countryCode: string): LeverBoard[] {
  const profileTerms = [
    profile.primary_domain,
    ...profile.secondary_domains,
    ...profile.industries,
    ...profile.career_taxonomy.primary_path,
    ...profile.career_taxonomy.related_domains,
  ].map(normalizeProviderValue).filter(Boolean);
  const countryAliases = countryCode.toLowerCase() === 'us' ? ['us', 'usa', 'united states'] : [countryCode.toLowerCase()];
  return getLeverBoardRegistry().filter((board) => {
    const countryMatches = !countryCode || countryAliases.includes(normalizeProviderValue(board.country));
    return countryMatches && board.industries.map(normalizeProviderValue).some((industry) => profileTerms.some((term) => term.includes(industry) || industry.includes(term)));
  });
}
export function getAshbyBoardRegistry(): AshbyBoard[] {
  try {
    const parsed = JSON.parse(String(process.env.ASHBY_BOARD_REGISTRY || '[]')) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): AshbyBoard[] => {
      if (!entry || typeof entry !== 'object') return [];
      const candidate = entry as Record<string, unknown>;
      const company = String(candidate.company || '').trim();
      const boardName = String(candidate.boardName || candidate.board_name || '').trim();
      const country = String(candidate.country || '').trim();
      const industries = Array.isArray(candidate.industries) ? candidate.industries.map((industry) => String(industry).trim()).filter(Boolean) : [];
      return company && boardName && country && industries.length ? [{ company, boardName, country, industries }] : [];
    });
  } catch {
    console.error('[job-match] ashby-registry-invalid-json');
    return [];
  }
}
export function relevantAshbyBoards(profile: CandidateProfile, countryCode: string): AshbyBoard[] {
  const profileTerms = [
    profile.primary_domain,
    ...profile.secondary_domains,
    ...profile.industries,
    ...profile.career_taxonomy.primary_path,
    ...profile.career_taxonomy.related_domains,
  ].map(normalizeProviderValue).filter(Boolean);
  const countryAliases = countryCode.toLowerCase() === 'us' ? ['us', 'usa', 'united states'] : [countryCode.toLowerCase()];
  return getAshbyBoardRegistry().filter((board) => {
    const countryMatches = !countryCode || countryAliases.includes(normalizeProviderValue(board.country));
    return countryMatches && board.industries.map(normalizeProviderValue).some((industry) => profileTerms.some((term) => term.includes(industry) || industry.includes(term)));
  });
}
/**
 * Pakistan boards are opt-in public feeds only. Do not put HTML search-page
 * URLs here: this adapter intentionally supports RSS and JSON feeds, not
 * scraping. Each configured URL must be publicly available and authorized.
 */
export function getPakistanPublicFeeds(): PakistanPublicFeed[] {
  try {
    const parsed = JSON.parse(String(process.env.PAKISTAN_PUBLIC_JOB_FEEDS || '[]')) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): PakistanPublicFeed[] => {
      if (!entry || typeof entry !== 'object') return [];
      const candidate = entry as Record<string, unknown>;
      const source = String(candidate.source || '').toLowerCase();
      const url = String(candidate.url || '').trim();
      const format = String(candidate.format || '').toLowerCase();
      if (!['rozee', 'brightsypre', 'mustakbil'].includes(source) || !/^https:\/\//i.test(url) || !['rss', 'json'].includes(format)) return [];
      return [{ source: source as PakistanPublicFeed['source'], url, format: format as PakistanPublicFeed['format'] }];
    });
  } catch {
    console.error('[job-match] pakistan-public-feeds-invalid-json');
    return [];
  }
}
const decodeFeedText = (value: string) => clean(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
const xmlTag = (xml: string, tag: string) => xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1] || '';
function normalizePublicFeedItems(source: PakistanPublicFeed['source'], payload: unknown, format: PakistanPublicFeed['format']): NormalizedJob[] {
  const items = format === 'rss'
    ? String(payload).match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || []
    : (() => {
      const record = payload as Record<string, unknown>;
      return Array.isArray(payload) ? payload : Array.isArray(record?.items) ? record.items : Array.isArray(record?.jobs) ? record.jobs : [];
    })();
  return items.map((item: any, index) => {
    const rss = typeof item === 'string';
    const title = rss ? decodeFeedText(xmlTag(item, 'title')) : clean(item.title || item.job_title);
    const description = rss ? decodeFeedText(xmlTag(item, 'description') || xmlTag(item, 'content:encoded')) : clean(item.description || item.content);
    const applyUrl = rss ? decodeFeedText(xmlTag(item, 'link') || xmlTag(item, 'guid')) : String(item.applyUrl || item.apply_url || item.url || '');
    const company = rss ? '' : clean(item.company || item.company_name || item.employer);
    const location = rss ? '' : clean(item.location || item.city);
    const job = { id: `${source}:${applyUrl || `${title}:${index}`}`, source, title, company, location, salary: rss ? '' : clean(item.salary), description, tags: rss ? [] : Array.isArray(item.tags) ? item.tags.map(clean) : [], applyUrl, employmentType: rss ? '' : clean(item.employmentType || item.employment_type) };
    return { ...job, remoteType: remoteType(job) };
  }).filter((job) => Boolean(job.title && job.applyUrl));
}
async function fetchPakistanPublicFeed(feed: PakistanPublicFeed): Promise<NormalizedJob[]> {
  return cachedBoardJobs(`pakistan-feed:${feed.source}:${feed.url}`, async () => {
    const response = await fetch(feed.url, { headers: { Accept: feed.format === 'rss' ? 'application/rss+xml, application/xml;q=0.9' : 'application/json' }, signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw new Error(`${feed.source} feed ${response.status}`);
    return normalizePublicFeedItems(feed.source, feed.format === 'rss' ? await response.text() : await response.json(), feed.format);
  });
}
const cachedPublicBoards = new Map<string, { expiresAt: number; jobs: NormalizedJob[] }>();
async function cachedBoardJobs(key: string, load: () => Promise<NormalizedJob[]>): Promise<NormalizedJob[]> {
  const cached = cachedPublicBoards.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.jobs;
  const jobs = await load();
  cachedPublicBoards.set(key, { jobs, expiresAt: Date.now() + 5 * 60_000 });
  return jobs;
}
/** Public Greenhouse feeds are searched only after country and industry board selection. */
export async function fetchGreenhouseBoards(profile: CandidateProfile, countryCode: string): Promise<NormalizedJob[]> {
  const boards = relevantGreenhouseBoards(profile, countryCode);
  const results = await Promise.allSettled(boards.map((board) => cachedBoardJobs(`greenhouse:${board.boardName}`, async () => {
    const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board.boardName)}/jobs?content=true`, { signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw new Error(`Greenhouse ${response.status}`);
    const data = await response.json() as { jobs?: any[] };
    return (data.jobs || []).map((item) => {
      const job = { id: `greenhouse:${board.boardName}:${item.id}`, source: 'greenhouse' as const, title: clean(item.title), company: board.company, location: clean(item.location?.name), salary: '', description: clean(item.content), tags: Array.isArray(item.departments) ? item.departments.map((department: any) => clean(department.name)) : [], applyUrl: String(item.absolute_url || ''), employmentType: '' };
      return { ...job, remoteType: remoteType(job) };
    });
  })));
  return results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
}
export async function fetchLeverBoards(profile: CandidateProfile, countryCode: string): Promise<NormalizedJob[]> {
  const boards = relevantLeverBoards(profile, countryCode);
  const results = await Promise.allSettled(boards.map((board) => cachedBoardJobs(`lever:${board.siteName}`, async () => {
    const response = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(board.siteName)}?mode=json`, { signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw new Error(`Lever ${response.status}`);
    const data = await response.json() as any[];
    return (data || []).map((item) => {
      const job = { id: `lever:${board.siteName}:${item.id}`, source: 'lever' as const, title: clean(item.text), company: board.company, location: clean(item.categories?.location), salary: '', description: clean(item.descriptionPlain || item.description), tags: Array.isArray(item.categories?.team) ? item.categories.team.map(clean) : [clean(item.categories?.team)].filter(Boolean), applyUrl: String(item.applyUrl || item.hostedUrl || ''), employmentType: clean(item.categories?.commitment) };
      return { ...job, remoteType: remoteType(job) };
    });
  })));
  return results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
}
export async function fetchAshbyBoards(profile: CandidateProfile, countryCode: string): Promise<NormalizedJob[]> {
  const boards = relevantAshbyBoards(profile, countryCode);
  const results = await Promise.allSettled(boards.map((board) => cachedBoardJobs(`ashby:${board.boardName}`, async () => {
    const response = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board.boardName)}?includeCompensation=true`, { signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw new Error(`Ashby ${response.status}`);
    const data = await response.json() as { jobs?: any[] };
    return (data.jobs || []).filter((item) => item.isListed !== false).map((item) => {
      const salary = item.compensation?.compensationTierSummary?.map((tier: any) => `${tier.currencyCode || ''} ${tier.minValue || ''}-${tier.maxValue || ''}`.trim()).filter(Boolean).join('; ') || '';
      const job = { id: `ashby:${board.boardName}:${item.id || item.jobUrl}`, source: 'ashby' as const, title: clean(item.title), company: board.company, location: clean(item.location || item.address?.postalAddress?.addressLocality), salary, description: clean(item.descriptionPlain || item.descriptionHtml), tags: [clean(item.department), clean(item.team)].filter(Boolean), applyUrl: String(item.applyUrl || item.jobUrl || ''), employmentType: clean(item.employmentType) };
      return { ...job, remoteType: item.workplaceType === 'Remote' ? 'Remote' as const : item.workplaceType === 'Hybrid' ? 'Hybrid' as const : remoteType(job) };
    });
  })));
  return results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
}
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
export async function searchJobs(query: string, location: string, workPreference: WorkPreference = 'both', profile?: CandidateProfile) {
  const resolved = resolveLocation(location);
  const providerPlan = getLocationProviderPlan(location);
  const effectivePreference: WorkPreference = resolved.remoteOnly ? 'remote' : workPreference;
  console.info('[job-match] search', { receivedLocation: location, mappedCountryCode: resolved.countryCode || 'unmapped', workPreference: effectivePreference, query });
  const providerCalls: Array<{ source: JobSource; request: Promise<NormalizedJob[]> }> = [
    { source: 'adzuna', request: fetchAdzuna(query, location, resolved.countryCode) },
    { source: 'remoteok', request: fetchRemoteOk() },
  ];
  if (providerPlan.providers.includes('arbeitnow')) providerCalls.push({ source: 'arbeitnow', request: fetchArbeitnow() });
  if (providerPlan.providers.includes('greenhouse') && profile) providerCalls.push(
    { source: 'greenhouse', request: fetchGreenhouseBoards(profile, resolved.countryCode) },
    { source: 'lever', request: fetchLeverBoards(profile, resolved.countryCode) },
    { source: 'ashby', request: fetchAshbyBoards(profile, resolved.countryCode) },
  );
  const pakistanFeeds = resolved.countryKey === 'pakistan' ? getPakistanPublicFeeds() : [];
  pakistanFeeds.forEach((feed) => providerCalls.push({ source: feed.source, request: fetchPakistanPublicFeed(feed) }));
  // Report Pakistan boards as unavailable unless a verified public feed was
  // explicitly configured. Never fall back to scraping their search pages.
  const unavailableByRegion = providerPlan.unavailablePublicSources.filter((source) => !pakistanFeeds.some((feed) => feed.source === source));
  const settled = await Promise.allSettled(providerCalls.map((provider) => provider.request));
  const collected = settled.flatMap((item) => item.status === 'fulfilled' ? item.value : []);
  const engineeringOnly = collected.filter((job) => engineeringConfidence(job) >= 70);
  const scoped = engineeringOnly.filter((job) => matchesLocation(job, resolved, effectivePreference));
  const providerCounts = Object.fromEntries(providerCalls.map((provider, index) => [provider.source, settled[index].status === 'fulfilled' ? settled[index].value.length : 0]));
  const scopedByProvider = Object.fromEntries(providerCalls.map((provider) => [provider.source, scoped.filter((job) => job.source === provider.source).length]));
  console.info('[job-match] provider-results', { providerCounts, rejectedBeforeGemini: collected.length - engineeringOnly.length, rejectedByLocation: engineeringOnly.length - scoped.length, engineeringScoped: scoped.length, scopedByProvider, unavailableByRegion });
  return {
    jobs: mergeAndNormalizeJobs(scoped).slice(0, 75),
    location: resolved,
    sources: [
      ...[...new Set(providerCalls.map((provider) => provider.source))].map((source) => ({ source, available: providerCalls.some((provider, index) => provider.source === source && settled[index].status === 'fulfilled') })),
      ...unavailableByRegion.map((source) => ({ source, available: false })),
    ],
  };
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
// Skills routinely contain regexp metacharacters (for example C++, C#, .NET).
// Escape after normalization before using the value as a literal phrase.
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const containsPhrase = (text: string, phrase: string) => {
  const normalizedPhrase = normalizeMatchText(phrase);
  return Boolean(normalizedPhrase) && new RegExp(`(?:^|\\s)${escapeRegExp(normalizedPhrase)}(?:$|\\s)`, 'i').test(text);
};
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
  const matched = candidateItems.filter((item) => item.length > 1 && containsPhrase(jobText, item)).slice(0, 8);
  if (/\b(?:bachelor|master|degree|bsc|bs |beng|be )\b/i.test(jobText) && profile.education) {
    matched.push(`${profile.major || 'Relevant'} degree`);
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
export function fallbackRank(profile: CandidateProfile, jobs: NormalizedJob[], location = ''): RankedJob[] { const resolved = resolveLocation(location); return jobs.map((job) => { const text = `${job.title} ${job.description} ${job.tags.join(' ')}`.toLowerCase(); const matches = profile.technical_skills.filter((skill) => text.includes(skill.toLowerCase())); const locationBonus = resolved.isMatch(job.location) ? 20 : job.remoteType === 'Remote' ? 8 : 0; return { ...job, matchPercent: Math.min(95, 25 + matches.length * 12 + locationBonus), relevanceScore: 0, matchLabel: 'Weak Match' as const, matchEvidence: jobMatchEvidence(profile, job), reasons: [...(resolved.isMatch(job.location) ? ['Matches your requested location.'] : job.remoteType === 'Remote' ? ['Remote role available worldwide.'] : []), ...(matches.length ? [`Matches documented resume skills: ${matches.slice(0, 3).join(', ')}.`] : [])], missingSkills: [], strengths: matches.slice(0, 3), weaknesses: [], potentialSalaryFit: job.salary ? 'Salary listed; compare it with your target range.' : 'Salary not listed.', careerGrowth: 'Review role scope and responsibilities.', likelihoodOfInterview: matches.length >= 2 ? 'Potential match based on documented skills.' : 'More role-specific evidence may improve fit.' }; }).sort((a,b) => b.matchPercent-a.matchPercent); }
