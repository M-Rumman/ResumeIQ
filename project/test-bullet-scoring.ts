import { validateRewrites } from './api/_lib/aiValidation.js';

const targetKeywords = ['React', 'TypeScript', 'Node.js', 'Python', 'AWS', 'Docker', 'SQL', 'PostgreSQL'];

const resumeText = `
Experience
Software Engineer at TechCorp
• Wrote some code for the backend.
• Developed a full-stack web application using React and Node.js that scaled to 100,000 monthly active users and generated $1M in revenue.
• Did some testing and deployment.
• Built a small script to parse logs.
`;

console.log("Running Bullet Improvement Pipeline Tests...\n");

const case1 = {
  before: 'Wrote some code for the backend using Node.js and PostgreSQL.',
  after: 'Engineered a scalable backend system using Node.js and PostgreSQL to improve system reliability.',
  confidence: 'High',
  inferenceType: 'STRONGLY_SUPPORTED_INFERENCE',
};

// Case 2: Already strong bullet -> unchanged bullet -> 0 improvement
const case2 = {
  before: 'Developed a full-stack web application using React and Node.js that scaled to 100,000 monthly active users and generated $1M in revenue.',
  after: 'Developed a full-stack web application using React and Node.js that scaled to 100,000 monthly active users and generated $1M in revenue.',
  confidence: 'High',
  inferenceType: 'EXPLICITLY_STATED',
};

// Case 3: Weak bullet with insufficient information -> conservative improvement or unchanged bullet.
const case3 = {
  before: 'Did some testing and deployment.',
  after: 'Led a global QA team of 50 engineers to deploy enterprise AWS infrastructure achieving 99.999% uptime.', // Invented metrics
  confidence: 'Medium',
  inferenceType: 'STRONGLY_SUPPORTED_INFERENCE',
};

// Case 5: LLM returns malformed/missing score -> system handles it explicitly.
const case5 = {
  before: 'Built a small script to parse logs.',
};

const input = [case1, case2, case3, case5];

const results = validateRewrites(input, resumeText, targetKeywords);

console.log(JSON.stringify(results, null, 2));

console.log("\n--- Validating Expected Behaviors ---");

const getResult = (beforePrefix: string) => results.find(r => r.before.startsWith(beforePrefix));

const res1 = getResult('Wrote some code for the backend using Node.js and PostgreSQL');
if (res1 && res1.improvementScore > 0) {
  console.log("✅ Case 1: Positive score improvement for genuinely stronger bullet.");
} else {
  console.error("❌ Case 1 Failed.", res1);
}

const res2 = getResult('Developed a full-stack');
if (res2 && res2.improvementScore === 0 && res2.before === res2.after) {
  console.log("✅ Case 2: 0 improvement for already strong bullet, original preserved.");
} else {
  console.error("❌ Case 2 Failed.", res2);
}

const res3 = getResult('Did some testing');
if (res3 && res3.improvementScore === 0 && res3.after === res3.before && res3.reasoning.includes('Original bullet preserved')) {
  console.log("✅ Case 3: Fallback triggered for invented metrics, original preserved with 0 improvement.");
} else {
  console.error("❌ Case 3 Failed.", res3);
}

const res5 = getResult('Built a small script');
if (res5 && res5.improvementScore === 0 && res5.after === res5.before) {
  console.log("✅ Case 5: Malformed output handled explicitly, original preserved.");
} else {
  console.error("❌ Case 5 Failed.", res5);
}

if (results.length === 4) {
  console.log("✅ Case 4: Multiple bullets handled independently.");
} else {
  console.error("❌ Case 4 Failed: Expected 4 results, got " + results.length);
}

console.log("\nAll tests completed.");
