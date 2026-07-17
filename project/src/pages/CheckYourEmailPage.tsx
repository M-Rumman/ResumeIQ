import { useEffect, useState } from 'react';
import { Mail, ArrowRight, Loader2 } from 'lucide-react';
import {
  getPendingVerificationEmail,
  getResendCooldownRemaining,
  resendVerificationEmail,
  RESEND_COOLDOWN_SECONDS,
} from '../lib/emailVerification.js';

interface CheckYourEmailPageProps {
  onNavigate: (page: string) => void;
}

export default function CheckYourEmailPage({ onNavigate }: CheckYourEmailPageProps) {
  const [email] = useState(() => getPendingVerificationEmail());
  const [resendLoading, setResendLoading] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(() => getResendCooldownRemaining());

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown(getResendCooldownRemaining());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function handleResend() {
    if (!email || resendLoading || cooldown > 0) return;

    setResendLoading(true);
    setResendError(null);
    setResendSuccess(false);

    const result = await resendVerificationEmail(email);
    setResendLoading(false);

    if (!result.ok) {
      setResendError(result.message);
      return;
    }

    setResendSuccess(true);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  return (
    <div className="min-h-screen">
      <div className="glass-panel border-b border-[rgba(255,255,255,0.35)] rounded-none">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 neu-surface rounded-[var(--radius-md)] flex items-center justify-center">
              <Mail className="w-5 h-5 text-accent" />
            </div>
            <h1 className="text-3xl text-primary">Check Your Email</h1>
          </div>
          <p className="text-primary text-base ml-[52px]">
            Please verify your email before logging into ResumeIQ.
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="glass-card p-8 scroll-reveal is-visible text-center space-y-5">
          <div className="w-14 h-14 mx-auto neu-surface rounded-full flex items-center justify-center">
            <Mail className="w-7 h-7 text-accent" />
          </div>

          <p className="text-sm text-body leading-relaxed">
            We sent a verification link
            {email ? (
              <>
                {' '}
                to <strong className="text-primary">{email}</strong>
              </>
            ) : (
              ' to your email address'
            )}
            . Click the link in that email to activate your account.
          </p>

          <p className="text-xs text-primary">
            Didn&apos;t receive it? Check your spam folder or resend below.
          </p>

          {resendError && (
            <p className="text-sm text-red-600 font-medium">{resendError}</p>
          )}
          {resendSuccess && (
            <p className="text-sm text-[#3c4a59] font-medium">
              Verification email sent. Check your inbox.
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={!email || resendLoading || cooldown > 0}
            className="w-full btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {resendLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending…
              </>
            ) : cooldown > 0 ? (
              `Resend in ${cooldown}s`
            ) : (
              'Resend Verification Email'
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('login')}
            className="w-full btn-ghost"
          >
            Return to Login
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
