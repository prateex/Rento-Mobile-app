/**
 * DEVELOPER ADMIN PAGE - SETUP GUIDE & ARCHITECTURE
 * 
 * Location: http://localhost:5173/dev/admin
 * Environment: LOCAL DEVELOPMENT ONLY
 * Access: Enabled when import.meta.env.DEV && VITE_ENABLE_DEV_ADMIN=true
 */

// ============================================================================
// 1. WHY THIS PAGE EXISTS
// ============================================================================

/**
 * PROBLEM: Login Loop on Fresh Local Setup
 * 
 * Before this page, creating a fresh local account caused:
 * 1. User creates account in Supabase Auth (auth.users)
 * 2. App tries to bootstrap user profile (INSERT into public.users)
 * 3. RLS policies check shop_id (RECURSIVE QUERY)
 * 4. Infinite loop: RLS checks users.shop_id, which queries users table
 * 5. 500 error: "Database access denied"
 * 6. App signs out user
 * 7. Loop repeats
 *
 * ROOT CAUSES (NOW FIXED):
 * A) Schema: users.role had DEFAULT 'staff' (silently assigned wrong role)
 * B) RLS: users table policy queried users table (recursion)
 * C) App: had fallback to 'staff' when DB fetch failed
 * D) Bootstrap: didn't handle missing user row gracefully
 *
 * SOLUTION: This page creates users with proper setup:
 * - Explicit role='owner' (no defaults)
 * - Shop_id is always present (FK required)
 * - Uses service role (bypasses RLS for setup)
 * - Validates each step with SQL queries
 */

// ============================================================================
// 2. HOW IT FIXES THE PROBLEMS
// ============================================================================

/**
 * LAYER 1: DATABASE RLS FIX
 * 
 * OLD (Recursive):
 *   CREATE POLICY shop_access_all ON users
 *   USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()))
 * 
 * CONSEQUENCE:
 *   - To check if user can access a row, query users table
 *   - That query also has RLS, which triggers same policy
 *   - Infinite recursion → 500 error
 *
 * NEW (Simple, no recursion):
 *   CREATE POLICY "User can view own record" ON users FOR SELECT
 *   USING (auth_id = auth.uid())
 * 
 * CONSEQUENCE:
 *   - To check if user can access a row, directly compare auth_id
 *   - No secondary query needed
 *   - Fast, predictable, no recursion
 * 
 * APPLIES TO: Migration 20260117010000
 * RESULT: Users table RLS is safe for login bootstrap
 */

/**
 * LAYER 2: SCHEMA FIX
 * 
 * OLD (Wrong):
 *   CREATE TABLE users (
 *     role user_role NOT NULL DEFAULT 'staff'
 *   )
 * 
 * CONSEQUENCE:
 *   - INSERT INTO users (auth_id, shop_id, role) VALUES (..., 'owner')
 *   - DEFAULT silently overrides: role becomes 'staff'
 *   - Owner gets wrong role
 *
 * NEW (Correct):
 *   CREATE TABLE users (
 *     role user_role NOT NULL
 *   )
 * 
 * CONSEQUENCE:
 *   - INSERT requires explicit role
 *   - No defaults allowed
 *   - Role assignment is guaranteed correct
 * 
 * VALIDATION:
 *   - Migration checks: column_default IS NULL
 *   - Fails migration if DEFAULT found
 *
 * APPLIES TO: Migration 20260117010000
 * RESULT: Role assignment is always explicit, never defaulted
 */

/**
 * LAYER 3: APP CODE FIX
 * 
 * OLD (Fallback chains):
 *   const role = dbUser?.role || user.user_metadata?.role || 'staff'
 * 
 * CONSEQUENCE:
 *   - If DB fetch fails, silently use metadata or default
 *   - User thinks they're logged in, but role is wrong
 *   - RLS silently blocks operations
 *
 * NEW (No fallbacks):
 *   const { data: dbUser, error } = await supabase.from('users').select()
 *   if (error) throw new Error('User profile not found')
 *   const role = dbUser.role // ← FROM DB ONLY
 * 
 * CONSEQUENCE:
 *   - If DB fetch fails, clear error
 *   - User knows why they can't log in
 *   - No silent failures
 *
 * FILES CHANGED:
 *   - store.ts: Login method requires DB fetch
 *   - main.tsx: Auth state handlers require DB fetch
 *   - bootstrapUser.ts: Added logging for diagnosis
 *
 * RESULT: Role comes from DB only, clear error messages
 */

