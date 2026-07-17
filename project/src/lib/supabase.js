import { createClient } from '@supabase/supabase-js';
import { resolveSupabaseClientConfig } from './supabaseConfig.js';

const { url, anonKey } = resolveSupabaseClientConfig();

export const supabase = createClient(url, anonKey, {
  auth: {
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
    flowType: 'pkce',
  },
});
