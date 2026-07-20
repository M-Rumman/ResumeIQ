export type ResumeLink = { url: string; anchorText: string };
export type TechnicalKeywordGroups = {
  programmingLanguages: string[];
  cadSoftware: string[];
  simulationTools: string[];
  microcontrollers: string[];
  protocols: string[];
  frameworks: string[];
  engineeringConcepts: string[];
  algorithms: string[];
  technicalDomains: string[];
};
export type StructuredProject = {
  title: string;
  description: string;
  bullets: string[];
  technologies: string[];
  outcomes: string[];
};
export type SkillCategories = {
  programming: string[];
  software: string[];
  engineering: string[];
  frameworks: string[];
  libraries: string[];
  tools: string[];
  platforms: string[];
  softSkills: string[];
  professionalSkills: string[];
};

export type StructuredResume = {
  contact: { name: string; email: string; phone: string; location: string };
  summary: string;
  experience: string[];
  projects: string[];
  /** Structured project records; projects remains the legacy flat list for existing consumers. */
  projectDetails: StructuredProject[];
  /** Categorized skills preserve grouped resume structure for parser consumers. */
  skillCategories: SkillCategories;
  /** Deterministic technical keywords found in the resume before any LLM call. */
  technicalKeywords: TechnicalKeywordGroups;
  /** Flat, deduplicated skill list retained for existing ATS and matching logic. */
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
  summary: [
    'summary', 'professional summary', 'career summary', 'career profile', 'profile', 'about me',
    'objective', 'career objective', 'professional profile', 'personal profile', 'personal statement',
  ],
  // Leadership and extracurricular work is practical experience, so it is
  // retained in the existing Experience output rather than discarded or added
  // as a new API field.
  experience: [
    'experience', 'professional experience', 'work experience', 'employment history', 'work history',
    'employment', 'internships', 'internship', 'research experience', 'leadership',
    'leadership experience', 'activities', 'extracurriculars', 'leadership and extracurriculars',
    'positions of responsibility', 'professional background', 'volunteering', 'volunteer experience',
  ],
  projects: [
    'projects', 'project experience', 'selected projects', 'personal projects', 'academic projects',
    'engineering projects', 'key projects', 'capstone', 'portfolio', 'research projects', 'design projects',
  ],
  skills: [
    'skills', 'technical skills', 'core skills', 'key skills', 'competencies', 'core competencies', 'technical competencies',
    'engineering skills', 'software', 'tools', 'toolbox', 'programming', 'programming languages', 'technologies',
    'personal skills', 'digital skills', 'technical proficiencies', 'professional skills',
  ],
  education: ['education', 'academic background', 'academic qualifications', 'qualifications', 'education and training', 'academic history', 'relevant coursework'],
  certifications: ['certifications', 'certificates', 'licenses', 'licenses and certifications', 'training', 'courses', 'professional development'],
  awards: ['awards', 'honors', 'achievements', 'awards and honors', 'scholarships', 'distinctions', 'accomplishments'],
  languages: ['languages', 'language skills', 'language proficiency'],
} as const;

type ResumeSection = keyof typeof SECTION_ALIASES;
type SkillCategory = keyof SkillCategories;

/** Semantic signals supplement aliases for mixed, decorated, or template headings. */
const SECTION_SIGNALS: Record<ResumeSection, string[]> = {
  summary: ['summary', 'profile', 'objective', 'statement'],
  experience: ['experience', 'employment', 'internship', 'internships', 'career', 'volunteer', 'leadership', 'activities'],
  projects: ['projects', 'project', 'capstone', 'portfolio'],
  skills: ['skills', 'competencies', 'competency', 'toolbox', 'programming', 'languages', 'technologies', 'proficiencies'],
  education: ['education', 'qualification', 'qualifications', 'coursework'],
  certifications: ['certification', 'certifications', 'certificate', 'certificates', 'license', 'licenses'],
  awards: ['awards', 'honors', 'scholarships', 'distinctions'],
  languages: ['languages', 'language', 'linguistic'],
};

type KeywordRule = { keyword: string; aliases?: string[] };