/**
 * LAYER 4: BOOTSTRAP FIX
 * 
 * OLD:
 *   1. User signs in to auth
 *   2. App tries to SELECT from users (RLS blocks due to recursion)
 *   3. Error → sign out
 *
 * NEW:
 *   1. This admin page creates shop first
 *   2. This admin page creates user in public.users with explicit role
 *   3. User signs in to auth
 *   4. App SELECTs from users (RLS allows via auth_id check)
 *   5. Success → app loads with correct role
 *
 * KEY DIFFERENCE:
 *   - old: Auth → DB (fails)
 *   - new: DB setup (admin page) → Auth → DB (succeeds)
 *
 * RESULT: User row exists before first login, no bootstrap RLS issue
 */

// ============================================================================
// 3. WORKFLOW
// ============================================================================

/**
 * STEP 1: CREATE AUTH USER
 * 
 * Action: POST /auth/v1/admin/users (service role)
 * Payload: { email, password, email_confirm: true }
 * Result: User in auth.users table
 * Copy: auth.user.id (UUID)
 * 
 * Why service role?
 *   - Admin API only accessible with service role
 *   - Can create users without email verification
 *   - Local development only
 * 
 * What's NOT created yet:
 *   - No entry in public.users
 *   - No shop association
 *   - No role assigned
 */

/**
 * STEP 2: CREATE RENTAL SHOP
 * 
 * Action: INSERT INTO rental_shops
 * SQL:
 *   INSERT INTO rental_shops (owner_id, name, address, city, state, phone, email, gst_number)
 *   VALUES (auth_user_id, ...)
 *   RETURNING id
 * 
 * Key detail:
 *   - owner_id = auth.user.id (links to auth.users)
 *   - shop_id generated as UUID
 *
 * Copy: shop_id (UUID)
 * 
 * Why this order?
 *   - Shop must exist before user (FK constraint)
 *   - users.shop_id REFERENCES rental_shops(id)
 */

/**
 * STEP 3: ASSIGN OWNER
 * 
 * Action: INSERT INTO public.users
 * SQL:
 *   INSERT INTO users (auth_id, shop_id, name, phone, email, role)
 *   VALUES (auth_user_id, shop_id, ..., 'owner')
 * 
 * Critical detail:
 *   - role = 'owner' (EXPLICIT, no default)
 *   - auth_id UNIQUE constraint (one user per auth)
 *   - shop_id is NOT NULL (FK required)
 *
 * Validation:
 *   - If duplicate auth_id → error (good)
 *   - If missing shop_id → error (good)
 *   - If default role used → migration fails (we prevent this)
 *
 * Result:
 *   - User can now log in
 *   - App will SELECT this row (RLS allows via auth_id check)
 *   - Role is 'owner' (explicit)
 *   - shop_id is present (required for all other tables)
 */

/**
 * STEP 4 (OPTIONAL): ADD STAFF USERS
 * 
 * Action: INSERT INTO public.users
 * SQL:
 *   INSERT INTO users (auth_id, shop_id, name, phone, email, role)
 *   VALUES (auth_user_id, SAME_shop_id, ..., 'staff')
 * 
 * Difference from step 3:
 *   - role = 'staff' (not 'owner')
 *   - Same shop_id (multiple staff allowed per shop)
 *   - Still requires explicit role (no defaults)
 *
 * Constraint:
 *   - Staff user must have auth account first
 *   - Can create via Step 1, then add as staff here
 */

