import assert from 'node:assert/strict';
import { fixtures, capabilityExpectations } from './fixtures.js';
import { cleanResumeExtractionArtifacts, parseResumeText } from '../../api/_lib/resumeParser.js';
import { validateAiResumeOutput } from '../../api/_lib/aiValidation.js';
import { planResumeRecommendations } from '../../api/_lib/recommendationPlanner.js';
import { rankMissingSkills } from '../../api/_lib/missingSkillRanking.js';
import { buildJobGapAnalysis, buildKeywordRecommendations, calculateJobSpecificAtsScore } from '../../api/_lib/openrouter.js';

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
        existingSkills: ['Python', 'python'],
        missingSkills: ['Python', 'STM32'],
        missingKeywords: ['Docker', 'docker', 'C++'],
        keywordSuggestions: ['AWS', 'AWS'],
        keywordGaps: ['React'],
        missingRequiredSkills: ['React'],
      }, fixtures.keywordGapResume);
      assert.deepEqual(result.existingSkills, ['Python']);
      assert.deepEqual(result.missingSkills, ['STM32']);
      assert.deepEqual(result.missingKeywords, ['Docker', 'C++']);
      assert.deepEqual(result.keywordSuggestions, ['AWS']);
      assert.deepEqual(result.keywordGaps, ['React']);
      assert.deepEqual(result.missingRequiredSkills, []);

      const ranked = rankMissingSkills({
        missingSkills: ['Technical Documentation', 'Circuit Validation', 'PCB Testing', 'Firmware Development', 'STM32'],
      }, `Required: STM32, Firmware Development, and PCB Testing. STM32 experience is required. Circuit Validation is preferred. Technical Documentation is a plus.`);
      assert.deepEqual(ranked.missingSkills, [
        'STM32',
        'Firmware Development',
        'PCB Testing',
        'Circuit Validation',
        'Technical Documentation',
      ]);
    },
  },
  {
    name: 'ranks keyword suggestions and excludes strongly represented skills',
    run: () => {
      const resume = parseResumeText(fixtures.embeddedGapResume);
      const job = {
        title: 'Embedded Systems Intern',
        requiredSkills: ['Arduino', 'STM32', 'Firmware Development', 'PCB Testing'],
        preferredSkills: ['Technical Documentation'],
      };
      const requiredGaps = buildJobGapAnalysis(resume, job);
      const suggestions = buildKeywordRecommendations(
        resume,
        job,
        'Required: STM32, Firmware Development, and PCB Testing. STM32 experience is required. Technical Documentation is preferred.',
        requiredGaps,
      );
      assert.equal(suggestions.some((item) => item.keyword === 'Arduino'), false);
      assert.deepEqual(suggestions.map((item) => item.priority), ['Critical', 'Important', 'Important', 'Optional']);
      assert.equal(suggestions.find((item) => item.keyword === 'STM32')?.recommendedSection, 'Projects');
      assert.match(suggestions.find((item) => item.keyword === 'PCB Testing')?.whyItMatters || '', /required/i);
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
  {
    name: 'removes PDF extraction metadata before certifications section parsing',
    run: () => {
      const cleaned = cleanResumeExtractionArtifacts(fixtures.certificationArtifactPdf);
      assert.doesNotMatch(cleaned, /Extracted Links:|mailto:|https?:\/\/|Thank You!|LinkedIn\s*(?:â†’|->)?/i);
      const resume = parseResumeText(fixtures.certificationArtifactPdf);
      assert.deepEqual(resume.certifications, ['P@SHA ICT Awards 2025.']);
      assert.equal(resume.links.linkedinUrl, 'https://www.linkedin.com/in/noor-ahmed');
      assert.equal(resume.links.portfolioUrl, 'https://portfolio.example.test');
    },
  },
  {
    name: 'keeps every unique grounded resume improvement without an arbitrary cap',
    run: () => {
      const improvements = [
        'Clarify Python evidence in the summary.',
        'Describe the React contribution in experience.',
        'Explain TypeScript use in project details.',
        'Name the Docker workflow outcome in experience.',
        'Document the AWS deployment responsibility.',
        'Add the Jest testing scope to the experience entry.',
        'Specify the PostgreSQL work in the experience entry.',
        'Clarify Kubernetes exposure in the project.',
        'Describe the Git automation responsibility.',
        'Explain the REST API contribution in the project.',
        'Add GraphQL integration context to the project.',
        'Document the CI pipeline responsibility.',
      ];
      const planned = planResumeRecommendations({ improvementSuggestions: improvements }, fixtures.recommendationCoverageResume);
      assert.deepEqual(planned.improvementSuggestions, improvements);
    },
  },
  {
    name: 'groups grounded recommendations by critical important and optional priority',
    run: () => {
      const planned = planResumeRecommendations({
        atsIssues: ['The experience section uses inconsistent dates.'],
        missingRequiredSkills: ['STM32'],
        weakBullets: ['Built embedded test software.'],
        improvementSuggestions: ['Your summary does not name the embedded engineering focus.'],
        missingKeywords: ['Firmware Development'],
        formattingSuggestions: ['Use consistent formatting in the Experience section.'],
        optimizationRecommendations: ['Move the skills section above education.'],
      }, `Summary\nEmbedded engineer\nExperience\nBuilt embedded test software.\nSkills\nSTM32`);
      assert.deepEqual(planned.recommendationPriorities.critical, [
        'The experience section uses inconsistent dates.',
        'Missing required job skill: STM32',
        'Weak bullet: Built embedded test software.',
      ]);
      assert.deepEqual(planned.recommendationPriorities.important, [
        'Your summary does not name the embedded engineering focus.',
        'Firmware Development',
      ]);
      assert.deepEqual(planned.recommendationPriorities.optional, [
        'Use consistent formatting in the Experience section.',
        'Move the skills section above education.',
      ]);
    },
  },
  {
    name: 'builds a required-skill gap analysis before recommendations',
    run: () => {
      const resume = parseResumeText(fixtures.embeddedGapResume);
      const gap = buildJobGapAnalysis(resume, {
        requiredSkills: ['C/C++', 'Microcontrollers', 'Firmware Development', 'PCB Testing', 'Circuit Validation', 'Not Applicable'],
      });
      const statusFor = (skill: string) => gap.items.find((item) => item.skill === skill)?.status;
      assert.equal(statusFor('C/C++'), 'MATCHED');
      assert.equal(statusFor('Microcontrollers'), 'MATCHED');
      assert.equal(statusFor('Firmware Development'), 'PARTIALLY MATCHED');
      assert.equal(statusFor('PCB Testing'), 'MISSING');
      assert.equal(statusFor('Circuit Validation'), 'PARTIALLY MATCHED');
      assert.equal(statusFor('Not Applicable'), 'NOT APPLICABLE');
      assert.match(gap.items.find((item) => item.skill === 'Firmware Development')?.recommendation || '', /only if/i);
    },
  },
  {
    name: 'calculates ATS from structure keywords and experience for the supplied job',
    run: () => {
      const resume = parseResumeText(fixtures.embeddedGapResume);
      const alignedGap = buildJobGapAnalysis(resume, {
        requiredSkills: ['C/C++', 'Microcontrollers', 'Proteus', 'Sensors and Actuators'],
      });
      const gapHeavyGap = buildJobGapAnalysis(resume, {
        requiredSkills: ['STM32', 'ESP32', 'PCB Testing', 'Firmware Development', 'Technical Documentation'],
      });
      const alignedScore = calculateJobSpecificAtsScore(resume, alignedGap);
      const gapHeavyScore = calculateJobSpecificAtsScore(resume, gapHeavyGap);
      assert.equal(alignedScore.structure.score + alignedScore.keywordAlignment.score + alignedScore.experienceAlignment.score, alignedScore.total);
      assert.equal(alignedScore.keywordAlignment.score <= 40, true);
      assert.equal(alignedScore.experienceAlignment.score <= 30, true);
      assert.ok(alignedScore.total >= gapHeavyScore.total + 15);
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
