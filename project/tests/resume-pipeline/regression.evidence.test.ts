import assert from 'node:assert/strict';
import { matchRequirements, getDeterministicMatches } from '../../api/_lib/analysis-engine/matcher.js';
import { extractCandidateProfile } from '../../api/_lib/analysis-engine/resumeExtraction.js';

const resumeText = `
Candidate Name
Summary
A professional with 5 years of experience.

Experience
Software Engineer — Tech Corp (2020 - Present)
- Responsible for mentoring bachelor students during their internship.
- Communication with stakeholders and managed expectations across multiple teams.

Skills
Communication, Java, TypeScript

Education
B.S. in Computer Science — University of State (2020)
`;

const candidateProfile = extractCandidateProfile(resumeText);
console.log(JSON.stringify(candidateProfile.facts, null, 2));

const job = {
  id: 'job-1',
  title: 'Test Job',
  requirements: [
    {
      id: 'req-edu-1',
      normalized_name: "Bachelor's Degree",
      category: 'education' as const,
      priority: 'required' as const,
      original_text: "Bachelor's Degree in a related field",
      degree_level: 'bachelor' as const
    },
    {
      id: 'req-skill-1',
      normalized_name: "Communication",
      category: 'soft skill' as const,
      priority: 'required' as const,
      original_text: "Communication"
    }
  ]
};

async function testEvidenceAttribution() {
  console.log('Testing Evidence Attribution...');
  
  // Deterministic matching should find the education requirement matching the B.S. degree, 
  // NOT the experience bullet containing the word "bachelor".
  const deterministicResult = getDeterministicMatches(job as any, candidateProfile);
  
  const eduMatch = deterministicResult.matches.find(m => m.requirement.id === 'req-edu-1');
  assert.ok(eduMatch, 'Education match should be found deterministically');
  
  const eduEvidence = eduMatch.evidence[0];
  assert.equal(eduEvidence.evidence_type, 'education', 'Evidence type for education requirement MUST be education');
  assert.ok(eduEvidence.source_text.includes('B.S. in Computer Science'), 'Evidence text MUST be the actual education fact');
  
  const skillMatch = deterministicResult.matches.find(m => m.requirement.id === 'req-skill-1');
  assert.ok(skillMatch, 'Skill match should be found deterministically');
  
  // Communication matches both a skill and an experience bullet.
  // Rule 5: Soft-skill requirements should prefer actual demonstrated experience over a bare keyword when both exist.
  // Since experience has a higher priority modifier (4000 vs 2000 in scoring), it should be preferred.
  const topSkillEvidence = skillMatch.evidence[0];
  assert.equal(topSkillEvidence.evidence_type, 'experience', 'Evidence type for soft-skill MUST prefer experience over bare skill when both exist');
  assert.ok(topSkillEvidence.source_text.includes('Communication with stakeholders'), 'Evidence text MUST be the demonstrated experience');

  console.log('✅ Evidence Attribution Test Passed');
}

testEvidenceAttribution().catch(console.error);
