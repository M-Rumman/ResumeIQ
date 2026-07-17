export type ResumeLink = { url: string; anchorText: string };

export type StructuredResume = {
  contact: { name: string; email: string; phone: string; location: string };
  summary: string;
  experience: string[];
  projects: string[];
  skills: string[];
  education: string[];
  certifications: string[];
  awards: string[];
  languages: string[];
  links: { linkedinUrl: string; portfolioUrl: string; items: ResumeLink[] };
};

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>()\[\]{}]+/gi;
const BARE_WEB_URL_PATTERN = /\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|dev|ai|me|co|app|tech|info|edu|pk|uk)(?:\/[^\s<>()\[\]{}]*)?/gi;
const PHONE_CANDIDATE_PATTERN = /\+?\d[\d().\s-]{5,}\d/g;
const INTERNATIONAL_PHONE_FRAGMENT_PATTERN = /\+\d{1,3}(?:[\s.-]+\d{1,4}){1,2}(?=$|[^\d\s-])/g;

const SECTION_ALIASES = {
  summary: ['summary', 'professional summary', 'profile', 'professional profile', 'objective', 'career objective'],
  experience: ['experience', 'work experience', 'professional experience', 'employment history', 'work history', 'employment'],
  projects: ['projects', 'project experience', 'selected projects', 'personal projects', 'academic projects'],
  skills: ['skills', 'technical skills', 'core skills', 'key skills', 'competencies', 'technologies'],
  education: ['education', 'academic background', 'academic qualifications'],
  certifications: ['certifications', 'certificates', 'licenses', 'licenses and certifications'],
  awards: ['awards', 'honors', 'achievements', 'awards and honors'],
  languages: ['languages', 'language skills'],
} as const;

type ResumeSection = keyof typeof SECTION_ALIASES;

function normalizeUrl(raw: string): string {
  const value = raw.trim().replace(/[.,;:!?]+$/, '');
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = item.trim();
    if (!value || seen.has(value.toLowerCase())) return false;
    seen.add(value.toLowerCase());
    return true;
  });
}

function isPhoneCandidate(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return false;
  if (value.trim().startsWith('+') || digits.length >= 10) return true;
  return /^\d{3}[.\s-]\d{4}$/.test(value.trim());
}

/** Detects complete phone values and surviving international-number fragments. */
export function containsPhoneNumber(value: string): boolean {
  const text = String(value || '');
  const hasInternationalFragment = INTERNATIONAL_PHONE_FRAGMENT_PATTERN.test(text);
  INTERNATIONAL_PHONE_FRAGMENT_PATTERN.lastIndex = 0;
  return (text.match(PHONE_CANDIDATE_PATTERN) || []).some(isPhoneCandidate) || hasInternationalFragment;
}

/** Ensures contact and hyperlinks never remain in section or bullet content. */
export function sanitizeResumeContentLine(value: string): string {
  return String(value || '')
    .replace(EMAIL_PATTERN, '')
    .replace(URL_PATTERN, '')
    .replace(BARE_WEB_URL_PATTERN, '')
    .replace(PHONE_CANDIDATE_PATTERN, (candidate) => (
      isPhoneCandidate(candidate) ? '' : candidate
    ))
    .replace(INTERNATIONAL_PHONE_FRAGMENT_PATTERN, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,;:])/g, '$1')
    .replace(/^[\s,;:|•·–—-]+|[\s,;:|•·–—-]+$/g, '')
    .trim();
}

function getSection(line: string): ResumeSection | null {
  const heading = line.toLowerCase().replace(/[:|]/g, '').replace(/\s+/g, ' ').trim();
  if (!heading || heading.length > 48) return null;
  for (const [section, aliases] of Object.entries(SECTION_ALIASES)) {
    if ((aliases as readonly string[]).includes(heading)) return section as ResumeSection;
  }
  return null;
}

const EXTRACTED_LINKS_MARKER = /^extracted\s+links\s*:\s*$/i;
const PDF_ANNOTATION_MARKER = /^(?:pdf\s+)?(?:link\s+)?annotation(?:s)?\s*:?$/i;
const LINK_ARROW_MARKER = /^(?:â†’|Ã¢â€ â€™|->)\s*/;
const STANDALONE_LINKEDIN_MARKER = /^linkedin(?:\s+(?:profile|url))?\s*(?:â†’|Ã¢â€ â€™|->)?\s*$/i;
const THANK_YOU_LINE = /^thank\s+you[!.\s]*$/i;

function hasContactOrLinkValue(line: string): boolean {
  return EMAIL_PATTERN.test(line)
    || URL_PATTERN.test(line)
    || BARE_WEB_URL_PATTERN.test(line)
    || PHONE_CANDIDATE_PATTERN.test(line)
    || /\b(?:mailto:|linkedin(?:\.com)?|github(?:\.com)?|portfolio)\b/i.test(line);
}

function resetPatterns(): void {
  EMAIL_PATTERN.lastIndex = 0;
  URL_PATTERN.lastIndex = 0;
  BARE_WEB_URL_PATTERN.lastIndex = 0;
  PHONE_CANDIDATE_PATTERN.lastIndex = 0;
}

function isMetadataOnlyLine(line: string): boolean {
  const value = line.trim();
  if (!value) return true;
  if (EXTRACTED_LINKS_MARKER.test(value) || PDF_ANNOTATION_MARKER.test(value)) return true;
  if (LINK_ARROW_MARKER.test(value) || STANDALONE_LINKEDIN_MARKER.test(value)) return true;
  if (/^mailto:/i.test(value)) return true;

  resetPatterns();
  const withoutContactValues = sanitizeResumeContentLine(value)
    .replace(/\b(?:linkedin|github|portfolio|website|profile)\b/gi, '')
    .replace(/(?:â†’|Ã¢â€ â€™|->|[|:])/g, '')
    .trim();
  resetPatterns();
  return !withoutContactValues;
}

