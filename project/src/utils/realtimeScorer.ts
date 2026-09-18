export interface RealTimePillar {
  name: 'Impact' | 'Brevity' | 'Style' | 'Structure';
  score: number; // 0 - 25
  maxScore: 25;
  status: 'excellent' | 'good' | 'needs_work';
  feedback: string;
  actionableTip: string;
}

export interface RealTimeScoreReport {
  overallScore: number; // 0 - 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  pillars: {
    impact: RealTimePillar;
    brevity: RealTimePillar;
    style: RealTimePillar;
    structure: RealTimePillar;
  };
  metricsCount: number;
  totalBullets: number;
  wordCount: number;
  readingTimeMinutes: number;
  activeVoicePercentage: number;
  quickChecklist: Array<{ text: string; passed: boolean }>;
}

const METRIC_PATTERN = /(?:\b\d+(?:\.\d+)?(?:%|x|k|m|b|\+)?\b|\$\d+[\d,]*(?:\.\d+)?|\b(?:million|billion|thousand)\b)/i;
const FIRST_PERSON_PATTERN = /\b(?:i|me|my|we|our|us)\b/i;

const STRONG_ACTION_VERBS = new Set([
  'accelerated', 'achieved', 'adapted', 'administered', 'advised', 'amplified', 'analyzed',
  'architected', 'assembled', 'audited', 'authored', 'automated', 'boosted', 'built', 'calculated',
  'championed', 'coached', 'collaborated', 'compiled', 'composed', 'computed', 'conceptualized',
  'conducted', 'configured', 'consolidated', 'constructed', 'coordinated', 'crafted', 'created',
  'debugged', 'delivered', 'deployed', 'designed', 'developed', 'devised', 'directed', 'eliminated',
  'enabled', 'engineered', 'enhanced', 'ensured', 'established', 'evaluated', 'examined', 'executed',
  'expanded', 'expedited', 'formulated', 'founded', 'generated', 'governed', 'guided', 'implemented',
  'improved', 'increased', 'innovated', 'instituted', 'integrated', 'launched', 'led', 'managed',
  'maximized', 'mentored', 'mobilized', 'modernized', 'navigated', 'negotiated', 'optimized',
  'orchestrated', 'organized', 'originated', 'overhauled', 'oversaw', 'partnered', 'pioneered',
  'planned', 'produced', 'published', 'reduced', 'refactored', 'resolved', 'restructured', 'revamped',
  'scaled', 'secured', 'simplified', 'spearheaded', 'standardized', 'steered', 'streamlined',
  'strengthened', 'surpassed', 'trained', 'transformed', 'upgraded', 'validated', 'verified'
]);

