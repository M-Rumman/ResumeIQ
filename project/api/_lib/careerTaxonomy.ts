/**
 * Stable internal career taxonomy used to organize candidate profiles and job
 * search intent. It deliberately models role families and domains, rather than
 * treating every extracted keyword as a career identity.
 */
export type CareerTaxonomyNode = {
  id: string;
  label: string;
  parentId?: string;
  aliases: string[];
};

export type CareerTaxonomyMembership = {
  primary_path: string[];
  related_domains: string[];
  confidence: number;
  evidence: string[];
};

export const CAREER_TAXONOMY: CareerTaxonomyNode[] = [
  { id: 'engineering', label: 'Engineering and Technology', aliases: ['engineering', 'technology'] },
  { id: 'mechatronics', label: 'Mechatronics Engineering', parentId: 'engineering', aliases: ['mechatronics'] },
  { id: 'robotics', label: 'Robotics', parentId: 'mechatronics', aliases: ['robotics', 'robot', 'autonomous vehicle', 'autonomous robot'] },
  { id: 'automation', label: 'Automation', parentId: 'mechatronics', aliases: ['automation', 'plc', 'industrial automation'] },
  { id: 'embedded', label: 'Embedded Systems', parentId: 'mechatronics', aliases: ['embedded', 'firmware', 'microcontroller', 'arduino', 'stm32', 'esp32'] },
  { id: 'control-systems', label: 'Control Systems', parentId: 'mechatronics', aliases: ['control systems', 'pid', 'state space'] },
  { id: 'manufacturing', label: 'Manufacturing', parentId: 'engineering', aliases: ['manufacturing', 'production', 'quality engineering'] },
  { id: 'industrial-engineering', label: 'Industrial Engineering', parentId: 'engineering', aliases: ['industrial engineering', 'operations research', 'lean manufacturing'] },
  { id: 'mechanical', label: 'Mechanical Engineering', parentId: 'engineering', aliases: ['mechanical engineering', 'solidworks', 'cad', 'fea'] },
  { id: 'electrical', label: 'Electrical Engineering', parentId: 'engineering', aliases: ['electrical engineering', 'electronics', 'circuit design', 'pcb'] },
  { id: 'computer-science', label: 'Computer Science', parentId: 'engineering', aliases: ['computer science', 'software development', 'algorithms'] },
  { id: 'cybersecurity', label: 'Cybersecurity', parentId: 'engineering', aliases: ['cybersecurity', 'information security', 'siem'] },

  { id: 'business', label: 'Business and Professional Services', aliases: ['business', 'professional services'] },
  { id: 'finance', label: 'Finance', parentId: 'business', aliases: ['finance', 'financial modeling', 'valuation'] },
  { id: 'accounting', label: 'Accounting', parentId: 'business', aliases: ['accounting', 'audit', 'tax'] },
  { id: 'marketing', label: 'Marketing', parentId: 'business', aliases: ['marketing', 'seo', 'content strategy'] },
  { id: 'human-resources', label: 'Human Resources', parentId: 'business', aliases: ['human resources', 'recruitment', 'talent acquisition'] },
  { id: 'sales', label: 'Sales', parentId: 'business', aliases: ['sales', 'business development', 'account management'] },
  { id: 'law', label: 'Law', parentId: 'business', aliases: ['law', 'legal research', 'litigation'] },

  { id: 'life-sciences', label: 'Life Sciences and Healthcare', aliases: ['life sciences', 'healthcare'] },
  { id: 'healthcare', label: 'Healthcare', parentId: 'life-sciences', aliases: ['healthcare', 'clinical', 'patient care'] },
  { id: 'marine-biology', label: 'Marine Biology', parentId: 'life-sciences', aliases: ['marine biology', 'marine science', 'oceanography'] },
  { id: 'education', label: 'Education', aliases: ['education', 'teaching', 'curriculum'] },
  { id: 'construction', label: 'Construction Management', aliases: ['construction management', 'quantity surveying', 'site engineering'] },
  { id: 'general-professional', label: 'General Professional', aliases: ['general professional'] },
];

const normalized = (value: string) => ` ${String(value || '').toLowerCase().replace(/[^a-z0-9+#]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
const includesAlias = (source: string, alias: string) => normalized(source).includes(normalized(alias));
const pathFor = (node: CareerTaxonomyNode): string[] => {
  const path = [node.label];
  let parent = node.parentId ? CAREER_TAXONOMY.find((candidate) => candidate.id === node.parentId) : undefined;
  while (parent !== undefined) {
    path.unshift(parent.label);
    const parentId = parent.parentId;
    parent = parentId ? CAREER_TAXONOMY.find((candidate) => candidate.id === parentId) : undefined;
  }
  return path;
};

export function classifyCareerTaxonomy(primaryDomain: string, secondaryDomains: string[], evidence: string[]): CareerTaxonomyMembership {
  const source = [primaryDomain, ...secondaryDomains, ...evidence].join(' ');
  const scored = CAREER_TAXONOMY.map((node) => ({
    node,
    matches: node.aliases.filter((alias) => includesAlias(source, alias)),
  })).filter((item) => item.matches.length);
  const preferred = scored.find((item) => normalized(item.node.label) === normalized(primaryDomain))
    || scored.sort((left, right) => right.matches.length - left.matches.length)[0]
    || { node: CAREER_TAXONOMY.find((node) => node.id === 'general-professional')!, matches: [] as string[] };
  const related = scored
    .filter((item) => item.node.id !== preferred.node.id && item.node.parentId !== undefined)
    .sort((left, right) => right.matches.length - left.matches.length)
    .slice(0, 6)
    .map((item) => item.node.label);
  const matchedEvidence = [...new Set(preferred.matches)].slice(0, 5);
  return {
    primary_path: pathFor(preferred.node),
    related_domains: related,
    confidence: preferred.node.id === 'general-professional' ? 25 : Math.min(100, 65 + matchedEvidence.length * 10),
    evidence: matchedEvidence,
  };
}
