import { BarChart3, Target, Zap, Sparkles } from 'lucide-react';

/** Illustrative preview — no fabricated scores or percentages. */
export default function ResumeScoreCheckerLandingPreview() {
  return (
    <div
      className="glass-card glass-card-interactive p-6 lg:p-8 w-full max-w-md mx-auto"
      aria-label="Resume score checker preview illustration"
    >
      <p className="section-label mb-1">Sample workflow</p>
      <h2 className="text-xl text-primary mb-6">Resume scoring overview</h2>

      <div className="space-y-4">
        <div className="neu-surface rounded-[var(--radius-md)] p-4 flex items-center gap-3">
          <Target className="w-5 h-5 text-accent flex-shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">ATS compatibility</p>
            <p className="text-sm text-body">How well your resume may parse in screening</p>
          </div>
        </div>

        <div className="neu-surface rounded-[var(--radius-md)] p-4 flex items-center gap-3">
          <Zap className="w-5 h-5 text-accent flex-shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Job match score</p>
            <p className="text-sm text-body">Alignment with the target job description</p>
          </div>
        </div>

        <div className="neu-surface rounded-[var(--radius-md)] p-4 flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-accent flex-shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Quality signals</p>
            <p className="text-sm text-body">Structure, keywords, and section clarity</p>
          </div>
        </div>

        <div className="neu-surface rounded-[var(--radius-md)] p-4 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-accent flex-shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Improvements</p>
            <p className="text-sm text-body">Actionable steps to raise your scores</p>
          </div>
        </div>
      </div>

      <p className="mt-5 text-xs text-primary text-center">
        Illustration only — run the analyzer for your personalized scores.
      </p>
    </div>
  );
}
