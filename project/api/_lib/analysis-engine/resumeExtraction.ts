import { parseResumeText, type StructuredResume } from '../resumeParser.js';
import type { CandidateProfile, CandidateFact } from './types.js';

/**
 * Extracts a normalized, flat list of CandidateFacts from the structured resume
 * for deterministic matching and provenance tracking.
 */
export function extractCandidateProfile(resumeText: string): CandidateProfile {
  const structuredResume = parseResumeText(resumeText);
  const facts: CandidateFact[] = [];

  const textLines = resumeText.split(/\r?\n/).map(l => l.trim().toLowerCase());
  
  // Helper to check if a section explicitly existed in the raw text
  const hasExplicitHeading = (aliases: string[]) => {
    return textLines.some(line => {
      // Check if line is short and matches a section alias
      if (line.length > 30) return false;
      return aliases.some(alias => line === alias || line.startsWith(alias + ':'));
    });
  };

  const hasExplicitProjects = hasExplicitHeading(['projects', 'project experience', 'portfolio', 'personal projects', 'academic projects']);
  const hasExplicitSkills = hasExplicitHeading(['skills', 'technical skills', 'core competencies']);
  const hasExplicitExperience = hasExplicitHeading(['experience', 'work experience', 'employment history']);
  const hasExplicitEducation = hasExplicitHeading(['education', 'academic background']);

  // Extract skills
  for (const skill of structuredResume.skills) {
    facts.push({
      id: crypto.randomUUID(),
      type: 'skill',
      normalizedName: skill.trim(),
      rawText: skill.trim(),
      sourceSection: hasExplicitSkills ? 'skills' : 'inferred / not explicitly sectioned',
      sectionInferred: !hasExplicitSkills,
      evidence: skill.trim()
    });
  }

  // Extract experience entries
  for (const exp of structuredResume.experience) {
    const duration = parseExperienceDuration(exp);
    facts.push({
      id: crypto.randomUUID(),
      type: 'experience',
      normalizedName: extractSummaryName(exp) || 'Professional Experience',
      rawText: exp,
      sourceSection: hasExplicitExperience ? 'experience' : 'inferred / not explicitly sectioned',
      sectionInferred: !hasExplicitExperience,
      evidence: exp,
      employment_duration_years: duration
    });
  }

  // Extract project entries
  for (const proj of structuredResume.projects) {
    facts.push({
      id: crypto.randomUUID(),
      type: 'project',
      normalizedName: extractSummaryName(proj) || 'Project',
      rawText: proj,
      sourceSection: hasExplicitProjects ? 'projects' : 'inferred / not explicitly sectioned',
      sectionInferred: !hasExplicitProjects,
      evidence: proj
    });
  }

  // Extract education
  for (const edu of structuredResume.education) {
    facts.push({
      id: crypto.randomUUID(),
      type: 'education',
      normalizedName: extractSummaryName(edu) || 'Education',
      rawText: edu,
      sourceSection: hasExplicitEducation ? 'education' : 'inferred / not explicitly sectioned',
      sectionInferred: !hasExplicitEducation,
      evidence: edu,
      degree_level: normalizeDegree(edu),
      fields: extractFieldsOfStudy(edu)
    });
  }

  // Extract certifications
  const hasExplicitCertifications = hasExplicitHeading(['certifications', 'licenses', 'certificates']);
  for (const cert of structuredResume.certifications) {
    facts.push({
      id: crypto.randomUUID(),
      type: 'certification',
      normalizedName: extractSummaryName(cert) || 'Certification',
      rawText: cert,
      sourceSection: hasExplicitCertifications ? 'certifications' : 'inferred / not explicitly sectioned',
      sectionInferred: !hasExplicitCertifications,
      evidence: cert
    });
  }

  // Extract summary
  if (structuredResume.summary) {
    const explicitDuration = parseExplicitDuration(structuredResume.summary);
    facts.push({
      id: crypto.randomUUID(),
      type: 'other',
      normalizedName: 'Summary',
      rawText: structuredResume.summary,
      sourceSection: 'summary',
      sectionInferred: false,
      evidence: structuredResume.summary,
      employment_duration_years: explicitDuration > 0 ? explicitDuration : undefined
    });
  }

  return {
    contact: structuredResume.contact,
    facts,
    rawStructure: structuredResume
  };
}

/**
 * Helper to get a short normalized name from a large block of text.
 */
function extractSummaryName(text: string): string {
  if (!text) return '';
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    return lines[0].substring(0, 50);
  }
  return text.substring(0, 50);
}