const TECHNICAL_KEYWORD_RULES: Record<keyof TechnicalKeywordGroups, KeywordRule[]> = {
  programmingLanguages: [
    { keyword: 'Python' }, { keyword: 'C++', aliases: ['cplusplus'] }, { keyword: 'C' },
    { keyword: 'Java' }, { keyword: 'MATLAB' }, { keyword: 'JavaScript' }, { keyword: 'TypeScript' },
  ],
  cadSoftware: [
    { keyword: 'SolidWorks' }, { keyword: 'Altium', aliases: ['altium designer'] }, { keyword: 'AutoCAD' },
    { keyword: 'CATIA' }, { keyword: 'Fusion 360' },
  ],
  simulationTools: [
    { keyword: 'ANSYS' }, { keyword: 'Proteus' }, { keyword: 'LTSpice', aliases: ['lt spice'] },
    { keyword: 'Simulink' }, { keyword: 'Multisim' },
  ],
  microcontrollers: [
    { keyword: 'STM32' }, { keyword: 'Arduino' }, { keyword: 'ESP32' }, { keyword: 'Raspberry Pi' },
    { keyword: 'PIC' }, { keyword: 'AVR' },
  ],
  protocols: [
    { keyword: 'I2C' }, { keyword: 'SPI' }, { keyword: 'UART' }, { keyword: 'CAN' }, { keyword: 'Modbus' },
    { keyword: 'MQTT' }, { keyword: 'TCP IP', aliases: ['tcp/ip'] },
  ],
  frameworks: [
    { keyword: 'ROS', aliases: ['ros2', 'robot operating system'] }, { keyword: 'React' },
    { keyword: 'Node JS', aliases: ['node.js', 'nodejs'] }, { keyword: 'TensorFlow' }, { keyword: 'PyTorch' },
  ],
  engineeringConcepts: [
    { keyword: 'PID Control', aliases: ['pid'] }, { keyword: 'Sensor Integration' }, { keyword: 'PCB Design' },
    { keyword: 'Circuit Design' }, { keyword: 'Circuit Validation' }, { keyword: 'Firmware Development' },
    { keyword: 'Embedded Programming' },
  ],
  algorithms: [
    { keyword: 'FSM', aliases: ['finite state machine'] }, { keyword: 'Path Planning' },
    { keyword: 'Kalman Filter' }, { keyword: 'Computer Vision' },
  ],
  technicalDomains: [
    { keyword: 'Embedded Systems' }, { keyword: 'Robotics' }, { keyword: 'Control Systems' },
    { keyword: 'Sensor Networks' }, { keyword: 'Internet of Things', aliases: ['iot'] },
  ],
};

const SKILL_CATEGORY_ALIASES: Record<SkillCategory, string[]> = {
  programming: ['programming', 'programming languages', 'languages', 'coding languages'],
  software: ['software', 'engineering software', 'software tools', 'design software', 'simulation software'],
  engineering: ['engineering skills', 'engineering', 'technical engineering skills', 'hardware skills'],
  frameworks: ['frameworks', 'frameworks and libraries'],
  libraries: ['libraries', 'packages'],
  tools: ['tools', 'toolbox', 'technical tools', 'developer tools'],
  platforms: ['platforms', 'cloud platforms', 'embedded platforms'],
  softSkills: ['soft skills', 'interpersonal skills'],
  professionalSkills: ['professional skills', 'professional competencies'],
};

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

