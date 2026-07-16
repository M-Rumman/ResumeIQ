import { supabase } from './supabase.js';
import { isPasswordResetPath } from './passwordReset.js';

/** Handle email confirmation, password recovery, and PKCE callbacks after Supabase redirects back. */
export async function handleSupabaseAuthCallback() {
  const query = new URLSearchParams(window.location.search);
  const code = query.get('code');
  const emailVerifiedFlow = query.get('verified') === '1';
  const passwordRecoveryFlow =
    isPasswordResetPath() || query.get('type') === 'recovery' || query.has('reset-password');

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (emailVerifiedFlow) {
        await supabase.auth.signOut();
        window.history.replaceState({}, '', '/login?verified=1');
        return { handled: true, error: null, emailVerified: true, passwordRecovery: false };
      }

      if (passwordRecoveryFlow) {
        window.history.replaceState({}, '', '/reset-password');
        return { handled: true, error: null, emailVerified: false, passwordRecovery: true };
      }

      window.history.replaceState({}, '', window.location.pathname || '/');
      return { handled: true, error: null, emailVerified: false, passwordRecovery: false };
    }

    if (emailVerifiedFlow) {
      window.history.replaceState({}, '', '/login');
      return {
        handled: true,
        error: 'This verification link is invalid or has expired. Request a new one from the login page.',
        emailVerified: false,
        passwordRecovery: false,
      };
    }

    if (passwordRecoveryFlow) {
      window.history.replaceState({}, '', '/reset-password');
      return {
        handled: true,
        error: 'This reset link is invalid or has expired. Please request a new one.',
        emailVerified: false,
        passwordRecovery: true,
      };
    }

    return {
      handled: true,
      error: 'Unable to complete sign in. Please try again.',
      emailVerified: false,
      passwordRecovery: false,
    };
  }

  const authError = query.get('error_description') || query.get('error');
  if (authError) {
    if (emailVerifiedFlow) {
      window.history.replaceState({}, '', '/login');
      return {
        handled: true,
        error: 'This verification link is invalid or has expired. Request a new one from the login page.',
        emailVerified: false,
        passwordRecovery: false,
      };
    }

    if (passwordRecoveryFlow) {
      window.history.replaceState({}, '', '/reset-password');
      return {
        handled: true,
        error: 'This reset link is invalid or has expired. Please request a new one.',
        emailVerified: false,
        passwordRecovery: true,
      };
    }

    window.history.replaceState({}, '', window.location.pathname || '/');
    return {
      handled: true,
      error: 'Unable to complete sign in. Please try again.',
      emailVerified: false,
      passwordRecovery: false,
    };
  }

  return { handled: false, error: null, emailVerified: false, passwordRecovery: false };
}
