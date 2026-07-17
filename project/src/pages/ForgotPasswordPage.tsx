import { useState } from 'react';
import { Mail, ArrowRight, Loader2 } from 'lucide-react';
import { sendPasswordResetEmail } from '../lib/passwordReset.js';

interface ForgotPasswordPageProps {
  onNavigate: (page: string) => void;
  initialEmail?: string;
}

export default function ForgotPasswordPage({ onNavigate, initialEmail = '' }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    const result = await sendPasswordResetEmail(email);
    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setSuccessMessage(result.message);
    setSuccess(true);
  }

  return (
    <div className="min-h-screen">
      <div className="glass-panel border-b border-[rgba(255,255,255,0.35)] rounded-none">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 neu-surface rounded-[var(--radius-md)] flex items-center justify-center">
              <Mail className="w-5 h-5 text-accent" />
            </div>
            <h1 className="text-3xl text-primary">Forgot Password</h1>
          </div>
          <p className="text-primary text-base ml-[52px]">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="glass-card p-8 scroll-reveal is-visible">
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 mx-auto neu-surface rounded-full flex items-center justify-center">
                <Mail className="w-7 h-7 text-accent" />
              </div>
              <h2 className="text-xl font-bold text-primary">Check Your Email</h2>
              <p className="text-sm text-body leading-relaxed">{successMessage}</p>
              <p className="text-xs text-primary">
                Didn&apos;t receive it? Check your spam folder or wait a minute before trying again.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="btn-primary w-full mt-2"
              >
                Return to Login
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="forgot-email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email address
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  placeholder="you@example.com"
                  className="input-neu disabled:opacity-60"
                  data-clarity-mask="true"
                />
              </div>
              {error && (
                <p className="text-sm text-center text-red-600 font-medium">{error}</p>
              )}
              <button
                type="submit"
                disabled={!canSubmit}
                className={`w-full btn-primary ${!canSubmit ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    Send Reset Link
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('login')}
                disabled={loading}
                className="w-full text-center text-sm text-accent font-bold hover:underline disabled:opacity-60"
              >
                Back to Log In
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