/** Normalizes visual heading variants before synonym lookup. */
export function normalizeSectionHeading(value: string): string {
  return String(value || '')
    // PDF extraction can encode decorative bullets/icons as mojibake such as
    // "â˜…". Remove those fragments before retaining alphabetic heading text.
    .replace(/(?:â|Ã)(?:[\u0080-\uFFFF]{1,3})?/g, ' ')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSection(line: string): ResumeSection | null {
  const heading = normalizeSectionHeading(line);
  if (!heading || heading.length > 64) return null;
  for (const [section, aliases] of Object.entries(SECTION_ALIASES)) {
    if ((aliases as readonly string[]).some((alias) => normalizeSectionHeading(alias) === heading)) {
      return section as ResumeSection;
    }
  }
  // Semantic fallback for headings such as "Work Experience and Internships"
  // that combine known concepts without matching a single alias verbatim.
  if (/\d/.test(line)) return null;
  const words = heading.split(' ').filter(Boolean);
  if (words.length > 5) return null;
  const candidates = (Object.entries(SECTION_SIGNALS) as [ResumeSection, string[]][])
    .map(([section, signals]) => ({
      section,
      score: words.filter((word) => signals.includes(word)).length,
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);
  if (!candidates.length) return null;
  // A multi-word capstone/prototype/design phrase is normally a project entry
  // title, not a new section heading (for example, "Capstone Design Project").
  if (candidates[0].section === 'projects' && words.length >= 3
    && /\b(?:capstone|prototype|robot|design|simulation)\b/i.test(line)) return null;
  // A one-word canonical signal is enough (for example, "Competencies").
  // For mixed headings require an unambiguous best semantic match.
  if (words.length === 1 || candidates.length === 1 || candidates[0].score > candidates[1].score) {
    return candidates[0].section;
  }
  return null;
}

type InlineSectionMatch = { section: ResumeSection; content: string; skillCategory: SkillCategory | null };

/** Identifies "Heading: value" and "Heading — value" template rows. */
function getInlineSection(line: string): InlineSectionMatch | null {
  const match = String(line || '').match(/^\s*(.{1,64}?)(?:\s*:\s*|\s+[—–-]\s+|\s+\|\s+|\t+)(.+)$/);
  if (!match) return null;
  const label = match[1].trim();
  const content = match[2].trim();
  const section = getSection(label);
  if (!section || !content) return null;
  return { section, content, skillCategory: getSkillCategory(label) };
}

/** Splits only visible column gaps/tabs; ordinary sentence spacing is retained. */
function splitColumnCells(line: string): string[] {
  return String(line || '').split(/\t+|\s{3,}/).map((cell) => cell.trim()).filter(Boolean);
}

/** Detects semantic section headings arranged side-by-side in a template. */
function getColumnSections(line: string): ResumeSection[] | null {
  const cells = splitColumnCells(line);
  if (cells.length < 2) return null;
  const sections = cells.map((cell) => getSection(cell));
  return sections.every((section): section is ResumeSection => section !== null) ? sections : null;
}

/** Converts common source-template syntax into the same logical text model. */
function normalizeTemplateSyntax(value: string): string {
  return String(value || '')
    .replace(/\\(?:section|subsection)\*?\s*\{([^{}]+)\}/gi, '$1')
    .replace(/\\(?:textbf|textit|emph|underline)\s*\{([^{}]+)\}/gi, '$1')
    .replace(/\\href\s*\{[^{}]*\}\s*\{([^{}]+)\}/gi, '$1')
    .replace(/\\item\b\s*/gi, '- ')
    .replace(/\\\\/g, '\n');
}

function getSkillCategory(line: string): SkillCategory | null {
  const heading = normalizeSectionHeading(line);
  if (!heading || heading.length > 64) return null;
  for (const [category, aliases] of Object.entries(SKILL_CATEGORY_ALIASES)) {
    if (aliases.some((alias) => normalizeSectionHeading(alias) === heading)) {
      return category as SkillCategory;
    }
  }
  return null;
}

function emptySkillCategories(): SkillCategories {
  return {
    programming: [], software: [], engineering: [], frameworks: [], libraries: [], tools: [],
    platforms: [], softSkills: [], professionalSkills: [],
  };
}

function emptyTechnicalKeywordGroups(): TechnicalKeywordGroups {
  return {
    programmingLanguages: [], cadSoftware: [], simulationTools: [], microcontrollers: [], protocols: [],
    frameworks: [], engineeringConcepts: [], algorithms: [], technicalDomains: [],
  };
}

/**
 * Normalizes technical text for deterministic, case-insensitive whole-phrase
 * matching. It deliberately retains + and # for language names such as C++.
 */
function normalizeTechnicalKeywordSource(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Finds only known technical terms. This runs before the LLM so generic
 * education/status text can never be promoted to a technical keyword.
 */
function extractDeterministicTechnicalKeywords(value: string): TechnicalKeywordGroups {
  const source = ` ${normalizeTechnicalKeywordSource(value)} `;
  const extracted = emptyTechnicalKeywordGroups();

  for (const [category, rules] of Object.entries(TECHNICAL_KEYWORD_RULES) as [keyof TechnicalKeywordGroups, KeywordRule[]][]) {
    for (const rule of rules) {
      const terms = [rule.keyword, ...(rule.aliases ?? [])];
      const matched = terms.some((term) => {
        const normalized = normalizeTechnicalKeywordSource(term);
        return normalized.length > 0 && source.includes(` ${normalized} `);
      });
      if (matched) extracted[category].push(rule.keyword);
    }
  }

  return extracted;
}

function flattenTechnicalKeywordGroups(groups: TechnicalKeywordGroups): string[] {
  return Object.values(groups).flat();
}

const DEGREE_EVIDENCE_PATTERN = /\b(?:bachelor(?:s)?|master(?:s)?|doctor(?:ate)?|associate|bsc|bs|msc|ms|phd|diploma)\b/i;
const ACADEMIC_CONTEXT_PATTERN = /\b(?:engineering|science|arts|business|computer|mechatronics|electrical|electronics|university|college|institute)\b/i;
const PROJECT_ACTION_PATTERN = /^(?:built|created|developed|designed|implemented|engineered|tested|simulated|prototyped|automated|modeled)\b/i;

function isLikelyNameLine(value: string): boolean {
  const words = sanitizeResumeContentLine(value).split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.length <= 5
    && words.every((word) => /^[A-Z][A-Za-z'.-]*$/.test(word));
}

/** Recovers a pre-heading introductory paragraph only when it reads as prose. */
function recoverIntroductorySummary(lines: string[]): string {
  const paragraph: string[] = [];
  for (const line of lines) {
    if (!line) {
      if (paragraph.length) break;
      continue;
    }
    if (getSection(line) || getInlineSection(line) || getColumnSections(line)) break;
    if (hasContactOrLinkValue(line) || isMetadataOnlyLine(line) || isLikelyNameLine(line)) continue;
    const safe = sanitizeResumeContentLine(line);
    if (!safe || DEGREE_EVIDENCE_PATTERN.test(safe)) continue;
    paragraph.push(safe);
    if (paragraph.join(' ').length >= 280) break;
  }
  const value = unique(paragraph).join(' ').trim();
  // Avoid turning a standalone title such as "Electrical Engineer" into a summary.
  return value.length >= 40 ? value : '';
}

/** Finds independent project blocks when a template omitted a Projects heading. */
function recoverProjectBlocks(lines: string[]): ProjectLine[][] {
  const recovered: ProjectLine[][] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const title = lines[index];
    if (!title || getSection(title) || getInlineSection(title) || isProjectBullet(title)) continue;
    if (classifyPracticalEntry(title, 'projects') === 'experience' || !looksLikeProjectTitle(title)) continue;

    const following: ProjectLine[] = [];
    for (let cursor = index + 1; cursor < lines.length && following.length < 8; cursor += 1) {
      const candidate = lines[cursor];
      if (!candidate || getSection(candidate) || getInlineSection(candidate)) break;
      if (looksLikeProjectTitle(candidate) && following.length > 0) break;
      const safe = sanitizeResumeContentLine(candidate);
      if (safe) following.push({ raw: candidate, text: safe });
    }
    const hasProjectEvidence = following.some((entry) =>
      isProjectBullet(entry.raw) || projectTechnologyHeading(entry.raw).isHeading || PROJECT_ACTION_PATTERN.test(entry.text),
    );
    if (!hasProjectEvidence) continue;
    const safeTitle = sanitizeResumeContentLine(title);
    if (!safeTitle) continue;
    recovered.push([{ raw: title, text: safeTitle }, ...following]);
    index += following.length;
  }
  return recovered;
}

/** Splits common grouped-skill delimiters without changing other resume sections. */
function splitSkillEntries(value: string): string[] {
  return value.split(/\s*(?:,|;|\||â€¢|Â·)\s*/).map((item) => item.trim()).filter(Boolean);
}

type ProjectLine = { raw: string; text: string };

const PROJECT_TECHNOLOGY_HEADINGS = new Set([
  'tools and skills', 'technologies', 'technology', 'technologies used', 'software used', 'software',
]);
const EXPERIENCE_ENTRY_PATTERN = /\b(?:intern(?:ship)?|engineer|research assistant|company|ltd|inc)\b/i;
const PROJECT_ENTRY_PATTERN = /\b(?:project|prototype|robot|design|simulation|capstone)\b/i;
const LEADERSHIP_ACTIVITY_PATTERN = /\b(?:led|leadership|society|club|team|extracurricular|position of responsibility)\b/i;

/** Experience evidence takes precedence when an entry includes both signals. */
function classifyPracticalEntry(value: string, fallback: 'experience' | 'projects'): 'experience' | 'projects' {
  if (EXPERIENCE_ENTRY_PATTERN.test(value)) return 'experience';
  if (fallback === 'experience' && LEADERSHIP_ACTIVITY_PATTERN.test(value)) return 'experience';
  if (PROJECT_ENTRY_PATTERN.test(value)) return 'projects';
  return fallback;
}

function isProjectBullet(raw: string): boolean {
  return /^\s*(?:[-*â€¢Â·â–ªâ—¦]|\d+[.)])\s+/.test(raw);
}

function stripProjectBullet(value: string): string {
  return value.replace(/^\s*(?:[-*â€¢Â·â–ªâ—¦]|\d+[.)])\s+/, '').trim();
}

function projectTechnologyHeading(raw: string): { isHeading: boolean; inlineValues: string } {
  const [label, ...rest] = raw.split(':');
  const normalized = normalizeSectionHeading(label);
  if (!PROJECT_TECHNOLOGY_HEADINGS.has(normalized)) return { isHeading: false, inlineValues: '' };
  return { isHeading: true, inlineValues: rest.join(':').trim() };
}

function looksLikeProjectTitle(raw: string): boolean {
  const value = stripProjectBullet(raw);
  if (!value || isProjectBullet(raw) || value.length > 100 || /[.!?]$/.test(value)) return false;
  if (/^(?:built|created|developed|designed|implemented|led|worked|used|responsible|collaborated)\b/i.test(value)) return false;
  if (/^project(?:\s+name)?\s*:/i.test(value)) return true;
  const words = value.split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.length <= 10
    && words.filter((word) => /^[A-Z0-9][A-Za-z0-9+#/.-]*$/.test(word)).length >= Math.ceil(words.length * 0.6);
}

function titleFromProjectLine(raw: string): string {
  return stripProjectBullet(raw).replace(/^project(?:\s+name)?\s*:\s*/i, '').trim();
}

function parseProjectDetails(blocks: ProjectLine[][]): StructuredProject[] {
  return blocks.map((block) => {
    let title = '';
    let technologyMode = false;
    const descriptionParts: string[] = [];
    const bullets: string[] = [];
    const technologies: string[] = [];
    const outcomes: string[] = [];

    for (const line of block) {
      const technologyHeading = projectTechnologyHeading(line.raw);
      if (technologyHeading.isHeading) {
        technologyMode = true;
        if (technologyHeading.inlineValues) technologies.push(...splitSkillEntries(technologyHeading.inlineValues));
        continue;
      }
      if (!title && looksLikeProjectTitle(line.raw)) {
        title = titleFromProjectLine(line.raw);
        technologyMode = false;
        continue;
      }
      if (technologyMode && !isProjectBullet(line.raw) && line.text.length <= 120 && !/[.!?]$/.test(line.text)) {
        technologies.push(...splitSkillEntries(line.text));
        continue;
      }
      technologyMode = false;
      const content = stripProjectBullet(line.text);
      if (!content) continue;
      if (isProjectBullet(line.raw)) bullets.push(content);
      else descriptionParts.push(content);
      if (/\b(?:\d+(?:\.\d+)?%?|increased|reduced|improved|achieved|saved|accelerated|decreased|delivered)\b/i.test(content)) {
        outcomes.push(content);
      }
    }

    return {
      title,
      description: unique(descriptionParts).join(' '),
      bullets: unique(bullets),
      technologies: unique(technologies),
      outcomes: unique(outcomes),
    };
  }).filter((project) => project.title || project.description || project.bullets.length || project.technologies.length);
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
  const sourceLines = normalizeTemplateSyntax(resumeText).replace(/\r\n/g, '\n').split('\n');
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
    // Keep paragraph boundaries so project records can be separated later.
    if (!line) {
      cleaned.push('');
      continue;
    }

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
  const lines = cleanedResumeText.split('\n').map((line) => line.trim());
  const sections: Record<ResumeSection, string[]> = { summary: [], experience: [], projects: [], skills: [], education: [], certifications: [], awards: [], languages: [] };
  const skillCategories = emptySkillCategories();
  const projectBlocks: ProjectLine[][] = [];
  let activeProjectBlock: ProjectLine[] = [];
  let active: ResumeSection | null = null;
  let activeSkillCategory: SkillCategory | null = null;
  let practicalContext: 'experience' | 'projects' | null = null;
  let lastPracticalDestination: 'experience' | 'projects' | null = null;
  let columnSections: ResumeSection[] | null = null;

  const finishProjectBlock = () => {
    if (activeProjectBlock.length > 0) projectBlocks.push(activeProjectBlock);
    activeProjectBlock = [];
  };

  const appendSectionContent = (target: ResumeSection, rawValue: string, category: SkillCategory | null = null) => {
    const safe = sanitizeResumeContentLine(rawValue);
    if (!safe) return;
    if (target === 'skills') {
      const entries = splitSkillEntries(safe);
      sections.skills.push(...entries);
      if (category) skillCategories[category].push(...entries);
      return;
    }
    if (target !== 'experience' && target !== 'projects') {
      sections[target].push(safe);
      return;
    }

    const destination = classifyPracticalEntry(rawValue, practicalContext || target);
    practicalContext = destination;
    if (lastPracticalDestination === 'projects' && destination !== 'projects') finishProjectBlock();
    if (destination === 'experience') {
      sections.experience.push(safe);
      lastPracticalDestination = 'experience';
      return;
    }
    if (activeProjectBlock.length > 0 && looksLikeProjectTitle(rawValue) && !projectTechnologyHeading(rawValue).isHeading) {
      finishProjectBlock();
    }
    activeProjectBlock.push({ raw: rawValue, text: safe });
    sections.projects.push(safe);
    lastPracticalDestination = 'projects';
  };

  for (const line of lines) {
    if (!line) {
      if (lastPracticalDestination === 'projects') finishProjectBlock();
      practicalContext = active === 'experience' || active === 'projects' ? active : null;
      lastPracticalDestination = null;
      columnSections = null;
      continue;
    }
    const detectedColumnSections = getColumnSections(line);
    if (detectedColumnSections) {
      if (lastPracticalDestination === 'projects') finishProjectBlock();
      active = null;
      activeSkillCategory = null;
      practicalContext = null;
      lastPracticalDestination = null;
      columnSections = detectedColumnSections;
      continue;
    }
    if (columnSections) {
      const cells = splitColumnCells(line);
      if (cells.length === columnSections.length) {
        for (const [index, cell] of cells.entries()) {
          const inline = getInlineSection(cell);
          const target = inline?.section || columnSections[index];
          appendSectionContent(target, inline?.content || cell, inline?.skillCategory || null);
        }
        continue;
      }
      // A non-column line marks a return to normal document flow.
      columnSections = null;
    }
    // "Software" can be a top-level Skills heading, but inside Projects it
    // is project metadata and must not end the current project.
    if (practicalContext === 'projects' && projectTechnologyHeading(line).isHeading) {
      const safe = sanitizeResumeContentLine(line);
      if (safe) {
        activeProjectBlock.push({ raw: line, text: safe });
        sections.projects.push(safe);
        lastPracticalDestination = 'projects';
      }
      continue;
    }
    const inlineSection = getInlineSection(line);
    if (inlineSection) {
      if (lastPracticalDestination === 'projects') finishProjectBlock();
      active = inlineSection.section;
      activeSkillCategory = inlineSection.section === 'skills' ? inlineSection.skillCategory : null;
      practicalContext = inlineSection.section === 'experience' || inlineSection.section === 'projects' ? inlineSection.section : null;
      lastPracticalDestination = null;
      appendSectionContent(inlineSection.section, inlineSection.content, inlineSection.skillCategory);
      continue;
    }
    const skillCategory = getSkillCategory(line);
    // A grouped heading inside Skills (for example, "Engineering Software")
    // changes category without becoming a skill item itself.
    if (active === 'skills' && skillCategory) {
      activeSkillCategory = skillCategory;
      continue;
    }
    const section = getSection(line);
    if (section) {
      if (lastPracticalDestination === 'projects') finishProjectBlock();
      columnSections = null;
      active = section;
      activeSkillCategory = section === 'skills' ? skillCategory : null;
      practicalContext = section === 'experience' || section === 'projects' ? section : null;
      lastPracticalDestination = null;
      continue;
    }
    // Some resumes begin directly with a group heading such as "Frameworks"
    // instead of a parent Skills heading. Treat it as a skills subsection.
    if (skillCategory) {
      active = 'skills';
      activeSkillCategory = skillCategory;
      continue;
    }
    if (active) {
      appendSectionContent(active, line, activeSkillCategory);
    }
  }
  if (lastPracticalDestination === 'projects') finishProjectBlock();

  const links = extractLinks(resumeText);
  const linkedin = links.find((link) => /linkedin/i.test(`${link.url} ${link.anchorText}`));
  const directLinkedin = resumeText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s<>()\[\]{}]+/i);
  const linkedinUrl = linkedin?.url || (directLinkedin ? normalizeUrl(directLinkedin[0]) : '');
  const portfolioUrl = links.find((link) => link.url !== linkedinUrl && /portfolio|github|gitlab|behance|dribbble|personal website|website/i.test(`${link.url} ${link.anchorText}`))?.url || links.find((link) => link.url !== linkedinUrl)?.url || '';
  const email = resumeText.match(EMAIL_PATTERN)?.[0] || '';
  const phone = (resumeText.match(PHONE_CANDIDATE_PATTERN) || []).find(isPhoneCandidate)?.trim() || '';
  const technicalKeywords = extractDeterministicTechnicalKeywords(cleanedResumeText);

  // Validation/recovery pass: a layout may omit a visible heading even when
  // the underlying resume evidence is present. Fill only empty sections and
  // only from deterministic, local evidence.
  if (sections.education.length === 0) {
    sections.education.push(...lines
      .filter((line) => DEGREE_EVIDENCE_PATTERN.test(line) && ACADEMIC_CONTEXT_PATTERN.test(line))
      .map(sanitizeResumeContentLine)
      .filter(Boolean));
  }
  if (sections.skills.length === 0) {
    sections.skills.push(...flattenTechnicalKeywordGroups(technicalKeywords));
  }
  if (sections.projects.length === 0) {
    const recoveredProjects = recoverProjectBlocks(lines);
    for (const block of recoveredProjects) {
      projectBlocks.push(block);
      sections.projects.push(...block.map((entry) => entry.text));
    }
  }
  const recoveredSummary = sections.summary.length === 0 ? recoverIntroductorySummary(lines) : '';

  return {
    contact: { name: findName(lines), email, phone, location: findLocation(lines) },
    summary: unique([...sections.summary, recoveredSummary]).join(' '),
    experience: unique(sections.experience), projects: unique(sections.projects),
    projectDetails: parseProjectDetails(projectBlocks),
    skillCategories: Object.fromEntries(
      Object.entries(skillCategories).map(([category, values]) => [category, unique(values)]),
    ) as SkillCategories,
    technicalKeywords,
    // Preserve explicit skills while guaranteeing recognized technical terms
    // are available to the existing ATS/LLM input without a prompt change.
    skills: unique([...sections.skills, ...flattenTechnicalKeywordGroups(technicalKeywords)]),
    education: unique(sections.education), certifications: unique(sections.certifications), awards: unique(sections.awards), languages: unique(sections.languages),
    links: { linkedinUrl, portfolioUrl, items: links },
  };
}
