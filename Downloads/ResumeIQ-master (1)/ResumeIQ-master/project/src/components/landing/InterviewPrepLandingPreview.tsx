import { MessageSquare, Sparkles, Target, ListChecks } from 'lucide-react';

/** Illustrative preview — no fabricated interview scores or sample answers. */
export default function InterviewPrepLandingPreview() {
  return (
    <div
      className="glass-card glass-card-interactive p-6 lg:p-8 w-full max-w-md mx-auto"
      aria-label="Interview preparation preview illustration"
    >
      <p className="section-label mb-1">Sample workflow</p>
      <h2 className="text-xl text-primary mb-6">Interview prep overview</h2>

      <div className="space-y-4">
        <div className="neu-surface rounded-[var(--radius-md)] p-4 flex items-center gap-3">
          <Target className="w-5 h-5 text-accent flex-shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Target role</p>
            <p className="text-sm text-body">Job title, level, and focus skills</p>
          </div>
        </div>

        <div className="neu-surface rounded-[var(--radius-md)] p-4 flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-accent flex-shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Question sets</p>
            <p className="text-sm text-body">HR, technical, and behavioral prompts</p>
          </div>
        </div>

        <div className="neu-surface rounded-[var(--radius-md)] p-4 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-accent flex-shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">AI guidance</p>
            <p className="text-sm text-body">Tips, ideal answer outlines, and follow-ups</p>
          </div>
        </div>

        <div className="neu-surface rounded-[var(--radius-md)] p-4 flex items-center gap-3">
          <ListChecks className="w-5 h-5 text-accent flex-shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Prep roadmap</p>
            <p className="text-sm text-body">Communication tips and preparation steps</p>
          </div>
        </div>
      </div>

      <p className="mt-5 text-xs text-primary text-center">
        Illustration only — start preparation for your personalized session.
      </p>
    </div>
  );
}
