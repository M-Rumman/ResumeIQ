import { getAuthRedirectUrl } from './authRedirects.js';
import { AUTH_EMAIL_DELIVERY_MESSAGE, isAuthEmailDeliveryError } from './authErrors.js';
import { supabase } from './supabase.js';

export const PENDING_VERIFICATION_EMAIL_KEY = 'resuv_pending_verification_email';
export const RESEND_COOLDOWN_SECONDS = 60;

export function getEmailVerificationRedirectUrl(): string {
  return getAuthRedirectUrl('/login?verified=1');
}

export function isEmailVerified(user: { email_confirmed_at?: string | null } | null | undefined): boolean {
  return Boolean(user?.email_confirmed_at);
}

export function storePendingVerificationEmail(email: string): void {
  sessionStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, email.trim().toLowerCase());
}

export function getPendingVerificationEmail(): string | null {
  const value = sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY);
  return value?.trim() || null;
}

export function clearPendingVerificationEmail(): void {
  sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
}

export function getResendCooldownRemaining(): number {
  const raw = sessionStorage.getItem('resuv_verification_resend_at');
  if (!raw) return 0;
  const sentAt = Number.parseInt(raw, 10);
  if (Number.isNaN(sentAt)) return 0;
  const elapsed = Math.floor((Date.now() - sentAt) / 1000);
  return Math.max(0, RESEND_COOLDOWN_SECONDS - elapsed);
}

export function markVerificationEmailSent(): void {
  sessionStorage.setItem('resuv_verification_resend_at', String(Date.now()));
}

export async function resendVerificationEmail(email: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const trimmed = email.trim();
  if (!trimmed) {
    return { ok: false, message: 'Enter your email address to resend the verification link.' };
  }

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: trimmed,
    options: {
      emailRedirectTo: getEmailVerificationRedirectUrl(),
    },
  });

  if (error) {
    const lower = error.message.toLowerCase();
    if (lower.includes('rate limit') || lower.includes('too many')) {
      return { ok: false, message: 'Too many requests. Please wait a minute and try again.' };
    }
    if (isAuthEmailDeliveryError(error.message)) {
      return { ok: false, message: AUTH_EMAIL_DELIVERY_MESSAGE };
    }
    return { ok: false, message: 'Unable to send the verification email. Please try again later.' };
  }

  markVerificationEmailSent();
  return { ok: true };
}
