import type { StructuredResume } from './resumeParser.js';
import { classifyCareerTaxonomy, type CareerTaxonomyMembership } from './careerTaxonomy.js';

/** The stable, deterministic candidate profile consumed by Job Match. */
export type ResumeIntelligenceProfile = {
  primary_domain: string;
  secondary_domains: string[];
  career_taxonomy: CareerTaxonomyMembership;
  career_level: 'Student' | 'Intern' | 'Graduate' | 'Junior' | 'Mid' | 'Senior' | 'Principal' | 'Director';
  /** Companies explicitly named in the candidate's resume; never guessed. */
  likely_companies: string[];
  /** Company types inferred from the evidence-backed domain, not company names. */
  target_company_types: string[];
  preferred_locations: string[];
  preferred_work_modes: Array<'Remote' | 'Hybrid' | 'Onsite'>;
  education: string;
  major: string;
  experience_years: number;
  experience: {
    years: number;
    companies: string[];
    titles: string[];
    project_count: number;
    research_or_internship_count: number;
  };
  technical_skills: string[];
  software_tools: string[];
  technical_stack: {
    programming_languages: string[];
    frameworks: string[];
    libraries: string[];
    software: string[];
    tools: string[];
    platforms: string[];
    hardware: string[];
    protocols: string[];
    engineering_concepts: string[];
    technical_domains: string[];
  };
  soft_skills: string[];
  industries: string[];
  job_titles: string[];
  keywords: string[];
};

type DomainDefinition = {
  domain: string;
  industries: string[];
  signals: string[];
  titles: string[];
};

