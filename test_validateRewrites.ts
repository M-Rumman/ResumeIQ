import { validateRewrites } from './project/api/_lib/aiValidation.js';

const resumeText = `
EXPERIENCE
Software Engineer
- Developed an awesome system for the company using Java.
- Worked on a project that improved performance by 20%.
`;

const llmOutput = [
  {
    before: "Developed an awesome system for the company using Java.",
    after: "Architected a high-performance system for the company using Java.",
    inferenceType: "STRONGLY_SUPPORTED_INFERENCE",
    confidence: "Medium",
    whyItIsWeak: "Weak",
    whatInformationIsMissing: "Missing",
    whyThisIsStronger: "Stronger"
  },
  {
    before: "Worked on a project that improved performance by 20%.",
    after: "Engineered a project that skyrocketed performance by 20%.",
    inferenceType: "STRONGLY_SUPPORTED_INFERENCE",
    confidence: "Medium",
    whyItIsWeak: "Weak",
    whatInformationIsMissing: "Missing",
    whyThisIsStronger: "Stronger"
  }
];

const targetKeywords = ['Java'];
const result = validateRewrites(llmOutput, resumeText, targetKeywords);

console.log(JSON.stringify(result, null, 2));
