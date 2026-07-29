interface JobMatchUnderDevelopmentProps {
  onReturnToDashboard: () => void;
}

/** Public production gate for a feature that remains available during development. */
export default function JobMatchUnderDevelopment({ onReturnToDashboard }: JobMatchUnderDevelopmentProps) {
  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-16 sm:px-6">
      <section className="mx-auto max-w-2xl rounded-2xl border border-[#d7e2f0] bg-white px-6 py-12 text-center shadow-sm sm:px-12">
        <p className="text-4xl" aria-hidden="true">🚧</p>
        <h1 className="mt-5 text-3xl font-extrabold text-gray-900">AI Job Match is coming soon</h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-gray-700">
          AI Job Match is currently under active development and will be available soon.
        </p>
        <button type="button" onClick={onReturnToDashboard} className="btn-primary mt-8 px-6 py-3">
          Return to Dashboard
        </button>
      </section>
    </main>
  );
}
