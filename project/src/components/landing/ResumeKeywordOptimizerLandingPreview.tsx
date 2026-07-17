import { FileText, Search, Target, Sparkles } from 'lucide-react';

/** Illustrative preview — no fabricated keyword lists or match scores. */
export default function ResumeKeywordOptimizerLandingPreview() {
  return (
    <div
      className="glass-card glass-card-interactive p-6 lg:p-8 w-full max-w-md mx-auto"
      aria-label="Resume keyword optimization preview illustration"
    >
      <p className="section-label mb-1">Sample workflow</p>
      <h2 className="text-xl text-primary mb-6">Keyword optimization overview</h2>

      <div className="space-y-4">
        <div className="neu-surface rounded-[var(--radius-md)] p-4 flex items-center gap-3">
          <FileText className="w-5 h-5 text-accent flex-shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Job description</p>
            <p className="text-sm text-body">Role requirements and skill terms</p>
          </div>
        </div>

        <div className="neu-surface rounded-[var(--radius-md)] p-4 flex items-center gap-3">
          <Search className="w-5 h-5 text-accent flex-shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Resume scan</p>
            <p className="text-sm text-body">Compare your text against role language</p>
          </div>
        </div>

        <div className="neu-surface rounded-[var(--radius-md)] p-4 flex items-center gap-3">
          <Target className="w-5 h-5 text-accent flex-shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Missing keywords</p>
            <p className="text-sm text-body">Terms from the posting not in your resume</p>
          </div>
        </div>

        <div className="neu-surface rounded-[var(--radius-md)] p-4 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-accent flex-shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Tailoring tips</p>
            <p className="text-sm text-body">Suggestions to align language with the role</p>
          </div>
        </div>
      </div>

      <p className="mt-5 text-xs text-primary text-center">
        Illustration only — run the analyzer for your personalized keyword report.
      </p>
    </div>
  );
}