// These are role-family concepts, not a blacklist or a job keyword list. A
// candidate can match multiple families and the evidence decides their order.
const DOMAIN_DEFINITIONS: DomainDefinition[] = [
  { domain: 'Mechatronics Engineering', industries: ['Engineering', 'Automation', 'Robotics'], signals: ['mechatronics', 'arduino', 'stm32', 'esp32', 'plc', 'proteus', 'sensor integration', 'pid control', 'bl dc'], titles: ['Mechatronics Engineer', 'Robotics Engineer', 'Embedded Engineer', 'Automation Engineer', 'Control Systems Engineer'] },
  { domain: 'Embedded Systems', industries: ['Engineering', 'Technology', 'Electronics'], signals: ['embedded systems', 'firmware', 'microcontroller', 'arduino', 'stm32', 'esp32', 'uart', 'spi', 'i2c'], titles: ['Embedded Systems Engineer', 'Firmware Engineer', 'Embedded Software Engineer', 'IoT Engineer', 'Hardware Engineer'] },
  { domain: 'Mechanical Engineering', industries: ['Engineering', 'Manufacturing'], signals: ['mechanical engineering', 'solidworks', 'autocad', 'catia', 'ansys', 'fea', 'gd&t', 'mechanical design'], titles: ['Mechanical Engineer', 'Mechanical Design Engineer', 'Product Design Engineer', 'Manufacturing Engineer'] },
  { domain: 'Electrical Engineering', industries: ['Engineering', 'Electronics', 'Energy'], signals: ['electrical engineering', 'power systems', 'circuit design', 'pcb design', 'altium', 'ltspice', 'electronics'], titles: ['Electrical Engineer', 'Electronics Engineer', 'Hardware Engineer', 'Power Systems Engineer'] },
  { domain: 'Computer Science', industries: ['Technology', 'Software'], signals: ['computer science', 'algorithms', 'data structures', 'software development', 'java', 'python', 'typescript', 'javascript'], titles: ['Software Engineer', 'Backend Engineer', 'Full Stack Developer', 'Application Developer'] },
  { domain: 'Cybersecurity', industries: ['Technology', 'Cybersecurity'], signals: ['cybersecurity', 'information security', 'siem', 'soc analyst', 'penetration testing', 'incident response', 'splunk'], titles: ['Cybersecurity Analyst', 'SOC Analyst', 'Information Security Analyst', 'Security Engineer'] },
  { domain: 'Finance', industries: ['Finance', 'Banking'], signals: ['finance', 'financial modeling', 'valuation', 'financial analysis', 'investment', 'risk analysis', 'bloomberg'], titles: ['Financial Analyst', 'Risk Analyst', 'Investment Analyst', 'Corporate Finance Analyst'] },
  { domain: 'Accounting', industries: ['Finance', 'Accounting'], signals: ['accounting', 'bookkeeping', 'audit', 'ifrs', 'gaap', 'accounts payable', 'accounts receivable'], titles: ['Accountant', 'Audit Associate', 'Financial Accountant', 'Tax Associate'] },
  { domain: 'Marketing', industries: ['Marketing', 'Advertising'], signals: ['marketing', 'seo', 'google analytics', 'content strategy', 'campaign management', 'social media marketing', 'brand management'], titles: ['Marketing Specialist', 'Digital Marketing Specialist', 'SEO Specialist', 'Content Marketing Specialist'] },
  { domain: 'Human Resources', industries: ['Human Resources'], signals: ['human resources', 'talent acquisition', 'recruitment', 'employee relations', 'hris', 'people operations'], titles: ['HR Coordinator', 'Talent Acquisition Specialist', 'HR Generalist', 'People Operations Associate'] },
  { domain: 'Law', industries: ['Legal Services'], signals: ['law', 'legal research', 'contract drafting', 'litigation', 'paralegal', 'compliance law', 'bar admission'], titles: ['Legal Associate', 'Paralegal', 'Compliance Analyst', 'Contract Specialist'] },
  { domain: 'Healthcare', industries: ['Healthcare'], signals: ['healthcare', 'clinical', 'patient care', 'nursing', 'medical', 'emr', 'hospital'], titles: ['Healthcare Assistant', 'Clinical Research Coordinator', 'Medical Assistant', 'Public Health Analyst'] },
  { domain: 'Marine Biology', industries: ['Life Sciences', 'Marine Science', 'Environmental Research'], signals: ['marine biology', 'marine science', 'aquatic ecology', 'scientific diver', 'padi', 'oceanography', 'field sampling'], titles: ['Marine Biologist', 'Marine Research Assistant', 'Field Research Technician', 'Conservation Scientist'] },
  { domain: 'Construction Management', industries: ['Construction', 'Infrastructure'], signals: ['construction management', 'quantity surveying', 'site engineering', 'construction safety', 'estimating', 'primavera p6', 'bim'], titles: ['Construction Project Coordinator', 'Site Engineer', 'Quantity Surveyor', 'Project Controls Engineer'] },
  { domain: 'Education', industries: ['Education'], signals: ['education', 'teaching', 'curriculum', 'lesson planning', 'student assessment', 'learning management system'], titles: ['Teacher', 'Education Coordinator', 'Curriculum Specialist', 'Academic Tutor'] },
  { domain: 'Sales', industries: ['Sales', 'Business Development'], signals: ['sales', 'business development', 'account management', 'crm', 'pipeline management', 'lead generation'], titles: ['Sales Representative', 'Business Development Associate', 'Account Executive', 'Account Manager'] },
];

