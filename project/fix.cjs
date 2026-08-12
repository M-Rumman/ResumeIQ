const fs = require('fs');
const files = [
  'tests/resume-pipeline/matcher.test.ts',
  'tests/resume-pipeline/regression.priya.test.ts',
  'tests/resume-pipeline/test_matcher.ts'
];
for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/await matchRequirements\(([\w]+),\s*([\w]+)\)/g, 'await matchRequirements($1, $2, { matches: [], unmatchedRequirements: $1.requirements, prioritizedFacts: $2.facts })');
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
}
