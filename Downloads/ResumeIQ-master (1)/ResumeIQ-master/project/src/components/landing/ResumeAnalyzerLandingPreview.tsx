import { FileText, Target, Sparkles, Upload } from 'lucide-react';

/**
 * Illustrative preview for the SEO landing page — no fabricated scores or metrics.
 */
export default function ResumeAnalyzerLandingPreview() {
  return (
    <div
      className="glass-card glass-card-interactive p-6 lg:p-8 w-full max-w-md mx-auto"
      aria-label="Resume analysis preview illustration"
    >
      <p className="section-label mb-1">Sample workflow</p>
      <h2 className="text-xl text-primary mb-6">Resume analysis overview</h2>

      <div className="space-y-4">
        <div className="neu-surface rounded-[var(--radius-md)] p-4 flex items-center gap-3">
          <Upload className="w-5 h-5 text-accent flex-shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Resume upload</p>
            <p className="text-sm text-body">PDF, DOCX, or pasted text</p>
          </div>
        </div>

        <div className="neu-surface rounded-[var(--radius-md)] p-4 flex items-center gap-3">
          <FileText className="w-5 h-5 text-accent flex-shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">ATS compatibility</p>
            <p className="text-sm text-body">Structured score and formatting feedback</p>
          </div>
        </div>

        <div className="neu-surface rounded-[var(--radius-md)] p-4 flex items-center gap-3">
          <Target className="w-5 h-5 text-accent flex-shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Keyword matching</p>
            <p className="text-sm text-body">Missing terms from the job description</p>
          </div>
        </div>

        <div className="neu-surface rounded-[var(--radius-md)] p-4 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-accent flex-shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Suggestions</p>
            <p className="text-sm text-body">Actionable improvements and bullet rewrites</p>
          </div>
        </div>
      </div>

      <p className="mt-5 text-xs text-primary text-center">
        Illustration only — run the analyzer for your personalized results.
      </p>
    </div>
  );
}