/**
 * STEP 5: VALIDATION
 * 
 * Queries run to verify setup:
 * 1. SELECT id, auth_id, role, shop_id FROM users
 *    → Verify all users exist with correct role
 *
 * 2. SELECT id, owner_id, name FROM rental_shops
 *    → Verify shop created and owner linked
 *
 * 3. SELECT auth.uid()
 *    → Verify current auth context (for debugging)
 * 
 * What these prove:
 *   ✓ Users table is accessible (RLS not blocking SELECT)
 *   ✓ Role is explicit (not defaulted)
 *   ✓ Shop_id is present (not NULL)
 *   ✓ Auth context is correct
 */

// ============================================================================
// 4. SECURITY MODEL
// ============================================================================

/**
 * ACCESS CONTROL
 * 
 * This page is ONLY accessible when:
 *   import.meta.env.DEV === true  (development mode)
 *   AND VITE_ENABLE_DEV_ADMIN === 'true'  (environment variable)
 * 
 * If either condition is false:
 *   → Shows "Access Denied" message
 *   → No buttons or forms rendered
 *   → Cannot access any functionality
 * 
 * Production safety:
 *   - Cannot be enabled in production (import.meta.env.DEV always false)
 *   - Environment variable not set in production builds
 *   - Even if code deployed, access denied at runtime
 */

/**
 * API KEY USAGE
 * 
 * Three keys are used:
 * 1. VITE_SUPABASE_ANON_KEY
 *    - Limited privileges (user data only)
 *    - Used for normal app operations
 *    - Safe to commit to git
 *
 * 2. VITE_SUPABASE_SERVICE_ROLE_KEY
 *    - Full database access (admin)
 *    - Used ONLY by this dev admin page
 *    - ⚠️ NEVER commit to production
 *    - Only works locally
 *
 * 3. Admin API Key
 *    - Embedded in service role JWT
 *    - Used to create auth users
 *    - Local-only claim
 * 
 * Key rotation:
 *   - Fresh local setup regenerates keys
 *   - Keys in .env.local
 *   - Different keys per machine
 */

/**
 * WHAT SERVICE ROLE ALLOWS
 * 
 * ✓ CREATE users in auth.users (via admin API)
 * ✓ INSERT into public.* (bypasses RLS)
 * ✓ SELECT from public.* (bypasses RLS)
 * ✓ Run RPC functions as service role
 * 
 * ✗ Cannot export credentials
 * ✗ Cannot access Supabase dashboard
 * ✗ Cannot modify schema (no DDL)
 * 
 * Why safe for local dev:
 *   - Isolated to localhost (127.0.0.1)
 *   - Only available in local Supabase container
 *   - Credentials are ephemeral (regenerated each docker reset)
 *   - No persistence outside container
 */

// ============================================================================
// 5. ERROR HANDLING
// ============================================================================

/**
 * COMMON ERRORS & FIXES
 * 
 * ERROR: "VITE_SUPABASE_SERVICE_ROLE_KEY not set"
 * CAUSE: .env.local missing VITE_SUPABASE_SERVICE_ROLE_KEY
 * FIX: Add to .env.local, restart dev server
 * 
 * ERROR: "Auth API error: 401"
 * CAUSE: Service role key invalid or wrong endpoint
 * FIX: Verify VITE_SUPABASE_URL and key
 * 
 * ERROR: "User already exists (duplicate email)"
 * CAUSE: Created user with same email before
 * FIX: Use different email, or manually delete from auth (local)
 * 
 * ERROR: "Shop name required"
 * CAUSE: User entered blank shop name
 * FIX: Fill in shop name field
 * 
 * ERROR: "Auth user ID and shop ID required"
 * CAUSE: Skipped Step 1 or Step 2
 * FIX: Complete all steps in order
 * 
 * ERROR: "Duplicate user record"
 * CAUSE: auth_id already exists in public.users
 * FIX: Choose different auth user, or delete row manually
 * 
 * All errors display with:
 *   - ✗ Clear error message
 *   - Full SQL error details
 *   - No silent failures
 */

