/**
 * PURE SQL QUERIES FOR DEV ADMIN PAGE
 * 
 * These are the raw SQL statements used by the dev admin page.
 * Each step shows the exact SQL and explains why it works.
 */

-- ============================================================================
-- STEP 1: CREATE SUPABASE AUTH USER
-- ============================================================================
-- This uses Supabase Admin API, not SQL
-- Endpoint: POST http://127.0.0.1:54321/auth/v1/admin/users
-- Header: Authorization: Bearer {SERVICE_ROLE_KEY}
// Payload:
{
  "email": "owner@example.com",
  "password": "secure_password_here",
  "email_confirm": true
}
// Response includes: { id: "a1b2c3d4-...", email: "owner@example.com" }
// Copy the id value (auth_user_id)


-- ============================================================================
-- STEP 2: CREATE RENTAL SHOP
-- ============================================================================
-- Uses service role to insert (bypasses RLS)

INSERT INTO rental_shops (
  owner_id,
  name,
  address,
  city,
  state,
  pincode,
  phone,
  email,
  gst_number
)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,  -- auth_user_id from Step 1
  'Test Rental Shop',
  '123 Main Street',
  'New York',
  'NY',
  '10001',
  '5551234567',
  'shop@example.com',
  'GST123456'
)
RETURNING 
  id as shop_id,
  owner_id,
  name;

-- Returns: shop_id (copy this)
-- Why this works:
--   - owner_id links to auth.users (not public.users)
--   - shop_id is generated UUID (not user-provided)
--   - Service role bypasses any RLS (if present)
--   - All fields filled in (required or optional)


-- ============================================================================
-- STEP 3: ASSIGN OWNER TO SHOP
-- ============================================================================
-- Critical: Role MUST be 'owner' (explicit, no default)
-- Critical: shop_id MUST be provided (FK required)

INSERT INTO users (
  auth_id,
  shop_id,
  name,
  phone,
  email,
  role
)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,  -- auth_user_id from Step 1
  '5a572e3f-1453-46a1-9151-86ef715d45d3'::uuid,  -- shop_id from Step 2
  'John Doe',
  '5559876543',
  'owner@example.com',
  'owner'  -- ← EXPLICIT, not defaulted
)
RETURNING
  id as user_id,
  auth_id,
  shop_id,
  role,
  created_at;

-- Returns: user_id (for reference)
-- Why this works:
--   - auth_id UNIQUE constraint ensures one user per auth
--   - shop_id NOT NULL constraint ensures shop exists
--   - role 'owner' is explicit (no DEFAULT 'staff')
--   - Service role bypasses RLS checks
--   - INSERT succeeds in one transaction
--
-- Why it would fail:
--   - Duplicate auth_id: user already in public.users
--   - Invalid shop_id: shop doesn't exist
--   - Missing role: would use DEFAULT 'staff' (BAD, we prevent this)
--   - Invalid role enum: 'owner' must be in user_role type


-- ============================================================================
-- STEP 4 (OPTIONAL): ADD STAFF USER
-- ============================================================================
-- Same as Step 3 but role = 'staff' or 'admin'

INSERT INTO users (
  auth_id,
  shop_id,
  name,
  phone,
  email,
  role
)
VALUES (
  'c3d4e5f6-a7b8-9012-cdef-123456789012'::uuid,  -- Different auth user
  '5a572e3f-1453-46a1-9151-86ef715d45d3'::uuid,  -- SAME shop_id
  'Jane Staff',
  '5555555555',
  'staff@example.com',
  'staff'  -- ← Can be 'staff' or 'admin'
);

-- Why multiple staff allowed:
--   - auth_id is UNIQUE (but this is different auth_id)
--   - shop_id is NOT UNIQUE (multiple staff per shop is fine)
--   - Each staff user is separate row


-- ============================================================================
-- STEP 5: VALIDATION QUERIES
-- ============================================================================

-- Query 1: Check all users were created
SELECT 
  id as user_id,
  auth_id,
  shop_id,
  role,
  name,
  email,
  is_active,
  created_at
FROM public.users
ORDER BY created_at DESC;

