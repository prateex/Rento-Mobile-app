import { createClient } from '@supabase/supabase-js';

const rawAppEnv = import.meta.env.VITE_APP_ENV || import.meta.env.APP_ENV;
if (!rawAppEnv) {
  throw new Error('[ENV] Missing APP_ENV. Set APP_ENV=local or APP_ENV=production.');
}
if (rawAppEnv !== 'local' && rawAppEnv !== 'production') {
  throw new Error(`[ENV] Invalid APP_ENV: ${rawAppEnv}. Use "local" or "production".`);
}

const APP_ENV = rawAppEnv as 'local' | 'production';
const devUrl = import.meta.env.VITE_DEV_SUPABASE_URL as string | undefined;
const devAnon = import.meta.env.VITE_DEV_SUPABASE_ANON_KEY as string | undefined;
const prodUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const prodAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const supabaseUrl = APP_ENV === 'local' ? devUrl : prodUrl;
const supabaseAnonKey = APP_ENV === 'local' ? devAnon : prodAnon;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

console.log('[ENV] APP_ENV', APP_ENV);
console.log('[SUPABASE] URL', supabaseUrl || 'undefined');
console.log('[SUPABASE] anon present', !!supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

if (APP_ENV === 'local') {
  const isLocalhost = supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1');
  if (!isLocalhost) {
    throw new Error(`[Supabase] APP_ENV=local but URL is not localhost: ${supabaseUrl}`);
  }
}

if (APP_ENV === 'production') {
  if (!supabaseUrl.includes('supabase.co')) {
    throw new Error(`[Supabase] APP_ENV=production but URL is not a hosted supabase.co URL: ${supabaseUrl}`);
  }
}

console.log('[DB] connected');
