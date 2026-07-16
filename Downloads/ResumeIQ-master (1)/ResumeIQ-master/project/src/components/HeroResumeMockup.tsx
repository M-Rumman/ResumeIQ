import type { CSSProperties } from 'react';

/** Floating glass resume score mockup for the home hero. */
export default function HeroResumeMockup() {
  const score = 87;
  const match = 92;
  const circumference = 2 * Math.PI * 45;
  const ringOffset = circumference - (score / 100) * circumference;

  const skills = ['React', 'ATS Ready', 'Leadership', 'SQL', 'Agile'];

  return (
    <div className="hero-mockup-float glass-card glass-card-interactive p-6 lg:p-8 w-full max-w-md mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="section-label mb-1">Live preview</p>
          <h3 className="text-2xl text-primary">Resume score</h3>
        </div>
        <span className="skill-tag text-accent">Pro scan</span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="relative w-36 h-36 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgba(163, 177, 198, 0.35)"
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              className="score-ring-animate"
              style={
                {
                  '--ring-offset': ringOffset,
                  strokeDashoffset: circumference,
                } as CSSProperties
              }
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-4xl text-primary leading-none">{score}</span>
            <span className="text-xs text-primary font-bold uppercase tracking-wider mt-1">ATS</span>
          </div>
        </div>

        <div className="flex-1 w-full space-y-4">
          <div className="neu-surface rounded-[var(--radius-md)] px-4 py-3">
            <p className="text-xs text-primary font-bold uppercase tracking-wide mb-1">Job match</p>
            <div className="flex items-end gap-2">
              <span className="font-display text-3xl text-primary leading-none">{match}%</span>
              <span className="text-sm text-accent font-bold pb-1">Strong fit</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-[var(--base)] overflow-hidden shadow-[inset_2px_2px_4px_rgba(163,177,198,0.4)]">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${match}%`,
                  background: 'linear-gradient(90deg, var(--accent), var(--cta-primary))',
                }}
              />
            </div>
          </div>

          <div>
            <p className="text-xs text-primary font-bold mb-2">Detected skills</p>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span key={skill} className="skill-tag">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-[rgba(255,255,255,0.4)] flex items-center justify-between text-sm">
        <span className="text-primary">3 sections analyzed</span>
        <span className="text-accent font-bold">+12 keywords</span>
      </div>
    </div>
  );
}