export function calculateRealtimeScore(text: string): RealTimeScoreReport {
  if (!text || text.trim().length === 0) {
    const emptyPillar = (name: RealTimePillar['name'], tip: string): RealTimePillar => ({
      name,
      score: 0,
      maxScore: 25,
      status: 'needs_work',
      feedback: 'Waiting for resume text.',
      actionableTip: tip,
    });
    return {
      overallScore: 0,
      grade: 'D',
      pillars: {
        impact: emptyPillar('Impact', 'Add quantifiable achievements and metrics.'),
        brevity: emptyPillar('Brevity', 'Aim for 12-25 words per bullet point.'),
        style: emptyPillar('Style', 'Start each bullet with a power action verb.'),
        structure: emptyPillar('Structure', 'Include clear headings: Experience, Education, Skills.'),
      },
      metricsCount: 0,
      totalBullets: 0,
      wordCount: 0,
      readingTimeMinutes: 0,
      activeVoicePercentage: 0,
      quickChecklist: [],
    };
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const readingTimeMinutes = Math.max(0.5, Math.round((wordCount / 200) * 10) / 10);

  // Extract bullet points (lines starting with •, -, *, or numbered items, or lines under experience)
  const bullets = lines.filter(l => /^[•\-*]|\d+\.\s+/.test(l) || (l.length > 25 && l.length < 250 && !/^[A-Z\s]{3,30}$/.test(l)));
  const totalBullets = Math.max(1, bullets.length);

  // 1. IMPACT PILLAR (0-25)
  let quantifiedBulletsCount = 0;
  for (const b of bullets) {
    if (METRIC_PATTERN.test(b)) quantifiedBulletsCount++;
  }
  const impactRatio = quantifiedBulletsCount / totalBullets;
  let impactScore = 5;
  let impactFeedback = '';
  let impactTip = '';

  if (impactRatio >= 0.4) {
    impactScore = 24;
    impactFeedback = `Exceptional impact! ${Math.round(impactRatio * 100)}% of bullets include metrics or numbers.`;
    impactTip = 'Continue framing accomplishments using the X-Y-Z formula (Accomplished X, measured by Y, by doing Z).';
  } else if (impactRatio >= 0.25) {
    impactScore = 20;
    impactFeedback = `Good impact: ${Math.round(impactRatio * 100)}% of bullets are quantified.`;
    impactTip = 'Try adding numbers or percentages to 1-2 more bullets in your recent roles.';
  } else if (impactRatio >= 0.1) {
    impactScore = 13;
    impactFeedback = `Moderate impact (${Math.round(impactRatio * 100)}% quantified).`;
    impactTip = 'Recruiters favor measurable outcomes (e.g. "reduced load time by 35%", "managed $50k budget").';
  } else {
    impactScore = 6;
    impactFeedback = 'Low quantifiable impact. Most bullets describe duties rather than measurable results.';
    impactTip = 'Add metrics (percentages, dollar amounts, time saved, team sizes) to showcase your value.';
  }

  // 2. BREVITY PILLAR (0-25)
  let tooLongCount = 0;
  let tooShortCount = 0;
  let idealCount = 0;

  for (const b of bullets) {
    const bulletWords = b.split(/\s+/).length;
    if (bulletWords > 36) tooLongCount++;
    else if (bulletWords < 6) tooShortCount++;
    else if (bulletWords >= 12 && bulletWords <= 28) idealCount++;
  }

  let brevityScore = 18;
  let brevityFeedback = '';
  let brevityTip = '';

  if (tooLongCount === 0 && idealCount / totalBullets >= 0.6) {
    brevityScore = 24;
    brevityFeedback = 'Bullets are concise, punchy, and easy for recruiters to skim quickly.';
    brevityTip = 'Maintain concise 1-2 line bullets across all positions.';
  } else if (tooLongCount <= 2) {
    brevityScore = 20;
    brevityFeedback = 'Good conciseness across most bullet points.';
    brevityTip = tooLongCount > 0 ? `Condense ${tooLongCount} overly long run-on bullets into tighter sentences.` : 'Keep bullet length between 12-25 words.';
  } else {
    brevityScore = Math.min(24, Math.max(8, 25 - tooLongCount * 3 - tooShortCount * 2));
    brevityFeedback = `${tooLongCount} bullet points are over 36 words and may lose recruiter attention.`;
    brevityTip = 'Break lengthy multi-clause sentences into two separate focused achievements.';
  }

  // 3. STYLE PILLAR (0-25)
  let actionVerbStartCount = 0;
  let firstPersonFound = false;

  for (const b of bullets) {
    const cleanWords = b.replace(/^[•\-*\d.]+\s*/, '').trim().split(/\s+/);
    if (cleanWords.length > 0) {
      const firstWord = cleanWords[0].toLowerCase().replace(/[^a-z]/g, '');
      if (STRONG_ACTION_VERBS.has(firstWord)) actionVerbStartCount++;
    }
    if (FIRST_PERSON_PATTERN.test(b)) {
      firstPersonFound = true;
    }
  }

  // Check for bullet formatting inconsistency (mixing symbol bullets with plain-text paragraph descriptions)
  const symbolBulletCount = lines.filter(l => /^[•\-*]|\d+\.\s+/.test(l)).length;
  const plainParagraphCount = lines.filter(l => !/^[•\-*]|\d+\.\s+/.test(l) && l.length > 50 && !/^[A-Z\s]{3,30}$/.test(l) && !/:$/.test(l)).length;
  const hasInconsistentBullets = symbolBulletCount >= 2 && plainParagraphCount >= 2;

  const activeVoiceRatio = actionVerbStartCount / totalBullets;
  let styleScore = 18;
  let styleFeedback = '';
  let styleTip = '';

  if (activeVoiceRatio >= 0.55 && !firstPersonFound) {
    styleScore = 24;
    styleFeedback = `Excellent executive style! ${Math.round(activeVoiceRatio * 100)}% of bullets start with strong power verbs.`;
    styleTip = 'Tone is authoritative, active, and free of first-person pronouns.';
  } else if (activeVoiceRatio >= 0.35) {
    styleScore = firstPersonFound ? 16 : 20;
    styleFeedback = `${Math.round(activeVoiceRatio * 100)}% of bullets begin with action verbs.`;
    styleTip = firstPersonFound
      ? 'Remove first-person pronouns ("I", "my", "we") — resumes should use implied first-person.'
      : 'Swap passive openings ("helped with", "responsible for") for dynamic action verbs.';
  } else {
    styleScore = firstPersonFound ? 10 : 13;
    styleFeedback = 'Many bullets begin with passive phrasing or duties.';
    styleTip = 'Start every bullet with a power verb like "Architected", "Spearheaded", or "Streamlined".';
  }

  // Penalize heavily for inconsistent bullet formatting (e.g. bullets in some sections, plain paragraphs in others)
  if (hasInconsistentBullets) {
    styleScore = Math.max(8, styleScore - 5);
    styleFeedback += ' Inconsistent bullet styling detected: some roles use bullet characters while others use plain paragraphs.';
    styleTip = 'Standardize bullet formatting: use round bullet points (•) consistently across all roles.';
  }

  // 4. STRUCTURE PILLAR (0-25)
  const lowerText = text.toLowerCase();
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text);
  const hasPhone = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(text);
  const hasExpHeading = /\b(experience|work history|employment|professional experience and projects)\b/.test(lowerText);
  const hasEduHeading = /\b(education|academic|degree)\b/.test(lowerText);
  const hasSkillsHeading = /\b(skills|technical skills|technologies)\b/.test(lowerText);

  let structurePoints = 0;
  if (hasEmail) structurePoints += 5;
  if (hasPhone) structurePoints += 5;
  if (hasExpHeading) structurePoints += 5;
  if (hasEduHeading) structurePoints += 5;
  if (hasSkillsHeading) structurePoints += 4; // Max allowable is 24/25 per category rule

  let structureFeedback = '';
  let structureTip = '';

  if (structurePoints >= 24) {
    structureFeedback = 'All essential sections and contact channels are present and well-structured.';
    structureTip = 'Your resume follows the standard hierarchy recognized by all enterprise ATS engines.';
  } else if (structurePoints >= 19) {
    structureFeedback = 'Good standard document hierarchy.';
    structureTip = !hasPhone ? 'Add a contact phone number.' : !hasSkillsHeading ? 'Add a dedicated Skills section.' : 'Maintain clear uppercase headings.';
  } else {
    structureFeedback = 'Missing key resume sections or contact information.';
    structureTip = 'Ensure your resume includes Contact Info, Experience, Education, and Skills.';
  }

  // Crucial Rule: Maximum allowable score for any category is 24/25
  impactScore = Math.min(24, Math.max(0, impactScore));
  brevityScore = Math.min(24, Math.max(0, brevityScore));
  styleScore = Math.min(24, Math.max(0, styleScore));
  structurePoints = Math.min(24, Math.max(0, structurePoints));

  const overallScore = Math.min(100, Math.max(15, impactScore + brevityScore + styleScore + structurePoints));

  let grade: RealTimeScoreReport['grade'] = 'C';
  if (overallScore >= 90) grade = 'A+';
  else if (overallScore >= 80) grade = 'A';
  else if (overallScore >= 68) grade = 'B';
  else if (overallScore >= 52) grade = 'C';
  else grade = 'D';

  const determineStatus = (score: number): RealTimePillar['status'] => {
    if (score >= 22) return 'excellent';
    if (score >= 16) return 'good';
    return 'needs_work';
  };

  const quickChecklist = [
    { text: 'Quantified metrics in key achievements', passed: impactRatio >= 0.25 },
    { text: 'Concise bullet points (12-28 words)', passed: tooLongCount <= 1 },
    { text: 'Strong power verbs start each bullet', passed: activeVoiceRatio >= 0.4 },
    { text: 'No first-person pronouns ("I", "my")', passed: !firstPersonFound },
    { text: 'Contact email & phone in document body', passed: hasEmail && hasPhone },
    { text: 'Standard ATS headings (Experience, Education, Skills)', passed: hasExpHeading && hasEduHeading && hasSkillsHeading },
  ];

  return {
    overallScore,
    grade,
    pillars: {
      impact: {
        name: 'Impact',
        score: impactScore,
        maxScore: 25,
        status: determineStatus(impactScore),
        feedback: impactFeedback,
        actionableTip: impactTip,
      },
      brevity: {
        name: 'Brevity',
        score: brevityScore,
        maxScore: 25,
        status: determineStatus(brevityScore),
        feedback: brevityFeedback,
        actionableTip: brevityTip,
      },
      style: {
        name: 'Style',
        score: styleScore,
        maxScore: 25,
        status: determineStatus(styleScore),
        feedback: styleFeedback,
        actionableTip: styleTip,
      },
      structure: {
        name: 'Structure',
        score: structurePoints,
        maxScore: 25,
        status: determineStatus(structurePoints),
        feedback: structureFeedback,
        actionableTip: structureTip,
      },
    },
    metricsCount: quantifiedBulletsCount,
    totalBullets,
    wordCount,
    readingTimeMinutes,
    activeVoicePercentage: Math.round(activeVoiceRatio * 100),
    quickChecklist,
  };
}
