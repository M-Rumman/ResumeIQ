import type { VercelRequest } from '@vercel/node';
import type { User } from '@supabase/supabase-js';
import { getSupabaseAuthClient } from './supabaseAdmin.js';

export async function getUserFromRequest(req: VercelRequest): Promise<User | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;

  const token = header.slice(7).trim();
  if (!token) return null;

  const supabase = getSupabaseAuthClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) return null;
  return data.user;
}

export function jsonError(status: number, message: string) {
  return { status, body: { error: message } };
}
