import assert from 'node:assert/strict';
import { fixtures, capabilityExpectations } from './fixtures.js';
import { cleanResumeExtractionArtifacts, parseResumeText } from '../../api/_lib/resumeParser.js';
import { validateAiResumeOutput } from '../../api/_lib/aiValidation.js';
import { planResumeRecommendations } from '../../api/_lib/recommendationPlanner.js';
import { rankMissingSkills } from '../../api/_lib/missingSkillRanking.js';
import { buildJobGapAnalysis, buildJobProfile, buildKeywordRecommendations, buildRoleStrengths, calculateJobMatchScore, calculateJobSpecificAtsScore, validateAndEnrichParsedJob } from '../../api/_lib/openrouter.js';

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
      assert.deepEqual(suggestions.map((item) => item.priority), ['Critical', 'Important', 'Important', 'Nice-to-Have']);
      assert.equal(suggestions.find((item) => item.keyword === 'STM32')?.recommendedSection, 'Projects');
      assert.match(suggestions.find((item) => item.keyword === 'STM32')?.whyItMatters || '', /partially demonstrates/i);
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
    name: 'rejects cross-bullet technology leakage in rewritten bullets',
    run: () => {
      const resume = `Experience\nBuilt Python data reports.\nProjects\nBuilt a React dashboard.`;
      const result = validateAiResumeOutput({
        improvedBulletPoints: [{
          before: 'Built Python data reports.',
          after: 'Developed Python and React reporting workflows.',
        }],
      }, resume);
      assert.deepEqual(result.improvedBulletPoints, []);
    },
  },
  {
    name: 'rejects generic formatting advice without target-job context',
    run: () => {
      const resume = `Skills\nArduino\nProjects\nBuilt an Arduino prototype.`;
      const result = validateAiResumeOutput({
        formattingSuggestions: [
          'Use a cleaner layout.',
          'The role requires Arduino, so clarify the Projects section where the Arduino prototype appears.',
        ],
      }, resume, 'Embedded Systems Intern\nRequired: Arduino');
      assert.deepEqual(result.formattingSuggestions, [
        'The role requires Arduino, so clarify the Projects section where the Arduino prototype appears.',
      ]);
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
    name: 'puts missing hiring blockers before partial job-gap recommendations',
    run: () => {
      const planned = planResumeRecommendations(
        { improvementSuggestions: [], optimizationRecommendations: ['Use a cleaner layout.'] },
        fixtures.embeddedGapResume,
        {
          items: [
            { skill: 'Firmware Development', status: 'PARTIALLY MATCHED', evidence: ['Built an Arduino line follower using sensors and BLDC motors.'] },
            { skill: 'PCB Testing', status: 'MISSING', evidence: [] },
          ],
          responsibilities: [],
        },
        'Embedded Systems Intern',
      );
      assert.equal(planned.improvementSuggestions.length, 2);
      assert.match(planned.improvementSuggestions[0], /Embedded Systems Intern.*PCB Testing/i);
      assert.match(planned.improvementSuggestions[0], /unable to verify/i);
      assert.match(planned.improvementSuggestions[1], /Embedded Systems Intern.*Firmware Development/i);
      assert.deepEqual(planned.optimizationRecommendations, []);
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
    name: 'builds a ranked job profile that changes resume comparison by role',
    run: () => {
      const resume = parseResumeText(fixtures.embeddedGapResume);
      const embeddedProfile = buildJobProfile({
        title: 'Embedded Systems Intern',
        requiredSkills: ['Arduino', 'Firmware Development'],
        preferredSkills: ['Proteus'],
        responsibilities: ['Debug hardware interfaces'],
      });
      const securityProfile = buildJobProfile({
        title: 'Cybersecurity Analyst',
        requiredSkills: ['Splunk', 'Network Security'],
        preferredSkills: ['Wazuh'],
        responsibilities: ['Monitor security incidents'],
      });
      assert.deepEqual(embeddedProfile.priorities.map((item) => item.priority), ['Critical', 'Critical', 'Important', 'Supporting']);
      assert.equal(buildJobGapAnalysis(resume, embeddedProfile).items.some((item) => item.status === 'MATCHED'), true);
      assert.deepEqual(buildJobGapAnalysis(resume, securityProfile).items.map((item) => item.status), ['MISSING', 'MISSING']);
    },
  },
  {
    name: 'validates parsed job requirements against raw job text and recovers omissions',
    run: () => {
      const job = validateAndEnrichParsedJob({
        title: 'Software Intern',
        requiredSkills: ['Python', 'InventedTool'],
        preferredSkills: ['React'],
        responsibilities: ['Build APIs'],
      }, `Job Title: Platform Engineer\nRequirements:\n- Python\n- Docker\n- Kubernetes\nReact is a plus.`);
      assert.equal(job.title, 'Platform Engineer');
      assert.deepEqual(job.requiredSkills, ['Python', 'Docker', 'Kubernetes']);
      assert.deepEqual(job.preferredSkills, ['React']);
    },
  },
  {
    name: 'grounds job responsibilities in the supplied job description',
    run: () => {
      const job = validateAndEnrichParsedJob({
        title: 'Embedded Engineer',
        requiredSkills: ['C++'],
        responsibilities: ['Operate a Kubernetes cluster', 'Debug embedded hardware interfaces'],
      }, `Job Title: Embedded Engineer
Responsibilities:
- Debug embedded hardware interfaces
- Test sensor integration
Requirements:
- C++`);
      assert.deepEqual(job.responsibilities, [
        'Debug embedded hardware interfaces',
        'Test sensor integration',
      ]);
      assert.equal(job.responsibilities.some((item) => /Kubernetes/i.test(item)), false);
    },
  },
  {
    name: 'recognizes broader security and data requirement equivalence',
    run: () => {
      const resume = parseResumeText(`Skills\nPython\nSIEM\nProjects\nBuilt ETL data pipelines and performed security log analysis.`);
      const gaps = buildJobGapAnalysis(resume, { requiredSkills: ['Data Pipelines', 'Splunk', 'Incident Response'] });
      assert.equal(gaps.items.find((item) => item.skill === 'Data Pipelines')?.status, 'MATCHED');
      assert.equal(gaps.items.find((item) => item.skill === 'Splunk')?.status, 'PARTIALLY MATCHED');
      assert.equal(gaps.items.find((item) => item.skill === 'Incident Response')?.status, 'MISSING');
    },
  },
  {
    name: 'builds recruiter strengths from role-matched resume evidence only',
    run: () => {
      const resume = parseResumeText(fixtures.embeddedGapResume);
      const gaps = buildJobGapAnalysis(resume, {
        requiredSkills: ['Arduino', 'C/C++', 'Proteus', 'STM32'],
      });
      const strengths = buildRoleStrengths(resume, { title: 'Embedded Systems Intern' }, gaps);
      assert.ok(strengths.length >= 3);
      assert.equal(strengths.some((strength) => /STM32/i.test(strength)), false);
      assert.equal(strengths.every((strength) => /Embedded Systems Intern/.test(strength)), true);
      assert.equal(strengths.some((strength) => /Arduino/.test(strength)), true);
    },
  },
  {
    name: 'calculates ATS from five job-specific dimensions for the supplied job',
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
      assert.equal(
        alignedScore.structure.score
          + alignedScore.technicalSkillCoverage.score
          + alignedScore.experienceRelevance.score
          + alignedScore.keywordCoverage.score
          + alignedScore.sectionQuality.score,
        alignedScore.total,
      );
      assert.equal(alignedScore.technicalSkillCoverage.score <= 30, true);
      assert.equal(alignedScore.experienceRelevance.score <= 20, true);
      assert.equal(alignedScore.keywordCoverage.score <= 15, true);
      assert.equal(alignedScore.sectionQuality.score <= 10, true);
      assert.ok(alignedScore.total >= gapHeavyScore.total + 15);
    },
  },
  {
    name: 'counts student projects as practical experience for early-career ATS scoring',
    run: () => {
      const studentResume = parseResumeText(`Student Candidate\n\nEducation\nBachelor of Science in Mechatronics\n\nSkills\nArduino\n\nProjects\nBuilt an Arduino sensor prototype.`);
      const gap = buildJobGapAnalysis(studentResume, { requiredSkills: ['Arduino'] });
      const studentScore = calculateJobSpecificAtsScore(studentResume, gap, { title: 'Embedded Systems Intern' });
      const nonStudentResume = { ...studentResume, education: [] };
      const nonStudentScore = calculateJobSpecificAtsScore(nonStudentResume, gap, { title: 'Senior Embedded Engineer' });
      assert.ok(studentScore.experienceRelevance.score > nonStudentScore.experienceRelevance.score);
      assert.match(studentScore.experienceRelevance.reasons.join(' '), /projects counted/i);
    },
  },
  {
    name: 'calculates materially different job-match scores and reasons for different roles',
    run: () => {
      const resume = parseResumeText(fixtures.embeddedGapResume);
      const embeddedProfile = buildJobProfile({
        title: 'Embedded Systems Intern',
        requiredSkills: ['Arduino', 'C/C++', 'Proteus', 'Sensors and Actuators'],
        preferredSkills: ['Circuit Validation'],
        responsibilities: ['Debug hardware interfaces and sensor integration'],
      });
      const securityProfile = buildJobProfile({
        title: 'Cybersecurity Analyst',
        requiredSkills: ['Splunk', 'Network Security', 'Incident Response'],
        preferredSkills: ['Wazuh'],
        responsibilities: ['Monitor security incidents and investigate alerts'],
      });
      const embedded = calculateJobMatchScore(resume, embeddedProfile, buildJobGapAnalysis(resume, embeddedProfile));
      const security = calculateJobMatchScore(resume, securityProfile, buildJobGapAnalysis(resume, securityProfile));
      assert.ok(embedded.total >= security.total + 25);
      assert.match(embedded.topStrengths.join(' '), /Arduino|C\/C\+\+|Proteus/i);
      assert.match(security.topGaps.join(' '), /Splunk|Network Security|Incident Response/i);
    },
  },
  {
    name: 'scores job responsibilities individually from practical resume evidence',
    run: () => {
      const resume = parseResumeText(`Skills\nArduino\nProjects\nBuilt and tested an Arduino sensor prototype for a robotic vehicle.`);
      const gap = buildJobGapAnalysis(resume, {
        requiredSkills: ['Arduino'],
        responsibilities: ['Debug hardware interfaces and integrate sensors', 'Support customer account management'],
      });
      assert.equal(gap.responsibilities.length, 2);
      assert.notEqual(gap.responsibilities[0]?.status, 'MISSING');
      assert.equal(gap.responsibilities[1]?.status, 'MISSING');
      assert.match(gap.responsibilities[0]?.evidence.join(' ') || '', /Arduino sensor prototype/i);
    },
  },
  {
    name: 'does not award preferred-skill points when a job has no preferred skills',
    run: () => {
      const resume = parseResumeText(`Skills\nPython\nProjects\nBuilt Python automation scripts.`);
      const profile = buildJobProfile({
        title: 'Software Engineer',
        requiredSkills: ['Python'],
        preferredSkills: [],
        responsibilities: ['Develop software automation'],
      });
      const score = calculateJobMatchScore(resume, profile, buildJobGapAnalysis(resume, profile));
      assert.equal(score.weights.requiredSkills, 40);
      assert.equal(score.weights.preferredSkills, 0);
      assert.equal(score.preferredSkills, 0);
      assert.equal(score.total <= 100, true);
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
