import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Admin client (bypasses RLS) - use ONLY for internal trusted actions
export function getSupabaseAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error('Missing Supabase admin env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
