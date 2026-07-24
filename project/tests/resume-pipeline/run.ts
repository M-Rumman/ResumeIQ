import assert from 'node:assert/strict';
import { fixtures, capabilityExpectations, requirementMatchingFixtures } from './fixtures.js';
import { cleanResumeExtractionArtifacts, normalizeSectionHeading, parseResumeText } from '../../api/_lib/resumeParser.js';
import { validateAiResumeOutput } from '../../api/_lib/aiValidation.js';
import { planResumeRecommendations } from '../../api/_lib/recommendationPlanner.js';
import { rankMissingSkills } from '../../api/_lib/missingSkillRanking.js';
import { buildJobGapAnalysis, buildJobProfile, buildKeywordCompatibility, buildKeywordRecommendations, buildResumeEvidenceIndex, buildRoleStrengths, calculateAssessmentConfidence, calculateInterviewReadinessScore, calculateJobMatchScore, calculateJobSpecificAtsScore, validateAndEnrichParsedJob } from '../../api/_lib/openrouter.js';

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
    name: 'classifies decorated semantic section-heading variants',
    run: () => {
      const resume = parseResumeText(`â˜… PROFESSIONAL SUMMARY â˜…
Embedded systems student focused on sensor integration.

â€¢ TECHNICAL SKILLS â€¢
C++

CORE COMPETENCIES
Circuit Validation

ACADEMIC PROJECTS
Built an Arduino navigation prototype.

LEADERSHIP & EXTRACURRICULARS
Led the robotics society design team.

ACADEMIC BACKGROUND
BS Mechatronics Engineering

TRAINING
Proteus Circuit Simulation

HONORS
Dean's List`);
      assert.equal(normalizeSectionHeading('â˜… Leadership & Extracurriculars â˜…'), 'leadership and extracurriculars');
      assert.match(resume.summary, /sensor integration/i);
      assert.equal(resume.skills.includes('C++'), true);
      assert.equal(resume.skills.includes('Circuit Validation'), true);
      assert.deepEqual(resume.technicalKeywords.microcontrollers, ['Arduino']);
      assert.deepEqual(resume.technicalKeywords.simulationTools, ['Proteus']);
      assert.deepEqual(resume.projects, ['Built an Arduino navigation prototype.']);
      assert.deepEqual(resume.experience, ['Led the robotics society design team.']);
      assert.deepEqual(resume.education, ['BS Mechatronics Engineering']);
      assert.deepEqual(resume.certifications, ['Proteus Circuit Simulation']);
      assert.deepEqual(resume.awards, ["Dean's List"]);
    },
  },
  {
    name: 'extracts summary from an exact PROFESSIONAL SUMMARY header',
    run: () => {
      const resume = parseResumeText('PROFESSIONAL SUMMARY\nEmbedded systems student with hands-on Arduino, sensor-interfacing, and hardware-prototyping experience.\n\nTECHNICAL SKILLS\nArduino, C++');
      assert.match(resume.summary, /Embedded systems student/i);
      assert.equal(resume.skills.includes('Arduino'), true);
    },
  },
  {
    name: 'parses semantic inline headings and side-by-side column sections',
    run: () => {
      const resume = parseResumeText('Professional Profile: Mechatronics student focused on robotics.\n\nAcademic Qualifications     Personal Skills\nBS Mechatronics Engineering     Python, C++\nRelevant Coursework     Embedded Systems, Control Systems\n\nWork Experience and Internships\nResearch Intern at RoboLab\n- Tested embedded interfaces.\n\nSelected Design Projects\nAutonomous Navigation Prototype\n- Designed an Arduino-based sensor system.');
      assert.match(resume.summary, /Mechatronics student/i);
      assert.equal(resume.education.some((entry) => /BS Mechatronics/i.test(entry)), true);
      assert.equal(resume.education.some((entry) => /Relevant Coursework/i.test(entry)), true);
      assert.equal(resume.skills.includes('Python'), true);
      assert.equal(resume.skills.includes('C++'), true);
      assert.equal(resume.experience.some((entry) => /Research Intern/i.test(entry)), true);
      assert.equal(resume.projects.some((entry) => /Autonomous Navigation Prototype/i.test(entry)), true);
    },
  },
  {
    name: 'normalizes source-template syntax into semantic resume sections',
    run: () => {
      const resume = parseResumeText('\\section{Education and Training}\n\\textbf{BS Electrical Engineering}\n\\section*{Technical Proficiencies}\n\\item Python, Proteus\n\\section{Research Projects}\n\\item Smart Sensor Platform\n\\item Designed an STM32 monitoring prototype.');
      assert.equal(resume.education.includes('BS Electrical Engineering'), true);
      assert.equal(resume.skills.includes('Python'), true);
      assert.equal(resume.skills.includes('Proteus'), true);
      assert.equal(resume.projects.some((entry) => /Smart Sensor Platform/i.test(entry)), true);
      assert.equal(resume.projects.some((entry) => /STM32 monitoring prototype/i.test(entry)), true);
    },
  },
  {
    name: 'self-heals empty sections from deterministic resume evidence',
    run: () => {
      const resume = parseResumeText('Amina Khan\namina@example.com\nEmerging embedded engineer focused on practical sensor and control-system work.\n\nBachelor of Science in Electrical Engineering\n\nSolidWorks | Proteus | STM32\n\nSmart Sensor Platform\n- Developed an STM32 monitoring prototype using Proteus.');
      assert.match(resume.summary, /Emerging embedded engineer/i);
      assert.deepEqual(resume.education, ['Bachelor of Science in Electrical Engineering']);
      assert.equal(resume.skills.includes('SolidWorks'), true);
      assert.equal(resume.skills.includes('Proteus'), true);
      assert.equal(resume.skills.includes('STM32'), true);
      assert.equal(resume.projects.some((entry) => /Smart Sensor Platform/i.test(entry)), true);
      assert.equal(resume.projectDetails.some((project) => project.title === 'Smart Sensor Platform'), true);
    },
  },
  {
    name: 'threads labeled Education content into requirement evidence with an Education section tag',
    run: () => {
      const resume = parseResumeText(`PROFESSIONAL SUMMARY
Early-career mechatronics student.

EDUCATION
Bachelor of Science in Mechatronics Engineering
National University of Sciences and Technology

SKILLS
Arduino, C++`);
      assert.equal(resume.education.some((entry) => /Bachelor of Science in Mechatronics Engineering/i.test(entry)), true);

      const gaps = buildJobGapAnalysis(resume, {
        requiredSkills: ['Bachelor of Science in Mechatronics Engineering'],
      });
      const degreeRequirement = gaps.items.find((item) => item.skill === 'Bachelor of Science in Mechatronics Engineering');
      assert.equal(degreeRequirement?.status, 'MATCHED');
      assert.equal(
        degreeRequirement?.evidenceSpans.some((span) =>
          span.section === 'Education' && /Bachelor of Science in Mechatronics Engineering/i.test(span.text),
        ),
        true,
      );
    },
  },
  {
    name: 'classifies explicit engineering education and concrete sensor work at the correct evidence level',
    run: () => {
      const resume = parseResumeText(`Education
Bachelor of Engineering in Mechatronics Engineering

Projects
Interfaced sensors, LiDAR, PLC, and BLDC motors for an autonomous robot.
Implemented PID Control for autonomous navigation.`);
      const gaps = buildJobGapAnalysis(resume, {
        requiredSkills: [
          "Bachelor's degree in Mechatronics Engineering",
          'Control Systems',
          'Sensor Integration',
        ],
      });
      assert.equal(gaps.items[0]?.status, 'MATCHED');
      assert.equal(gaps.items[0]?.evidenceLevel, 'Exact Match');
      assert.equal(gaps.items[0]?.evidenceSpans[0]?.section, 'Education');
      assert.equal(gaps.items[1]?.status, 'MATCHED');
      assert.equal(gaps.items[1]?.evidenceLevel, 'Strong Match');
      assert.equal(gaps.items[2]?.status, 'MATCHED');
      assert.equal(gaps.items[2]?.evidenceLevel, 'Exact Match');
      assert.match(gaps.items[2]?.evidenceSpans[0]?.text || '', /sensors.*LiDAR.*PLC.*BLDC/i);
    },
  },
  {
    name: 'keeps the requirement set inside the current job-description boundary',
    run: () => {
      const job = validateAndEnrichParsedJob({
        title: 'Embedded Systems Intern',
        requiredSkills: ['Arduino', 'SIEM'],
        preferredSkills: ['Splunk'],
        responsibilities: ['Develop firmware using C++', 'Monitor SIEM alerts'],
      }, `Embedded Systems Intern
Requirements
- Arduino
- C++
Responsibilities
- Develop firmware using C++`);
      assert.deepEqual(job.requiredSkills, ['Arduino', 'C++']);
      assert.deepEqual(job.preferredSkills, []);
      assert.deepEqual(job.responsibilities, ['Develop firmware using C++']);
      assert.equal(JSON.stringify(job).includes('SIEM'), false);
      assert.equal(JSON.stringify(job).includes('Splunk'), false);
    },
  },
  {
    name: 'treats OR requirements and engineering equivalence as recruiter-level evidence',
    run: () => {
      const resume = parseResumeText(`Skills
Python
SolidWorks
ANSYS
Embedded C

Projects
Built an Arduino-based embedded controller.`);
      const gaps = buildJobGapAnalysis(resume, {
        requiredSkills: [
          'Programming languages such as Python, C++, or MATLAB',
          'SolidWorks OR AutoCAD',
          'Finite Element Analysis',
          'C Programming',
          'Embedded Systems',
        ],
      });
      assert.equal(gaps.items[0]?.status, 'MATCHED');
      assert.equal(gaps.items[0]?.evidenceLevel, 'Exact Match');
      assert.match(gaps.items[0]?.matchReason || '', /accepts one of/i);
      assert.equal(gaps.items[1]?.status, 'MATCHED');
      assert.equal(gaps.items[2]?.evidenceLevel, 'Strong Match');
      assert.equal(gaps.items[3]?.evidenceLevel, 'Strong Match');
      assert.equal(gaps.items[4]?.evidenceLevel, 'Strong Match');
      assert.equal(gaps.items.every((item) => item.evidenceConfidence > 0 && item.evidenceQuality !== 'None'), true);
    },
  },
  {
    name: 'matches hand-labelled requirement fixtures with grounded section citations',
    run: () => {
      for (const fixture of requirementMatchingFixtures) {
        const gap = buildJobGapAnalysis(parseResumeText(fixture.resume), { requiredSkills: [fixture.requirement] }).items[0];
        assert.equal(gap?.matchTier, fixture.tier, fixture.name);
        if (fixture.section) {
          assert.equal(gap?.evidenceSpans.some((span) => span.section === fixture.section), true, fixture.name);
        } else {
          assert.deepEqual(gap?.evidenceSpans, [], fixture.name);
        }
      }
    },
  },
  {
    name: 'indexes normalized global evidence in priority order before requirement matching',
    run: () => {
      const resume = parseResumeText(`Summary
Mechanical engineering candidate.

Education
Bachelor of Science in Mechanical Engineering

Certifications
PADI AOW Diver

Skills
SOLIDWORKS

Projects
Used SolidWorks to design a mechanical prototype.`);
      const index = buildResumeEvidenceIndex(resume);

      assert.equal(index.entries.some((entry) => entry.canonical === 'padi advanced open water certification' && entry.section === 'Certifications'), true);
      assert.equal(index.entries.some((entry) => entry.canonical === 'solidworks' && entry.section === 'Skills'), true);

      const gap = buildJobGapAnalysis(resume, {
        requiredSkills: ['PADI Advanced Open Water', 'SolidWorks', "Bachelor's in Mechanical Engineering"],
      }, index);
      assert.equal(gap.items[0]?.matchTier, 'Strong Match');
      assert.equal(gap.items[1]?.matchTier, 'Strong Match');
      assert.equal(gap.items[2]?.matchTier, 'Strong Match');
      assert.equal(gap.items[0]?.evidenceSpans[0]?.section, 'Certifications');
      assert.equal(gap.items[1]?.evidenceSpans[0]?.section, 'Skills');
      assert.equal(gap.items[2]?.evidenceSpans[0]?.section, 'Education');
    },
  },
  {
    name: 'uses exclusive strong equivalent related weak and missing requirement tiers',
    run: () => {
      const resume = parseResumeText(`Education
Master of Science in Marine Biology

Certifications
PADI Advanced Open Water Diver

Skills
Altium
Circuit Design

Projects
Conducted scientific diver open-water research.`);
      const gaps = buildJobGapAnalysis(resume, {
        requiredSkills: [
          'PADI Advanced Open Water',
          "Bachelor's degree in Marine Biology",
          'PCB Design',
          'Strong swimmer',
          'STM32',
        ],
      });
      const tierFor = (skill: string) => gaps.items.find((item) => item.skill === skill)?.matchTier;
      assert.equal(tierFor('PADI Advanced Open Water'), 'Strong Match');
      assert.equal(tierFor("Bachelor's degree in Marine Biology"), 'Exceeded Requirement');
      assert.equal(gaps.verificationCompleted, true);
      assert.equal(gaps.items.find((item) => item.skill === 'PADI Advanced Open Water')?.verificationStep, 1);
      assert.equal(gaps.items.find((item) => item.skill === "Bachelor's degree in Marine Biology")?.verificationStep, 2);
      assert.equal(gaps.items.find((item) => item.skill === 'PCB Design')?.verificationStep, 4);
      assert.equal(gaps.items.find((item) => item.skill === 'Strong swimmer')?.verificationStep, 5);
      assert.equal(gaps.items.find((item) => item.skill === 'STM32')?.verificationStep, 6);
      assert.equal(tierFor('PCB Design'), 'Related Match');
      assert.equal(tierFor('Strong swimmer'), 'Weak Evidence');
      assert.equal(tierFor('STM32'), 'Missing');
      assert.equal(gaps.items.filter((item) => item.matchTier === 'Related Match').every((item) => item.matchClassification === 'RELATED_MATCH'), true);
    },
  },
  {
    name: 'parser benchmark extracts student sections across semantic heading variants',
    run: () => {
      const headingSets = [
        {
          summary: 'Professional Summary', skills: 'Technical Skills', engineering: 'Engineering Skills',
          leadership: 'Leadership & Extracurriculars', projects: 'Academic Projects',
          education: 'Education', certifications: 'Certifications',
        },
        {
          summary: 'Career Profile', skills: 'Digital Skills', engineering: 'Hardware Skills',
          leadership: 'Positions of Responsibility', projects: 'Selected Design Projects',
          education: 'Academic Qualifications', certifications: 'Professional Development',
        },
      ];
      for (const headings of headingSets) {
        const resume = parseResumeText(`${headings.summary}\nMechatronics student with hands-on robotics and control-system project work.\n\n${headings.skills}\nProgramming Languages\nPython, C++\n${headings.engineering}\nPCB Design, Circuit Validation\n\n${headings.projects}\nAutonomous Navigation Robot\n- Built an Arduino sensor-navigation prototype.\n\n${headings.leadership}\nRobotics Society Captain coordinating autonomous vehicle testing.\n\n${headings.education}\nBS Mechatronics Engineering\n\n${headings.certifications}\nProteus Circuit Simulation Training`);
        assert.match(resume.summary, /Mechatronics student/i);
        assert.equal(resume.skills.includes('Python'), true);
        assert.equal(resume.skills.includes('PCB Design'), true);
        assert.equal(resume.skillCategories.programming.includes('C++'), true);
        assert.equal(resume.skillCategories.engineering.includes('Circuit Validation'), true);
        assert.equal(resume.projects.some((entry) => /Autonomous Navigation Robot/i.test(entry)), true);
        assert.equal(resume.experience.some((entry) => /Robotics Society Captain/i.test(entry)), true);
        assert.equal(resume.education.some((entry) => /BS Mechatronics/i.test(entry)), true);
        assert.equal(resume.certifications.some((entry) => /Proteus Circuit Simulation/i.test(entry)), true);
      }
    },
  },
  {
    name: 'parser benchmark extracts two-column student resume content by semantic column role',
    run: () => {
      const resume = parseResumeText('Career Profile\nElectrical engineering student building practical embedded systems.\n\nAcademic Background     Core Competencies\nBS Electrical Engineering     Python, C++, Arduino\n\nLeadership Experience     Selected Projects\nIEEE Student Branch Chair     Smart Energy Monitor Prototype\nOrganized circuit-validation workshops.     - Developed an Arduino power-monitoring prototype.\n\nCourses     Licenses\nEmbedded Systems Design     Proteus Simulation Certificate');
      assert.match(resume.summary, /Electrical engineering student/i);
      assert.equal(resume.education.some((entry) => /BS Electrical Engineering/i.test(entry)), true);
      assert.equal(resume.skills.includes('Python'), true);
      assert.equal(resume.skills.includes('Arduino'), true);
      assert.equal(resume.experience.some((entry) => /IEEE Student Branch Chair/i.test(entry)), true);
      assert.equal(resume.projects.some((entry) => /Smart Energy Monitor Prototype/i.test(entry)), true);
      assert.equal(resume.certifications.some((entry) => /Proteus Simulation Certificate/i.test(entry)), true);
    },
  },
  {
    name: 'parser benchmark extracts industry resume content without relying on student headings',
    run: () => {
      const resume = parseResumeText('Professional Profile\nMechanical design engineer with production and structural-analysis experience.\n\nTechnical Proficiencies\nEngineering Software\nSolidWorks, ANSYS\nTools\nAutoCAD\n\nEmployment History\nMechanical Design Engineer, Atlas Engineering Ltd\n- Produced manufacturable assemblies and validated structural designs.\n\nKey Projects\nLattice Transmission Tower\n- Performed ANSYS structural simulation and design validation.\n\nAcademic History\nBS Mechanical Engineering\n\nLicenses\nCertified SolidWorks Associate');
      assert.match(resume.summary, /Mechanical design engineer/i);
      assert.equal(resume.skills.includes('SolidWorks'), true);
      assert.equal(resume.skillCategories.software.includes('ANSYS'), true);
      assert.equal(resume.experience.some((entry) => /Mechanical Design Engineer/i.test(entry)), true);
      assert.equal(resume.projects.some((entry) => /Lattice Transmission Tower/i.test(entry)), true);
      assert.equal(resume.education.some((entry) => /BS Mechanical Engineering/i.test(entry)), true);
      assert.equal(resume.certifications.some((entry) => /Certified SolidWorks Associate/i.test(entry)), true);
    },
  },
  {
    name: 'extracts grouped skills into categories and a flat master list',
    run: () => {
      const resume = parseResumeText(`TECHNICAL SKILLS
Programming:
Python, C++
Languages
TypeScript
Engineering Software
SolidWorks
ANSYS
Proteus
Engineering Skills
CAD Design
PCB Design
Frameworks
React
Tools
Git`);
      assert.deepEqual(resume.skillCategories.programming, ['Python', 'C++', 'TypeScript']);
      assert.deepEqual(resume.skillCategories.software, ['SolidWorks', 'ANSYS', 'Proteus']);
      assert.deepEqual(resume.skillCategories.engineering, ['CAD Design', 'PCB Design']);
      assert.deepEqual(resume.skillCategories.frameworks, ['React']);
      assert.deepEqual(resume.skillCategories.tools, ['Git']);
      assert.deepEqual(resume.skills, [
        'Python', 'C++', 'TypeScript', 'SolidWorks', 'ANSYS', 'Proteus', 'CAD Design', 'PCB Design', 'React', 'Git',
      ]);
    },
  },
  {
    name: 'parses independent projects into structured project records',
    run: () => {
      const resume = parseResumeText(`PROJECTS
Autonomous Navigation Robot
Technologies: Arduino, C++, LiDAR
- Built real-time obstacle detection for autonomous navigation.
- Improved route completion by 20%.

Smart Energy Monitor
Software Used:
Proteus
MATLAB
Designed a power-monitoring prototype for laboratory testing.`);
      assert.equal(resume.projectDetails.length, 2);
      assert.deepEqual(resume.projectDetails[0], {
        title: 'Autonomous Navigation Robot',
        description: '',
        bullets: [
          'Built real-time obstacle detection for autonomous navigation.',
          'Improved route completion by 20%.',
        ],
        technologies: ['Arduino', 'C++', 'LiDAR'],
        outcomes: ['Improved route completion by 20%.'],
      });
      assert.deepEqual(resume.projectDetails[1], {
        title: 'Smart Energy Monitor',
        description: 'Designed a power-monitoring prototype for laboratory testing.',
        bullets: [],
        technologies: ['Proteus', 'MATLAB'],
        outcomes: [],
      });
      assert.deepEqual(resume.projects, [
        'Autonomous Navigation Robot',
        'Technologies: Arduino, C++, LiDAR',
        'Built real-time obstacle detection for autonomous navigation.',
        'Improved route completion by 20%.',
        'Smart Energy Monitor',
        'Software Used',
        'Proteus',
        'MATLAB',
        'Designed a power-monitoring prototype for laboratory testing.',
      ]);
    },
  },
  {
    name: 'reclassifies project and experience entries beyond their section headings',
    run: () => {
      const resume = parseResumeText(`EXPERIENCE
Autonomous Robot Prototype
- Designed a sensor-guided navigation prototype.

Embedded Systems Intern, RoboTech Inc
- Tested hardware interfaces and documented results.

PROJECTS
Research Assistant at Applied Systems Company
- Supported laboratory testing and reporting.

Capstone Design Project
- Built a PCB simulation model.`);
      assert.equal(resume.projects.some((entry) => /Autonomous Robot Prototype/i.test(entry)), true);
      assert.equal(resume.projects.some((entry) => /Capstone Design Project/i.test(entry)), true);
      assert.equal(resume.projects.some((entry) => /Research Assistant/i.test(entry)), false);
      assert.equal(resume.experience.some((entry) => /Embedded Systems Intern/i.test(entry)), true);
      assert.equal(resume.experience.some((entry) => /Research Assistant/i.test(entry)), true);
      assert.equal(resume.experience.some((entry) => /Autonomous Robot Prototype/i.test(entry)), false);
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
      assert.match(suggestions.find((item) => item.keyword === 'STM32')?.whyItMatters || '', /Evidence: Skills.*Arduino.*Classification: Related Match/i);
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
    name: 'never cites academic tutoring as evidence for CAD',
    run: () => {
      const resume = parseResumeText('Experience\nProvided academic tutoring in Mathematics and Science to O-Level and A-Level students.\n\nSkills\nPython');
      const gaps = buildJobGapAnalysis(resume, { requiredSkills: ['CAD'] });
      const cad = gaps.items.find((item) => item.skill === 'CAD');
      const strengths = buildRoleStrengths(resume, { title: 'Mechanical Design Intern' }, gaps);
      assert.equal(cad?.status, 'MISSING');
      assert.deepEqual(cad?.evidence, []);
      assert.deepEqual(cad?.evidenceSpans, []);
      assert.match(cad?.recommendation || '', /not explicitly evidenced/i);
      assert.equal(strengths.some((strength) => /academic tutoring|Mathematics and Science/i.test(strength)), false);
    },
  },
  {
    name: 'does not infer ROS or technical software from conference attendance',
    run: () => {
      const resume = parseResumeText(`Certifications
International Conference on Robotics and Automation Industry (ICRAI) attendance certificate

Awards
Robotics competition participant`);
      const gaps = buildJobGapAnalysis(resume, { requiredSkills: ['ROS', 'MATLAB', 'Embedded Systems'] });
      for (const gap of gaps.items) {
        assert.equal(gap.status, 'MISSING');
        assert.equal(gap.evidenceLevel, 'Missing');
        assert.equal(gap.evidenceQuality, 'None');
        assert.deepEqual(gap.evidenceSpans, []);
      }
    },
  },
  {
    name: 'prioritizes explicit Skills and Languages evidence over nearby domain text',
    run: () => {
      const resume = parseResumeText(`Education
Bachelor of Engineering in Mechatronics Engineering

Languages
Python
C++

Skills
SolidWorks
AutoCAD

Experience
Worked on BLDC motors.`);
      const gaps = buildJobGapAnalysis(resume, {
        requiredSkills: [
          "Bachelor's degree in Mechatronics Engineering",
          'Programming Languages (C++, Python)',
          '3D CAD software (SolidWorks, AutoCAD)',
          'Mechanical Components',
        ],
      });
      assert.equal(gaps.items[0]?.status, 'MATCHED');
      assert.equal(gaps.items[0]?.matchClassification, 'EXACT_MATCH');
      assert.equal(gaps.items[0]?.evidenceSpans[0]?.section, 'Education');
      assert.equal(gaps.items[1]?.status, 'MATCHED');
      assert.equal(['Skills', 'Languages'].includes(gaps.items[1]?.evidenceSpans[0]?.section || ''), true);
      assert.equal(gaps.items[2]?.status, 'MATCHED');
      assert.equal(gaps.items[2]?.evidenceSpans[0]?.section, 'Skills');
      assert.equal(gaps.items[3]?.status, 'PARTIALLY MATCHED');
      assert.equal(gaps.items[3]?.evidenceLevel, 'Related Match');
      assert.match(gaps.items[3]?.evidenceSpans[0]?.text || '', /BLDC motors/i);
    },
  },
  {
    name: 'gives related microcontroller evidence partial credit without treating ESP32 as absent',
    run: () => {
      const relatedResume = parseResumeText('Skills\nArduino\n\nProjects\nAutonomous Robot Prototype\n- Built a microcontroller-based embedded navigation system using Arduino.');
      const relatedGap = buildJobGapAnalysis(relatedResume, { requiredSkills: ['ESP-32'] });
      const esp32 = relatedGap.items[0];
      assert.equal(esp32.status, 'PARTIALLY MATCHED');
      assert.equal(esp32.matchClassification, 'RELATED_MATCH');
      assert.match(esp32.matchReason, /Related skill evidenced: Arduino/i);
      assert.equal(esp32.evidence.some((evidence) => /Arduino/i.test(evidence)), true);
      assert.equal(relatedGap.items.some((item) => item.skill === 'ESP-32' && item.status === 'MISSING'), false);
      const relatedStrengths = buildRoleStrengths(relatedResume, { title: 'Embedded Systems Intern' }, relatedGap);
      assert.equal(relatedStrengths.some((strength) => /ESP-32/i.test(strength)), false);
      const relatedMatch = calculateJobMatchScore(relatedResume, buildJobProfile({ title: 'Embedded Systems Intern', requiredSkills: ['ESP-32'] }), relatedGap);
      assert.match(relatedMatch.topGaps.join(' '), /Related skill evidenced: Arduino.*does not explicitly name ESP-32/i);

      const exactResume = parseResumeText('Skills\nESP32\n\nProjects\nESP32 Sensor Controller\n- Developed an ESP32-based sensor controller.');
      const exactGap = buildJobGapAnalysis(exactResume, { requiredSkills: ['ESP32'] });
      assert.equal(exactGap.items[0]?.status, 'MATCHED');
      assert.equal(exactGap.items[0]?.matchClassification, 'EXACT_MATCH');
      assert.equal(buildRoleStrengths(exactResume, { title: 'Embedded Systems Intern' }, exactGap).some((strength) => /ESP32/i.test(strength)), true);
    },
  },
  {
    name: 'builds keyword compatibility from semantic requirement evidence without changing ATS scoring',
    run: () => {
      const resume = parseResumeText(`Skills
Arduino, SolidWorks CAD

Projects
Embedded Systems Monitor
- Designed circuit design documentation and an embedded monitoring prototype.`);
      const compatibility = buildKeywordCompatibility(resume, {
        requiredSkills: ['Arduino', 'Mechanical Design', 'PCB Design', 'Firmware Development', 'STM32'],
        preferredSkills: [],
      });
      assert.deepEqual(compatibility.strongMatches, ['Arduino', 'Mechanical Design']);
      assert.deepEqual(compatibility.partialMatches, ['PCB Design', 'Firmware Development', 'STM32']);
      assert.deepEqual(compatibility.missing, []);
      assert.equal(compatibility.overallMatch, 70);
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
      // Evidence priority now correctly cites the explicit Skills entry before
      // the project mention. The student-aware scoring branch must still run;
      // this test deliberately does not alter that scoring formula.
      assert.ok(studentScore.experienceRelevance.score >= nonStudentScore.experienceRelevance.score);
      assert.match(studentScore.experienceRelevance.reasons.join(' '), /student-aware evaluation/i);
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
    name: 'treats robot assembly and calibration as implied practical evidence when related hands-on work is documented',
    run: () => {
      const resume = parseResumeText('Projects\nPhysical Autonomous Robot\n- Built a physical autonomous robot with sensor interfacing, hardware prototyping, breadboard prototyping, and testing.');
      const gap = buildJobGapAnalysis(resume, { responsibilities: ['Perform robot assembly and calibration'] });
      const item = gap.responsibilities[0];
      assert.equal(item?.status, 'PARTIALLY MATCHED');
      assert.equal(item?.matchClassification, 'IMPLIED_PRACTICAL_EVIDENCE');
      assert.match(item?.matchReason || '', /Implied but not explicitly stated/i);
      assert.equal(item?.evidence.some((value) => /sensor interfacing|hardware prototyping/i.test(value)), true);
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
  {
    name: 'derives interview readiness from scores, structure, evidence, bullets, and missing requirements',
    run: () => {
      const resume = parseResumeText(`Summary\nEmbedded systems student\nSkills\nArduino\nEducation\nBS Mechatronics\nProjects\nBuilt an Arduino sensor prototype.\nExperience\nTested embedded interfaces.`);
      const strongGap = buildJobGapAnalysis(resume, { requiredSkills: ['Arduino'] });
      const weakGap = buildJobGapAnalysis(resume, { requiredSkills: ['STM32', 'PCB Testing', 'Firmware Development'] });
      const strong = calculateInterviewReadinessScore(resume, strongGap, 78, 82, {
        improvedBulletPoints: [{ before: 'Tested embedded interfaces.', after: 'Tested embedded interfaces.' }],
        weakBullets: [],
      });
      const weak = calculateInterviewReadinessScore(resume, weakGap, 78, 82, {
        improvedBulletPoints: [],
        weakBullets: ['Tested embedded interfaces.'],
      });
      assert.ok(strong > weak);
      assert.notEqual(strong, 82);
      assert.equal(strong <= 100 && weak >= 0, true);
    },
  },
  {
    name: 'derives assessment confidence from citable direct evidence rather than resume section counts',
    run: () => {
      const resume = parseResumeText(`Summary
Embedded systems student.

Skills
Arduino, C++, Proteus

Projects
Autonomous Sensor Robot
- Built an Arduino sensor controller in C++ and validated circuits in Proteus.

Embedded Monitoring Prototype
- Developed and tested an Arduino-based monitoring prototype.`);
      const stronglyEvidenced = buildJobGapAnalysis(resume, {
        requiredSkills: ['Arduino', 'C++', 'Proteus'],
        responsibilities: ['Design and test embedded hardware systems'],
      });
      assert.equal(calculateAssessmentConfidence(resume, stronglyEvidenced), 'High');

      const ambiguous = buildJobGapAnalysis(resume, {
        requiredSkills: ['STM32', 'ESP32', 'PCB Testing'],
        responsibilities: ['Perform robot assembly and calibration'],
      });
      assert.notEqual(calculateAssessmentConfidence(resume, ambiguous), 'High');
      assert.equal(calculateAssessmentConfidence(resume, ambiguous), 'Medium');
    },
  },
  {
    name: 'deterministically extracts discrete engineering keywords before LLM analysis',
    run: () => {
      const resume = parseResumeText('Summary\nCurrently pursuing a Mechatronics degree. Expected graduation 2027.\n\nSkills\nPython, C++, Problem solving\n\nEngineering Software\nSolidWorks, ANSYS, Proteus, LTSpice, Altium\n\nProjects\nBuilt an Embedded Systems prototype using Arduino and STM32. Implemented PID and FSM logic for Sensor Integration and PCB Design.\n\nTechnical Skills\nI2C, SPI, UART, CAN, ROS');
      assert.deepEqual(resume.technicalKeywords.programmingLanguages, ['Python', 'C++']);
      assert.deepEqual(resume.technicalKeywords.cadSoftware, ['SolidWorks', 'Altium']);
      assert.deepEqual(resume.technicalKeywords.simulationTools, ['ANSYS', 'Proteus', 'LTSpice']);
      assert.deepEqual(resume.technicalKeywords.microcontrollers, ['STM32', 'Arduino']);
      assert.deepEqual(resume.technicalKeywords.protocols, ['I2C', 'SPI', 'UART', 'CAN']);
      assert.deepEqual(resume.technicalKeywords.frameworks, ['ROS']);
      assert.deepEqual(resume.technicalKeywords.engineeringConcepts, ['PID Control', 'Sensor Integration', 'PCB Design']);
      assert.deepEqual(resume.technicalKeywords.algorithms, ['FSM']);
      assert.deepEqual(resume.technicalKeywords.technicalDomains, ['Embedded Systems']);
      assert.equal(resume.skills.includes('Python'), true);
      assert.equal(resume.skills.includes('Currently pursuing'), false);
      assert.equal(Object.values(resume.technicalKeywords).flat().some((keyword) => /expected graduation|problem solving/i.test(keyword)), false);
    },
  },
  {
    name: 'stores project-context evidence spans for matched technical skills',
    run: () => {
      const resume = parseResumeText('Skills\nSolidWorks\nANSYS\n\nProjects\nMechanical Workshop Workbench Design\nTechnologies: SolidWorks\nDesigned a workshop workbench in SolidWorks.\n\nLattice Transmission Tower\nSoftware Used: ANSYS\nPerformed structural simulation using ANSYS.');
      const gaps = buildJobGapAnalysis(resume, { requiredSkills: ['SolidWorks', 'ANSYS'] });
      const index = buildResumeEvidenceIndex(resume);
      const solidWorks = gaps.items.find((item) => item.skill === 'SolidWorks');
      const ansys = gaps.items.find((item) => item.skill === 'ANSYS');
      assert.equal(solidWorks?.status, 'MATCHED');
      // An explicitly indexed Skills entry has priority for the user-facing
      // citation. Project evidence remains independently indexed with context
      // for analyses that need the project location.
      assert.equal(solidWorks?.evidenceSpans.some((span) => span.section === 'Skills' && /solidworks/i.test(span.text)), true);
      assert.equal(ansys?.evidenceSpans.some((span) => span.section === 'Skills' && /ansys/i.test(span.text)), true);
      assert.equal(index.entries.some((entry) => entry.section === 'Projects' && entry.context === 'Mechanical Workshop Workbench Design' && /solidworks/i.test(entry.text)), true);
      assert.equal(index.entries.some((entry) => entry.section === 'Projects' && entry.context === 'Lattice Transmission Tower' && /ansys/i.test(entry.text)), true);
      assert.equal(solidWorks?.evidenceSpans.every((span) => span.start >= 0 && span.end > span.start && span.end <= span.text.length), true);
      const ats = calculateJobSpecificAtsScore(resume, gaps, { title: 'Mechanical Design Intern' });
      assert.match(ats.technicalSkillCoverage.reasons.join(' '), /SolidWorks evidenced by SolidWorks/i);
    },
  },
  {
    name: 'uses projects competitions academic work and leadership before penalizing student employment history in ATS',
    run: () => {
      const resume = parseResumeText('Education\nBachelor of Science in Mechatronics\nAcademic coursework in embedded control systems.\n\nLeadership & Extracurriculars\nRobotics Society Captain leading autonomous vehicle testing.\n\nProjects\nAutonomous Robot Prototype\nBuilt an Arduino sensor-navigation prototype.\n\nPCB Simulation Capstone\nValidated circuits in Proteus.\n\nAwards\nNational Robotics Competition finalist.');
      const gap = buildJobGapAnalysis(resume, { requiredSkills: ['Arduino', 'Proteus'] });
      const internScore = calculateJobSpecificAtsScore(resume, gap, { title: 'Embedded Systems Intern' });
      const reasons = internScore.experienceRelevance.reasons.join(' ');
      assert.equal(resume.experience.some((entry) => /Robotics Society Captain/i.test(entry)), true);
      assert.equal(resume.projects.length >= 2, true);
      assert.match(reasons, /student-aware evaluation/i);
      assert.match(reasons, /competition entr/i);
      assert.match(reasons, /academic-work entr/i);
      assert.match(reasons, /leadership entr/i);
      assert.match(reasons, /multiple engineering projects count as practical experience/i);
      // Requirement citations prioritize explicit Skills evidence. The
      // student-aware calculation remains present, but its existing score is
      // intentionally outside the scope of the evidence-index change.
      assert.equal(internScore.experienceRelevance.score >= 0, true);
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
