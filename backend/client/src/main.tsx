console.log('[MAIN] === APP STARTING ===');

import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./ErrorBoundary";
import App from "./App";
import DevAdmin from "./pages/DevAdmin";
import "./index.css";

console.log('[MAIN] Imports loaded');

// Render immediate loading UI
const rootEl = document.getElementById("root");
if (rootEl) {
  rootEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;font-size:18px;color:#333;">Loading App...</div>';
}

const showBlockingError = (message: string) => {
  if (!rootEl) return;
  rootEl.innerHTML = `<div style="padding:20px;color:#d32f2f;font-family:system-ui;"><h2>Login blocked</h2><p>${message}</p></div>`;
};

// Global error logging
window.addEventListener('error', (e) => {
  console.error('[ERROR]', e.error || e.message || e);
  if (rootEl) {
    rootEl.innerHTML = `<div style="padding:20px;color:#d32f2f;font-family:system-ui;"><h2>Error</h2><pre>${e.error?.stack || e.message}</pre></div>`;
  }
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[REJECTION]', e.reason || e);
});

console.log('[MAIN] Starting initialization...');

// Initialize app
(async () => {
  try {
    console.log('[MAIN] Loading Supabase...');
    const { supabase, isSupabaseEnabled } = await import("./lib/supabase");
    const { useStore } = await import("./lib/store");
    const { bootstrapUser, fetchUserFromDatabase } = await import("./lib/bootstrapUser");
    const { getAuthContext } = await import("./lib/shopIdHelper");
    
    if (!isSupabaseEnabled) {
      console.warn('[MAIN] Supabase disabled. Running in local-only/Zustand mode.');
      if (!rootEl) throw new Error('Root element not found');
      createRoot(rootEl).render(
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      );
      console.log('[MAIN] === APP RENDERED (LOCAL MODE) ===');
      return;
    }

    console.log('[MAIN] Supabase loaded, setting up auth...');
    
    // Auth state tracking
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AUTH]', event, session?.user?.id);
      
      if (session?.user) {
        try {
          await bootstrapUser();
          const dbUser = await fetchUserFromDatabase();

          if (!dbUser) {
            throw new Error('User profile could not be loaded');
          }

          const user = {
            id: session.user.id,
            name: dbUser.name,
            phone: dbUser.phone,
            role: dbUser.role,
            email: dbUser.email,
          };
          const { shopId } = await getAuthContext();
          useStore.setState({ user, authToken: session.access_token, session, shopId });
          await useStore.getState().refreshAllData();
        } catch (e) {
          useStore.setState({ user: null, authToken: null, session: null, shopId: null });
          showBlockingError('shop_id could not be resolved for this account');
        }
      } else if (event === 'SIGNED_OUT') {
        useStore.setState({ user: null, authToken: null, session: null });
      }
    });

    // Check existing session
    console.log('[MAIN] Checking session...');
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      console.log('[MAIN] Session found:', session.user.id);

      await bootstrapUser();
      const dbUser = await fetchUserFromDatabase();

      if (!dbUser) {
        showBlockingError('User profile could not be loaded');
        return;
      }

      const user = {
        id: session.user.id,
        name: dbUser.name,
        phone: dbUser.phone,
        role: dbUser.role,
        email: dbUser.email,
      };
      const { shopId } = await getAuthContext();
      useStore.setState({ user, authToken: session.access_token, session, shopId });
      try { await useStore.getState().refreshAllData(); } catch (e) { console.error('[MAIN] refreshAllData on startup failed:', e); }
    } else {
      console.log('[MAIN] No session');
    }

    console.log('[MAIN] Rendering React app...');
    if (!rootEl) throw new Error('Root element not found');
    
    // Check if user is accessing /dev/admin route
    const path = window.location.pathname;
    const component = path === '/dev/admin' ? <DevAdmin /> : <App />;
    
    createRoot(rootEl).render(
      <ErrorBoundary>
        {component}
      </ErrorBoundary>
    );
    
    console.log('[MAIN] === APP RENDERED ===');
  } catch (e) {
    console.error('[FATAL]', e);
    if (rootEl) {
      rootEl.innerHTML = `<div style="padding:20px;color:#d32f2f;font-family:system-ui;"><h2>Fatal Error</h2><pre>${e instanceof Error ? e.stack : String(e)}</pre><button onclick="location.reload()" style="margin-top:16px;padding:8px 16px;background:#1976d2;color:white;border:none;border-radius:4px;cursor:pointer;">Reload</button></div>`;
    }
  }
})();
