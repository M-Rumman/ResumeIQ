export interface SectionAuditItem {
  sectionName: string;
  status: 'passed' | 'warning' | 'critical';
  score: number; // 0 - 100
  headline: string;
  critiques: string[];
  recommendations: string[];
}

export interface FullResumeAudit {
  contactAudit: SectionAuditItem;
  summaryAudit: SectionAuditItem;
  experienceAudit: SectionAuditItem;
  educationAudit: SectionAuditItem;
  skillsAudit: SectionAuditItem;
}

export function performSectionAudits(resumeText: string): FullResumeAudit {
  const lines = resumeText.split('\n').map(l => l.trim()).filter(Boolean);
  const textLower = resumeText.toLowerCase();

  // 1. CONTACT INFORMATION AUDIT
  const emailMatch = resumeText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const phoneMatch = resumeText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const linkedinMatch = resumeText.match(/(?:linkedin\.com\/in\/[\w-]+|linkedin)/i);
  const portfolioMatch = resumeText.match(/(?:github\.com\/[\w-]+|behance|dribbble|https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  const locationMatch = resumeText.match(/\b([A-Z][a-zA-Z\s]+,\s*[A-Z]{2}|Remote|[A-Za-z\s]+,\s*[A-Za-z]+)\b/);

  const contactCritiques: string[] = [];
  const contactRecommendations: string[] = [];
  let contactScore = 100;

  if (!emailMatch) {
    contactScore -= 40;
    contactCritiques.push('No email address detected.');
    contactRecommendations.push('Add a professional email address (e.g. firstname.lastname@gmail.com) at the top of your resume.');
  } else {
    const emailPrefix = emailMatch[1].split('@')[0].toLowerCase();
    if (/baby|cool|gamer|killer|party|dude|queen|king|sexy/i.test(emailPrefix)) {
      contactScore -= 15;
      contactCritiques.push(`Email address "${emailMatch[1]}" may appear informal to corporate hiring teams.`);
      contactRecommendations.push('Create a dedicated, clean email with your first and last name.');
    }
  }

  if (!phoneMatch) {
    contactScore -= 20;
    contactCritiques.push('No phone number found in document text.');
    contactRecommendations.push('Include an active mobile number with standard spacing (e.g., +1 (555) 123-4567).');
  }

  if (!linkedinMatch) {
    contactScore -= 15;
    contactCritiques.push('LinkedIn profile link is missing.');
    contactRecommendations.push('Over 85% of recruiters cross-reference LinkedIn. Add your clean customized vanity URL (linkedin.com/in/yourname).');
  }

  if (!portfolioMatch && /developer|engineer|designer|architect|programmer|data/i.test(textLower)) {
    contactScore -= 5;
    contactCritiques.push('Technical role detected without a GitHub, portfolio, or project repository link.');
    contactRecommendations.push('Add your GitHub or personal portfolio link to showcase verified code and artifacts.');
  }

  if (!locationMatch) {
    contactScore -= 10;
    contactCritiques.push('Location or work arrangement is not explicitly indicated.');
    contactRecommendations.push('Specify your City, State/Country or "Open to Remote" so ATS geo-filters do not disqualify you.');
  }

  const contactAudit: SectionAuditItem = {
    sectionName: 'Contact Information',
    status: contactScore >= 85 ? 'passed' : contactScore >= 65 ? 'warning' : 'critical',
    score: Math.max(20, contactScore),
    headline: contactScore >= 85 ? 'Contact details are complete and recruiter-ready' : 'Missing essential contact or profile links',
    critiques: contactCritiques.length ? contactCritiques : ['All standard contact fields (email, phone, location, profile link) detected.'],
    recommendations: contactRecommendations.length ? contactRecommendations : ['No changes needed. Your contact header is cleanly structured.'],
  };

  // 2. PROFESSIONAL SUMMARY AUDIT
  const summaryHeaderIndex = lines.findIndex(l => /^(professional summary|summary|about me|profile|executive summary)$/i.test(l));
  const hasSummary = summaryHeaderIndex !== -1;
  const summaryCritiques: string[] = [];
  const summaryRecommendations: string[] = [];
  let summaryScore = 80;

  if (!hasSummary) {
    summaryScore = 60;
    summaryCritiques.push('No dedicated "Professional Summary" or "Profile" header recognized.');
    summaryRecommendations.push('Include a 2-3 sentence executive summary highlighting your role, years of experience, and primary value proposition.');
  } else {
    // Check summary lines
    const summaryLines = lines.slice(summaryHeaderIndex + 1, summaryHeaderIndex + 6).filter(l => !/^(experience|education|skills|projects)$/i.test(l));
    const summaryText = summaryLines.join(' ');
    const wordCount = summaryText.split(/\s+/).length;

    if (wordCount < 15) {
      summaryScore -= 20;
      summaryCritiques.push('Summary is too brief or under-developed.');
      summaryRecommendations.push('Expand your summary to 40-75 words showcasing your career focus and top achievements.');
    } else if (wordCount > 100) {
      summaryScore -= 15;
      summaryCritiques.push('Summary is overly long (>100 words) and may be skipped by busy recruiters.');
      summaryRecommendations.push('Condense to 3-4 high-impact sentences for quick readability.');
    } else {
      summaryScore = 100;
    }

    if (/hardworking|detail-oriented|fast learner|team player|passionate professional/i.test(summaryText)) {
      summaryScore = Math.max(50, summaryScore - 15);
      summaryCritiques.push('Contains generic filler phrases ("hardworking", "detail-oriented").');
      summaryRecommendations.push('Replace generic traits with hard skills, domains, or notable career metrics.');
    }
  }

  const summaryAudit: SectionAuditItem = {
    sectionName: 'Professional Summary',
    status: summaryScore >= 80 ? 'passed' : summaryScore >= 60 ? 'warning' : 'critical',
    score: summaryScore,
    headline: summaryScore >= 80 ? 'Well-targeted summary statement' : 'Summary could be punchier and more specific',
    critiques: summaryCritiques.length ? summaryCritiques : ['Summary is concise, professional, and well-proportioned.'],
    recommendations: summaryRecommendations.length ? summaryRecommendations : ['Your summary statement delivers a clear professional snapshot.'],
  };

  // 3. WORK EXPERIENCE AUDIT
  const expIndex = lines.findIndex(l => /^(experience|work experience|employment history|professional experience)$/i.test(l));
  const experienceCritiques: string[] = [];
  const experienceRecommendations: string[] = [];
  let experienceScore = 85;

  if (expIndex === -1) {
    experienceScore = 40;
    experienceCritiques.push('Could not find a standard "Experience" or "Work Experience" heading.');
    experienceRecommendations.push('Use the exact heading "Work Experience" or "Professional Experience" for maximum ATS parsing.');
  } else {
    // Check date patterns
    const hasDates = /\b(?:19|20)\d{2}\b|\b(?:present|current)\b/i.test(textLower);
    if (!hasDates) {
      experienceScore -= 20;
      experienceCritiques.push('Missing employment dates or unparseable date formats.');
      experienceRecommendations.push('Use clear date ranges (e.g., "Jan 2022 – Present" or "2021 – 2024").');
    }
    
    // Check bullet count
    const bulletsInResume = lines.filter(l => /^[•\-*]|\d+\.\s+/.test(l));
    if (bulletsInResume.length < 4) {
      experienceScore -= 15;
      experienceCritiques.push('Very few bullet points detected. Paragraphs are difficult for recruiters to scan.');
      experienceRecommendations.push('Format your work history with 3-5 concise bullet points per role.');
    }
  }

  const experienceAudit: SectionAuditItem = {
    sectionName: 'Work Experience',
    status: experienceScore >= 80 ? 'passed' : experienceScore >= 60 ? 'warning' : 'critical',
    score: experienceScore,
    headline: experienceScore >= 80 ? 'Strong experience section structure' : 'Experience formatting needs improvement',
    critiques: experienceCritiques.length ? experienceCritiques : ['Clear employment history with recognizable dates and bulleted accomplishments.'],
    recommendations: experienceRecommendations.length ? experienceRecommendations : ['Maintain reverse-chronological order with most recent role first.'],
  };

  // 4. EDUCATION AUDIT
  const eduIndex = lines.findIndex(l => /^(education|academic background|degrees)$/i.test(l));
  const educationCritiques: string[] = [];
  const educationRecommendations: string[] = [];
  let educationScore = 90;

  if (eduIndex === -1) {
    educationScore = 50;
    educationCritiques.push('No standard "Education" section header found.');
    educationRecommendations.push('Add an "Education" section specifying your degree, institution, and graduation year.');
  } else {
    const eduSnippet = lines.slice(eduIndex, eduIndex + 8).join(' ').toLowerCase();
    const hasDegree = /bachelor|master|phd|associate|b\.?s|m\.?s|b\.?a|mba|degree|diploma/i.test(eduSnippet);
    if (!hasDegree) {
      educationScore -= 20;
      educationCritiques.push('Degree title (e.g., B.S., B.A., M.S., High School) was not clearly recognized.');
      educationRecommendations.push('State the full degree name clearly: e.g. "Bachelor of Science in Computer Science".');
    }

    if (/gpa:\s*(?:[1-2]\.\d|3\.[0-3])/i.test(eduSnippet)) {
      educationCritiques.push('Low or mediocre GPA listed in education.');
      educationRecommendations.push('Industry best practice: Omit GPA unless it is 3.5 or higher, or if you have been in the workforce for over 2 years.');
    }
  }

  const educationAudit: SectionAuditItem = {
    sectionName: 'Education',
    status: educationScore >= 80 ? 'passed' : educationScore >= 60 ? 'warning' : 'critical',
    score: educationScore,
    headline: educationScore >= 80 ? 'Education section is properly formatted' : 'Education details need refinement',
    critiques: educationCritiques.length ? educationCritiques : ['Degree, institution, and dates are formatted cleanly for ATS readers.'],
    recommendations: educationRecommendations.length ? educationRecommendations : ['Keep education concise, especially if you have 3+ years of professional experience.'],
  };

  // 5. SKILLS AUDIT
  const skillsIndex = lines.findIndex(l => /^(skills|technical skills|technologies|core competencies)$/i.test(l));
  const skillsCritiques: string[] = [];
  const skillsRecommendations: string[] = [];
  let skillsScore = 85;

  if (skillsIndex === -1) {
    skillsScore = 50;
    skillsCritiques.push('No dedicated "Skills" section detected.');
    skillsRecommendations.push('Add a dedicated Skills section near the top or bottom of your resume for fast ATS keyword parsing.');
  } else {
    const skillsSnippet = lines.slice(skillsIndex, skillsIndex + 8).join(' ');
    if (skillsSnippet.length < 30) {
      skillsScore -= 20;
      skillsCritiques.push('Skills section contains very few entries.');
      skillsRecommendations.push('Group skills into categories (e.g. "Languages", "Frameworks", "Cloud & Tools") with 10-15 key skills.');
    }
  }

  const skillsAudit: SectionAuditItem = {
    sectionName: 'Skills',
    status: skillsScore >= 80 ? 'passed' : skillsScore >= 60 ? 'warning' : 'critical',
    score: skillsScore,
    headline: skillsScore >= 80 ? 'Skills section is ATS-accessible' : 'Skills section needs enrichment',
    critiques: skillsCritiques.length ? skillsCritiques : ['Dedicated skills section present for search keyword discovery.'],
    recommendations: skillsRecommendations.length ? skillsRecommendations : ['Align skills directly with target job requirements.'],
  };

  return {
    contactAudit,
    summaryAudit,
    experienceAudit,
    educationAudit,
    skillsAudit,
  };
}
