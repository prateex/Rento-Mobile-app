# Safe Development Mode - Configuration Verified

**Status**: ✅ All safety checks in place

## Guarantees

### 1. ✅ Localhost-Only Guard (CRITICAL)
- **File**: `src/lib/supabase.ts`
- **Check**: If dev mode tries to use a non-localhost URL, it **throws an error immediately**
- **Message**: `"Dev mode MUST use localhost (http://localhost:54321 only). Production Supabase is forbidden."`
- **Result**: Production Supabase is **impossible** to reach from dev environment

### 2. ✅ Offline-First Default
- **Feature Flag**: `VITE_USE_LOCAL_SUPABASE`
- **Default**: `false` (OFFLINE mode active)
- **Behavior**: 
  - App uses Zustand/mock data only
  - Zero network calls to Supabase
  - No auth bootstrap attempted
- **Console Warning**: Clear `OFFLINE MODE` banner displayed on startup

### 3. ✅ Local CLI Opt-In
- **Enabled When**: `VITE_USE_LOCAL_SUPABASE=true` + `VITE_DEV_SUPABASE_URL=http://localhost:54321`
- **Requires**: Docker running + `supabase start` (manual)
- **Console Warning**: Clear `LOCAL SUPABASE MODE ENABLED` banner with URL on startup

### 4. ✅ No-OP Helpers in Offline Mode
- **bootstrapUser.ts**: Returns mock local user data (no auth calls)
- **shopIdHelper.ts**: Returns mock shop ID (no database lookups)
- **store.ts**: All CRUD operations work locally (Zustand only)
- **Result**: App is fully functional without any backend

### 5. ✅ Callable Runtime Checks
- **Function**: `isSupabaseEnabledNow()`
- **Location**: `src/lib/supabase.ts` (exported)
- **Usage**: All guards use runtime checks, not static flags
- **Result**: State is always current, even if env vars change

### 6. ✅ No SQL Changes
- **Database**: Untouched
- **Schema**: Untouched
- **Migrations**: Not auto-run
- **RLS Policies**: Not modified

### 7. ✅ No Production Access
- **Workspace**: Never links to cloud projects
- **URLs**: Only `http://localhost:*` allowed in dev
- **Credentials**: Never hardcoded; always env-var based
- **Result**: Zero risk of accidental production data access

---

## How It Works

### OFFLINE MODE (Default)
```bash
# .env.local
VITE_USE_LOCAL_SUPABASE=false
```
- App boots instantly with mock data
- No Docker required
- No Supabase connection attempts
- Console shows: `OFFLINE MODE – Running fully local with Zustand/mock data`
- **Perfect for**: Frontend development, UI testing, offline work

### LOCAL SUPABASE MODE
```bash
# .env.local
VITE_USE_LOCAL_SUPABASE=true
VITE_DEV_SUPABASE_URL=http://localhost:54321
VITE_DEV_SUPABASE_ANON_KEY=<from supabase start output>
```
- Prerequisites: Docker running
- Start: `supabase start` (manual, from project root)
- Stop: `supabase stop`
- Console shows: `LOCAL SUPABASE MODE ENABLED – Connected to: http://localhost:54321`
- **Perfect for**: Integration testing, auth testing, multi-user testing

---

## Startup Checklist

### 1. Offline (no Docker needed)
```bash
# .env.local (or defaults)
VITE_USE_LOCAL_SUPABASE=false

cd backend/client
npm run dev

# Expected console output:
# ════════════════════════════════════════════════════════════════
# [Supabase] OFFLINE MODE – Running fully local with Zustand/mock data.
# [Supabase] No backend calls. No Supabase connection.
# [Supabase] To enable local Supabase CLI: set VITE_USE_LOCAL_SUPABASE=true
# ════════════════════════════════════════════════════════════════
```

### 2. With Local Supabase CLI
```bash
# Prerequisites: Docker Desktop running

# Terminal 1: Start Supabase
supabase start
# Wait for output with anon key

# Terminal 2: Set env vars and start app
# .env.local
VITE_USE_LOCAL_SUPABASE=true
VITE_DEV_SUPABASE_URL=http://localhost:54321
VITE_DEV_SUPABASE_ANON_KEY=<copy from supabase start output>

cd backend/client
npm run dev

# Expected console output:
# ════════════════════════════════════════════════════════════════
# [Supabase] LOCAL SUPABASE MODE ENABLED
# [Supabase] Connected to: http://localhost:54321
# [Supabase] Using local Supabase CLI (Docker required).
# ════════════════════════════════════════════════════════════════
```

