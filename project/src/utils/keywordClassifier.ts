export interface ClassifiedKeyword {
  term: string;
  category: 'hard_skill' | 'soft_skill' | 'credential';
  categoryLabel: string;
  status: 'matched' | 'missing' | 'under_expressed';
  occurrencesInJd: number;
  occurrencesInResume: number;
  importance: 'high' | 'medium' | 'bonus';
  recommendation: string;
}

export interface KeywordAnalysisReport {
  overallMatchScore: number;
  hardSkills: {
    items: ClassifiedKeyword[];
    matchedCount: number;
    totalCount: number;
    percentage: number;
  };
  softSkills: {
    items: ClassifiedKeyword[];
    matchedCount: number;
    totalCount: number;
    percentage: number;
  };
  credentials: {
    items: ClassifiedKeyword[];
    matchedCount: number;
    totalCount: number;
    percentage: number;
  };
  topMissingKeywords: ClassifiedKeyword[];
}

// Curated taxonomy for high accuracy categorization
const CREDENTIAL_PATTERNS = [
  /\b(?:bachelor'?s?|master'?s?|ph\.?d|b\.?s\.?|m\.?s\.?|b\.?a\.?|m\.?b\.?a|associate'?s?)\b/i,
  /\b(?:pmp|cpa|cfa|cissp|cism|ceh|aws certified|azure certified|gcp certified|scrum master|csm|psm|safe|prince2|comptia|ccna|ccnp)\b/i,
  /\b(?:certified|certification|licensed|license|accredited)\b/i,
];

const SOFT_SKILL_PATTERNS = [
  /\b(?:agile|scrum|kanban|waterfall|sprint planning)\b/i,
  /\b(?:communication|written communication|verbal communication|presentation skills|public speaking)\b/i,
  /\b(?:leadership|team leadership|cross-functional leadership|people management|mentorship|coaching)\b/i,
  /\b(?:collaboration|teamwork|cross-functional collaboration|partnering)\b/i,
  /\b(?:problem[- ]solving|critical thinking|analytical thinking|decision making)\b/i,
  /\b(?:stakeholder management|client management|customer facing|relationship building)\b/i,
  /\b(?:time management|organization|prioritization|adaptability|flexibility|resilience)\b/i,
  /\b(?:conflict resolution|negotiation|strategic thinking|growth mindset)\b/i,
];

const KNOWN_HARD_SKILLS = new Set([
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'golang', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin',
  'react', 'next.js', 'vue', 'angular', 'svelte', 'node.js', 'express', 'django', 'fastapi', 'spring boot', 'flask',
  'html', 'css', 'tailwind', 'sass', 'bootstrap', 'graphql', 'rest api', 'grpc', 'microservices',
  'aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'terraform', 'ci/cd', 'github actions', 'jenkins',
  'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb', 'snowflake', 'databricks',
  'git', 'linux', 'unix', 'figma', 'jira', 'confluence', 'tableau', 'power bi', 'excel',
  'machine learning', 'deep learning', 'pytorch', 'tensorflow', 'nlp', 'computer vision', 'pandas', 'numpy',
  'cybersecurity', 'penetration testing', 'siem', 'soc', 'firewalls', 'encryption', 'api security'
]);

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countOccurrences(text: string, term: string): number {
  const normalized = text.toLowerCase();
  const escaped = escapeRegex(term.toLowerCase());
  const regex = new RegExp(`(?:^|[^a-z0-9+#.-])${escaped}(?=$|[^a-z0-9+#.-])`, 'gi');
  const matches = normalized.match(regex);
  return matches ? matches.length : 0;
}

export function classifyKeyword(rawTerm: string): 'hard_skill' | 'soft_skill' | 'credential' {
  const termLower = rawTerm.trim().toLowerCase();

  for (const pattern of CREDENTIAL_PATTERNS) {
    if (pattern.test(termLower)) return 'credential';
  }

  for (const pattern of SOFT_SKILL_PATTERNS) {
    if (pattern.test(termLower)) return 'soft_skill';
  }

  if (KNOWN_HARD_SKILLS.has(termLower)) return 'hard_skill';

  // Heuristic fallbacks
  if (/degree|bachelor|master|certif|license|exam|accredit/i.test(termLower)) {
    return 'credential';
  }
  if (/communication|lead|manage|collab|culture|interpersonal|think|organi|agile|scrum/i.test(termLower)) {
    return 'soft_skill';
  }

  return 'hard_skill';
}

export function extractAndClassifyKeywords(jdText: string, resumeText: string): KeywordAnalysisReport {
  if (!jdText.trim()) {
    return {
      overallMatchScore: 0,
      hardSkills: { items: [], matchedCount: 0, totalCount: 0, percentage: 0 },
      softSkills: { items: [], matchedCount: 0, totalCount: 0, percentage: 0 },
      credentials: { items: [], matchedCount: 0, totalCount: 0, percentage: 0 },
      topMissingKeywords: [],
    };
  }

  const jdLower = jdText.toLowerCase();
  const rawCandidateTerms = new Set<string>();

  // 1. Scan for known hard skills
  for (const skill of KNOWN_HARD_SKILLS) {
    if (countOccurrences(jdLower, skill) > 0) {
      rawCandidateTerms.add(skill);
    }
  }

  // 2. Scan for credentials
  const credentialTerms = [
    "Bachelor's Degree", "Master's Degree", "PhD", "PMP Certification", "AWS Certified",
    "Azure Certified", "GCP Certified", "Scrum Master (CSM)", "CPA", "CISSP", "Security+ Certification"
  ];
  for (const cred of credentialTerms) {
    if (new RegExp(escapeRegex(cred.split(' ')[0]), 'i').test(jdLower)) {
      rawCandidateTerms.add(cred);
    }
  }

  // 3. Scan for soft skills & methodologies
  const softTerms = [
    "Agile / Scrum", "Cross-Functional Collaboration", "Problem Solving", "Stakeholder Management",
    "Written & Verbal Communication", "Team Leadership", "Strategic Planning", "Mentorship & Coaching"
  ];
  for (const soft of softTerms) {
    const keyPart = soft.split('/')[0].split('&')[0].trim();
    if (countOccurrences(jdLower, keyPart) > 0) {
      rawCandidateTerms.add(soft);
    }
  }

  // 4. Also scan for capitalized noun chunks or high-frequency job keywords in JD
  const lines = jdText.split('\n');
  for (const line of lines) {
    const requirementMatch = line.match(/(?:experience with|proficiency in|knowledge of|hands-on with|skills in)\s+([A-Za-z0-9+#.-]+(?:\s+[A-Za-z0-9+#.-]+){0,2})/i);
    if (requirementMatch && requirementMatch[1]) {
      const candidate = requirementMatch[1].trim();
      if (candidate.length > 2 && !/^(the|a|an|any|all|our|your)$/i.test(candidate)) {
        rawCandidateTerms.add(candidate);
      }
    }
  }

  const classifiedItems: ClassifiedKeyword[] = [];

  for (const term of rawCandidateTerms) {
    const category = classifyKeyword(term);
    const categoryLabel = category === 'hard_skill' ? 'Hard Skill' : category === 'soft_skill' ? 'Soft Skill' : 'Credential';
    const jdOccurrences = Math.max(1, countOccurrences(jdText, term));
    const resumeOccurrences = countOccurrences(resumeText, term);

    let status: ClassifiedKeyword['status'] = 'missing';
    if (resumeOccurrences >= 2) {
      status = 'matched';
    } else if (resumeOccurrences === 1) {
      status = 'under_expressed';
    } else {
      status = 'missing';
    }

    const importance: ClassifiedKeyword['importance'] = jdOccurrences >= 3 ? 'high' : jdOccurrences === 2 ? 'medium' : 'bonus';

    let recommendation = '';
    if (status === 'missing') {
      recommendation = `Add ${term} to your Skills section and incorporate evidence in at least one bullet point.`;
    } else if (status === 'under_expressed') {
      recommendation = `${term} is mentioned once. Add quantifiable context or outcomes demonstrating this skill.`;
    } else {
      recommendation = `Well-represented in your resume (${resumeOccurrences} occurrences).`;
    }

    classifiedItems.push({
      term: term.charAt(0).toUpperCase() + term.slice(1),
      category,
      categoryLabel,
      status,
      occurrencesInJd: jdOccurrences,
      occurrencesInResume: resumeOccurrences,
      importance,
      recommendation,
    });
  }

  // Group by categories
  const hardSkillsList = classifiedItems.filter(i => i.category === 'hard_skill');
  const softSkillsList = classifiedItems.filter(i => i.category === 'soft_skill');
  const credentialsList = classifiedItems.filter(i => i.category === 'credential');

  const calcStats = (items: ClassifiedKeyword[]) => {
    if (items.length === 0) return { matchedCount: 0, totalCount: 0, percentage: 100 };
    const matched = items.filter(i => i.status === 'matched' || i.status === 'under_expressed').length;
    return {
      matchedCount: matched,
      totalCount: items.length,
      percentage: Math.round((matched / items.length) * 100),
    };
  };

  const hardStats = calcStats(hardSkillsList);
  const softStats = calcStats(softSkillsList);
  const credStats = calcStats(credentialsList);

  const totalPossible = classifiedItems.length;
  const totalMatched = classifiedItems.filter(i => i.status === 'matched').length * 1 + classifiedItems.filter(i => i.status === 'under_expressed').length * 0.6;
  const overallScore = totalPossible > 0 ? Math.round((totalMatched / totalPossible) * 100) : 0;

  const topMissing = classifiedItems
    .filter(i => i.status === 'missing')
    .sort((a, b) => b.occurrencesInJd - a.occurrencesInJd)
    .slice(0, 10);

  return {
    overallMatchScore: overallScore,
    hardSkills: {
      items: hardSkillsList,
      ...hardStats,
    },
    softSkills: {
      items: softSkillsList,
      ...softStats,
    },
    credentials: {
      items: credentialsList,
      ...credStats,
    },
    topMissingKeywords: topMissing,
  };
}