export function normalizeDegree(text: string): 'bachelor' | 'master' | 'phd' | 'associate' | 'high school' | 'any' {
  const lower = text.toLowerCase().replace(/['.]/g, ''); // normalize B.S. -> BS, bachelor's -> bachelors
  if (/\b(ba|bs|be|bachelor|bachelors|beng|bsc)\b/.test(lower)) return 'bachelor';
  if (/\b(ma|ms|me|master|masters|meng|mba|msc)\b/.test(lower)) return 'master';
  if (/\b(phd|doctorate|dphil|doctor)\b/.test(lower)) return 'phd';
  if (/\b(associate|aa|as|aas)\b/.test(lower)) return 'associate';
  if (/\b(high school|ged|diploma)\b/.test(lower)) return 'high school';
  return 'any';
}

export function extractFieldsOfStudy(text: string): string[] {
  const fields = [];
  const lower = text.toLowerCase();
  if (lower.includes('psychology') || lower.includes('psychological science')) fields.push('psychology');
  if (lower.includes('computer science') || lower.includes('cs')) fields.push('computer science');
  if (lower.includes('mechatronics')) fields.push('mechatronics engineering');
  if (lower.includes('electrical')) fields.push('electrical engineering');
  if (lower.includes('mechanical')) fields.push('mechanical engineering');
  if (lower.includes('business')) fields.push('business');
  return fields;
}

export function parseExplicitDuration(text: string): number {
  const match = text.match(/\b(\d+)(?:\+)?\s*(?:years?|yrs?)\b/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return 0;
}

export function parseExperienceDuration(text: string): number {
  const dateStr = extractDateRangeString(text);
  if (!dateStr) return 0;
  const parsed = parseDateRange(dateStr);
  if (!parsed) return 0;
  const years = calculateIntervalsDurationYears([parsed]);
  return Math.round(years * 10) / 10;
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, janunary: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
};

export function parseDate(dateStr: string): { year: number, month: number, isPresent: boolean } | null {
  const clean = dateStr.toLowerCase().trim();
  if (clean === 'present' || clean === 'current' || clean === 'now' || clean === 'today') {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), isPresent: true };
  }
  
  // Check for Month Year, e.g. "June 2019" or "Jun 2019" or "06/2019"
  const monthYearMatch = clean.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(20\d{2}|19\d{2})\b/i);
  if (monthYearMatch) {
    const month = MONTH_MAP[monthYearMatch[1].slice(0, 3).toLowerCase()] ?? 0;
    const year = parseInt(monthYearMatch[2], 10);
    return { year, month, isPresent: false };
  }
  
  const slashMatch = clean.match(/\b(0?[1-9]|1[0-2])\/((?:19|20)?\d{2})\b/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10) - 1;
    let year = parseInt(slashMatch[2], 10);
    if (year < 100) year += 2000;
    return { year, month, isPresent: false };
  }
  
  const yearMatch = clean.match(/\b(20\d{2}|19\d{2})\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    return { year, month: 0, isPresent: false };
  }
  
  return null;
}

export function extractDateRangeString(text: string): string | null {
  const clean = text.replace(/–|—/g, '-');
  const rangeMatch = clean.match(/\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*)?(?:19|20)?\d{2}\s*(?:-|\bto\b|\buntil\b)\s*(?:(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*)?(?:19|20)?\d{2}|present|current|now)\b/i);
  if (rangeMatch) return rangeMatch[0];
  
  const slashRangeMatch = clean.match(/\b\d{1,2}\/\d{2,4}\s*(?:-|\bto\b)\s*(?:\d{1,2}\/\d{2,4}|present|current|now)\b/i);
  if (slashRangeMatch) return slashRangeMatch[0];
  
  const presentMatch = clean.match(/\b(?:19|20)\d{2}\s*(?:-|\bto\b)?\s*(?:present|current|now)\b/i);
  if (presentMatch) return presentMatch[0];
  
  return null;
}

export function parseDateRange(text: string): { start: Date, end: Date, isAmbiguous: boolean } | null {
  const clean = text.replace(/–|—/g, '-');
  const parts = clean.split(/\s*(?:to|-|–|—|until)\s*/i);
  if (parts.length >= 2) {
    const start = parseDate(parts[0]);
    const end = parseDate(parts[1]);
    
    if (start && end) {
      return {
        start: new Date(start.year, start.month, 1),
        end: new Date(end.year, end.month, 1),
        isAmbiguous: false
      };
    }
  }
  
  const years = [...clean.matchAll(/\b(20\d{2}|19\d{2})\b/g)].map(m => parseInt(m[1], 10));
  const hasPresent = /\b(present|current|now)\b/i.test(clean);
  
  if (years.length >= 2) {
    return {
      start: new Date(years[0], 0, 1),
      end: new Date(years[1], 0, 1),
      isAmbiguous: false
    };
  } else if (years.length === 1 && hasPresent) {
    const now = new Date();
    return {
      start: new Date(years[0], 0, 1),
      end: now,
      isAmbiguous: false
    };
  }
  
  if (years.length === 1) {
    const year = years[0];
    const isSummer = /summer/i.test(clean);
    if (isSummer) {
      return {
        start: new Date(year, 5, 1),
        end: new Date(year, 8, 1),
        isAmbiguous: true
      };
    }
    return {
      start: new Date(year, 0, 1),
      end: new Date(year + 1, 0, 1),
      isAmbiguous: true
    };
  }
  
  return null;
}

export function calculateIntervalsDurationYears(intervals: Array<{ start: Date, end: Date }>): number {
  if (intervals.length === 0) return 0;
  
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Array<{ start: Date, end: Date }> = [];
  let current = { start: sorted[0].start, end: sorted[0].end };
  
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (next.start.getTime() <= current.end.getTime()) {
      if (next.end.getTime() > current.end.getTime()) {
        current.end = next.end;
      }
    } else {
      merged.push(current);
      current = { start: next.start, end: next.end };
    }
  }
  merged.push(current);
  
  let totalMs = 0;
  for (const interval of merged) {
    totalMs += (interval.end.getTime() - interval.start.getTime());
  }
  
  return totalMs / (1000 * 60 * 60 * 24 * 365.25);
}

export function isRoleRelevantToRequirement(factText: string, reqName: string): boolean {
  const factLower = factText.toLowerCase();
  const reqLower = reqName.toLowerCase();
  
  if (reqLower.includes('research')) {
    return /research|usability|ux|user\s+experience|hci|cognitive|design|product|interview/i.test(factLower) &&
           !/sales|barista|cashier|waiter|driver|delivery/i.test(factLower);
  }
  
  return true;
}
