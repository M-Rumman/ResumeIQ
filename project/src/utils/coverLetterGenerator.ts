export type CoverLetterTone = 'professional' | 'confident' | 'modern' | 'concise';

export interface GeneratedCoverLetter {
  candidateName: string;
  candidateContact: string;
  date: string;
  recipient: string;
  companyName: string;
  targetRole: string;
  subjectLine: string;
  salutation: string;
  openingParagraph: string;
  bodyParagraph: string;
  impactParagraph: string;
  closingParagraph: string;
  signOff: string;
  fullFormattedText: string;
}

export function generateTailoredCoverLetter(
  resumeText: string,
  jdText: string,
  tone: CoverLetterTone = 'professional',
  customCompany?: string,
  customRole?: string
): GeneratedCoverLetter {
  // 1. Extract Candidate Name & Contact
  const lines = resumeText.split('\n').map(l => l.trim()).filter(Boolean);
  const candidateName = lines[0] && lines[0].length < 50 ? lines[0] : 'Candidate Name';
  const emailMatch = resumeText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = resumeText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const candidateContact = [emailMatch?.[0], phoneMatch?.[0]].filter(Boolean).join(' | ') || 'email@example.com | (555) 000-0000';

  // 2. Identify Target Role & Company
  let targetRole = customRole || '';
  if (!targetRole && jdText) {
    const roleMatch = jdText.match(/(?:seeking a|looking for an?|position of|hiring a|role:)\s+([A-Za-z\s]{3,40})/i);
    if (roleMatch && roleMatch[1]) {
      targetRole = roleMatch[1].trim();
    } else {
      const firstLine = jdText.split('\n')[0].trim();
      targetRole = firstLine.length < 50 ? firstLine : 'Specialist';
    }
  }
  if (!targetRole) targetRole = 'Target Role';

  let companyName = customCompany || '';
  if (!companyName && jdText) {
    const compMatch = jdText.match(/(?:at|join|with)\s+([A-Z][a-zA-Z0-9&.\s]{2,30})(?:\s+team|\s+family|\s+inc|\s+llc|\s+technologies)?/i);
    if (compMatch && compMatch[1]) companyName = compMatch[1].trim();
  }
  if (!companyName) companyName = 'Your Team';

  // 3. Extract top skills/evidence from resume to highlight
  const hardSkillsList = ['leadership', 'engineering', 'architecture', 'optimization', 'cloud infrastructure', 'data analysis', 'stakeholder management', 'problem-solving'];
  const matchedSkills: string[] = [];
  const lowerResume = resumeText.toLowerCase();
  for (const s of hardSkillsList) {
    if (lowerResume.includes(s)) matchedSkills.push(s);
  }
  const topSkill1 = matchedSkills[0] || 'strategic execution';
  const topSkill2 = matchedSkills[1] || 'cross-functional collaboration';

  // Extract a quantified win if present
  const metricBullet = lines.find(l => /^[•\-*]/.test(l) && /(?:\d+%|\$\d+|\d+x)/.test(l));
  const cleanMetric = metricBullet
    ? metricBullet.replace(/^[•\-*\s]+/, '')
    : 'consistently delivered high-priority projects ahead of schedule while optimizing operational efficiency';

  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const recipient = 'Hiring Team';
  const salutation = `Dear ${companyName} Hiring Team,`;
  const subjectLine = `Application for ${targetRole} — ${candidateName}`;

  let openingParagraph = '';
  let bodyParagraph = '';
  let impactParagraph = '';
  let closingParagraph = '';

  if (tone === 'confident') {
    openingParagraph = `I am writing to express my strong interest in the ${targetRole} opportunity at ${companyName}. With a proven track record of spearheading high-impact initiatives and driving measurable results, I am eager to bring my expertise in ${topSkill1} and ${topSkill2} to your team.`;
    bodyParagraph = `Throughout my career, I have specialized in turning complex challenges into streamlined, scalable systems. In reviewing the requirements for the ${targetRole}, I noted your focus on driving excellence. My background directly reflects this mandate: I have consistently led initiatives that elevated standards and delivered sustainable value.`;
    impactParagraph = `Specifically, in my recent work, I ${cleanMetric}. This experience taught me how to operate with agility while keeping organizational goals squarely in focus, which I am excited to replicate at ${companyName}.`;
    closingParagraph = `I welcome the opportunity to discuss how my skillset and proactive approach will help ${companyName} achieve its upcoming milestones. Thank you for your time and consideration.`;
  } else if (tone === 'modern') {
    openingParagraph = `I was thrilled to come across the ${targetRole} opening at ${companyName}. As someone who thrives on building modern solutions and collaborating across disciplines, your mission immediately resonated with my passion for ${topSkill1}.`;
    bodyParagraph = `What excites me most about this role is the opportunity to combine ${topSkill1} with ${topSkill2}. In my past positions, I have focused on solving real user and operational bottlenecks, ensuring that every project delivers both technical elegance and concrete business impact.`;
    impactParagraph = `A representative highlight of my work includes how I ${cleanMetric}. I pride myself on staying ahead of emerging best practices and fostering a culture of continuous improvement.`;
    closingParagraph = `I would love to connect and share more about how my background aligns with your vision for the ${targetRole}. Looking forward to hearing from you.`;
  } else if (tone === 'concise') {
    openingParagraph = `Please accept this letter as my enthusiastic application for the ${targetRole} position at ${companyName}.`;
    bodyParagraph = `My experience centers on ${topSkill1} and ${topSkill2}. Across multiple cross-functional initiatives, I have focused on lean, high-velocity execution tailored to organizational priorities.`;
    impactParagraph = `Most notably, I ${cleanMetric}. I am confident this proven ability to execute will provide immediate value to ${companyName}.`;
    closingParagraph = `I look forward to discussing how I can contribute to your goals. Thank you for your review.`;
  } else {
    // Professional / Executive
    openingParagraph = `I am writing to formally submit my application for the ${targetRole} position at ${companyName}. Having followed your organization's impressive accomplishments, I am keen to contribute my background in ${topSkill1} and ${topSkill2} toward your continued growth.`;
    bodyParagraph = `My professional journey has been defined by strategic ownership and a rigorous dedication to quality. When reviewing your job specifications, I recognized an ideal alignment with my experience overseeing complex workflows, mentoring colleagues, and translating objectives into measurable operational wins.`;
    impactParagraph = `For example, I recently ${cleanMetric}. Accomplishments like this demonstrate my commitment to delivering tangible returns on every organizational investment.`;
    closingParagraph = `Thank you for your consideration. I look forward to the privilege of discussing how my qualifications align with the needs of ${companyName}.`;
  }

  const signOff = 'Sincerely,\n' + candidateName;

  const fullFormattedText = [
    candidateName.toUpperCase(),
    candidateContact,
    '',
    date,
    '',
    `Hiring Team`,
    companyName,
    '',
    `RE: ${subjectLine}`,
    '',
    salutation,
    '',
    openingParagraph,
    '',
    bodyParagraph,
    '',
    impactParagraph,
    '',
    closingParagraph,
    '',
    signOff,
  ].join('\n');

  return {
    candidateName,
    candidateContact,
    date,
    recipient,
    companyName,
    targetRole,
    subjectLine,
    salutation,
    openingParagraph,
    bodyParagraph,
    impactParagraph,
    closingParagraph,
    signOff,
    fullFormattedText,
  };
}
