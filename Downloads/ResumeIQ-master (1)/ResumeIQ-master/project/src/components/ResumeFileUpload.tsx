import { useRef, useState } from 'react';
import { Upload, FileText, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { extractResumeTextFromFile } from '../utils/extractResumeText.js';

interface ResumeFileUploadProps {
  onTextExtracted: (text: string, fileName: string) => void;
  onClear?: () => void;
  disabled?: boolean;
}

export default function ResumeFileUpload({
  onTextExtracted,
  onClear,
  disabled = false,
}: ResumeFileUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractSuccess, setExtractSuccess] = useState(false);

  async function processFile(file: File) {
    setExtracting(true);
    setExtractError(null);
    setExtractSuccess(false);
    setProgress(0);
    setUploadedFile(file);

    try {
      const { text, fileName } = await extractResumeTextFromFile(file, {
        onProgress: setProgress,
      });

      onTextExtracted(text, fileName);
      setExtractSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not extract text from this file.';
      setExtractError(message);
      setUploadedFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } finally {
      setExtracting(false);
    }
  }

  function handleFileSelect(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || disabled || extracting) return;
    processFile(file);
  }

  function handleClear() {
    setUploadedFile(null);
    setExtractError(null);
    setExtractSuccess(false);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = '';
    onClear?.();
  }

  return (
    <div className="space-y-3">
      {uploadedFile && extractSuccess && !extracting ? (
        <div className="glass-card p-4 flex items-center justify-between gap-3 border border-[rgba(160,174,202,0.4)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{uploadedFile.name}</p>
              <p className="text-xs text-green-700">Text extracted — review or edit below</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="p-1.5 rounded-lg hover:bg-green-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            aria-label="Remove file"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled && !extracting) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!disabled && !extracting) handleFileSelect(e.dataTransfer.files);
          }}
          onClick={() => !disabled && !extracting && fileRef.current?.click()}
          className={`neu-pressed p-8 flex flex-col items-center justify-center transition-all ${
            disabled || extracting
              ? 'cursor-not-allowed opacity-70'
              : dragging
                ? 'ring-2 ring-[var(--accent)] cursor-pointer'
                : 'cursor-pointer hover:ring-1 hover:ring-[var(--accent)]'
          }`}
        >
          {extracting ? (
            <>
              <div className="w-14 h-14 neu-surface rounded-[var(--radius-lg)] flex items-center justify-center mb-4">
                <div className="w-7 h-7 border-2 border-[rgba(160,174,202,0.4)] border-t-accent rounded-full animate-spin" />
              </div>
              <p className="font-bold text-primary text-sm">Extracting text…</p>
              <div className="w-full max-w-xs mt-4 h-2 neu-pressed rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300 bg-accent"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-primary mt-2">{progress}%</p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 neu-surface rounded-[var(--radius-lg)] flex items-center justify-center mb-4">
                <Upload className="w-7 h-7 text-accent" />
              </div>
              <p className="font-bold text-primary text-sm">Drag & drop your resume</p>
              <p className="text-xs text-primary mt-1">or click to browse</p>
              <p className="text-xs text-primary mt-3 skill-tag">PDF or DOCX · max 5 MB</p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            disabled={disabled || extracting}
            onChange={(e) => handleFileSelect(e.target.files)}
          />
        </div>
      )}

      {extractError && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{extractError}</span>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-gray-400">
        <FileText className="w-3.5 h-3.5" />
        <span>Or paste resume text in the box below</span>
      </div>
    </div>
  );
}
