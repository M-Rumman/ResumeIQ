const GENERIC_BULLET_OPENERS = new Set([
  'assisted', 'helped', 'participated', 'responsible', 'supported', 'worked',
]);

function firstWord(text) {
  return text.trim().match(/[A-Za-z]+/)?.[0]?.toLowerCase() || '';
}

function hasQuantification(text) {
  return /(?:\b\d+(?:\.\d+)?(?:%|x)?\b|\[x\]\s*(?:%|users|components|requests))/i.test(text);
}

function containsTerm(text, term) {
  const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i').test(text);
}

function buildDetailedBulletTeachingGuide(
  { before, after },
  targetKeywords,
) {
  const targetTerms = targetKeywords.filter((term) => containsTerm(after, term) && !containsTerm(before, term));
  const purpose = after.match(/\bto\s+([^.;]+)/i)?.[1]?.trim();
  const genericOpening = GENERIC_BULLET_OPENERS.has(firstWord(before));

  const whyStronger = [
    `Makes ownership explicit with the action “${firstWord(after).replace(/^./, (letter) => letter.toUpperCase())}.”`,
    targetTerms.length
      ? `Adds resume-supported professional context: ${targetTerms.slice(0, 3).join(', ')}.`
      : 'Makes the documented work easier for a recruiter to understand.',
    purpose
      ? `Clarifies the professional objective: ${purpose}.`
      : 'Uses a clearer action-to-contribution structure without adding unsupported results.',
    targetTerms.length
      ? `Improves alignment with this role through supported job terminology: ${targetTerms.slice(0, 2).join(', ')}.`
      : `Makes the documented work easier to evaluate against this role's stated requirements without adding unsupported job terminology.`,
  ];
  return { whyStronger, targetTerms, purpose };
}

const guide1 = buildDetailedBulletTeachingGuide(
  {
    before: 'Worked on the backend API',
    after: 'Developed the backend REST API in Node.js to improve response times by 20%',
  },
  ['REST API', 'Node.js']
);
console.log(1, guide1);

const guide3 = buildDetailedBulletTeachingGuide(
  {
    before: 'Responsible for B2B sales in the region',
    after: 'Managed B2B sales pipeline for the region to exceed quarterly quotas by 15%',
  },
  ['B2B sales pipeline', 'Quotas']
);
console.log(3, guide3);
