import { validateAndProcessRequirements } from '../api/_lib/analysis-engine/jdParser.ts';

const jdText = `We are looking for someone with UX Research Experience. 
You should have a Bachelor's Degree in Psychology/HCI/Cognitive Science or related.
You will be Qualitative and Quantitative Research Methods.
You will be Running Research at Scale.
You must have Stakeholder Communication and Storytelling.
Preferred: Master's Degree in Psychology/HCI/Cognitive Science or related.`;

const parsed = [
  {
    normalized_name: 'UX Research Experience',
    original_text: 'UX Research Experience'
  },
  {
    normalized_name: 'Bachelor\'s Degree',
    original_text: 'Bachelor\'s Degree in Psychology/HCI/Cognitive Science or related'
  }
];

const result = validateAndProcessRequirements(parsed, jdText);
console.log(JSON.stringify(result, null, 2));