const unique = (values: string[]) => [...new Map(values.map((value) => [value.trim().toLowerCase(), value.trim()] as const)).values()].filter(Boolean);
const normalized = (value: string) => ` ${String(value || '').toLowerCase().replace(/[^a-z0-9+#]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
const hasPhrase = (source: string, phrase: string) => normalized(source).includes(normalized(phrase));
const NON_TECHNICAL_SKILL = /^(?:communication|teamwork|leadership|problem solving|time management|adaptability|critical thinking|collaboration|work ethic)$/i;
const WORK_MODE = /\b(remote|hybrid|on[ -]?site)\b/gi;

function experienceYears(entries: string[]): number {
  const intervals = entries.flatMap((entry) => [...entry.matchAll(/\b((?:19|20)\d{2})\s*(?:-|–|to)\s*((?:19|20)\d{2}|present|current)\b/gi)]
    .map((match) => ({ start: Number(match[1]), end: /present|current/i.test(match[2]) ? new Date().getUTCFullYear() : Number(match[2]) })));
  if (!intervals.length) return 0;
  const first = Math.min(...intervals.map((period) => period.start));
  const last = Math.max(...intervals.map((period) => period.end));
  return Math.max(0, Math.round((last - first) * 10) / 10);
}

function careerLevel(resume: StructuredResume, years: number): ResumeIntelligenceProfile['career_level'] {
  const source = [resume.summary, ...resume.education, ...resume.experience].join(' ').toLowerCase();
  if (/\b(?:director|head of|vice president|vp)\b/.test(source)) return 'Director';
  if (/\b(?:principal|staff engineer)\b/.test(source)) return 'Principal';
  if (/\b(?:senior|sr\.)\b/.test(source) || years >= 7) return 'Senior';
  if (/\b(?:mid level|mid-level)\b/.test(source) || years >= 3) return 'Mid';
  if (/\b(?:junior|entry level)\b/.test(source) || years >= 1) return 'Junior';
  if (/\b(?:intern|internship)\b/.test(source)) return 'Intern';
  if (/\b(?:student|undergraduate|pursuing|expected graduation|currently enrolled)\b/.test(source)) return 'Student';
  return 'Graduate';
}

function educationMajor(resume: StructuredResume, rawResumeText = ''): { education: string; major: string } {
  const recoveredEducation = rawResumeText.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /\b(?:bachelor(?:s)?|master(?:s)?|doctorate|phd|bsc|bs|beng|msc|ms)\b/i.test(line));
  const education = unique(resume.education.length ? resume.education : recoveredEducation).join('; ');
  const detailMajor = resume.understanding.educationDetails.map((detail) => detail.major).find(Boolean);
  const inField = education.match(/\bin\s+([A-Za-z][A-Za-z &/-]{2,80}?)(?=\s*(?:\||,|\(|\d{4}|$))/i);
  const ofField = education.match(/\bof\s+([A-Za-z][A-Za-z &/-]{2,80}?)(?=\s*(?:\||,|\(|\d{4}|$))/i);
  return { education, major: detailMajor || inField?.[1]?.trim() || ofField?.[1]?.trim() || '' };
}

function preferredWorkModes(resume: StructuredResume, rawResumeText: string): ResumeIntelligenceProfile['preferred_work_modes'] {
  const found = `${resume.contact.location} ${rawResumeText.match(WORK_MODE)?.join(' ') || ''}`.toLowerCase();
  return [
    /remote/.test(found) && 'Remote',
    /hybrid/.test(found) && 'Hybrid',
    /on[ -]?site/.test(found) && 'Onsite',
  ].filter(Boolean) as ResumeIntelligenceProfile['preferred_work_modes'];
}

function companiesFromExperience(resume: StructuredResume): string[] {
  const parsed = resume.understanding.experienceDetails.map((detail) => detail.company).filter(Boolean);
  const inline = resume.experience.flatMap((entry) => {
    const pipeCompany = entry.match(/\|\s*([A-Z][A-Za-z0-9&.,' -]{1,80})(?:\||$)/m)?.[1];
    const atCompany = entry.match(/\bat\s+([A-Z][A-Za-z0-9&.,' -]{1,80})(?:\s*[|,]|$)/m)?.[1];
    return [pipeCompany, atCompany].filter((value): value is string => Boolean(value));
  });
  return unique([...parsed, ...inline].map((value) => value.trim()).filter(Boolean));
}

export function extractResumeIntelligence(resume: StructuredResume, rawResumeText = ''): ResumeIntelligenceProfile {
  const technicalGroups = Object.values(resume.technicalKeywords).flat();
  const categorizedTechnical = [
    ...resume.skillCategories.programming,
    ...resume.skillCategories.software,
    ...resume.skillCategories.engineering,
    ...resume.skillCategories.frameworks,
    ...resume.skillCategories.libraries,
    ...resume.skillCategories.tools,
    ...resume.skillCategories.platforms,
  ];
  const technical_skills = unique([...resume.skills, ...categorizedTechnical, ...technicalGroups])
    .filter((skill) => !NON_TECHNICAL_SKILL.test(skill));
  const software_tools = unique([
    ...resume.skillCategories.software,
    ...resume.skillCategories.tools,
    ...resume.skillCategories.platforms,
    ...resume.skillCategories.frameworks,
    ...resume.skillCategories.libraries,
    ...resume.technicalKeywords.cadSoftware,
    ...resume.technicalKeywords.simulationTools,
  ]);
  const source = [
    resume.summary,
    ...resume.education,
    ...resume.experience,
    ...resume.projects,
    ...technical_skills,
    ...software_tools,
  ].join(' ');
  const scoredDomains = DOMAIN_DEFINITIONS.map((definition) => ({
    definition,
    score: definition.signals.reduce((score, signal) => score + (hasPhrase(source, signal) ? 1 : 0), 0),
  })).filter((item) => item.score > 0).sort((left, right) => right.score - left.score);
  const educationInfo = educationMajor(resume, rawResumeText);
  const fallbackDomain = educationInfo.major || 'General Professional';
  const primary = scoredDomains[0]?.definition;
  const secondary = scoredDomains.slice(1, 3).map((item) => item.definition.domain);
  const years = experienceYears(resume.experience);
  const experienceCompanies = companiesFromExperience(resume);
  const experienceTitles = unique(resume.understanding.experienceDetails.map((detail) => detail.position).filter(Boolean));
  const technical_stack: ResumeIntelligenceProfile['technical_stack'] = {
    programming_languages: unique([...resume.skillCategories.programming, ...resume.technicalKeywords.programmingLanguages]),
    frameworks: unique([...resume.skillCategories.frameworks, ...resume.technicalKeywords.frameworks]),
    libraries: unique(resume.skillCategories.libraries),
    software: unique([...resume.skillCategories.software, ...resume.technicalKeywords.cadSoftware, ...resume.technicalKeywords.simulationTools]),
    tools: unique(resume.skillCategories.tools),
    platforms: unique(resume.skillCategories.platforms),
    hardware: unique(resume.understanding.projectUnderstanding.flatMap((project) => project.hardware)),
    protocols: unique(resume.technicalKeywords.protocols),
    engineering_concepts: unique([...resume.skillCategories.engineering, ...resume.technicalKeywords.engineeringConcepts, ...resume.technicalKeywords.algorithms]),
    technical_domains: unique(resume.technicalKeywords.technicalDomains),
  };
  const targetCompanyTypes = unique((primary?.industries || []).map((industry) => `${industry} organizations`));
  const primaryDomain = primary?.domain || fallbackDomain;
  const secondaryDomains = unique(secondary);
  const career_taxonomy = classifyCareerTaxonomy(primaryDomain, secondaryDomains, [
    ...technical_skills,
    ...software_tools,
    ...resume.understanding.projectUnderstanding.flatMap((project) => [...project.domains, ...project.technologies, ...project.hardware]),
  ]);
  return {
    primary_domain: primaryDomain,
    secondary_domains: secondaryDomains,
    career_taxonomy,
    career_level: careerLevel(resume, years),
    likely_companies: experienceCompanies,
    target_company_types: targetCompanyTypes,
    preferred_locations: unique([resume.contact.location].filter(Boolean)),
    preferred_work_modes: preferredWorkModes(resume, rawResumeText),
    education: educationInfo.education,
    major: educationInfo.major,
    experience_years: years,
    experience: {
      years,
      companies: experienceCompanies,
      titles: experienceTitles,
      project_count: resume.projectDetails.length,
      research_or_internship_count: resume.understanding.experienceDetails.filter((detail) => /research|intern/i.test(`${detail.position} ${detail.employmentType}`)).length,
    },
    technical_skills,
    software_tools,
    technical_stack,
    soft_skills: unique([...resume.skillCategories.softSkills, ...resume.skillCategories.professionalSkills]),
    industries: unique(scoredDomains.flatMap((item) => item.definition.industries)),
    job_titles: unique(primary?.titles || (educationInfo.major ? [`${educationInfo.major} Professional`] : [])),
    keywords: unique([...technical_skills, ...software_tools, primary?.domain || '', ...secondary]),
  };
}
