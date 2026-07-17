import { getAuthRedirectUrl, isRedirectUrlError } from './authRedirects.js';
import { AUTH_EMAIL_DELIVERY_MESSAGE, isAuthEmailDeliveryError } from './authErrors.js';
import { supabase } from './supabase.js';

export const PASSWORD_RESET_SUCCESS_MESSAGE =
  'A password reset link has been sent to your email if an account exists.';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getPasswordResetRedirectUrl(): string {
  return getAuthRedirectUrl('/reset-password');
}

export function isValidResetEmail(email: string): boolean {
  const trimmed = email.trim();
  return trimmed.length > 0 && EMAIL_PATTERN.test(trimmed);
}

export async function sendPasswordResetEmail(
  email: string,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const trimmed = email.trim();

  if (!isValidResetEmail(trimmed)) {
    return { ok: false, message: 'Please enter a valid email address.' };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
    redirectTo: getPasswordResetRedirectUrl(),
  });

  if (error) {
    const lower = error.message.toLowerCase();

    if (lower.includes('rate limit') || lower.includes('too many')) {
      return {
        ok: false,
        message: 'Too many requests. Please wait a few minutes and try again.',
      };
    }

    if (lower.includes('failed to fetch') || lower.includes('network')) {
      return {
        ok: false,
        message: 'Unable to send the reset email. Please check your connection and try again.',
      };
    }

    if (isRedirectUrlError(error.message)) {
      return {
        ok: false,
        message: 'Unable to send the reset email right now. Please try again later.',
      };
    }

    if (isAuthEmailDeliveryError(error.message)) {
      return { ok: false, message: AUTH_EMAIL_DELIVERY_MESSAGE };
    }

    return {
      ok: false,
      message: 'Unable to send the reset email right now. Please try again later.',
    };
  }

  return { ok: true, message: PASSWORD_RESET_SUCCESS_MESSAGE };
}

export function getUpdatePasswordErrorMessage(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('same') || lower.includes('different from the old')) {
    return 'New password must be different from your current password.';
  }
  if (
    lower.includes('weak') ||
    lower.includes('pwned') ||
    lower.includes('character of each') ||
    lower.includes('easy to guess')
  ) {
    return 'Password must contain a-z, A-Z, 0-9, and a special character.';
  }
  if (
    lower.includes('session') ||
    lower.includes('not authenticated') ||
    lower.includes('jwt') ||
    lower.includes('expired')
  ) {
    return 'This reset link is invalid or has expired. Please request a new one.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Unable to update your password. Please check your connection and try again.';
  }

  return 'Unable to update your password. Please try again.';
}

export function isPasswordResetPath(): boolean {
  const normalized = window.location.pathname.replace(/\/+$/, '') || '/';
  return normalized === '/reset-password';
}
