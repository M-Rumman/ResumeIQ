import { parseResumeText, type StructuredResume } from '../resumeParser.js';
import type { CandidateProfile, CandidateFact } from './types.js';
import { randomUUID } from 'node:crypto';

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
      id: randomUUID(),
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
      id: randomUUID(),
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
      id: randomUUID(),
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
      id: randomUUID(),
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

  // Extract summary
  if (structuredResume.summary) {
    facts.push({
      id: randomUUID(),
      type: 'other',
      normalizedName: 'Summary',
      rawText: structuredResume.summary,
      sourceSection: 'summary',
      sectionInferred: false,
      evidence: structuredResume.summary
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

export function parseExperienceDuration(text: string): number {
  // Simple heuristic: look for years (e.g. 2018 - 2021)
  const matches = [...text.matchAll(/\b(19\d{2}|20\d{2}|present|current)\b/gi)];
  if (matches.length < 2) return 0;
  
  let totalYears = 0;
  for (let i = 0; i < matches.length - 1; i += 2) {
    const startStr = matches[i][1].toLowerCase();
    const endStr = matches[i+1][1].toLowerCase();
    
    const startYear = parseInt(startStr, 10);
    const endYear = (endStr === 'present' || endStr === 'current') ? new Date().getFullYear() : parseInt(endStr, 10);
    
    if (!isNaN(startYear) && !isNaN(endYear) && endYear >= startYear) {
      totalYears += (endYear - startYear);
    }
  }
  return totalYears;
}
