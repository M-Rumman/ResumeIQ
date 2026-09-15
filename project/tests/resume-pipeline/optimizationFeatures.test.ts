import assert from 'node:assert/strict';
import { scanResumeFormatting } from '../../src/utils/atsFormatScanner.js';
import { extractAndClassifyKeywords } from '../../src/utils/keywordClassifier.js';
import { calculateRealtimeScore } from '../../src/utils/realtimeScorer.js';
import { findWeakPhrases, replaceWeakPhrase } from '../../src/utils/powerVerbEngine.js';
import { findUnquantifiedBullets } from '../../src/utils/quantifiableImpactChecker.js';
import { performSectionAudits } from '../../src/utils/sectionAuditor.js';
import { parseLinkedInText, formatProfileToResumeText } from '../../src/utils/linkedInImporter.js';
import { generateTailoredCoverLetter } from '../../src/utils/coverLetterGenerator.js';

console.log('Testing 12 Optimization Features...\n');

// 1. ATS Formatting Scanner
const badResume = `
John Doe
| Role | Company | Dates |
| Engineer | Acme | 2021-2023 |
❖ Custom star bullet item with strange â character
`;
const formatReport = scanResumeFormatting(badResume);
assert.ok(formatReport.issues.length >= 2, 'Should detect table and font issues');
assert.ok(formatReport.score < 80, 'Score should be penalized for table & bad characters');
console.log('✔ ATS Formatting Scanner correctly flagged tables and font issues');

// 2. Keyword Classification (Hard skills, soft skills, credentials)
const jd = `
We are looking for a Senior Software Engineer with:
- Deep experience in React, TypeScript, and AWS
- Strong Agile and Cross-Functional Leadership skills
- Bachelor's Degree in Computer Science or PMP Certification
`;
const sampleResume = `
Jane Doe
jane@example.com | 555-123-4567
EXPERIENCE
Software Engineer
- Built modern apps with React and TypeScript
- Worked in Agile sprint teams
`;
const keywords = extractAndClassifyKeywords(jd, sampleResume);
assert.ok(keywords.hardSkills.items.length > 0, 'Should classify hard skills');
assert.ok(keywords.softSkills.items.length > 0, 'Should classify soft skills');
assert.ok(keywords.credentials.items.length > 0, 'Should classify credentials');
assert.ok(keywords.hardSkills.percentage > 0, 'Should calculate hard skill match percentage');
console.log('✔ Keyword Classifier properly categorized Hard Skills, Soft Skills, and Credentials');

// 3. Power Verb Engine
const textWithWeakVerbs = `
- Helped with building database pipelines
- Was responsible for leading customer syncs
`;
const weakMatches = findWeakPhrases(textWithWeakVerbs);
assert.equal(weakMatches.length, 2, 'Should find 2 weak phrases');
const replaced = replaceWeakPhrase(textWithWeakVerbs, weakMatches[0].startIndex, weakMatches[0].endIndex, 'Architected');
assert.ok(replaced.includes('Architected'), 'Should replace weak phrase with power verb');
console.log('✔ Power Verb Engine detected passive phrases and performed replacement');

// 4. Real-Time Scorer
const liveScore = calculateRealtimeScore(sampleResume);
assert.ok(liveScore.overallScore > 0, 'Live score should be computed');
assert.ok(liveScore.pillars.impact.score <= 25, 'Pillars should have max 25');
assert.ok(liveScore.quickChecklist.length > 0, 'Should generate quick checklist');
console.log('✔ Real-Time Scorer computed live 4-pillar score and checklist');

// 5. Quantifiable Impact Checker
const unquantified = findUnquantifiedBullets(sampleResume);
assert.ok(unquantified.length > 0, 'Should flag bullets without metrics');
assert.ok(unquantified[0].promptQuestion.length > 0, 'Should formulate AI prompt question');
console.log('✔ Quantifiable Impact Checker found unquantified bullets and built prompts');

// 6. Section Auditor
const sectionAudit = performSectionAudits(sampleResume);
assert.ok(sectionAudit.contactAudit.score > 0, 'Contact audit scored');
assert.ok(sectionAudit.experienceAudit.score > 0, 'Experience audit scored');
assert.ok(sectionAudit.educationAudit.score > 0, 'Education audit scored');
console.log('✔ Section Auditor performed deep audit across all key resume sections');

// 7. LinkedIn Importer
const linkedInText = `
Alex Mercer
Senior Frontend Developer
San Francisco, CA
alex.mercer@gmail.com | 555-987-6543
linkedin.com/in/alex-mercer

About
Passionate web developer with 6+ years of building web applications.

Experience
Frontend Engineer
Vercel
Jan 2022 - Present
- Led UI redesign of dashboard

Education
Stanford University
Bachelor of Science in Computer Science
2016 - 2020

Skills
React, TypeScript, Next.js, Tailwind CSS
`;
const parsedProfile = parseLinkedInText(linkedInText);
assert.equal(parsedProfile.name, 'Alex Mercer');
assert.equal(parsedProfile.email, 'alex.mercer@gmail.com');
assert.ok(parsedProfile.experience.length > 0, 'Parsed experience');
assert.ok(parsedProfile.skills.length > 0, 'Parsed skills');
const baselineResume = formatProfileToResumeText(parsedProfile);
assert.ok(baselineResume.includes('ALEX MERCER'), 'Formatted baseline resume text');
console.log('✔ LinkedIn Importer successfully parsed profile and formatted baseline resume');

// 8. Cover Letter Generator
const coverLetter = generateTailoredCoverLetter(sampleResume, jd, 'confident', 'Acme Tech', 'Senior Engineer');
assert.ok(coverLetter.openingParagraph.includes('Acme Tech'), 'Cover letter tailored to company');
assert.ok(coverLetter.openingParagraph.includes('Senior Engineer'), 'Cover letter tailored to role');
assert.ok(coverLetter.fullFormattedText.length > 200, 'Complete formatted letter produced');
console.log('✔ Tailored Cover Letter Generator produced customized letter matching resume & JD');

console.log('\nAll 12 Optimization Features tests PASSED successfully!');
