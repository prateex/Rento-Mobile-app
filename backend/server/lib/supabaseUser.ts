import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// User-scoped client (RLS enforced)
export function getSupabaseUserClient(accessToken: string): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error('Missing Supabase user env vars: SUPABASE_URL, SUPABASE_ANON_KEY');
  }
  if (!accessToken) {
    throw new Error('Missing access token for Supabase user client');
  }

  return createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
