import assert from 'node:assert/strict';
import { fixtures, capabilityExpectations } from './fixtures.js';
import { parseResumeText } from '../../api/_lib/resumeParser.js';
import { validateAiResumeOutput } from '../../api/_lib/aiValidation.js';
import { planResumeRecommendations } from '../../api/_lib/recommendationPlanner.js';

type TestCase = { name: string; run: () => void; expectedFailure?: boolean };

const tests: TestCase[] = [
  {
    name: 'detects LinkedIn from extracted PDF annotation text',
    run: () => {
      const resume = parseResumeText(fixtures.linkedInAnnotation);
      assert.equal(resume.links.linkedinUrl, 'https://www.linkedin.com/in/amina-khan');
      assert.equal(resume.links.items[0]?.anchorText, 'LinkedIn Profile');
    },
  },
  {
    name: 'detects a direct LinkedIn URL case-insensitively',
    run: () => {
      const resume = parseResumeText(fixtures.directLinkedIn);
      assert.equal(resume.links.linkedinUrl, 'https://linkedin.com/in/jordan-lee');
    },
  },
  {
    name: 'removes URLs, email, and phone numbers from experience and projects',
    run: () => {
      const resume = parseResumeText(fixtures.piiInProject);
      const content = [...resume.experience, ...resume.projects].join('\n');
      assert.doesNotMatch(content, /@|https?:\/\/|\+44|7946/);
      const validated = validateAiResumeOutput({
        improvedBulletPoints: [{
          before: 'Built internal analytics dashboards.',
          after: 'Led migration work with +44 20.',
        }],
        atsIssues: ['Led migration work with +44 20.'],
      }, fixtures.piiInProject);
      assert.deepEqual(validated.improvedBulletPoints, []);
      assert.deepEqual(validated.atsIssues, []);
    },
  },
  {
    name: 'extracts expected structured resume sections',
    run: () => {
      const resume = parseResumeText(fixtures.structuredSections);
      assert.match(resume.summary, /reliable APIs/i);
      assert.deepEqual(resume.skills, ['Python', 'FastAPI', 'PostgreSQL']);
      assert.deepEqual(resume.certifications, ['AWS Certified Cloud Practitioner']);
      assert.deepEqual(resume.languages, ['English', 'Urdu']);
    },
  },
  {
    name: 'keeps only discrete, unique keyword candidates',
    run: () => {
      const result = validateAiResumeOutput({
        missingKeywords: ['Docker', 'docker', 'C++'],
        keywordSuggestions: ['AWS', 'AWS'],
        keywordGaps: ['React'],
        missingRequiredSkills: ['React'],
      }, fixtures.keywordGapResume);
      assert.deepEqual(result.missingKeywords, ['Docker']);
      assert.deepEqual(result.keywordSuggestions, ['AWS']);
      assert.deepEqual(result.keywordGaps, ['React']);
      assert.deepEqual(result.missingRequiredSkills, ['React']);
    },
  },
  {
    name: 'rejects email and URL leakage in rewritten bullets',
    run: () => {
      const result = validateAiResumeOutput({
        improvedBulletPoints: [{
          before: 'Developed Python data pipelines for sales reports.',
          after: 'Contact priya@example.com at https://example.com for Python data pipelines.',
        }],
      }, fixtures.emailLeakResume);
      assert.deepEqual(result.improvedBulletPoints, []);
    },
  },
  {
    name: 'rejects invented title-case technologies and employers',
    run: () => {
      const result = validateAiResumeOutput({
        improvedBulletPoints: [{
          before: 'Built a React analytics dashboard.',
          after: 'Built a Kubernetes dashboard for Acme Corp.',
        }],
      }, fixtures.inventedTechnologyResume);
      assert.deepEqual(result.improvedBulletPoints, []);
    },
  },
  {
    name: 'rejects invented metrics in rewritten bullets',
    run: () => {
      const result = validateAiResumeOutput({
        improvedBulletPoints: [{
          before: 'Built a React analytics dashboard.',
          after: 'Built a React dashboard used by 500 users.',
        }],
      }, fixtures.inventedMetricResume);
      assert.deepEqual(result.improvedBulletPoints, []);
    },
  },
  {
    name: 'removes duplicate advice across recommendation sections',
    run: () => {
      const planned = planResumeRecommendations({
        atsIssues: ['Python data pipelines need clearer evidence.'],
        formattingIssues: ['Python data pipelines need clearer evidence.'],
        formattingSuggestions: ['Python data pipelines need clearer evidence.'],
        improvementSuggestions: ['Improve Python data pipelines for sales reports.'],
        optimizationRecommendations: [],
        weakBullets: ['Built a React analytics dashboard.'],
        improvedBulletPoints: [{
          before: 'Built a React analytics dashboard.',
          after: 'Built a React analytics dashboard for [X] users.',
        }],
        missingKeywords: ['Docker'],
        keywordSuggestions: ['docker'],
        keywordGaps: [],
        missingRequiredSkills: [],
      }, fixtures.duplicateAdviceResume);
      assert.equal(planned.atsIssues.length, 1);
      assert.equal(planned.formattingIssues.length, 0);
      assert.equal(planned.formattingSuggestions.length, 0);
      assert.deepEqual(planned.weakBullets, []);
      assert.deepEqual(planned.missingKeywords, ['Docker']);
      assert.deepEqual(planned.keywordSuggestions, []);
    },
  },
  {
    name: 'records photo detection as an unsupported capability',
    run: () => {
      assert.match(fixtures.photoResume, /Profile photo embedded/i);
      assert.equal(capabilityExpectations.photoDetection, false);
    },
  },
];

let failures = 0;
for (const test of tests) {
  try {
    test.run();
    console.log(`PASS ${test.name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${test.name}`);
    console.error(error);
  }
}

console.log(`\n${tests.length - failures}/${tests.length} benchmark cases passed.`);
if (failures > 0) process.exitCode = 1;
