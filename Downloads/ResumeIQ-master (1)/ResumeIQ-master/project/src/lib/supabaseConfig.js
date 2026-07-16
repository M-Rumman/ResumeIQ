import { DEFAULT_SUPABASE_ANON_KEY, DEFAULT_SUPABASE_URL } from '../../shared/supabaseDefaults.js';

/** Normalize and validate Supabase client config (guards common Vercel env mistakes). */
export function resolveSupabaseClientConfig() {
  let url = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
  let anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (!url.includes('.supabase.co')) {
    if (url) {
      console.warn(
        '[ResuV] VITE_SUPABASE_URL must be your Supabase project URL (https://xxx.supabase.co), not your app URL. Using default.',
      );
    }
    if (import.meta.env.PROD) {
      throw new Error(
        'VITE_SUPABASE_URL is required in production. Set it in Vercel Environment Variables.',
      );
    }
    url = DEFAULT_SUPABASE_URL;
  }

  url = url.replace(/\/+$/, '').replace(/\/auth\/v1\/?$/, '');

  if (!anonKey || anonKey.length < 80) {
    if (anonKey) {
      console.warn('[ResuV] VITE_SUPABASE_ANON_KEY looks invalid. Using default.');
    }
    if (import.meta.env.PROD) {
      throw new Error(
        'VITE_SUPABASE_ANON_KEY is required in production. Set it in Vercel Environment Variables.',
      );
    }
    anonKey = DEFAULT_SUPABASE_ANON_KEY;
  }

  return { url, anonKey };
}
