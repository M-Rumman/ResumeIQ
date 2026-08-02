import { parseResumeText } from './api/_lib/resumeParser.js';

const resumeText = `
Experience
- Led
- Built
- Ran
- Mentored
- Regularly presented
- Partnered
- Conducted
- Designed
- Supported
- Synthesized
`;

const structuredResume = parseResumeText(resumeText);
const bullets = [
  ...(structuredResume.experience || []),
  ...(structuredResume.projects || [])
];

let actionVerbCount = 0;
const actionVerbsRegex = /^(developed|led|managed|created|designed|implemented|increased|reduced|achieved|built|delivered|engineered|orchestrated|spearheaded|launched|ran|mentored)/i;
const flagged = [];

for (const bullet of bullets) {
  const words = bullet.trim().split(/\s+/);
  
  let isStrong = false;
  if (words.length > 0 && actionVerbsRegex.test(words[0])) {
    actionVerbCount++;
    isStrong = true;
  }
  if (!isStrong) {
    flagged.push({ bullet, word0: words[0] });
  }
}

console.table(flagged);
