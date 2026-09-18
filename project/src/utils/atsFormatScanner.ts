export interface AtsFormattingIssue {
  id: string;
  category: 'tables' | 'text_boxes' | 'fonts' | 'columns' | 'headers' | 'structure';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  remediation: string;
  detectedCount?: number;
}

export interface AtsFormatReport {
  score: number; // 0 - 100
  status: 'optimal' | 'needs_review' | 'critical_issues';
  issues: AtsFormattingIssue[];
  passedChecks: string[];
}

export function scanResumeFormatting(resumeText: string, _rawFileContext?: { fileType?: string; originalName?: string }): AtsFormatReport {
  const issues: AtsFormattingIssue[] = [];
  const passedChecks: string[] = [];
  let deduction = 0;

  if (!resumeText || resumeText.trim().length < 50) {
    return {
      score: 30,
      status: 'critical_issues',
      issues: [{
        id: 'empty_text',
        category: 'structure',
        severity: 'critical',
        title: 'Empty or Unreadable Resume Text',
        description: 'Less than 50 characters of readable text could be extracted from your document.',
        remediation: 'Ensure your resume is a text-based PDF or DOCX file, not a scanned image.',
      }],
      passedChecks: [],
    };
  }

  // 1. Check for Tables or Grid Delimiters
  // Task 4: Do NOT flag for tables unless explicit markdown table syntax (|---|) or severe tab-spacing that destroys text flow
  const tableBorderMatches = resumeText.match(/\|(?:\s*-+\s*\|)+|[|+][-=]{3,}[|+]/g) || [];
  const severeTabs = resumeText.match(/\t{3,}|\t[^\n\t]+\t[^\n\t]+\t/g) || [];
  if (tableBorderMatches.length > 0 || severeTabs.length >= 4) {
    deduction += 25;
    issues.push({
      id: 'table_detected',
      category: 'tables',
      severity: 'critical',
      title: 'Table or Multi-Column Grid Layout Detected',
      description: 'Found explicit markdown table syntax or severe tab-spacing that destroys ATS text flow. Parsers often merge cells horizontally, misassigning your titles and dates.',
      remediation: 'Convert all tables to a clean, single-column vertical layout with standard bullet points.',
      detectedCount: tableBorderMatches.length || severeTabs.length,
    });
  } else {
    passedChecks.push('Single-column flow without unreadable table structures');
  }

  // 2. Check for Text Boxes or Sidebars
  // Characterized by fragmented disconnected lines or phrases like "Contact", "Skills" inserted in the middle of sentences
  const fragmentedLines = resumeText.split('\n').filter(line => line.trim().length > 0 && line.trim().length <= 3);
  if (fragmentedLines.length > 8) {
    deduction += 15;
    issues.push({
      id: 'textbox_detected',
      category: 'text_boxes',
      severity: 'warning',
      title: 'Potential Floating Text Box / Sidebar Fragmentation',
      description: `Detected ${fragmentedLines.length} isolated short text fragments. When sidebars or floating text boxes are used, PDF extractors often scatter sidebar text randomly across experience lines.`,
      remediation: 'Place contact info and skills in continuous body flow instead of floating boxes or sidebar columns.',
      detectedCount: fragmentedLines.length,
    });
  } else {
    passedChecks.push('Linear text hierarchy without floating text box fragmentation');
  }

  // 3. Check for Unusual Characters, Dingbats, and Font Mojibake
  // Task 4: Do NOT flag "Unreadable Characters or Custom Font Encoding" unless the text actually contains unparsed unicode replacement characters (\uFFFD). Standard text extraction means font is readable.
  const unicodeReplacementMatches = resumeText.match(/\uFFFD/g) || [];
  const nonStandardBullets = resumeText.match(/[❖➢➤➔■◆★☆✓✔✕✖]/g) || [];
  if (unicodeReplacementMatches.length > 0) {
    deduction += 20;
    issues.push({
      id: 'unusual_fonts_encoding',
      category: 'fonts',
      severity: 'critical',
      title: 'Unreadable Characters or Custom Font Encoding',
      description: `Found ${unicodeReplacementMatches.length} unparsed unicode replacement characters (\uFFFD). This indicates custom font encoding or corrupted text extraction.`,
      remediation: 'Use standard ATS-safe fonts (Arial, Calibri, Helvetica, Times New Roman, Georgia) and standard keyboard characters.',
      detectedCount: unicodeReplacementMatches.length,
    });
  } else if (nonStandardBullets.length > 3) {
    deduction += 10;
    issues.push({
      id: 'decorative_bullets',
      category: 'fonts',
      severity: 'warning',
      title: 'Decorative Icons or Non-Standard Bullets',
      description: 'Found decorative symbol characters (such as stars, checkmarks, or custom arrows) which some legacy ATS engines convert to question marks or drop entirely.',
      remediation: 'Use standard round bullets (•) or hyphens (-) for work experience bullet points.',
      detectedCount: nonStandardBullets.length,
    });
  } else {
    passedChecks.push('Standard ATS-safe characters and bullet typography');
  }

  // 4. Multi-Column Reading Flow Check
  // Check for lines with huge spacing gaps in the middle indicating multi-column resumes
  const columnGapLines = resumeText.split('\n').filter(line => /\S\s{5,}\S/.test(line));
  if (columnGapLines.length > 6) {
    deduction += 15;
    issues.push({
      id: 'multicol_detected',
      category: 'columns',
      severity: 'warning',
      title: 'Two-Column Layout Detected',
      description: `Detected ${columnGapLines.length} lines with wide horizontal gaps. Two-column resumes cause ATS parsers to read line-by-line across columns, mixing unrelated experience and skills together.`,
      remediation: 'Adopt a single-column layout from top to bottom.',
      detectedCount: columnGapLines.length,
    });
  } else {
    passedChecks.push('Clean single-column reading order verified');
  }

  // 5. Header / Contact Info Placement Check
  // Look for email or phone in the text
  const emailMatch = resumeText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = resumeText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  
  if (!emailMatch) {
    deduction += 20;
    issues.push({
      id: 'missing_email_in_body',
      category: 'headers',
      severity: 'critical',
      title: 'Contact Email Not Found in Main Body',
      description: 'Could not detect an email address in the extracted text. If your email is in a PDF header or footer element, ATS software frequently strips headers/footers entirely.',
      remediation: 'Move your email, phone, and contact links directly into the top of the resume document body.',
    });
  } else {
    passedChecks.push('Contact email extracted cleanly in document body');
  }

  if (!phoneMatch) {
    deduction += 10;
    issues.push({
      id: 'missing_phone_in_body',
      category: 'headers',
      severity: 'warning',
      title: 'Phone Number Missing or Embedded in Header',
      description: 'No standard phone number was found in the text flow. If placed inside a header margin or graphics box, it may be ignored by recruiters.',
      remediation: 'Place your phone number clearly under your name in the main body.',
    });
  } else {
    passedChecks.push('Phone number verified in document flow');
  }

  // 6. Section Heading Recognition
  const textLower = resumeText.toLowerCase();
  const standardSections = [
    { name: 'Experience / Work History', regex: /\b(experience|work history|employment|work experience|professional experience and projects)\b/ },
    { name: 'Education', regex: /\b(education|academic|degrees|university|college)\b/ },
    { name: 'Skills', regex: /\b(skills|technical skills|competencies|technologies)\b/ },
  ];

  let missingSections = 0;
  for (const section of standardSections) {
    if (!section.regex.test(textLower)) {
      missingSections++;
    }
  }

  // Check for non-standard compound headings that benefit from an exact standard rename
  const compoundHeadingMatch = resumeText.match(/\b(professional\s+experience\s+(?:and|&)\s+projects|work\s+history\s+(?:and|&)\s+projects)\b/i);
  if (compoundHeadingMatch) {
    issues.push({
      id: 'compound_heading_rename',
      category: 'structure',
      severity: 'info',
      title: 'Actionable ATS Heading Rename',
      description: `Heading "${compoundHeadingMatch[0]}" combines multiple categories. While intelligent parsers process both, older legacy ATS engines may misclassify entries under compound titles.`,
      remediation: `Change '${compoundHeadingMatch[0]}' to 'Experience' to ensure 100% legacy ATS compatibility.`,
    });
  }

  if (missingSections > 0) {
    deduction += missingSections * 8;
    issues.push({
      id: 'nonstandard_headings',
      category: 'structure',
      severity: missingSections >= 2 ? 'critical' : 'warning',
      title: 'Non-Standard or Missing Section Headings',
      description: 'One or more primary sections (Experience, Education, or Skills) were not recognized with conventional ATS headings.',
      remediation: 'Use exact standard headings like "Work Experience", "Education", and "Skills" rather than creative titles like "Where I\'ve Been" or "My Toolkit".',
    });
  } else {
    passedChecks.push('Standard ATS section headings recognized');
  }

  const score = Math.max(10, Math.min(100, 100 - deduction));
  let status: AtsFormatReport['status'] = 'optimal';
  if (score < 60 || issues.some(i => i.severity === 'critical')) {
    status = 'critical_issues';
  } else if (score < 85 || issues.length > 0) {
    status = 'needs_review';
  }

  return {
    score,
    status,
    issues,
    passedChecks,
  };
}
