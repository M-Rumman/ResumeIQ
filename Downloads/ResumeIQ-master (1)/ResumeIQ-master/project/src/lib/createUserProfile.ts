import { supabase } from './supabase.js';

function isDuplicateEmailError(error: { code?: string; message?: string; details?: string }) {
  if (error.code !== '23505') return false;
  const text = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return text.includes('email') || text.includes('profiles_email_lower_unique');
}

export async function createUserProfile(userId: string, email?: string) {
  const normalizedEmail = email?.trim().toLowerCase() || null;

  const { error } = await supabase.from('profiles').insert({
    user_id: userId,
    email: normalizedEmail,
    plan: 'free',
    subscription_status: 'inactive',
    unlocked_reports: [],
  });

  if (!error) {
    return { ok: true as const };
  }

  if (isDuplicateEmailError(error)) {
    return {
      ok: false as const,
      message: 'An account with this email already exists.',
    };
  }

  if (error.code === '23505') {
    return { ok: true as const };
  }

  return {
    ok: false as const,
    message: 'Your account was created, but profile setup failed. Try logging in or contact support.',
  };
}
