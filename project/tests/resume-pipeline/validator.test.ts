import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAndSanitizeReport } from '../../api/_lib/analysis-engine/validator.js';
import { validateRewrites } from '../../api/_lib/aiValidation.js';
import type { AiResumeAnalysisFull } from '../../api/_lib/openrouter.js';
import type { JobProfile, CandidateProfile } from '../../api/_lib/analysis-engine/types.js';

test('validator.ts strictly verifies properties', async (t: any) => {
  const dummyJob: JobProfile = {
    title: 'Software Engineer',
    requirements: [
      {
        id: 'r1',
        normalized_name: 'Python',
        original_text: 'Python',
        source_section: 'Requirements',
        source_span: [0, 6],
        source_text: 'Python',
        category: 'hard skill',
        priority: 'required',
        requirement_type: 'explicit',
        confidence: 1.0
      }
    ],
    
  };

  const dummyCandidate: CandidateProfile = {
    contact: {} as any,
    facts: [],
    rawStructure: {
      experience: ['Worked with Python']
    } as any
  };

  const dummyReport: AiResumeAnalysisFull = {
    tier: 'premium',
    parsed: {} as any,
    atsScore: 90,
    matchScore: 80,
    existingSkills: ['Python', 'HallucinatedSkill1'],
    missingSkills: ['HallucinatedSkill2'],
    missingKeywords: [],
    keywordRecommendations: [],
    keywordGaps: [],
    missingRequiredSkills: [],
    educationAlignment: [],
    detectedSections: [],
    missingSections: [],
    formattingIssues: [],
    formattingSuggestions: [],
    weakBullets: [],
    improvedBulletPoints: [],
    improvementSuggestions: ['Add Java'],
    optimizationRecommendations: ['Focus on AWS.'],
    keywordSuggestions: [],
    atsIssues: [],
    recommendationPriorities: {
      critical: ['Learn React'],
      important: [],
      optional: []
    },
    atsScoreExplanation: {
      strengths: [],
      missingElements: [],
      formattingIssues: [],
      keywordIssues: [],
      whatIncreasedScore: [],
      whatReducedScore: [],
      topImprovements: [],
      estimatedScoreImprovement: 0,
      potentialAtsScore: 100
    },
    jobMatchExplanation: {
      strongMatches: [
        { requirement: 'Python', context: 'Matches Python' },
        { requirement: 'HallucinatedSkill1', context: 'Bad' }
      ],
      partialMatches: [],
      missingSkills: [
        { requirement: 'HallucinatedSkill2', context: 'Bad', tag: 'Genuine gap' }
      ]
    },
    keywordCompatibility: {
      overallMatch: 80,
      exactMatches: ['Python', 'HallucinatedSkill1'],
      semanticMatches: [],
      underExpressed: [],
      missing: ['HallucinatedSkill2']
    },
    coachingReport: [],
    atsBreakdown: [
      { label: 'Section Recognition', score: 20, maximum: 25, explanation: '' },
      { label: 'Readability & Formatting', score: 20, maximum: 25, explanation: '' },
      { label: 'Impact & Metrics', score: 20, maximum: 25, explanation: '' },
      { label: 'Resume Quality', score: 20, maximum: 25, explanation: '' },
    ],
    roleStrengths: [],
    hiringManagerAssessment: {
      overallDecision: 'Good Match',
      recruiterSummary: '',
      topReasonsToInterview: [],
      topReasonsForRejection: [],
      estimatedInterviewProbability: 85, // should be erased
      biggestImprovements: [],
      confidence: 'High'
    }
  } as any;

  const validated = validateAndSanitizeReport(dummyReport, dummyJob, dummyCandidate);

  await t.test('Strips hallucinated skills', () => {
    assert.deepEqual(validated.existingSkills, ['Python']);
    assert.deepEqual(validated.missingSkills, []);
    assert.deepEqual(validated.jobMatchExplanation.strongMatches, [
      { requirement: 'Python', context: 'Matches Python' }
    ]);
    assert.deepEqual(validated.keywordCompatibility.missing, []);
  });

  await t.test('Enforces grounding warnings on recommendations', () => {
    assert.match(validated.improvementSuggestions[0], /only add this if accurate/i);
    assert.match(validated.optimizationRecommendations[0], /only add this if accurate/i);
    assert.match(validated.recommendationPriorities.critical[0], /only add this if accurate/i);
  });

  await t.test('Reconciles math for ATS score', () => {
    // 20 + 20 + 20 + 20 = 80
    assert.equal(validated.atsScore, 80);
  });

  await t.test('Wipes interview probability', () => {
    assert.equal(validated.hiringManagerAssessment.estimatedInterviewProbability, undefined);
  });
});