/**
 * Removes PDF-extractor metadata before section classification. Link/contact
 * discovery intentionally continues to use the original text, so this never
 * discards a candidate's LinkedIn, portfolio, email, or phone from its
 * dedicated fields.
 */
export function cleanResumeExtractionArtifacts(resumeText: string): string {
  const sourceLines = String(resumeText || '').replace(/\r\n/g, '\n').split('\n');
  const extractedLinksIndex = sourceLines.findIndex((line) => EXTRACTED_LINKS_MARKER.test(line.trim()));
  // This marker is created by extractPdfText.js; its entire trailing block is
  // annotation metadata rather than visible resume content.
  const lines = (extractedLinksIndex >= 0 ? sourceLines.slice(0, extractedLinksIndex) : sourceLines)
    .map((line) => line.trim());

  let activeSection: ResumeSection | null = null;
  let firstContactBlockSeen = false;
  const cleaned: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;

    const section = getSection(line);
    if (section) {
      activeSection = section;
      cleaned.push(line);
      continue;
    }

    // Annotations and URL-only rows are not resume content. A contact block in
    // the header is retained for dedicated extraction; repeated contact blocks
    // later in the document are footer/annotation noise.
    const contactOrLinkLine = hasContactOrLinkValue(line);
    resetPatterns();
    if (isMetadataOnlyLine(line)) continue;
    if (contactOrLinkLine) {
      if (firstContactBlockSeen || cleaned.length > 8 || activeSection !== null) continue;
      firstContactBlockSeen = true;
      // Keep a name/location that shares the header row, but never pass its
      // email, phone, or URL into structural section parsing.
      const visibleHeaderText = sanitizeResumeContentLine(line);
      if (visibleHeaderText) cleaned.push(visibleHeaderText);
      continue;
    }

    // A standalone closing "Thank You!" after a normal final section is PDF
    // footer noise. Do not remove it from a project or award, where it can be
    // intentional resume content.
    if (THANK_YOU_LINE.test(line) && activeSection !== 'projects' && activeSection !== 'awards') {
      continue;
    }

    cleaned.push(line);
  }

  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function extractLinks(text: string): ResumeLink[] {
  const links: ResumeLink[] = [];
  const add = (rawUrl: string, rawAnchor: string) => {
    const url = normalizeUrl(rawUrl);
    if (links.some((link) => link.url.toLowerCase() === url.toLowerCase())) return;
    links.push({ url, anchorText: sanitizeResumeContentLine(rawAnchor) || url });
  };

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const annotation = line.match(/^(?:→|â†’|->)\s*(\S+)/);
    if (annotation) add(annotation[1], lines[index - 1] || annotation[1]);
    for (const rawUrl of line.match(URL_PATTERN) || []) {
      add(rawUrl, line.replace(rawUrl, '').trim() || rawUrl);
    }
  }
  return links;
}

function findName(lines: string[]): string {
  for (const line of lines.slice(0, 6)) {
    const value = sanitizeResumeContentLine(line);
    const words = value.split(/\s+/);
    if (words.length >= 2 && words.length <= 5 && value.length < 80 && !/\d|@|linkedin|github|portfolio|resume/i.test(value) && words.every((word) => /^[A-Za-zÀ-ÿ'.-]+$/.test(word))) return value;
  }
  return '';
}

function findLocation(lines: string[]): string {
  for (const line of lines.slice(0, 8)) {
    const value = sanitizeResumeContentLine(line);
    if (value && value.length < 100 && (/\b(remote|hybrid)\b/i.test(value) || /(?:,|\s)\b[A-Z]{2}\b/.test(value))) return value;
  }
  return '';
}

/** Deterministic, safe resume structure used before the existing AI pipeline. */
export function parseResumeText(resumeText: string): StructuredResume {
  const cleanedResumeText = cleanResumeExtractionArtifacts(resumeText);
  const lines = cleanedResumeText.split('\n').map((line) => line.trim()).filter(Boolean);
  const sections: Record<ResumeSection, string[]> = { summary: [], experience: [], projects: [], skills: [], education: [], certifications: [], awards: [], languages: [] };
  let active: ResumeSection | null = null;

  for (const line of lines) {
    const section = getSection(line);
    if (section) {
      active = section;
      continue;
    }
    if (active) {
      const safe = sanitizeResumeContentLine(line);
      if (safe) sections[active].push(safe);
    }
  }

  const links = extractLinks(resumeText);
  const linkedin = links.find((link) => /linkedin/i.test(`${link.url} ${link.anchorText}`));
  const directLinkedin = resumeText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s<>()\[\]{}]+/i);
  const linkedinUrl = linkedin?.url || (directLinkedin ? normalizeUrl(directLinkedin[0]) : '');
  const portfolioUrl = links.find((link) => link.url !== linkedinUrl && /portfolio|github|gitlab|behance|dribbble|personal website|website/i.test(`${link.url} ${link.anchorText}`))?.url || links.find((link) => link.url !== linkedinUrl)?.url || '';
  const email = resumeText.match(EMAIL_PATTERN)?.[0] || '';
  const phone = (resumeText.match(PHONE_CANDIDATE_PATTERN) || []).find(isPhoneCandidate)?.trim() || '';

  return {
    contact: { name: findName(lines), email, phone, location: findLocation(lines) },
    summary: unique(sections.summary).join(' '),
    experience: unique(sections.experience), projects: unique(sections.projects), skills: unique(sections.skills),
    education: unique(sections.education), certifications: unique(sections.certifications), awards: unique(sections.awards), languages: unique(sections.languages),
    links: { linkedinUrl, portfolioUrl, items: links },
  };
}
