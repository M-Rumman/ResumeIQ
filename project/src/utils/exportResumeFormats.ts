import { jsPDF } from 'jspdf';
import { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType, BorderStyle } from 'docx';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 1. EXPORT RESUME AS ATS-FRIENDLY PDF
export async function exportResumePdf(resumeText: string, candidateName = 'Resume'): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 45;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;
  const lineHeight = 14;

  const lines = resumeText.split('\n');

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      y += 8;
      continue;
    }

    // Check if this line is the candidate's top Name
    if (i === 0 && trimmed.length < 50) {
      checkPageBreak(28);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(20, 24, 33);
      doc.text(trimmed, margin, y);
      y += 22;
      continue;
    }

    // Check if line is a major Section Heading (e.g. WORK EXPERIENCE, EDUCATION, SKILLS)
    const isHeading = /^(work experience|experience|education|skills|technical skills|summary|professional summary|projects|certifications)$/i.test(trimmed);
    if (isHeading) {
      checkPageBreak(28);
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59); // Slate 800
      doc.text(trimmed.toUpperCase(), margin, y);
      y += 4;
      // Draw horizontal separator rule for clean ATS design
      doc.setDrawColor(203, 213, 225); // Slate 300
      doc.setLineWidth(0.75);
      doc.line(margin, y, pageWidth - margin, y);
      y += 14;
      continue;
    }

    // Check if line is a Role / Title line (e.g. "Senior Engineer — Google" or "Jan 2022 – Present")
    const isRoleHeader = /—|–|-/.test(trimmed) && trimmed.length < 80 && !/^[•\-*]/.test(trimmed);
    if (isRoleHeader) {
      checkPageBreak(18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(30, 41, 59);
      doc.text(trimmed, margin, y);
      y += lineHeight;
      continue;
    }

    // Check if line is a bullet point
    const isBullet = /^[•\-*]|\d+\.\s+/.test(trimmed);
    if (isBullet) {
      const cleanBullet = trimmed.replace(/^[•\-*\d.]+\s*/, '');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85); // Slate 700

      const bulletIndent = 12;
      const bulletLines = doc.splitTextToSize(cleanBullet, maxWidth - bulletIndent);
      checkPageBreak(bulletLines.length * lineHeight + 4);

      // Draw standard clean round bullet
      doc.text('•', margin, y);
      for (const bLine of bulletLines) {
        doc.text(bLine, margin + bulletIndent, y);
        y += lineHeight;
      }
      y += 2;
      continue;
    }

    // Regular body line (contact info, summary paragraph, or skills list)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    const bodyLines = doc.splitTextToSize(trimmed, maxWidth);
    checkPageBreak(bodyLines.length * lineHeight);
    for (const line of bodyLines) {
      doc.text(line, margin, y);
      y += lineHeight;
    }
  }

  const safeFilename = candidateName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  doc.save(`${safeFilename || 'resuv-resume'}.pdf`);
}

// 2. EXPORT RESUME AS ATS-FRIENDLY WORD (.DOCX)
export async function exportResumeDocx(resumeText: string, candidateName = 'Resume'): Promise<void> {
  const lines = resumeText.split('\n');
  const paragraphs: Paragraph[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      paragraphs.push(new Paragraph({ spacing: { after: 120 } }));
      continue;
    }

    // Name at top
    if (i === 0 && trimmed.length < 50) {
      paragraphs.push(
        new Paragraph({
          text: trimmed,
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.LEFT,
          spacing: { after: 120 },
        })
      );
      continue;
    }

    // Major Section Heading
    const isHeading = /^(work experience|experience|education|skills|technical skills|summary|professional summary|projects|certifications)$/i.test(trimmed);
    if (isHeading) {
      paragraphs.push(
        new Paragraph({
          text: trimmed.toUpperCase(),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 100 },
          border: {
            bottom: {
              color: 'CBD5E1',
              space: 4,
              style: BorderStyle.SINGLE,
              size: 6,
            },
          },
        })
      );
      continue;
    }

    // Subheader (Company / Role / Degree)
    const isSubheader = /—|–|-/.test(trimmed) && trimmed.length < 80 && !/^[•\-*]/.test(trimmed);
    if (isSubheader) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed,
              bold: true,
              size: 21, // 10.5pt
              color: '1E293B',
            }),
          ],
          spacing: { before: 120, after: 60 },
        })
      );
      continue;
    }

    // Bullet point
    const isBullet = /^[•\-*]|\d+\.\s+/.test(trimmed);
    if (isBullet) {
      const cleanBullet = trimmed.replace(/^[•\-*\d.]+\s*/, '');
      paragraphs.push(
        new Paragraph({
          text: cleanBullet,
          bullet: {
            level: 0,
          },
          spacing: { after: 60 },
        })
      );
      continue;
    }

    // Normal body paragraph (Contact info, Summary, Skills)
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: trimmed,
            size: 20, // 10pt
            color: '334155',
          }),
        ],
        spacing: { after: 80 },
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720, // 0.5 inch (720 twips)
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeFilename = candidateName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  downloadBlob(blob, `${safeFilename || 'resuv-resume'}.docx`);
}

// 3. EXPORT COVER LETTER AS PDF
export async function exportCoverLetterPdf(coverLetterText: string, candidateName = 'Cover-Letter'): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 54;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;
  const lineHeight = 15;

  const paragraphs = coverLetterText.split('\n\n');

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(30, 41, 59);

    const lines = doc.splitTextToSize(trimmed, maxWidth);
    for (const line of lines) {
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += 10;
  }

  const safeFilename = candidateName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  doc.save(`${safeFilename || 'resuv-cover-letter'}.pdf`);
}

// 4. EXPORT COVER LETTER AS WORD (.DOCX)
export async function exportCoverLetterDocx(coverLetterText: string, candidateName = 'Cover-Letter'): Promise<void> {
  const paragraphs = coverLetterText.split('\n\n').map(p => {
    return new Paragraph({
      children: [
        new TextRun({
          text: p.trim(),
          size: 22, // 11pt
          color: '1E293B',
        }),
      ],
      spacing: { after: 200 },
    });
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1080, // 0.75 in
              right: 1080,
              bottom: 1080,
              left: 1080,
            },
          },
        },
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeFilename = candidateName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  downloadBlob(blob, `${safeFilename || 'resuv-cover-letter'}.docx`);
}
