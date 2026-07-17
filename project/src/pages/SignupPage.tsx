import { useState } from 'react';
import { UserPlus, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { createUserProfile } from '../lib/createUserProfile.js';
import { getEmailVerificationRedirectUrl, storePendingVerificationEmail } from '../lib/emailVerification.js';
import { isRedirectUrlError } from '../lib/authRedirects.js';
import { getSignupErrorMessage } from '../lib/authErrors.js';

interface SignupPageProps {
  onNavigate: (page: string) => void;
}

export default function SignupPage({ onNavigate }: SignupPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim() && email.trim() && password.length >= 6 && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    const trimmedEmail = email.trim();
    const signUpPayload = {
      email: trimmedEmail,
      password,
      options: {
        data: {
          full_name: name.trim(),
        },
        emailRedirectTo: getEmailVerificationRedirectUrl(),
      },
    };

    let { data, error: authError } = await supabase.auth.signUp(signUpPayload);

    if (authError && isRedirectUrlError(authError.message)) {
      ({ data, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: name.trim(),
          },
        },
      }));
    }

    if (authError) {
      setLoading(false);
      setError(getSignupErrorMessage(authError.message));
      return;
    }

    if (data.user?.id) {
      const profileResult = await createUserProfile(data.user.id, trimmedEmail);
      if (!profileResult.ok) {
        await supabase.auth.signOut();
        setLoading(false);
        setError(profileResult.message);
        return;
      }
    }

    if (data.session) {
      await supabase.auth.signOut();
    }

    storePendingVerificationEmail(trimmedEmail);
    setLoading(false);
    onNavigate('check-email');
  }

  return (
    <div className="min-h-screen">
      <div className="glass-panel border-b border-[rgba(255,255,255,0.35)] rounded-none">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 neu-surface rounded-[var(--radius-md)] flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-accent" />
            </div>
            <h1 className="text-3xl text-primary">Sign Up</h1>
          </div>
          <p className="text-primary text-base ml-[52px]">
            Create an account to save analyses and unlock more features.
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="glass-card p-8 scroll-reveal is-visible">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="signup-name" className="block text-sm font-semibold text-gray-700 mb-2">
                Full name
              </label>
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                placeholder="Jane Doe"
                className="input-neu disabled:opacity-60"
              />
            </div>
            <div>
              <label htmlFor="signup-email" className="block text-sm font-semibold text-gray-700 mb-2">
                Email
              </label>
              <input
                id="signup-email"
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
              <label htmlFor="signup-password" className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="signup-password"
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
              <p className="mt-2 text-xs text-primary">
                At least 6 characters. Avoid common passwords (e.g. password123).
              </p>
            </div>
            {error && (
              <p className="text-sm text-center text-red-600 font-medium">{error}</p>
            )}
            <button type="submit" disabled={!canSubmit} className={`w-full btn-primary ${!canSubmit ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-primary mt-6">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => onNavigate('login')}
              disabled={loading}
              className="text-accent font-bold hover:underline disabled:opacity-60"
            >
              Log in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
