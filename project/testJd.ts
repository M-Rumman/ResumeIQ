import { parseJobDescription } from './api/_lib/analysis-engine/jdParser.js';

const jd = `
Role: Senior Software Engineer
We are looking for a Senior Software Engineer to join our core backend team.
Requirements:
- Bachelor's degree in Computer Science or related field.
- 5+ years of experience in backend development.
- Strong proficiency in Node.js and TypeScript.
- Experience with PostgreSQL and Redis.
Nice to have:
- Previous experience with AI/ML pipelines.
- Familiarity with Kubernetes.
`;

async function test() {
  try {
    const result = await parseJobDescription(jd);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(e);
  }
}

test();
