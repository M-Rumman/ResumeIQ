import type { CandidateProfile, JobProfile, MatchingResult, EvaluationResult, AtsDisplayBreakdownItem, MatchClassification, JobRequirement } from './types.js';

function getRequirementWeight(req: JobRequirement): number {
  const isCore = ['experience', 'education', 'domain', 'responsibility', 'seniority', 'years', 'location'].includes(req.category);
  
  if (req.priority === 'required') {
    return isCore ? 1.0 : 0.8;
  } else if (req.priority === 'preferred') {
    return isCore ? 0.5 : 0.3;
  } else {
    return 0.1; // nice_to_have or other
  }
}

function getMatchContribution(classification: MatchClassification): number {
  switch (classification) {
    case 'EXACT_MATCH': return 1.0;
    case 'STRONG_SEMANTIC_MATCH': return 0.85;
    case 'PARTIAL_MATCH': return 0.5;
    case 'RELATED_MATCH':
    case 'UNDER_EXPRESSED': return 0.25;
    case 'MISSING': return 0.0;
    default: return 0.0;
  }
}

export function evaluateScores(job: JobProfile, candidate: CandidateProfile, matchingResult: MatchingResult): EvaluationResult {
  // 1. Job Match Scoring (Mathematically calculated from requirements)
  let totalMaxScore = 0;
  let totalAchievedScore = 0;
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  for (const match of matchingResult.matches) {
    const weight = getRequirementWeight(match.requirement);
    const contribution = getMatchContribution(match.classification);
    const confidence = match.confidence > 0 ? match.confidence : 1.0;
    
    const maxPoints = weight * 10;
    const achievedPoints = maxPoints * contribution * confidence;

    totalMaxScore += maxPoints;
    totalAchievedScore += achievedPoints;

    if (contribution >= 0.85) {
      strengths.push(`Matched ${match.requirement.category}: ${match.requirement.normalized_name}`);
    } else if (contribution > 0 && contribution < 0.85) {
      weaknesses.push(`Partial match for ${match.requirement.category}: ${match.requirement.normalized_name}`);
    } else if (contribution === 0 && match.requirement.priority === 'required') {
      weaknesses.push(`Missing required ${match.requirement.category}: ${match.requirement.normalized_name}`);
    }
  }

  const matchScore = totalMaxScore > 0 ? Math.round((totalAchievedScore / totalMaxScore) * 100) : 100;

  // 2. ATS Formatting & Parsing Health (Completely Decoupled from Job Match)
  
  // A. Section Recognition
  const expectedSections = ['summary', 'experience', 'projects', 'skills', 'education'] as const;
  let structureScore = 25;
  const structureReasons: string[] = [];
  
  for (const section of expectedSections) {
    const s = candidate.rawStructure[section];
    if (!(Array.isArray(s) ? s.length > 0 : !!s)) {
      structureScore -= 5;
      structureReasons.push(`Missing or unparseable section: ${section}`);
    }
  }
  if (structureReasons.length === 0) structureReasons.push('Standard resume structure detected.');

  // B. Readability & Formatting
  let readabilityScore = 25;
  const readabilityReasons: string[] = [];
  
  // Check for mojibake or weird bullet artifacts indicating poor parser formatting
  const rawText = JSON.stringify(candidate.rawStructure);
  if (/â|Ã|[\u0080-\u00FF]{2,}/.test(rawText)) {
    readabilityScore -= 10;
    readabilityReasons.push('Detected unrecognized character encodings (often from unusual fonts or icons).');
  }
  if (!candidate.contact?.email) {
    readabilityScore -= 5;
    readabilityReasons.push('Email could not be cleanly extracted.');
  }
  if (readabilityReasons.length === 0) readabilityReasons.push('Text extracted cleanly without severe formatting artifacts.');

  // C. Impact & Metrics & Quality
  let impactScore = 25;
  const impactReasons: string[] = [];
  let qualityScore = 25;
  const qualityReasons: string[] = [];

  const bullets = [
    ...(candidate.rawStructure.experience || []),
    ...(candidate.rawStructure.projects || [])
  ];

  if (bullets.length === 0) {
    impactScore = 0;
    impactReasons.push('No bullet points available to analyze.');
    qualityScore = 0;
    qualityReasons.push('No bullet points available to analyze.');
  } else {
    let quantifiedCount = 0;
    let actionVerbCount = 0;
    let vagueCount = 0;

    const actionVerbs = new Set([
      'accelerated', 'achieved', 'adapted', 'addressed', 'administered', 'advised', 'advocated', 'analyzed',
      'architected', 'assembled', 'assessed', 'audited', 'authored', 'automated', 'balanced', 'budgeted',
      'built', 'calculated', 'calibrated', 'cataloged', 'certified', 'championed', 'clarified', 'classified',
      'coached', 'collaborated', 'collected', 'communicated', 'compiled', 'completed', 'composed', 'computed',
      'conceptualized', 'conducted', 'configured', 'consolidated', 'constructed', 'consulted', 'controlled',
      'converted', 'coordinated', 'counseled', 'crafted', 'created', 'critiqued', 'customized', 'debugged',
      'decided', 'defined', 'delegated', 'delivered', 'demonstrated', 'deployed', 'designed', 'detected',
      'determined', 'developed', 'devised', 'diagnosed', 'directed', 'discovered', 'dispatched', 'displayed',
      'distributed', 'documented', 'drafted', 'drove', 'edited', 'educated', 'eliminated', 'enabled',
      'engineered', 'enhanced', 'ensured', 'established', 'estimated', 'evaluated', 'examined', 'executed',
      'expanded', 'expedited', 'experimented', 'explained', 'extracted', 'facilitated', 'figured', 'financed',
      'forecasted', 'formulated', 'founded', 'gathered', 'generated', 'guided', 'handled', 'headed', 'helped',
      'identified', 'illustrated', 'implemented', 'improved', 'increased', 'influenced', 'informed', 'initiated',
      'innovated', 'inspected', 'installed', 'instituted', 'instructed', 'integrated', 'interpreted', 'interviewed',
      'introduced', 'invented', 'investigated', 'launched', 'led', 'maintained', 'managed', 'mapped', 'marketed',
      'measured', 'mentored', 'modeled', 'modified', 'monitored', 'motivated', 'navigated', 'negotiated',
      'operated', 'optimized', 'orchestrated', 'organized', 'originated', 'overhauled', 'oversaw', 'participated',
      'partnered', 'performed', 'persuaded', 'piloted', 'pioneered', 'pitched', 'planned', 'predicted', 'prepared',
      'presented', 'prioritized', 'produced', 'programmed', 'projected', 'promoted', 'proposed', 'provided',
      'published', 'purchased', 'quantified', 'ran', 'recommended', 'reconciled', 'recorded', 'recruited',
      'redesigned', 'reduced', 'regulated', 'rehabilitated', 'remodeled', 'reorganized', 'repaired', 'replaced',
      'reported', 'represented', 'researched', 'resolved', 'restored', 'restructured', 'retrieved', 'reviewed',
      'revised', 'revitalized', 'routed', 'saved', 'scheduled', 'screened', 'secured', 'selected', 'served',
      'shaped', 'simplified', 'simulated', 'solved', 'sparked', 'spearheaded', 'specified', 'standardized',
      'steered', 'strategized', 'streamlined', 'strengthened', 'structured', 'studied', 'succeeded', 'suggested',
      'summarized', 'supervised', 'supported', 'surpassed', 'synthesized', 'systematized', 'tailored', 'taught',
      'tested', 'tracked', 'trained', 'transformed', 'translated', 'troubleshot', 'tutored', 'unified', 'updated',
      'upgraded', 'used', 'utilized', 'validated', 'verified', 'visualized', 'volunteered', 'won', 'wrote'
    ]);
    const adverbs = new Set(['successfully', 'regularly', 'consistently', 'continually', 'frequently', 'proactively', 'effectively', 'efficiently', 'strategically', 'significantly', 'actively', 'carefully', 'expertly', 'proficiently', 'competently']);
    const metricRegex = /(\d+%|\$\d+|\d+x|\d+k|\d+ million|\d+ thousand|\d+\+)/i;
    const vagueRegex = /(helped with|worked on|responsible for|duties included|assisted with)/i;

    for (const bullet of bullets) {
      if (metricRegex.test(bullet)) quantifiedCount++;
      
      const words = bullet.trim().split(/\s+/);
      if (words.length > 0) {
        let firstWord = words[0].replace(/[^a-zA-Z]/g, '').toLowerCase();
        let targetWord = firstWord;
        
        if (adverbs.has(firstWord) && words.length > 1) {
          targetWord = words[1].replace(/[^a-zA-Z]/g, '').toLowerCase();
        }
        
        if (actionVerbs.has(targetWord)) {
          actionVerbCount++;
        }
      }
      if (vagueRegex.test(bullet)) vagueCount++;
    }

    // Evaluate Impact
    const percentQuantified = quantifiedCount / bullets.length;
    if (percentQuantified > 0.3) {
      impactScore = 25;
      impactReasons.push(`Strong use of metrics (quantified ~${Math.round(percentQuantified * 100)}% of bullets).`);
    } else if (percentQuantified > 0.1) {
      impactScore = 15;
      impactReasons.push('Some metrics used, but many bullets lack quantified impact.');
    } else {
      impactScore = 5;
      impactReasons.push('Critically low use of metrics and quantified outcomes.');
    }

    // Evaluate Quality
    const percentAction = actionVerbCount / bullets.length;
    if (percentAction > 0.5 && vagueCount === 0) {
      qualityScore = 25;
      qualityReasons.push('Bullets start with strong action verbs and avoid passive language.');
    } else {
      if (vagueCount > 0) {
        qualityScore -= (vagueCount * 2);
        qualityReasons.push(`Found vague phrases (e.g., 'responsible for') in ${vagueCount} bullet(s).`);
      }
      if (percentAction <= 0.5) {
        qualityScore -= 10;
        qualityReasons.push('Many bullets do not start with strong action verbs.');
      }
      qualityScore = Math.max(5, qualityScore);
    }
    if (qualityReasons.length === 0) qualityReasons.push('High overall bullet clarity and active voice.');
  }

  const atsBreakdown: AtsDisplayBreakdownItem[] = [
    {
      label: 'Section Recognition',
      score: structureScore,
      maximum: 25,
      explanation: structureReasons.join(' '),
    },
    {
      label: 'Readability & Formatting',
      score: readabilityScore,
      maximum: 25,
      explanation: readabilityReasons.join(' '),
    },
    {
      label: 'Impact & Metrics',
      score: impactScore,
      maximum: 25,
      explanation: impactReasons.join(' '),
    },
    {
      label: 'Resume Quality',
      score: qualityScore,
      maximum: 25,
      explanation: qualityReasons.join(' '),
    }
  ];

  const atsScore = Math.max(0, Math.min(100, structureScore + readabilityScore + impactScore + qualityScore));

  return {
    atsScore,
    matchScore,
    atsBreakdown,
    scoreExplanations: {
      whatIncreasedScore: strengths.slice(0, 5),
      whatReducedScore: weaknesses.slice(0, 5)
    }
  };
}
