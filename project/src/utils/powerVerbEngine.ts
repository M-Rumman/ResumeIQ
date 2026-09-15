export interface PowerVerbCategory {
  name: string;
  description: string;
  verbs: string[];
}

export interface WeakPhraseMatch {
  id: string;
  foundText: string;
  startIndex: number;
  endIndex: number;
  sentence: string;
  recommendedVerbs: string[];
  suggestedRewritePreview: string;
}

export const POWER_VERB_TAXONOMY: PowerVerbCategory[] = [
  {
    name: 'Leadership & Strategy',
    description: 'When guiding teams, driving strategic vision, or owning high-stakes outcomes.',
    verbs: ['Spearheaded', 'Orchestrated', 'Mobilized', 'Directed', 'Championed', 'Steered', 'Governed', 'Instituted', 'Fostered', 'Commanded']
  },
  {
    name: 'Engineering & Innovation',
    description: 'When creating technical systems, inventing tools, or implementing architecture.',
    verbs: ['Architected', 'Engineered', 'Pioneered', 'Formulated', 'Deployed', 'Constructed', 'Refactored', 'Automated', 'Devised', 'Configured']
  },
  {
    name: 'Optimization & Efficiency',
    description: 'When cutting waste, speeding up processes, or improving existing systems.',
    verbs: ['Streamlined', 'Accelerated', 'Overhauled', 'Consolidated', 'Standardized', 'Eliminated', 'Maximized', 'Revamped', 'Expedited', 'Restructured']
  },
  {
    name: 'Growth & Business Impact',
    description: 'When increasing revenue, scaling users, boosting adoption, or expanding market reach.',
    verbs: ['Amplified', 'Surpassed', 'Outperformed', 'Scaled', 'Generated', 'Expanded', 'Captured', 'Boosted', 'Elevated', 'Delivered']
  },
  {
    name: 'Collaboration & Negotiation',
    description: 'When aligning stakeholders, closing deals, managing partners, or mediating.',
    verbs: ['Negotiated', 'Facilitated', 'Aligned', 'Partnered', 'Advocated', 'Co-developed', 'Arbitrated', 'Brokered', 'Mobilized', 'Unified']
  }
];

export const WEAK_PHRASES_MAP: Array<{
  pattern: RegExp;
  label: string;
  recommended: string[];
}> = [
  {
    pattern: /\b(?:helped\s+with|helped\s+to|helped)\b/gi,
    label: 'helped with',
    recommended: ['Facilitated', 'Orchestrated', 'Collaborated to execute', 'Streamlined', 'Championed']
  },
  {
    pattern: /\b(?:responsible\s+for(?:\s+the)?|was\s+responsible\s+for)\b/gi,
    label: 'responsible for',
    recommended: ['Directed', 'Spearheaded', 'Governed', 'Oversaw', 'Managed execution of']
  },
  {
    pattern: /\b(?:worked\s+on|worked\s+with)\b/gi,
    label: 'worked on',
    recommended: ['Engineered', 'Architected', 'Developed', 'Executed', 'Refactored']
  },
  {
    pattern: /\b(?:duties\s+included|tasks\s+included)\b/gi,
    label: 'duties included',
    recommended: ['Led', 'Owned', 'Executed', 'Delivered', 'Instituted']
  },
  {
    pattern: /\b(?:assisted\s+with|assisted\s+in|assisted)\b/gi,
    label: 'assisted with',
    recommended: ['Partnered with', 'Supported execution of', 'Facilitated', 'Contributed directly to']
  },
  {
    pattern: /\b(?:handled|handled\s+all)\b/gi,
    label: 'handled',
    recommended: ['Resolved', 'Administered', 'Managed', 'Negotiated', 'Dispatched']
  },
  {
    pattern: /\b(?:participated\s+in)\b/gi,
    label: 'participated in',
    recommended: ['Contributed to', 'Co-designed', 'Co-authored', 'Executed']
  },
  {
    pattern: /\b(?:did|made)\b/gi,
    label: 'did / made',
    recommended: ['Produced', 'Constructed', 'Authored', 'Formulated', 'Engineered']
  },
  {
    pattern: /\b(?:was\s+involved\s+in)\b/gi,
    label: 'was involved in',
    recommended: ['Engaged in', 'Coordinated', 'Implemented', 'Drove']
  }
];

export function findWeakPhrases(text: string): WeakPhraseMatch[] {
  const matches: WeakPhraseMatch[] = [];
  const lines = text.split('\n');
  let currentOffset = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    
    for (const rule of WEAK_PHRASES_MAP) {
      rule.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      
      while ((match = rule.pattern.exec(line)) !== null) {
        const found = match[0];
        const startIndex = currentOffset + match.index;
        const endIndex = startIndex + found.length;
        
        // Generate rewrite preview
        const firstRecommendation = rule.recommended[0];
        let preview = line.slice(0, match.index) + firstRecommendation + line.slice(match.index + found.length);
        // Capitalize line if replaced at beginning
        if (match.index === 0 || /^[•\-*\s]+$/.test(line.slice(0, match.index))) {
          const trimmedLead = line.slice(0, match.index);
          preview = trimmedLead + firstRecommendation + line.slice(match.index + found.length);
        }

        matches.push({
          id: `weak_${lineIndex}_${match.index}`,
          foundText: found,
          startIndex,
          endIndex,
          sentence: line.trim(),
          recommendedVerbs: rule.recommended,
          suggestedRewritePreview: preview.trim(),
        });
      }
    }

    currentOffset += line.length + 1; // +1 for newline
  }

  return matches;
}

export function replaceWeakPhrase(
  fullText: string,
  startIndex: number,
  endIndex: number,
  replacement: string
): string {
  const before = fullText.slice(0, startIndex);
  const after = fullText.slice(endIndex);

  // If the replaced word is the start of a sentence or bullet, capitalize replacement
  let adjustedReplacement = replacement;
  const isStart = startIndex === 0 || /[\n.•\-*]\s*$/.test(before);
  if (isStart) {
    adjustedReplacement = replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }

  return before + adjustedReplacement + after;
}
