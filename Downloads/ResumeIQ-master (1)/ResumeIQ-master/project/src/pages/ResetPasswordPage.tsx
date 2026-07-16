import { useEffect, useState } from 'react';
import { KeyRound, ArrowRight, Eye, EyeOff, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { getUpdatePasswordErrorMessage } from '../lib/passwordReset.js';

interface ResetPasswordPageProps {
  onNavigate: (page: string) => void;
}

export default function ResetPasswordPage({ onNavigate }: ResetPasswordPageProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function verifySession() {
      setCheckingSession(true);
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session) {
          setSessionValid(false);
          setError('This reset link is invalid or has expired. Please request a new one.');
        } else {
          setSessionValid(true);
        }
      } catch {
        setSessionValid(false);
        setError('Unable to verify your reset link. Please request a new one.');
      } finally {
        setCheckingSession(false);
      }
    }

    void verifySession();
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => {
      onNavigate('login');
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [success, onNavigate]);

  const passwordsMatch = password === confirmPassword;
  const passwordTooShort = password.length > 0 && password.length < 6;
  const canSubmit =
    sessionValid &&
    password.length >= 6 &&
    confirmPassword.length > 0 &&
    passwordsMatch &&
    !loading &&
    !checkingSession;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setLoading(false);
      setError(getUpdatePasswordErrorMessage(updateError.message));
      return;
    }

    await supabase.auth.signOut();
    setLoading(false);
    setSuccess(true);
  }

  if (checkingSession) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#3c4a59]" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen">
        <div className="glass-panel border-b border-[rgba(255,255,255,0.35)] rounded-none">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 neu-surface rounded-[var(--radius-md)] flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <h1 className="text-3xl text-primary">Password Updated</h1>
            </div>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="glass-card p-8 text-center space-y-5">
            <div className="w-16 h-16 mx-auto neu-surface rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-primary">All Set!</h2>
            <p className="text-sm text-body leading-relaxed">
              Your password has been updated successfully. You can now log in with your new password.
            </p>
            <p className="text-xs text-primary">Redirecting to login…</p>
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="btn-primary w-full"
            >
              Go to Log In
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!sessionValid) {
    return (
      <div className="min-h-screen">
        <div className="glass-panel border-b border-[rgba(255,255,255,0.35)] rounded-none">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 neu-surface rounded-[var(--radius-md)] flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-accent" />
              </div>
              <h1 className="text-3xl text-primary">Reset Link Invalid</h1>
            </div>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="glass-card p-8 text-center space-y-5">
            <p className="text-sm text-red-600 font-medium">{error}</p>
            <button
              type="button"
              onClick={() => onNavigate('forgot-password')}
              className="btn-primary w-full"
            >
              Request New Reset Link
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="w-full text-center text-sm text-accent font-bold hover:underline"
            >
              Back to Log In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="glass-panel border-b border-[rgba(255,255,255,0.35)] rounded-none">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 neu-surface rounded-[var(--radius-md)] flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-accent" />
            </div>
            <h1 className="text-3xl text-primary">Set New Password</h1>
          </div>
          <p className="text-primary text-base ml-[52px]">
            Enter your new password below.
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="glass-card p-8 scroll-reveal is-visible">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="new-password" className="block text-sm font-semibold text-gray-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  placeholder="••••••••"
                  className="input-neu pr-11 disabled:opacity-60"
                  data-clarity-mask="true"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-60"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {passwordTooShort && (
                <p className="mt-2 text-xs text-red-500 font-medium">
                  Password must be at least 6 characters.
                </p>
              )}
              {!passwordTooShort && (
                <p className="mt-2 text-xs text-primary">
                  At least 6 characters. Use a mix of letters, numbers, and special characters.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-semibold text-gray-700 mb-2">
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                placeholder="••••••••"
                className="input-neu disabled:opacity-60"
                data-clarity-mask="true"
              />
              {confirmPassword && !passwordsMatch && (
                <p className="mt-2 text-xs text-red-500 font-medium">Passwords do not match.</p>
              )}
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
                  Updating…
                </>
              ) : (
                <>
                  Update Password
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-primary mt-6">
            Remember your password?{' '}
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="text-accent font-bold hover:underline"
            >
              Log in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
