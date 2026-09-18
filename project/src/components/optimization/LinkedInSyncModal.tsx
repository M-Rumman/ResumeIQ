import { useState, useRef } from 'react';
import { X, Linkedin, Check, Sparkles, Upload, FileText, Loader2, AlertCircle } from 'lucide-react';
import { parseLinkedInText, formatProfileToResumeText, type ParsedLinkedInProfile } from '../../utils/linkedInImporter';
import { extractResumeTextFromFile } from '../../utils/extractResumeText.js';

interface LinkedInSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportResume: (formattedResumeText: string) => void;
}

export default function LinkedInSyncModal({
  isOpen,
  onClose,
  onImportResume,
}: LinkedInSyncModalProps) {
  if (!isOpen) return null;

  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedLinkedInProfile | null>(null);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [pdfExtractProgress, setPdfExtractProgress] = useState(0);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleParse = () => {
    if (!rawText.trim()) return;
    const profile = parseLinkedInText(rawText);
    setParsed(profile);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtractingPdf(true);
    setPdfExtractProgress(10);
    setPdfError(null);
    setUploadedFileName(file.name);

    try {
      const result = await extractResumeTextFromFile(file, {
        onProgress: (percent) => setPdfExtractProgress(percent),
      });

      if (!result.text || !result.text.trim()) {
        throw new Error('No readable text could be extracted from this PDF.');
      }

      setRawText(result.text);
      // Automatically attempt parsing with LinkedIn parser
      const profile = parseLinkedInText(result.text);
      if (profile.experience.length > 0 || profile.education.length > 0 || profile.skills.length > 0) {
        setParsed(profile);
      } else {
        setParsed(null);
      }
    } catch (err) {
      console.error('[LinkedInSyncModal] PDF extraction error:', err);
      setPdfError(err instanceof Error ? err.message : 'Failed to extract text from PDF');
      setUploadedFileName(null);
    } finally {
      setIsExtractingPdf(false);
      // Reset input value so the same file can be re-uploaded if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleApply = () => {
    if (!parsed) {
      if (rawText.trim()) {
        onImportResume(rawText.trim());
        onClose();
      }
      return;
    }
    const formatted = formatProfileToResumeText(parsed);
    onImportResume(formatted);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#0a66c2] text-white">
              <Linkedin className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900">LinkedIn Sync / Resume Upload</h3>
              <p className="text-xs text-gray-500">1-Click import from your LinkedIn profile or direct PDF upload to build an editable baseline resume</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 text-xs text-blue-900 leading-relaxed">
            <p className="font-bold mb-1">Quick Instruction:</p>
            <p>1. <strong>Direct PDF Upload:</strong> Upload your PDF resume below to automatically extract and populate its text.</p>
            <p>2. <strong>LinkedIn Profile:</strong> Go to LinkedIn &rarr; <strong>"More"</strong> below your headline &rarr; <strong>"Save to PDF"</strong>, or copy and paste your profile text directly into the box.</p>
          </div>

          {/* PDF File Input Component */}
          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1.5">
              Upload PDF Resume:
            </label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
                id="pdf-resume-upload-input"
              />
              <label
                htmlFor="pdf-resume-upload-input"
                className={`flex-1 flex items-center justify-center gap-2 p-3.5 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  isExtractingPdf
                    ? 'border-blue-400 bg-blue-50/40 cursor-wait'
                    : 'border-gray-200 hover:border-[#0a66c2] hover:bg-blue-50/30'
                }`}
              >
                {isExtractingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 text-[#0a66c2] animate-spin" />
                    <span className="text-xs font-medium text-blue-900">
                      Extracting text from PDF ({pdfExtractProgress}%)...
                    </span>
                  </>
                ) : uploadedFileName ? (
                  <>
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-medium text-emerald-800 truncate max-w-xs">
                      Extracted: {uploadedFileName}
                    </span>
                    <span className="text-[10px] text-gray-400 ml-auto font-medium">Click to replace</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 text-[#0a66c2]" />
                    <span className="text-xs font-bold text-gray-700">Choose PDF file</span>
                    <span className="text-xs text-gray-400">or drag & drop here</span>
                  </>
                )}
              </label>
            </div>
            {pdfError && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{pdfError}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1.5">
              Paste LinkedIn Profile or Resume Content:
            </label>
            <textarea
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                setParsed(null);
              }}
              placeholder="Paste your LinkedIn profile text or PDF export here..."
              className="w-full h-44 p-4 rounded-xl border border-gray-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0a66c2]"
            />
          </div>

          {!parsed && (
            <button
              onClick={handleParse}
              disabled={!rawText.trim() || isExtractingPdf}
              className="w-full py-3 rounded-xl bg-[#0a66c2] hover:bg-[#084e96] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              Parse & Sync Data
            </button>
          )}

          {/* Parsed Preview */}
          {parsed && (
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-3">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                Extracted Baseline Resume Structure:
              </span>
              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-3 rounded-xl border border-gray-200">
                  <span className="text-gray-400 font-bold block text-[10px]">CANDIDATE</span>
                  <p className="font-bold text-gray-900">{parsed.name}</p>
                  <p className="text-gray-600">{parsed.headline}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-200">
                  <span className="text-gray-400 font-bold block text-[10px]">CONTACT DETAILS</span>
                  <p className="text-gray-700">{parsed.email} • {parsed.phone}</p>
                  <p className="text-gray-600">{parsed.location}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 font-bold">
                  ✓ {parsed.experience.length} Experience Roles Found
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-800 font-bold">
                  ✓ {parsed.education.length} Education Entries
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-purple-100 text-purple-800 font-bold">
                  ✓ {parsed.skills.length} Skills Extracted
                </span>
              </div>

              <button
                onClick={handleApply}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
              >
                <Check className="w-4 h-4" />
                Apply as Baseline Resume & Open Studio
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}
