import { createClient } from '@supabase/supabase-js';

/**
 * Local Supabase CLI usage (dev-only):
 * - Install: npm install -g supabase
 * - Start:   supabase start
 * - Stop:    supabase stop
 * Never link or use production projects from this workspace.
 */

type SessionLike = {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  expires_at: number;
  refresh_token?: string;
  user: {
    id: string;
    email?: string;
    phone?: string;
    role?: string;
    user_metadata?: Record<string, unknown>;
  };
};

const rawAppEnv = import.meta.env.VITE_APP_ENV || import.meta.env.APP_ENV;
if (!rawAppEnv) {
  throw new Error('[ENV] Missing APP_ENV. Set APP_ENV=local or APP_ENV=production.');
}
if (rawAppEnv !== 'local' && rawAppEnv !== 'production') {
  throw new Error(`[ENV] Invalid APP_ENV: ${rawAppEnv}. Use "local" or "production".`);
}

const APP_ENV = rawAppEnv as 'local' | 'production';
const stubMode = import.meta.env.VITE_STUB_MODE === 'true';

const devUrl = import.meta.env.VITE_DEV_SUPABASE_URL as string | undefined;
const devAnon = import.meta.env.VITE_DEV_SUPABASE_ANON_KEY as string | undefined;

const prodUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const prodAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const logEnvCheck = (url?: string, anon?: string) => {
  console.log('[ENV] APP_ENV', APP_ENV);
  console.log('[SUPABASE] URL', url || 'undefined');
  console.log('[SUPABASE] anon present', !!anon);
  console.log('[DB] stub mode', stubMode ? 'enabled' : 'disabled');
};

const createOfflineSupabaseStub = () => {
  let currentSession: SessionLike | null = null;

  const buildQueryResponse = () => {
    let lastPayload: any = null;

    const chain: any = {
      select: (_columns?: any, _opts?: any) => chain,
      insert: (payload?: any) => {
        lastPayload = payload || null;
        return chain;
      },
      update: (payload?: any) => {
        lastPayload = payload || lastPayload;
        return chain;
      },
      delete: () => chain,
      eq: () => chain,
      is: () => chain,
      limit: () => chain,
      order: () => chain,
      single: async () => {
        const row = Array.isArray(lastPayload) ? lastPayload[0] : lastPayload;
        const normalized = row ? { id: row.id || `local-${Date.now()}`, ...row } : null;
        return { data: normalized, error: null, count: normalized ? 1 : 0 };
      },
      maybeSingle: async () => ({ data: null, error: null, count: 0 }),
      then: (resolve: any) => resolve({ data: Array.isArray(lastPayload) ? lastPayload : [], error: null, count: 0 }),
      catch: () => chain,
      finally: () => chain,
    };

    return chain;
  };

  const buildSession = (email?: string): SessionLike => ({
    access_token: 'offline-dev-token',
    token_type: 'bearer',
    expires_in: 60 * 60,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    user: {
      id: 'offline-user',
      email: email || 'offline@local.dev',
      role: 'owner',
      user_metadata: {
        full_name: 'Offline Admin',
        role: 'owner',
      },
    },
  });

  return {
    __offline: true,
    auth: {
      signInWithPassword: async ({ email }: { email?: string; password?: string }) => {
        currentSession = buildSession(email);
        return { data: { session: currentSession, user: currentSession.user }, error: null };
      },
      signOut: async () => {
        currentSession = null;
        return { error: null };
      },
      getSession: async () => ({ data: { session: currentSession }, error: null }),
      onAuthStateChange: (callback: (event: string, session: SessionLike | null) => void) => {
        setTimeout(() => callback(currentSession ? 'SIGNED_IN' : 'SIGNED_OUT', currentSession), 0);
        return { data: { subscription: { unsubscribe: () => {} } }, error: null };
      },
    },
    from: () => buildQueryResponse(),
    rpc: async () => ({ data: `INV-LOCAL-${Date.now()}`, error: null }),
  } as const;
};

let supabaseClient: any = null;

if (stubMode) {
  console.warn('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.warn('[Supabase] STUB MODE ENABLED (explicit)');
  console.warn('[Supabase] No backend calls. Supabase is disabled.');
  console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  supabaseClient = createOfflineSupabaseStub();
} else {
  const targetUrl = APP_ENV === 'local' ? devUrl : prodUrl;
  const targetAnon = APP_ENV === 'local' ? devAnon : prodAnon;

  logEnvCheck(targetUrl, targetAnon);

  if (!targetUrl || !targetAnon) {
    const message = APP_ENV === 'local'
      ? '[Supabase] Missing VITE_DEV_SUPABASE_URL or VITE_DEV_SUPABASE_ANON_KEY'
      : '[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY';
    throw new Error(message);
  }

  if (APP_ENV === 'local') {
    const isLocalhost = targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1');
    if (!isLocalhost) {
      throw new Error(`[Supabase] APP_ENV=local but URL is not localhost: ${targetUrl}`);
    }
  }

  if (APP_ENV === 'production') {
    if (!targetUrl.includes('supabase.co')) {
      throw new Error(`[Supabase] APP_ENV=production but URL is not a hosted supabase.co URL: ${targetUrl}`);
    }
  }

  supabaseClient = createClient(targetUrl, targetAnon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  });

  console.log('[DB] connected');
}

export const supabase = supabaseClient;
export const isSupabaseEnabled = !supabaseClient.__offline;
export const isSupabaseEnabledNow = () => !supabaseClient.__offline;
export const isSupabaseOffline = Boolean(supabaseClient.__offline);
export const supabaseMode = APP_ENV;

export const ensureSupabaseEnabled = () => {
  if (!isSupabaseEnabled) {
    throw new Error('Supabase is disabled in development. Enable VITE_USE_LOCAL_SUPABASE to use the local CLI.');
  }
  return supabaseClient;
};
