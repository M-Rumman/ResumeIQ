import { validateRewrites } from './api/_lib/aiValidation.js';
import { generateReasoning } from './api/_lib/analysis-engine/bulletScoring.js';

const values = [
  {
    before: "I worked on the server.",
    after: "Engineered scalable backend services using Node.js.",
    whyItIsWeak: "It uses weak action verbs and lacks specificity.",
    whatInformationIsMissing: "Technical details about the server.",
    whyThisIsStronger: "It uses a strong action verb and specifies the technology."
  }
];

const resumeText = "I worked on the server.";
const keywords = ["Node.js"];

const accepted = validateRewrites(values, resumeText, keywords);

console.log(JSON.stringify(accepted, null, 2));
