export interface ParsedLinkedInProfile {
  name: string;
  headline: string;
  location: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  about: string;
  experience: Array<{
    role: string;
    company: string;
    dates: string;
    description: string[];
  }>;
  education: Array<{
    school: string;
    degree: string;
    dates: string;
  }>;
  skills: string[];
}

export function parseLinkedInText(rawInput: string): ParsedLinkedInProfile {
  const lines = rawInput.split('\n').map(l => l.trim()).filter(Boolean);
  
  let name = '';
  let headline = '';
  let location = '';
  let email = '';
  let phone = '';
  let linkedinUrl = '';
  let about = '';
  const experience: ParsedLinkedInProfile['experience'] = [];
  const education: ParsedLinkedInProfile['education'] = [];
  const skills: string[] = [];

  // 1. Extract contact details
  const emailMatch = rawInput.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) email = emailMatch[0];

  const phoneMatch = rawInput.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) phone = phoneMatch[0];

  const urlMatch = rawInput.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
  if (urlMatch) linkedinUrl = urlMatch[0];

  // 2. Identify candidate Name & Headline
  // Typically line 0 is Name if not a header
  if (lines.length > 0) {
    const candidateName = lines[0];
    if (candidateName.length < 50 && !/experience|education|skills|about|contact/i.test(candidateName)) {
      name = candidateName;
    }
  }

  if (lines.length > 1 && !/experience|education|skills|about|contact/i.test(lines[1])) {
    headline = lines[1];
  }

  // 3. Section Slicing
  let currentSection: 'header' | 'about' | 'experience' | 'education' | 'skills' = 'header';
  let currentExpItem: { role: string; company: string; dates: string; description: string[] } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Check for section headers
    if (/^(about|summary)$/i.test(lower)) {
      currentSection = 'about';
      continue;
    }
    if (/^(experience|work experience)$/i.test(lower)) {
      currentSection = 'experience';
      continue;
    }
    if (/^(education)$/i.test(lower)) {
      currentSection = 'education';
      if (currentExpItem) {
        experience.push(currentExpItem);
        currentExpItem = null;
      }
      continue;
    }
    if (/^(skills|top skills|skills & endorsements)$/i.test(lower)) {
      currentSection = 'skills';
      if (currentExpItem) {
        experience.push(currentExpItem);
        currentExpItem = null;
      }
      continue;
    }

    // Process based on current section
    if (currentSection === 'about') {
      about += (about ? ' ' : '') + line;
    } else if (currentSection === 'experience') {
      // Look for role / company indicators or dates
      const dateMatch = line.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)?\s*(?:19|20)\d{2}\b/i);
      if (dateMatch && lines[i - 1] && !/^(experience|education)$/i.test(lines[i - 1])) {
        if (currentExpItem) {
          experience.push(currentExpItem);
        }
        const previousLine = lines[i - 1];
        const role = lines[i - 2] && lines[i - 2].length < 60 ? lines[i - 2] : 'Professional Role';
        currentExpItem = {
          role,
          company: previousLine,
          dates: line,
          description: [],
        };
      } else if (currentExpItem) {
        if (/^[•\-*]/.test(line) || line.length > 20) {
          currentExpItem.description.push(line.replace(/^[•\-*]\s*/, ''));
        }
      }
    } else if (currentSection === 'education') {
      if (/university|college|school|institute|academy/i.test(line)) {
        const degree = lines[i + 1] && lines[i + 1].length < 80 ? lines[i + 1] : "Bachelor's Degree";
        const dates = lines[i + 2] && /\b(?:19|20)\d{2}\b/.test(lines[i + 2]) ? lines[i + 2] : '';
        education.push({
          school: line,
          degree,
          dates,
        });
      }
    } else if (currentSection === 'skills') {
      const splitSkills = line.split(/[•,|·]/).map(s => s.trim()).filter(Boolean);
      for (const s of splitSkills) {
        if (s.length > 1 && s.length < 40) {
          skills.push(s);
        }
      }
    }
  }

  if (currentExpItem) {
    experience.push(currentExpItem);
  }

  // Set safe fallbacks if sections were sparse
  if (!name) name = 'Candidate Name';
  if (!headline) headline = 'Professional Title';

  return {
    name,
    headline,
    location: location || 'City, Country',
    email: email || 'name@example.com',
    phone: phone || '+1 (555) 000-0000',
    linkedinUrl: linkedinUrl || 'linkedin.com/in/profile',
    about,
    experience,
    education,
    skills,
  };
}

export function formatProfileToResumeText(profile: ParsedLinkedInProfile): string {
  let doc = `${profile.name.toUpperCase()}\n`;
  doc += `${profile.headline}\n`;
  doc += `${profile.email} | ${profile.phone} | ${profile.location} | ${profile.linkedinUrl}\n\n`;

  if (profile.about) {
    doc += `PROFESSIONAL SUMMARY\n${profile.about}\n\n`;
  }

  if (profile.experience.length > 0) {
    doc += `WORK EXPERIENCE\n`;
    for (const exp of profile.experience) {
      doc += `${exp.role} — ${exp.company}\n`;
      if (exp.dates) doc += `${exp.dates}\n`;
      if (exp.description.length > 0) {
        for (const desc of exp.description) {
          doc += `• ${desc}\n`;
        }
      } else {
        doc += `• Executed core responsibilities and delivered key milestones for ${exp.company}.\n`;
      }
      doc += `\n`;
    }
  }

  if (profile.education.length > 0) {
    doc += `EDUCATION\n`;
    for (const edu of profile.education) {
      doc += `${edu.school}\n`;
      doc += `${edu.degree}${edu.dates ? ` (${edu.dates})` : ''}\n\n`;
    }
  }

  if (profile.skills.length > 0) {
    doc += `SKILLS\n`;
    doc += `${profile.skills.join(', ')}\n`;
  }

  return doc.trim();
}
