import { matchRequirements } from '../../api/_lib/analysis-engine/matcher.js';
import { extractCandidateProfile } from '../../api/_lib/analysis-engine/resumeExtraction.js';

const resumeText = `
Summary
Construction Project Manager with 8 years of experience.

Certifications
PMP (Project Management Professional)

Education
B.S. in Construction Management — Colorado State University, 2016
`;

const candidate = extractCandidateProfile(resumeText);
console.log('Candidate Facts:', JSON.stringify(candidate.facts, null, 2));

const job = {
  id: 'job-1',
  title: 'Project Manager',
  requirements: [
    {
      id: 'req-edu-1',
      normalized_name: "Bachelor's Degree in Construction Management or Civil Engineering",
      category: 'education' as const,
      priority: 'required' as const,
      original_text: "Bachelor's Degree in Construction Management or Civil Engineering",
      degree_level: 'bachelor' as const,
      fields: ['Construction Management', 'Civil Engineering']
    },
    {
      id: 'req-cert-1',
      normalized_name: "PMP",
      category: 'certification' as const,
      priority: 'preferred' as const,
      original_text: "PMP (Project Management Professional) certification"
    }
  ]
};

async function run() {
  // Mock callOpenRouter if it falls back to LLM
  // But we want to see if it EXACT matches first. If it falls back to LLM, we log it.
  const result = await matchRequirements(job as any, candidate);
  console.log('Matches:', JSON.stringify(result.matches, null, 2));
}

run().catch(console.error);
