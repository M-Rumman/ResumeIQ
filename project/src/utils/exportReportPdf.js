/**
 * Export resume analysis results as a PDF report (Pro feature).
 * Uses jspdf — loaded on demand to keep initial bundle smaller.
 */

/**
 * @param {object} report
 * @param {number} report.atsScore
 * @param {number} report.matchScore
 * @param {string[]} report.detectedSections
 * @param {string[]} report.missingSections
 * @param {string[]} report.missingKeywords
 * @param {Array<{ text: string }>} report.improvements
 */
export async function downloadResumeAnalysisPdf(report) {
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 48;
  let y = margin;
  const lineHeight = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;

  const addLine = (text, opts = {}) => {
    const { bold = false, size = 11, gap = lineHeight } = opts;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += gap;
    }
  };

  addLine('ResuV — Resume Analysis Report', { bold: true, size: 16, gap: 22 });
  addLine(`Generated: ${new Date().toLocaleString()}`, { size: 10, gap: 20 });

  addLine(`ATS Score: ${report.atsScore}%`, { bold: true, size: 13, gap: 18 });
  addLine(`Job Match Score: ${report.matchScore}%`, { bold: true, size: 13, gap: 22 });

  addLine('Resume Sections', { bold: true, size: 12, gap: 16 });
  addLine(`Detected: ${report.detectedSections.join(', ') || 'None'}`);
  addLine(`Missing: ${report.missingSections.join(', ') || 'None'}`, { gap: 20 });

  if (report.missingKeywords?.length) {
    addLine('Missing Keywords', { bold: true, size: 12, gap: 16 });
    addLine(report.missingKeywords.map((k) => `• ${k}`).join('\n'), { gap: 20 });
  }

  addLine('Improvements & Recommendations', { bold: true, size: 12, gap: 16 });
  const improvementLines = report.improvements?.map((i) => `• ${i.text}`) ?? [];
  addLine(improvementLines.join('\n') || 'None');

  doc.save(`resuv-analysis-${Date.now()}.pdf`);
}
