import { MessageSquare, Sparkles, ListChecks, CheckCircle2 } from 'lucide-react';

/** Illustrative preview — no fabricated feedback text or scores. */
export default function ResumeFeedbackLandingPreview() {
  return (
    <div
      className="glass-card glass-card-interactive p-6 lg:p-8 w-full max-w-md mx-auto"
      aria-label="Resume feedback preview illustration"
    >
      <p className="section-label mb-1">Sample workflow</p>
      <h2 className="text-xl text-primary mb-6">Resume feedback overview</h2>

      <div className="space-y-4">
        <div className="neu-surface rounded-[var(--radius-md)] p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Strengths</p>
            <p className="text-sm text-body">What is already working in your resume</p>
          </div>
        </div>

        <div className="neu-surface rounded-[var(--radius-md)] p-4 flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-accent flex-shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Improvements</p>
            <p className="text-sm text-body">Specific suggestions to strengthen content</p>
          </div>
        </div>

        <div className="neu-surface rounded-[var(--radius-md)] p-4 flex items-center gap-3">
          <ListChecks className="w-5 h-5 text-accent flex-shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Weak sections</p>
            <p className="text-sm text-body">Areas that may hold your application back</p>
          </div>
        </div>

        <div className="neu-surface rounded-[var(--radius-md)] p-4 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-accent flex-shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Next steps</p>
            <p className="text-sm text-body">Actionable edits tailored to the job</p>
          </div>
        </div>
      </div>

      <p className="mt-5 text-xs text-primary text-center">
        Illustration only — run the analyzer for your personalized feedback.
      </p>
    </div>
  );
}
