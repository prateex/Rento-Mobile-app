import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Runtime logging to aid debugging in WebView
console.log('[Supabase] Env check:', { 
  urlPresent: !!url, 
  anonPresent: !!anon,
  urlValue: url ? `${url.substring(0, 20)}...` : 'undefined'
});

if (!url || !anon) {
  console.error('[Supabase] CRITICAL: Missing environment variables!');
  console.error('[Supabase] Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local');
  throw new Error('Supabase environment variables not configured');
}

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

console.log('[Supabase] Client initialized successfully');
