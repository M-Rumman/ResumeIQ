import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAndSanitizeReport } from '../../api/_lib/analysis-engine/validator.js';
import type { AiResumeAnalysisFull } from '../../api/_lib/openrouter.js';
import type { JobProfile, CandidateProfile } from '../../api/_lib/analysis-engine/types.js';

test('validator.ts strictly verifies properties', async (t) => {
  const dummyJob: JobProfile = {
    title: 'Software Engineer',
    requirements: [
      {
        requirement_id: 'r1',
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
    metadata: { job_type: 'Full-time' }
  };

  const dummyCandidate: CandidateProfile = {
    facts: [],
    rawStructure: {
      experience: ['Worked with Python']
    }
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
      strongMatches: ['Python', 'HallucinatedSkill1'],
      partialMatches: [],
      missingSkills: ['HallucinatedSkill2']
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
  };

  const validated = validateAndSanitizeReport(dummyReport, dummyJob, dummyCandidate);

  await t.test('Strips hallucinated skills', () => {
    assert.deepEqual(validated.existingSkills, ['Python']);
    assert.deepEqual(validated.missingSkills, []);
    assert.deepEqual(validated.jobMatchExplanation.strongMatches, ['Python']);
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
    assert.equal(validated.hiringManagerAssessment.estimatedInterviewProbability, 0);
  });
});
