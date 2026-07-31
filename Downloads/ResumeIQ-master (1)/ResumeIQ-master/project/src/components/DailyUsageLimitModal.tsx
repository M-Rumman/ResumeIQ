interface DailyUsageLimitModalProps {
  featureLabel: 'Resume Analysis' | 'Interview Prep';
  onUpgrade: () => void;
  onUnlockReport: () => void;
  onDismiss: () => void;
}

/** Shown before a new free request is sent once its UTC daily allowance is exhausted. */
export default function DailyUsageLimitModal({
  featureLabel,
  onUpgrade,
  onUnlockReport,
  onDismiss,
}: DailyUsageLimitModalProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4 py-8" role="presentation">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="daily-limit-title">
        <h2 id="daily-limit-title" className="text-xl font-extrabold text-gray-900">You&apos;ve reached today&apos;s free limit.</h2>
        <p className="mt-3 text-sm leading-6 text-gray-700">
          Free Plan includes 2 Resume Analyses per day and 2 Interview Prep sessions per day. Your {featureLabel} limit resets tomorrow.
        </p>
        <p className="mt-3 text-sm leading-6 text-gray-700">
          Upgrade to ResuV Pro for unlimited access, or unlock a single premium report for just $2.
        </p>
        <div className="mt-6 grid gap-3">
          <button type="button" className="btn-primary w-full justify-center" onClick={onUpgrade}>Upgrade to Pro</button>
          <button type="button" className="btn-ghost w-full justify-center" onClick={onUnlockReport}>Unlock Report</button>
          <button type="button" className="w-full text-sm font-semibold text-gray-600 hover:text-gray-900" onClick={onDismiss}>Maybe Tomorrow</button>
        </div>
      </section>
    </div>
  );
}
