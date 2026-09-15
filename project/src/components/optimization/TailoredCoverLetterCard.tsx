import { useState, useEffect } from 'react';
import { FileText, Copy, Check, Download, RefreshCw } from 'lucide-react';
import { generateTailoredCoverLetter, type CoverLetterTone } from '../../utils/coverLetterGenerator';
import { exportCoverLetterPdf, exportCoverLetterDocx } from '../../utils/exportResumeFormats';

interface TailoredCoverLetterCardProps {
  resumeText: string;
  jobDescription: string;
}

export default function TailoredCoverLetterCard({
  resumeText,
  jobDescription,
}: TailoredCoverLetterCardProps) {
  const [tone, setTone] = useState<CoverLetterTone>('professional');
  const [customCompany, setCustomCompany] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [letterText, setLetterText] = useState('');
  const [copied, setCopied] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleGenerate = () => {
    if (!resumeText.trim()) return;
    const generated = generateTailoredCoverLetter(
      resumeText,
      jobDescription,
      tone,
      customCompany.trim() || undefined,
      customRole.trim() || undefined
    );
    setLetterText(generated.fullFormattedText);
  };

  useEffect(() => {
    if (resumeText.trim() && !letterText) {
      handleGenerate();
    }
  }, [resumeText, jobDescription]);

  const handleCopy = () => {
    navigator.clipboard.writeText(letterText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await exportCoverLetterPdf(letterText, customRole || 'Cover-Letter');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportDocx = async () => {
    setExportingDocx(true);
    try {
      await exportCoverLetterDocx(letterText, customRole || 'Cover-Letter');
    } finally {
      setExportingDocx(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-[#3c4a59] to-[#252f38] text-white shadow-sm">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900">Tailored Cover Letter Studio</h3>
            <p className="text-xs text-gray-500">Auto-generated matching letter tailored to your resume achievements and target job requirements</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopy}
            disabled={!letterText}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy Text'}
          </button>
          <button
            onClick={handleExportPdf}
            disabled={!letterText || exportingPdf}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-[#3c4a59] flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {exportingPdf ? 'Exporting PDF...' : 'Export PDF'}
          </button>
          <button
            onClick={handleExportDocx}
            disabled={!letterText || exportingDocx}
            className="px-3.5 py-2 rounded-xl bg-[#3c4a59] hover:bg-[#2e3a47] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {exportingDocx ? 'Generating Word...' : 'Download Word (.docx)'}
          </button>
        </div>
      </div>

      {/* Tone & Target Role Controls */}
      <div className="grid sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
        <div>
          <label className="block text-xs font-bold text-gray-900 mb-1">Tone of Voice:</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as CoverLetterTone)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#3c4a59]"
          >
            <option value="professional">Professional & Strategic (Default)</option>
            <option value="confident">Confident & High-Impact</option>
            <option value="modern">Modern, Engaging & Personable</option>
            <option value="concise">Direct & Concise (Quick Read)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-900 mb-1">Target Company (Optional):</label>
          <input
            type="text"
            value={customCompany}
            onChange={(e) => setCustomCompany(e.target.value)}
            placeholder="e.g. Acme Corp"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#3c4a59]"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-900 mb-1">Target Position (Optional):</label>
          <input
            type="text"
            value={customRole}
            onChange={(e) => setCustomRole(e.target.value)}
            placeholder="e.g. Senior Software Engineer"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#3c4a59]"
          />
        </div>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          Editable Letter Preview
        </span>
        <button
          onClick={handleGenerate}
          className="text-xs font-bold text-[#3c4a59] hover:underline flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          Regenerate with selected tone
        </button>
      </div>

      {/* Textarea Editor */}
      <div>
        <textarea
          value={letterText}
          onChange={(e) => setLetterText(e.target.value)}
          placeholder="Your tailored cover letter will appear here..."
          className="w-full h-96 p-5 rounded-2xl border border-gray-200 font-sans text-sm leading-relaxed text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#3c4a59] shadow-inner"
        />
        <p className="text-[11px] text-gray-400 mt-2 text-right">
          You can edit any paragraph above directly before exporting.
        </p>
      </div>
    </div>
  );
}
