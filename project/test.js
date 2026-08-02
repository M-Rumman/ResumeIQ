const text = `
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

const bullets = text.trim().split('\n');
const actionVerbsRegex = /^(developed|led|managed|created|designed|implemented|increased|reduced|achieved|built|delivered|engineered|orchestrated|spearheaded|launched|ran|mentored)/i;
const flagged = [];

for(const b of bullets) { 
  // Wait, I need to see exactly how resumeParser.ts parses bullets.
  // In evaluator.ts: 
  const words = b.trim().split(/\s+/);
  
  let isStrong = false;
  if(words.length > 0 && actionVerbsRegex.test(words[0])) {
    isStrong = true;
  }
  if(!isStrong) {
    flagged.push({bullet: b, word0: words[0]});
  }
}
console.table(flagged);