---

## Safety Tests Performed

✅ **Test 1: App runs without Docker**
- Set `VITE_USE_LOCAL_SUPABASE=false`
- App starts with mock data
- No Supabase errors
- Full functionality available

✅ **Test 2: App runs with local Supabase CLI**
- Set `VITE_USE_LOCAL_SUPABASE=true`
- Set localhost URL + anon key
- `supabase start` running
- App connects to local CLI
- Auth works with local users
- Data persists locally

✅ **Test 3: Production URL is rejected**
- Try to set `VITE_DEV_SUPABASE_URL=https://xxx.supabase.co`
- App throws error immediately
- Message: `"Dev mode MUST use localhost...Production Supabase is forbidden."`
- No requests sent

✅ **Test 4: All helpers work offline**
- `bootstrapUser()` returns mock data
- `getCurrentShopId()` returns local mock ID
- `store.ts` CRUD all use Zustand
- No auth/session calls attempted

✅ **Test 5: Console warnings are clear**
- Offline mode: Banner shows `OFFLINE MODE`
- Local mode: Banner shows `LOCAL SUPABASE MODE ENABLED`
- Both show explicit state and instructions

---

## Files Modified

1. **src/lib/supabase.ts**
   - Added localhost guard with error on non-localhost URL
   - Offline stub client with chainable query builder
   - Clear console banners for offline/local modes
   - Exported `isSupabaseEnabledNow()` for runtime checks

2. **src/lib/store.ts**
   - Updated to use callable `isSupabaseEnabledNow()`
   - All CRUD operations have offline fallbacks
   - No Supabase calls without guard checks

3. **src/lib/bootstrapUser.ts**
   - Returns null in offline mode (for fetch)
   - Returns mock user in offline mode (for bootstrap)
   - No auth calls when disabled

4. **src/lib/shopIdHelper.ts**
   - Returns mock shop ID in offline mode
   - No database lookups when disabled

5. **src/main.tsx**
   - Checks if Supabase is enabled before auth setup
   - Renders app immediately in offline mode

6. **SUPABASE_LOCAL_SETUP.md**
   - Updated with localhost-only instructions
   - Added CLI install steps
   - Removed cloud linking references

7. **.env.example**
   - Added with offline-by-default settings
   - Localhost URL placeholder
   - Anon key placeholder

---

## Key Design Principles

1. **Fail-Safe**: If anything goes wrong, default to offline mode
2. **Explicit Opt-In**: Supabase requires deliberate env var setting + localhost check
3. **Clear Messaging**: Console warnings indicate current mode
4. **No Auto-Fallbacks**: If local URL is bad, throw (don't try cloud)
5. **Mock Data First**: App works 100% with Zustand before trying any backend

---

## What's NOT Allowed

❌ Using production Supabase URLs in development  
❌ Auto-running SQL migrations  
❌ Hardcoding Supabase credentials  
❌ Linking to cloud projects  
❌ Accessing production data from dev  
❌ Removing offline fallbacks  

---

## Maintenance Notes

- **To add a new Supabase call**: Wrap with `if (!isSupabaseEnabledNow()) return mockData;`
- **To test offline mode**: Set `VITE_USE_LOCAL_SUPABASE=false` and ensure no errors
- **To test local mode**: Set flag to `true`, run `supabase start`, and verify connection
- **To switch modes**: Just change env vars in `.env.local` and reload

---

## Support Commands

```bash
# Start local Supabase
supabase start

# Get local anon key (from supabase start output)
# Look for: "anon key: eyJ..."

# Stop local Supabase
supabase stop

# Reset local data completely
supabase stop --no-backup
rm -rf .supabase/
supabase start

# Access local Studio (when running)
# Open browser: http://localhost:54323

# Run app in offline mode
VITE_USE_LOCAL_SUPABASE=false npm run dev

# Run app with local Supabase
VITE_USE_LOCAL_SUPABASE=true npm run dev
```

---

**Setup Complete. All safety checks verified and in place. ✅**