// ============================================================================
// 6. VERIFICATION CHECKLIST
// ============================================================================

/**
 * AFTER COMPLETING SETUP:
 * 
 * ✓ Navigate to http://localhost:5173/dev/admin
 * ✓ See "⚠️ DEV ADMIN — LOCAL ONLY" warning banner
 * ✓ Create auth user (Step 1) → got auth.user.id
 * ✓ Create shop (Step 2) → got shop.id  
 * ✓ Assign owner (Step 3) → no error
 * ✓ Run validation (Step 5) → users and shops visible in output
 * ✓ Close dev admin page
 * ✓ Navigate to http://localhost:5173/login
 * ✓ Enter email/password from Step 1
 * ✓ Login succeeds → redirected to app
 * ✓ User shows as "owner" role
 * ✓ No "User role lookup failed" error
 * 
 * If any step fails:
 *   - Check error message
 *   - Review validation query output
 *   - Verify schema via Supabase Studio
 *   - Check browser console logs
 */

// ============================================================================
// 7. TECHNICAL NOTES
// ============================================================================

/**
 * WHY NOT USE EDGE FUNCTIONS?
 * 
 * This page uses direct API calls instead of edge functions because:
 * - Service role key never leaves local machine
 * - No network exposure (localhost only)
 * - Direct control over SQL execution
 * - Easier debugging (inspect network tab)
 * - No cold start delays
 * 
 * Trade-off: Not production-ready pattern
 * This is acceptable because:
 * - Page only works locally (import.meta.env.DEV)
 * - Credentials embedded in frontend (acceptable locally)
 * - No data sensitivity (test setup only)
 */

/**
 * WHY SERVICE ROLE & NOT USING APP AUTH?
 * 
 * Cannot use regular app auth for bootstrap because:
 * - User doesn't exist in public.users yet (chicken-egg problem)
 * - RLS would block INSERT (no shop_id to validate against)
 * - Cannot insert shop_id field if user doesn't have one
 * 
 * Service role solves this by:
 * - Bypassing RLS entirely
 * - Can insert without RLS checks
 * - Can create full record in one transaction
 * 
 * Alternative (more complex):
 * - Create public.users row with NULL shop_id
 * - Use trigger to create default shop
 * - Update shop_id after
 * Current solution is simpler and more explicit
 */

/**
 * RLS VALIDATION
 * 
 * After setup, verify RLS is working:
 * 1. Log in as owner
 * 2. Should see only own shop's data (RLS filters)
 * 3. Try to access another shop's data (direct URL)
 * 4. RLS blocks it (404 or empty result)
 * 
 * How to test:
 *   - Get shop_id from validation panel
 *   - In browser console:
 *     const { data, error } = await supabase
 *       .from('vehicles')
 *       .select()
 *       .eq('shop_id', 'wrong-shop-id')
 *     // Should return error: "new row violates row-level security"
 */

// ============================================================================
// 8. SUMMARY
// ============================================================================

/**
 * WHAT THIS PAGE DOES:
 * 1. Bypasses bootstrap RLS issue (creates users before first login)
 * 2. Ensures explicit role assignment (no defaults)
 * 3. Verifies shop_id presence (FK constraint)
 * 4. Tests that RLS policies work (no recursion)
 * 5. Provides clear error messages (no silent failures)
 * 6. Isolates dev admin functionality from production code
 * 
 * RESULT:
 * - Login loop is fixed
 * - Users can sign in and load their data
 * - RLS policies protect data correctly
 * - Developer has full control over test setup
 * 
 * USE THIS PAGE FOR:
 * ✓ Creating fresh test accounts locally
 * ✓ Testing multi-tenant scenarios
 * ✓ Verifying RLS policies work
 * ✓ Debugging authentication issues
 * 
 * DO NOT USE THIS PAGE FOR:
 * ✗ Production deployments
 * ✗ User-facing account creation
 * ✗ Bypassing security in production
 * ✗ Modifying schema
 */
