const PROGRAMMING_LANGUAGES = new Set([
  'assembly', 'bash', 'c', 'c#', 'c++', 'css', 'dart', 'go', 'java', 'javascript', 'kotlin', 'matlab',
  'php', 'python', 'r', 'ruby', 'rust', 'scala', 'sql', 'swift', 'typescript',
]);

const FRAMEWORKS_AND_CORE_TECH = new Set([
  'angular', 'arduino', 'aws', 'azure', 'django', 'docker', 'fastapi', 'firmware development', 'flask', 'pcb testing',
  'google cloud', 'kubernetes', 'node js', 'postgresql', 'react', 'ros', 'spring', 'stm32', 'tensorflow',
  'vue',
]);

const MEDIUM_PRIORITY = new Set([
  'circuit validation', 'embedded linux', 'esp32', 'hardware testing', 'ltspice', 'proteus',
  'raspberry pi', 'sensor integration', 'solidworks', 'simulink', 'simulation software',
]);

const LOW_PRIORITY = new Set([
  'communication', 'documentation', 'technical documentation', 'teamwork', 'written communication',
]);

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function countOccurrences(text: string, skill: string): number {
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return (text.match(new RegExp(`\\b${escaped}\\b`, 'gi')) || []).length;
}

function appearsRequired(jobDescription: string, skill: string): boolean {
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const requiredContext = '(?:required|must have|mandatory|essential|minimum qualifications?|core requirements?)';
  return new RegExp(`${requiredContext}[\\s\\S]{0,180}\\b${escaped}\\b|\\b${escaped}\\b[\\s\\S]{0,100}${requiredContext}`, 'i')
    .test(jobDescription);
}

function categoryWeight(skill: string): number {
  const normalized = normalize(skill);
  if (LOW_PRIORITY.has(normalized)) return 10;
  if (MEDIUM_PRIORITY.has(normalized)) return 50;
  if (PROGRAMMING_LANGUAGES.has(normalized) || FRAMEWORKS_AND_CORE_TECH.has(normalized)) return 100;
  return 75;
}

function rankSkill(skill: string, jobDescription: string): number {
  const normalizedJob = jobDescription.toLowerCase();
  const occurrences = countOccurrences(normalizedJob, normalize(skill));
  return categoryWeight(skill) + (appearsRequired(jobDescription, normalize(skill)) ? 40 : 0) + Math.min(occurrences, 5) * 5;
}

/** Orders existing missing-skill fields by job-description importance without changing their schema. */
export function rankMissingSkills(raw: Record<string, any>, jobDescription: string): Record<string, any> {
  const output = { ...raw };
  const fields = ['missingSkills', 'missingKeywords', 'keywordSuggestions', 'keywordGaps', 'missingRequiredSkills'];

  for (const field of fields) {
    if (!Array.isArray(output[field])) continue;
    output[field] = [...output[field]]
      .filter((skill): skill is string => typeof skill === 'string')
      .sort((left, right) => {
        const scoreDifference = rankSkill(right, jobDescription) - rankSkill(left, jobDescription);
        return scoreDifference || left.localeCompare(right);
      });
  }

  return output;
}