-- Expected results:
--   - Rows with auth_id from Step 1 and Step 4 (if done)
--   - shop_id matches Step 2 shop
--   - role is 'owner' (Step 3) or 'staff'/'admin' (Step 4)
--   - is_active = true (default)
--
-- If no rows: INSERT didn't complete (check for SQL errors)
-- If wrong role: DEFAULT 'staff' was applied (migration has issue)


-- Query 2: Check shops were created
SELECT
  id as shop_id,
  owner_id,
  name,
  city,
  state,
  email,
  created_at
FROM public.rental_shops
ORDER BY created_at DESC;

-- Expected results:
--   - shop_id from Step 2
--   - owner_id = auth_user_id from Step 1
--   - name = "Test Rental Shop" (or custom)
--   - city, state, email populated


-- Query 3: Check RLS policy is working (auth_id based, no recursion)
SELECT 
  policyname,
  cmd AS operation,
  pg_get_expr(qual, 'users'::regclass) AS using_clause
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- Expected results:
--   - 4 rows (SELECT, INSERT, UPDATE, DELETE policies)
--   - No policy should mention "shop_id IN (SELECT ...)" (no recursion)
--   - SELECT policy should have: auth_id = auth.uid()
--   - INSERT policy should have: auth_id = auth.uid()
--   - UPDATE policy should have: auth_id = auth.uid()
--   - DELETE policy should have: false (blocked)


-- Query 4: Check role has NO DEFAULT
SELECT
  column_name,
  column_default,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name = 'role';

-- Expected results:
--   - column_default: NULL (empty)
--   - is_nullable: NO
--   - data_type: user_role (the enum type)
--
-- If column_default is not NULL:
--   - Schema has DEFAULT 'staff' (BAD)
--   - Must run migration that removes it


-- Query 5: Get current auth context (for debugging)
-- Run this to see who "you" are in the context
SELECT 
  auth.uid() AS current_auth_id,
  auth.email() AS current_email,
  auth.role() AS current_role;

-- When accessed by anon user (page viewer):
--   - current_auth_id: NULL
--   - current_email: NULL
--   - current_role: 'authenticated' or 'anon'
--
-- When accessed by admin service role (SQL execution):
--   - current_auth_id: NULL (service role has no uid)
--   - But queries succeed due to service role privileges


-- ============================================================================
-- STEP 6: MANUAL VERIFICATION (If needed)
-- ============================================================================

-- Check if user can log in (verify RLS allows their SELECT)
-- This simulates what happens during login
SELECT
  id,
  auth_id,
  role,
  shop_id,
  name
FROM public.users
WHERE auth_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid
LIMIT 1;

-- This query works because:
--   - Direct WHERE clause on auth_id (user-provided UUID)
--   - RLS policy checks: auth_id = auth.uid()
--   - No recursion, no subqueries
--   - Fast and predictable
--
-- If this fails with "permission denied" error:
--   - RLS policy is wrong
--   - Check Query 3 output
--   - Should not reference shop_id or get_my_shop_id()


-- ============================================================================
-- WHY THESE SQL STATEMENTS WORK
-- ============================================================================
--
// REASON 1: Uses explicit role values
//   - role = 'owner' or role = 'staff' (not relying on DEFAULT)
//   - If column had DEFAULT 'staff', it would override explicit value
//   - Our schema has NO DEFAULT, so explicit value is used
//
// REASON 2: Always provides shop_id
//   - shop_id is NOT NULL, so must be provided
//   - Cannot INSERT without shop_id
//   - Cannot INSERT with NULL shop_id
//   - Prevents bootstrap errors later
//
// REASON 3: Uses service role
//   - Service role bypasses RLS entirely
//   - Can INSERT without user_id context
//   - Can INSERT with shop_id not yet owned by user
//   - This is fine because we're setting up the initial record
//
// REASON 4: Validates each step
//   - Query 1-5 run immediately after INSERTs
//   - User sees data in validation panel
//   - Can confirm role is correct (not 'staff' default)
//   - Can confirm shop_id is present (not NULL)
//   - Can confirm RLS policy is simple (no recursion)
//
// REASON 5: Clear error handling
//   - If INSERT fails: SQL error shown (e.g., duplicate auth_id)
//   - User knows exactly what went wrong
//   - No silent failures or defaults applied
//   - Page is transparent about what's happening
//
// ============================================================================
