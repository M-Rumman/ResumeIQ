import { isRedirectUrlError } from './authRedirects.js';

export const AUTH_EMAIL_DELIVERY_MESSAGE =
  'We could not send the email right now. Please try again in a few minutes.';

export function isAuthEmailDeliveryError(message) {
  const lower = (message || '').toLowerCase();
  return (
    lower.includes('confirmation mail') ||
    lower.includes('confirmation email') ||
    lower.includes('recovery email') ||
    lower.includes('error sending confirmation') ||
    lower.includes('error sending recovery') ||
    lower.includes('error sending email')
  );
}

export function getLoginErrorMessage(message) {
  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials')) {
    return 'Invalid email or password. Please try again.';
  }
  if (lower.includes('email not confirmed') || lower.includes('email not verified')) {
    return 'Please verify your email before signing in.';
  }
  if (isRedirectUrlError(message)) {
    return 'This domain is not authorized in Supabase yet. Add your Vercel URL under Authentication → URL Configuration in the Supabase dashboard.';
  }
  if (lower.includes('invalid api key') || lower.includes('invalid jwt')) {
    return 'Supabase is misconfigured on this deployment. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel environment variables.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Could not reach Supabase. Check your internet connection and try again.';
  }

  return 'Unable to log in. Please try again.';
}

export function getSignupErrorMessage(message) {
  const lower = message.toLowerCase();

  if (lower.includes('already registered') || lower.includes('user already registered')) {
    return 'An account with this email already exists.';
  }
  if (
    lower.includes('duplicate') ||
    lower.includes('unique constraint') ||
    lower.includes('already exists')
  ) {
    return 'An account with this email already exists.';
  }
  if (lower.includes('invalid email') || lower.includes('unable to validate email')) {
    return 'Please enter a valid email address.';
  }
  if (isRedirectUrlError(message)) {
    return 'This domain is not authorized for signup redirects. In Supabase → Authentication → URL Configuration, add your Vercel URL (e.g. https://your-app.vercel.app/**).';
  }
  if (lower.includes('invalid api key') || lower.includes('invalid jwt')) {
    return 'Supabase is misconfigured on this deployment. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel environment variables.';
  }
  if (
    lower.includes('weak') ||
    lower.includes('pwned') ||
    lower.includes('easy to guess') ||
    lower.includes('known to be weak')
  ) {
    return 'This password is too common or easy to guess. Use a stronger, unique password with letters and numbers.';
  }
  if (
    lower.includes('uppercase') ||
    lower.includes('lowercase') ||
    lower.includes('special character') ||
    lower.includes('character of each') ||
    (lower.includes('at least') && lower.includes('character'))
  ) {
    return 'Password must contain a-z, A-Z, 0-9, and a special character.';
  }
  if (lower.includes('too short') || lower.includes('minimum')) {
    return message;
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Too many signup attempts. Please wait a few minutes and try again.';
  }
  if (isAuthEmailDeliveryError(message)) {
    return AUTH_EMAIL_DELIVERY_MESSAGE;
  }
  if (lower.includes('signup') && lower.includes('disabled')) {
    return 'New signups are temporarily disabled. Please contact support.';
  }
  if (lower.includes('password')) {
    return message;
  }

  return 'Unable to create your account. Please try again.';
}
