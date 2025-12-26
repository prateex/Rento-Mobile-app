console.log('[MAIN] === APP STARTING ===');

import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./ErrorBoundary";
import App from "./App";
import "./index.css";

console.log('[MAIN] Imports loaded');

// Render immediate loading UI
const rootEl = document.getElementById("root");
if (rootEl) {
  rootEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;font-size:18px;color:#333;">Loading App...</div>';
}

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
    const { supabase } = await import("./lib/supabase");
    const { useStore } = await import("./lib/store");
    
    console.log('[MAIN] Supabase loaded, setting up auth...');
    
    // Auth state tracking
    supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AUTH]', event, session?.user?.id);
      
      if (session?.user) {
        const user = {
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.email || 'User',
          phone: session.user.user_metadata?.phone || '',
          role: (session.user.user_metadata?.role || 'staff') as 'admin' | 'staff' | 'owner',
          email: session.user.email || undefined,
        };
        useStore.setState({ user, authToken: session.access_token, session });
      } else if (event === 'SIGNED_OUT') {
        useStore.setState({ user: null, authToken: null, session: null });
      }
    });

    // Check existing session
    console.log('[MAIN] Checking session...');
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      console.log('[MAIN] Session found:', session.user.id);
      const user = {
        id: session.user.id,
        name: session.user.user_metadata?.full_name || session.user.email || 'User',
        phone: session.user.user_metadata?.phone || '',
        role: (session.user.user_metadata?.role || 'staff') as 'admin' | 'staff' | 'owner',
        email: session.user.email || undefined,
      };
      useStore.setState({ user, authToken: session.access_token, session });
    } else {
      console.log('[MAIN] No session');
    }

    console.log('[MAIN] Rendering React app...');
    if (!rootEl) throw new Error('Root element not found');
    
    createRoot(rootEl).render(
      <ErrorBoundary>
        <App />
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