test('validateRewrites enforcement rules', async (t: any) => {
  const resumeText = 'Worked on a personal finance app. Ran usability testing. Mentored 3 UX researchers. Led mixed-methods research resulting in 34% faster delivery.';
  
  await t.test('Unchanged or cosmetically changed bullet gets preserved', () => {
    const raw = [{
      before: 'Ran usability testing.',
      after: 'Ran usability testing.',
      inferenceType: 'EXPLICITLY_STATED',
      confidence: 'High'
    }];
    const result = validateRewrites(raw, resumeText, []);
    assert.equal(result.length, 1);
    assert.equal(result[0].improvementScore, 0);
    assert.equal(result[0].inferenceType, 'NOT_APPLICABLE');
    assert.deepEqual(result[0].whyWeak, ['No meaningful rewrite recommended.']);
  });

  await t.test('Stronger action verb gets accepted', () => {
    // "Worked on a personal finance app." vs "Developed a personal finance app."
    const raw = [{
      before: 'Worked on a personal finance app.',
      after: 'Developed a personal finance app.',
      inferenceType: 'STRONGLY_SUPPORTED_INFERENCE',
      confidence: 'Medium'
    }];
    const result = validateRewrites(raw, resumeText, []);
    assert.equal(result.length, 1);
    assert.ok(result[0].improvementScore > 0);
    assert.equal(result[0].inferenceType, 'STRONGLY_SUPPORTED_INFERENCE');
  });

  await t.test('Unsupported metric gets rejected and falls back', () => {
    const raw = [{
      before: 'Ran usability testing.',
      after: 'Ran usability testing, increasing conversion by 20%.',
      inferenceType: 'UNSUPPORTED',
      confidence: 'Low'
    }];
    const result = validateRewrites(raw, resumeText, []);
    assert.equal(result.length, 1);
    assert.equal(result[0].after, 'Ran usability testing.'); // Falls back to original
    assert.equal(result[0].whyWeak[0], 'No meaningful rewrite recommended.');
  });

  await t.test('Unsupported ownership gets rejected via UNSUPPORTED flag', () => {
    // Inference type flagged as UNSUPPORTED should trigger rejection
    const raw = [{
      before: 'Ran usability testing.',
      after: 'Designed usability testing.',
      inferenceType: 'UNSUPPORTED',
      confidence: 'Low'
    }];
    const result = validateRewrites(raw, resumeText, []);
    assert.equal(result.length, 1);
    assert.equal(result[0].after, 'Ran usability testing.');
  });

  await t.test('Legitimate terminology alignment', () => {
    const raw = [{
      before: 'Mentored 3 UX researchers.',
      after: 'Managed and mentored 3 UX researchers.',
      inferenceType: 'STRONGLY_SUPPORTED_INFERENCE',
      confidence: 'Medium'
    }];
    const result = validateRewrites(raw, resumeText, ['UX researchers']);
    assert.equal(result.length, 1);
    assert.ok(result[0].improvementScore > 0);
    assert.equal(result[0].after, 'Managed and mentored 3 UX researchers.');
  });
});

test('Research at scale validation rules', async (t: any) => {
  const dummyJob: JobProfile = { title: 'UX', requirements: [] };
  const dummyCandidate: CandidateProfile = { contact: {} as any, facts: [], rawStructure: {} as any };

  await t.test('Generic UX research is MISSING for Research at scale', () => {
    const rawReport: any = {
      jobMatchExplanation: {
        strongMatches: [],
        partialMatches: [{ requirement: 'Research at scale', context: 'Conducted 5 studies' }],
        missingSkills: []
      },
      keywordCompatibility: { missing: [], exactMatches: [], semanticMatches: [], underExpressed: [] }
    };
    const validated = validateAndSanitizeReport(rawReport, dummyJob, dummyCandidate);
    assert.equal(validated.jobMatchExplanation.missingSkills.some((m: any) => m.requirement === 'Research at scale'), true);
    assert.equal(validated.jobMatchExplanation.partialMatches.length, 0);
  });

  await t.test('Concrete evidence preserves STRONG_SEMANTIC_MATCH', () => {
    const rawReport: any = {
      jobMatchExplanation: {
        strongMatches: [{ requirement: 'Research at scale', context: 'Managed a 5,000-person participant panel and maintained research repository' }],
        partialMatches: [],
        missingSkills: []
      },
      keywordCompatibility: { missing: [], exactMatches: [], semanticMatches: [], underExpressed: [] }
    };
    const validated = validateAndSanitizeReport(rawReport, dummyJob, dummyCandidate);
    assert.equal(validated.jobMatchExplanation.strongMatches.some((m: any) => m.requirement === 'Research at scale'), true);
  });
});
