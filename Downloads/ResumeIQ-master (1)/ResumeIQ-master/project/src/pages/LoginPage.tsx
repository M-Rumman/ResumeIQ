import { useEffect, useState } from 'react';
import { LogIn, ArrowRight, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { createUserProfile } from '../lib/createUserProfile.js';
import { getLoginErrorMessage } from '../lib/authErrors.js';
import { isEmailVerified, storePendingVerificationEmail } from '../lib/emailVerification.js';

interface LoginPageProps {
  onNavigate: (page: string) => void;
  onAuthSuccess: () => void;
}

export default function LoginPage({ onNavigate, onAuthSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('verified') === '1') {
      setVerifiedSuccess(true);
      window.history.replaceState({}, '', '/login');
    }
  }, []);

  const canSubmit = email.trim() && password && !loading;

  function handleForgotPassword() {
    sessionStorage.setItem('resuv_forgot_password_email', email.trim());
    onNavigate('forgot-password');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);
    setVerifiedSuccess(false);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setLoading(false);
      setError(getLoginErrorMessage(authError.message));
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && !isEmailVerified(user)) {
      await supabase.auth.signOut();
      storePendingVerificationEmail(email.trim());
      setLoading(false);
      setError('Please verify your email before signing in.');
      return;
    }

    if (user?.id) {
      await createUserProfile(user.id);
    }

    setLoading(false);
    onAuthSuccess();
  }

  return (
    <div className="min-h-screen">
      <div className="glass-panel border-b border-[rgba(255,255,255,0.35)] rounded-none">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 neu-surface rounded-[var(--radius-md)] flex items-center justify-center">
              <LogIn className="w-5 h-5 text-accent" />
            </div>
            <h1 className="text-3xl text-primary">Log In</h1>
          </div>
          <p className="text-base text-primary font-body ml-[52px]">
            Welcome back. Sign in to access your resume analyses and interview prep.
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="glass-card p-8 scroll-reveal is-visible">
          {verifiedSuccess && (
            <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto" />
              <p className="text-sm font-semibold text-green-900">
                Email verified successfully.
              </p>
              <p className="text-sm text-green-800">You may now log in.</p>
            </div>
          )}
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="login-email" className="block text-sm font-semibold text-gray-700 mb-2">
                Email
              </label>
              <input
                id="login-email"
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
            <div>
              <label htmlFor="login-password" className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
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
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="text-xs text-accent font-semibold hover:underline disabled:opacity-60"
                >
                  Forgot Password?
                </button>
              </div>
            </div>
            {error && (
              <div className="space-y-2">
                <p className="text-sm text-center text-red-600 font-medium">{error}</p>
                {error.includes('verify your email') && (
                  <button
                    type="button"
                    onClick={() => onNavigate('check-email')}
                    className="w-full text-center text-sm text-accent font-bold hover:underline"
                  >
                    Resend verification email
                  </button>
                )}
              </div>
            )}
            <button type="submit" disabled={!canSubmit} className={`w-full btn-primary ${!canSubmit ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  Log In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-primary mt-6">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => onNavigate('signup')}
              disabled={loading}
              className="text-accent font-bold hover:underline disabled:opacity-60"
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
