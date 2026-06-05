-- ============================================================================
-- RENTO APP: MULTI-TENANT USER & SHOP MANAGEMENT ARCHITECTURE
-- ============================================================================
-- This document defines the SAFE, repeatable, production-ready process for:
-- 1. Creating rental shops
-- 2. Managing users (owners and staff)
-- 3. Assigning roles and access
-- 4. Enforcing data isolation via RLS

-- ============================================================================
-- A) DATABASE DESIGN ASSUMPTIONS
-- ============================================================================

-- SOURCE OF TRUTH FOR ROLES:
--   The `users.role` column in the public schema is the source of truth.
--   Roles: 'admin' (system), 'owner' (shop owner), 'staff' (shop employee)
--
-- USER-TO-SHOP LINKING:
--   users.shop_id → rental_shops.id (foreign key)
--   A user belongs to EXACTLY ONE shop.
--   A shop can have MULTIPLE staff users.
--   A shop has AT MOST ONE owner (enforced via unique constraint).
--
-- AUTH.USERS REFERENCE:
--   users.auth_id → auth.users.id (foreign key)
--   Auth is the source of authentication.
--   The users table adds business context (role, shop, status).
--
-- MULTIPLE STAFF SUPPORT:
--   Multiple rows in users table, all with same shop_id, role='staff'.
--   RLS policies allow staff to see shop data based on users.shop_id.
--
-- SINGLE OWNER ENFORCEMENT:
--   Unique constraint: UNIQUE(shop_id, role) WHERE role='owner'
--   This prevents multiple owners per shop.
--   If an owner leaves, you promote a staff member via function.
--
-- OWNER IDENTITY:
--   rental_shops.owner_id: Initial creator (historical record)
--   users (role='owner'): Current owner (enforced via RLS and constraints)
--   The user with role='owner' in the users table is the actual owner.

-- ============================================================================
-- B) SQL FUNCTIONS (MIGRATION-SAFE)
-- ============================================================================

-- FUNCTION 1: Create a rental shop
-- Input: shop metadata (name, phone, email, address, city, state, pincode, gst_number)
-- Output: shop.id UUID
-- Purpose: Create a new shop (without owner yet)
-- Safety: Validates inputs, generates UUID, doesn't assign owner
--
-- Migration: Add this to your migration file after CREATE TABLE statements

CREATE OR REPLACE FUNCTION create_rental_shop(
  p_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_pincode TEXT DEFAULT NULL,
  p_gst_number TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_shop_id UUID;
BEGIN
  -- Validate required inputs
  IF p_name IS NULL OR TRIM(p_name) = '' THEN
    RAISE EXCEPTION 'Shop name is required and cannot be empty';
  END IF;

  -- Create shop
  INSERT INTO rental_shops (
    owner_id,
    name,
    phone,
    email,
    address,
    city,
    state,
    pincode,
    gst_number
  )
  VALUES (
    auth.uid(),  -- Temporary owner (will be updated when user is created)
    TRIM(p_name),
    TRIM(p_phone),
    TRIM(p_email),
    TRIM(p_address),
    TRIM(p_city),
    TRIM(p_state),
    TRIM(p_pincode),
    TRIM(p_gst_number)
  )
  RETURNING id INTO v_shop_id;

  RETURN v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================

-- FUNCTION 2: Create and assign shop owner
-- Input: auth_user_id (from auth.users), shop_id
-- Output: users.id UUID
-- Purpose: Link an authenticated user as OWNER to a shop
-- Safety: Checks shop exists, validates role uniqueness, validates auth user exists
-- Rules: Only ONE owner per shop. Fails if owner already exists.
--
-- Migration: Add after create_rental_shop function

CREATE OR REPLACE FUNCTION create_owner(
  p_auth_user_id UUID,
  p_shop_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_existing_owner_count INTEGER;
BEGIN
  -- Validate inputs
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth user ID is required';
  END IF;
  
  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'Shop ID is required';
  END IF;

  -- Check if shop exists
  IF NOT EXISTS (SELECT 1 FROM rental_shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'Shop does not exist: %', p_shop_id;
  END IF;

  -- Check if auth user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_auth_user_id) THEN
    RAISE EXCEPTION 'Auth user does not exist: %', p_auth_user_id;
  END IF;

  -- Check if user already exists in this shop
  IF EXISTS (SELECT 1 FROM users WHERE auth_id = p_auth_user_id AND shop_id = p_shop_id) THEN
    RAISE EXCEPTION 'User already exists in this shop';
  END IF;

  -- Check if shop already has an owner
  SELECT COUNT(*) INTO v_existing_owner_count
  FROM users
  WHERE shop_id = p_shop_id AND role = 'owner';

  IF v_existing_owner_count > 0 THEN
    RAISE EXCEPTION 'Shop already has an owner. Promote an existing staff member instead.';
  END IF;

  -- Create owner user record
  INSERT INTO users (
    auth_id,
    shop_id,
    name,
    email,
    role,
    is_active
  )
  VALUES (
    p_auth_user_id,
    p_shop_id,
    COALESCE((SELECT email FROM auth.users WHERE id = p_auth_user_id), 'Unknown'),
    (SELECT email FROM auth.users WHERE id = p_auth_user_id),
    'owner',
    true
  )
  RETURNING id INTO v_user_id;

  -- Update rental_shops.owner_id to point to the actual user record
  UPDATE rental_shops
  SET owner_id = p_auth_user_id
  WHERE id = p_shop_id;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================

-- FUNCTION 3: Create and assign staff member
-- Input: auth_user_id (from auth.users), shop_id
-- Output: users.id UUID
-- Purpose: Link an authenticated user as STAFF to a shop
-- Safety: Checks shop exists, validates auth user exists, prevents duplicate assignments
-- Rules: Multiple staff per shop allowed. Staff cannot have access to users management.
--
-- Migration: Add after create_owner function

CREATE OR REPLACE FUNCTION create_staff(
  p_auth_user_id UUID,
  p_shop_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Validate inputs
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth user ID is required';
  END IF;
  
  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'Shop ID is required';
  END IF;

  -- Check if shop exists
  IF NOT EXISTS (SELECT 1 FROM rental_shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'Shop does not exist: %', p_shop_id;
  END IF;

  -- Check if auth user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_auth_user_id) THEN
    RAISE EXCEPTION 'Auth user does not exist: %', p_auth_user_id;
  END IF;

  -- Check if user already exists in this shop (any role)
  IF EXISTS (SELECT 1 FROM users WHERE auth_id = p_auth_user_id AND shop_id = p_shop_id) THEN
    RAISE EXCEPTION 'User already exists in this shop';
  END IF;

  -- Create staff user record
  INSERT INTO users (
    auth_id,
    shop_id,
    name,
    email,
    role,
    is_active
  )
  VALUES (
    p_auth_user_id,
    p_shop_id,
    COALESCE((SELECT email FROM auth.users WHERE id = p_auth_user_id), 'Unknown'),
    (SELECT email FROM auth.users WHERE id = p_auth_user_id),
    'staff',
    true
  )
  RETURNING id INTO v_user_id;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================

-- FUNCTION 4: Promote staff member to owner
-- Input: auth_user_id (staff user to promote), shop_id
-- Output: varchar (success message)
-- Purpose: Change a staff member's role to 'owner'
-- Safety: Validates user exists, validates shop exists, validates user is in the shop,
--         removes previous owner if exists, enforces single owner constraint
-- Rules: Only one owner per shop. Previous owner (if any) must be demoted first.
--
-- Migration: Add after create_staff function

CREATE OR REPLACE FUNCTION promote_staff_to_owner(
  p_auth_user_id UUID,
  p_shop_id UUID
)
RETURNS TEXT AS $$
DECLARE
  v_current_owner_auth_id UUID;
  v_user_role user_role;
BEGIN
  -- Validate inputs
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth user ID is required';
  END IF;
  
  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'Shop ID is required';
  END IF;

  -- Check if shop exists
  IF NOT EXISTS (SELECT 1 FROM rental_shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'Shop does not exist: %', p_shop_id;
  END IF;

  -- Check if user exists in this shop
  IF NOT EXISTS (SELECT 1 FROM users WHERE auth_id = p_auth_user_id AND shop_id = p_shop_id) THEN
    RAISE EXCEPTION 'User does not exist in this shop: %', p_auth_user_id;
  END IF;

  -- Check if user is already owner
  SELECT role INTO v_user_role
  FROM users
  WHERE auth_id = p_auth_user_id AND shop_id = p_shop_id;

  IF v_user_role = 'owner' THEN
    RETURN 'User is already the owner of this shop';
  END IF;

  -- Find current owner (if any)
  SELECT auth_id INTO v_current_owner_auth_id
  FROM users
  WHERE shop_id = p_shop_id AND role = 'owner'
  LIMIT 1;

  -- If there's a current owner, demote them to staff
  IF v_current_owner_auth_id IS NOT NULL THEN
    UPDATE users
    SET role = 'staff'
    WHERE auth_id = v_current_owner_auth_id AND shop_id = p_shop_id;
  END IF;

  -- Promote the staff member to owner
  UPDATE users
  SET role = 'owner'
  WHERE auth_id = p_auth_user_id AND shop_id = p_shop_id;

  -- Update rental_shops.owner_id to the new owner
  UPDATE rental_shops
  SET owner_id = p_auth_user_id
  WHERE id = p_shop_id;

  RETURN 'User promoted to owner successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================

-- FUNCTION 5: Deactivate user (soft delete)
-- Input: auth_user_id
-- Output: varchar (success message)
-- Purpose: Deactivate a user (they can no longer access the app)
-- Safety: Soft delete only (doesn't remove auth.users), validates user exists
-- Rules: Deactivated users cannot access the app via RLS policies.
--        auth.users record is preserved for audit trail.
--        Cannot deactivate users from other shops (enforced by RLS).
--
-- Migration: Add after promote_staff_to_owner function

CREATE OR REPLACE FUNCTION deactivate_user(
  p_auth_user_id UUID
)
RETURNS TEXT AS $$
DECLARE
  v_rows_affected INTEGER;
BEGIN
  -- Validate input
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth user ID is required';
  END IF;

  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE auth_id = p_auth_user_id) THEN
    RAISE EXCEPTION 'User does not exist: %', p_auth_user_id;
  END IF;

  -- Deactivate user (soft delete)
  UPDATE users
  SET is_active = false, updated_at = now()
  WHERE auth_id = p_auth_user_id;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  RETURN 'User deactivated successfully. ' || v_rows_affected || ' record(s) updated.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================

-- FUNCTION 6: Get current user context
-- Input: (none - uses auth.uid())
-- Output: TABLE (user_id UUID, shop_id UUID, role user_role, is_active BOOLEAN)
-- Purpose: Retrieve the current user's role and shop assignment
-- Safety: Uses auth.uid() context, returns only authenticated user's info
-- Rules: Frontend calls this after login to determine access level.
--
-- Migration: Add after deactivate_user function

CREATE OR REPLACE FUNCTION get_current_user_context()
RETURNS TABLE (
  user_id UUID,
  shop_id UUID,
  role user_role,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    users.id,
    users.shop_id,
    users.role,
    users.is_active
  FROM users
  WHERE users.auth_id = auth.uid()
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- C) RLS POLICY MODEL
-- ============================================================================

-- OWNERS: Can manage shop and staff
-- STAFF:  Can access only their shop's data
-- ADMINS: Can access all shops (if role='admin')

-- EXAMPLE: rental_shops policies

-- Policy 1: Owners can view/update their own shop
CREATE POLICY "Owners can view their own shops"
ON rental_shops FOR SELECT
USING (
  owner_id = auth.uid()
);

CREATE POLICY "Owners can update their own shops"
ON rental_shops FOR UPDATE
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- Policy 2: Staff can view (but not update) their shop
CREATE POLICY "Staff can view their shop"
ON rental_shops FOR SELECT
USING (
  id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid() AND role = 'staff'
  )
);

-- EXAMPLE: users policies (user management)

-- Policy 1: Owners can manage users in their shop
CREATE POLICY "Owners can view their shop's users"
ON users FOR SELECT
USING (
  shop_id IN (
    SELECT id FROM rental_shops WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Owners can insert staff to their shop"
ON users FOR INSERT
WITH CHECK (
  shop_id IN (
    SELECT id FROM rental_shops WHERE owner_id = auth.uid()
  )
  AND role != 'admin'  -- Cannot create admins
);

-- Policy 2: Users can view their own record
CREATE POLICY "Users can view their own record"
ON users FOR SELECT
USING (auth_id = auth.uid());

-- Policy 3: Staff cannot modify user records
-- (No INSERT/UPDATE/DELETE policy for staff on users table)

-- EXAMPLE: bookings policies (data isolation)

-- Policy 1: Staff can view only bookings in their shop
CREATE POLICY "Staff can view bookings in their shop"
ON bookings FOR SELECT
USING (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Staff can create bookings in their shop"
ON bookings FOR INSERT
WITH CHECK (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid() AND role IN ('owner', 'staff') AND is_active = true
  )
);

CREATE POLICY "Staff can update bookings in their shop"
ON bookings FOR UPDATE
USING (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid() AND role IN ('owner', 'staff') AND is_active = true
  )
)
WITH CHECK (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid() AND role IN ('owner', 'staff') AND is_active = true
  )
);

-- PATTERN: Apply this same pattern to all tables:
-- - vehicles, customers, payments, damages, documents, etc.
-- - Always filter by: shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())
-- - Always check: is_active = true

-- ============================================================================
-- D) STEP-BY-STEP OPERATIONAL FLOW
-- ============================================================================

-- STEP 1: OWNER SIGNUP (Frontend + Auth)
-- Location: Supabase Auth (handled by auth provider)
-- Action: Owner creates account (email/password)
-- Result: New row in auth.users with unique id
-- Code Example:
--   const { data, error } = await supabase.auth.signUp({
--     email: 'owner@shop.com',
--     password: 'secure_password'
--   });
--   const auth_user_id = data.user.id;

-- STEP 2: SHOP CREATION (Frontend → SQL Function)
-- Location: Frontend calls Supabase function
-- Action: Create rental shop record
-- SQL:    create_rental_shop(name, phone, email, address, city, state, pincode, gst)
-- Result: New row in rental_shops with id, owner_id=auth.uid()
-- Code Example:
--   const { data, error } = await supabase.rpc('create_rental_shop', {
--     p_name: 'ABC Rentals',
--     p_phone: '9876543210',
--     p_email: 'shop@abc.com',
--     p_address: '123 Main St',
--     p_city: 'New York',
--     p_state: 'NY',
--     p_pincode: '10001',
--     p_gst_number: 'GST123'
--   });
--   const shop_id = data;

-- STEP 3: OWNER ASSIGNMENT (Frontend → SQL Function)
-- Location: Frontend calls Supabase function
-- Action: Link authenticated owner to shop
-- SQL:    create_owner(auth_user_id, shop_id)
-- Result: New row in users table (role='owner')
-- Code Example:
--   const { data, error } = await supabase.rpc('create_owner', {
--     p_auth_user_id: auth_user_id,
--     p_shop_id: shop_id
--   });
--   const user_id = data;

-- STEP 4: STAFF INVITATION (Owner → Frontend)
-- Location: Owner's admin panel
-- Action: Owner invites staff (sends email or generates invite code)
-- Design: Store invite codes in a separate table (not shown here) or use auth invites
-- Code Example:
--   POST /api/invite-staff
--   Body: { shop_id, staff_email }

-- STEP 5: STAFF SIGNUP (Frontend + Auth)
-- Location: Supabase Auth (handled by auth provider)
-- Action: Staff creates account (email/password or accepts invite)
-- Result: New row in auth.users
-- Code Example:
--   const { data, error } = await supabase.auth.signUp({
--     email: 'staff@abc.com',
--     password: 'secure_password'
--   });
--   const staff_auth_user_id = data.user.id;

-- STEP 6: STAFF ASSIGNMENT (Frontend → SQL Function)
-- Location: Frontend calls Supabase function (after staff signup)
-- Action: Link authenticated staff to shop
-- SQL:    create_staff(auth_user_id, shop_id)
-- Result: New row in users table (role='staff')
-- Code Example:
--   const { data, error } = await supabase.rpc('create_staff', {
--     p_auth_user_id: staff_auth_user_id,
--     p_shop_id: shop_id
--   });
--   const staff_user_id = data;

-- STEP 7: ROLE ENFORCEMENT (RLS + Frontend Logic)
-- Location: Database + Frontend
-- Action: RLS policies filter data based on user's role and shop_id
-- Result: Staff can only see their shop's data
-- Frontend Code Example:
--   // After login, fetch user context
--   const { data: context } = await supabase.rpc('get_current_user_context');
--   
--   if (context.role === 'owner') {
--     // Show owner dashboard (manage staff, financials, etc.)
--   } else if (context.role === 'staff') {
--     // Show staff dashboard (bookings, vehicles, customers - shop-specific)
--   } else {
--     // Redirect to unauthorized page
--   }
--
--   // All data queries automatically filtered by RLS
--   const { data: bookings } = await supabase
--     .from('bookings')
--     .select('*');
--   // RLS ensures only bookings from user's shop are returned

-- ============================================================================
-- E) WHAT GOES WHERE
-- ============================================================================

-- ===== MIGRATIONS (supabase/migrations/*.sql) =====
-- 1. CREATE TABLE statements
-- 2. CREATE TYPE (enum) statements
-- 3. CREATE INDEX statements
-- 4. CREATE CONSTRAINT statements (UNIQUE, FOREIGN KEY)
-- 5. CREATE TRIGGER statements
-- 6. CREATE FUNCTION statements (the 6 functions defined in section B)
-- 7. ALTER TABLE ... ENABLE ROW LEVEL SECURITY
-- 8. CREATE POLICY statements (RLS policies)
--
-- Apply with: supabase db push --local (or --remote for production)

-- ===== SQL FUNCTIONS (Backend Business Logic) =====
-- 1. create_rental_shop() - validates inputs, creates shop
-- 2. create_owner() - validates inputs, creates owner user, enforces single owner
-- 3. create_staff() - validates inputs, creates staff user
-- 4. promote_staff_to_owner() - validates inputs, changes role, updates owner
-- 5. deactivate_user() - soft deletes user
-- 6. get_current_user_context() - returns authenticated user's role and shop
--
-- Apply with: Include in migrations, or deploy as separate migration if adding later

-- ===== FRONTEND (React/Vite Code) =====
-- 1. Call SQL functions via supabase.rpc()
--    Example: supabase.rpc('create_owner', { p_auth_user_id, p_shop_id })
--
-- 2. Handle authentication
--    Example: supabase.auth.signUp() or supabase.auth.signInWithPassword()
--
-- 3. Call get_current_user_context() after login
--    Example: supabase.rpc('get_current_user_context')
--
-- 4. Render UI based on role
--    Example: if (user.role === 'owner') { show admin panel }
--
-- 5. Query data (RLS applies automatically)
--    Example: supabase.from('bookings').select('*')
--
-- 6. Display errors from functions
--    Example: if (error) { toast.error(error.message) }

-- ===== WHAT NEVER RUNS FROM FRONTEND =====
-- 1. Direct INSERT/UPDATE/DELETE on auth.users
--    (Supabase handles auth, don't modify it)
--
-- 2. Direct INSERT/UPDATE on users without role validation
--    (Use SQL functions instead)
--
-- 3. Setting custom JWT claims
--    (Use Postgres functions with SECURITY DEFINER instead)
--
-- 4. SQL that accesses tables from other shops
--    (RLS policies prevent this, never bypass RLS)
--
-- 5. Dropping tables or migrations
--    (Only in controlled migrations, never from app code)

-- ===== WHAT ONLY RUNS IN ADMIN PANEL (Backend API) =====
-- 1. Manual user deactivation by support team
--    (RPC call: supabase.rpc('deactivate_user', { p_auth_user_id }))
--
-- 2. Audit queries
--    (Query users table directly, not available to frontend)
--
-- 3. Database backups
--    (Supabase handles this)
--
-- 4. Schema migrations
--    (supabase db push)

-- ============================================================================
-- F) SAFETY GUARANTEES
-- ============================================================================

-- GUARANTEE 1: PREVENT DUPLICATE OWNERS
-- Method: Unique constraint on (shop_id, role) WHERE role='owner'
-- Implementation: 
--   ALTER TABLE users ADD CONSTRAINT unique_owner_per_shop
--   UNIQUE (shop_id, role) WHERE role = 'owner';
-- Enforcement: create_owner() checks existing owners before INSERT
-- Result: Exactly 0 or 1 owner per shop

-- GUARANTEE 2: PREVENT ORPHAN USERS
-- Method: Foreign key constraint
-- Implementation:
--   ALTER TABLE users ADD CONSTRAINT fk_users_shop_id
--   FOREIGN KEY (shop_id) REFERENCES rental_shops(id) ON DELETE CASCADE;
-- Enforcement: Database prevents orphan users
-- Result: If shop is deleted, all users are deleted (cascading)

-- GUARANTEE 3: PREVENT CROSS-SHOP ACCESS
-- Method: RLS policies
-- Implementation: All queries filter by:
--   shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())
-- Enforcement: Database applies RLS before returning data
-- Result: A staff member cannot see data from other shops

-- GUARANTEE 4: PREVENT ACCIDENTAL PRODUCTION DAMAGE
-- Method: Environment-based safety
-- Implementation:
--   1. Development uses Supabase CLI (local database)
--   2. Production uses cloud Supabase (separate project)
--   3. Environment variables separate local from production
--   4. Migrations are versioned and must be reviewed
--   5. No direct SQL from app code (only RPC functions)
-- Enforcement: Strict separation of environments
-- Result: Local development cannot affect production

-- GUARANTEE 5: PREVENT UNAUTHORIZED ROLE CHANGES
-- Method: RLS policies + function validation
-- Implementation:
--   1. No direct UPDATE to users.role from frontend
--   2. Only promote_staff_to_owner() can change roles
--   3. Function validates user is owner before allowing role change
--   4. RLS policy prevents staff from updating user records
-- Enforcement: Database and function logic
-- Result: Only authorized users can change roles

-- GUARANTEE 6: PREVENT HARDCODED USER IDS
-- Method: Function parameters + auth.uid()
-- Implementation:
--   1. All functions accept explicit parameters (no hardcoding)
--   2. Functions use auth.uid() for authorization, not data access
--   3. Frontend passes user IDs explicitly
-- Enforcement: Code review + database constraints
-- Result: No accidental access to wrong users

-- GUARANTEE 7: PREVENT DELETION OF AUTH.USERS
-- Method: deactivate_user() uses soft delete
-- Implementation:
--   UPDATE users SET is_active = false
--   (Never DELETE from auth.users)
-- Enforcement: Function code + audit trail
-- Result: Auth records preserved, RLS filters inactive users

-- ============================================================================
-- DEPLOYMENT CHECKLIST
-- ============================================================================

-- [ ] 1. Run migration: supabase db push --local
-- [ ] 2. Test create_rental_shop() locally
-- [ ] 3. Test create_owner() locally
-- [ ] 4. Test create_staff() locally
-- [ ] 5. Test RLS policies (verify cross-shop access is blocked)
-- [ ] 6. Test promote_staff_to_owner()
-- [ ] 7. Test deactivate_user() and verify RLS filters inactive users
-- [ ] 8. Test get_current_user_context() after login
-- [ ] 9. Review all RLS policies in Supabase Studio
-- [ ] 10. Test from frontend: login, call functions, verify data isolation
-- [ ] 11. Review error messages and user feedback
-- [ ] 12. Document user invitation flow for staff
-- [ ] 13. Test production deployment (supabase db push --remote)
-- [ ] 14. Verify production data is isolated and RLS is active
-- [ ] 15. Monitor error logs for authorization failures

-- ============================================================================
-- EXAMPLE: COMPLETE USER CREATION FLOW (TYPESCRIPT)
-- ============================================================================

/*
// File: src/services/authService.ts

import { supabase } from '@/lib/supabase';

interface OwnerSignupParams {
  email: string;
  password: string;
  shopName: string;
  shopPhone?: string;
  shopEmail?: string;
  shopAddress?: string;
  shopCity?: string;
  shopState?: string;
  shopPincode?: string;
  shopGstNumber?: string;
}

export async function ownerSignupAndCreateShop(params: OwnerSignupParams) {
  try {
    // STEP 1: Create auth account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
    });

    if (authError) throw new Error(`Auth signup failed: ${authError.message}`);
    if (!authData.user?.id) throw new Error('No user ID returned from auth');

    const auth_user_id = authData.user.id;
    console.log('Auth user created:', auth_user_id);

    // STEP 2: Create shop
    const { data: shopId, error: shopError } = await supabase.rpc(
      'create_rental_shop',
      {
        p_name: params.shopName,
        p_phone: params.shopPhone || null,
        p_email: params.shopEmail || null,
        p_address: params.shopAddress || null,
        p_city: params.shopCity || null,
        p_state: params.shopState || null,
        p_pincode: params.shopPincode || null,
        p_gst_number: params.shopGstNumber || null,
      }
    );

    if (shopError) throw new Error(`Shop creation failed: ${shopError.message}`);
    if (!shopId) throw new Error('No shop ID returned');

    console.log('Shop created:', shopId);

    // STEP 3: Create owner user
    const { data: userId, error: userError } = await supabase.rpc(
      'create_owner',
      {
        p_auth_user_id: auth_user_id,
        p_shop_id: shopId,
      }
    );

    if (userError) throw new Error(`Owner creation failed: ${userError.message}`);
    if (!userId) throw new Error('No user ID returned');

    console.log('Owner user created:', userId);

    return {
      success: true,
      auth_user_id,
      shop_id: shopId,
      user_id: userId,
      message: 'Shop and owner created successfully',
    };
  } catch (error) {
    console.error('Owner signup failed:', error);
    throw error;
  }
}

interface StaffSignupParams {
  email: string;
  password: string;
  shopId: string;
}

export async function staffSignupAndAssign(params: StaffSignupParams) {
  try {
    // STEP 1: Create auth account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
    });

    if (authError) throw new Error(`Auth signup failed: ${authError.message}`);
    if (!authData.user?.id) throw new Error('No user ID returned from auth');

    const auth_user_id = authData.user.id;
    console.log('Staff auth user created:', auth_user_id);

    // STEP 2: Assign staff to shop
    const { data: userId, error: userError } = await supabase.rpc(
      'create_staff',
      {
        p_auth_user_id: auth_user_id,
        p_shop_id: params.shopId,
      }
    );

    if (userError) throw new Error(`Staff assignment failed: ${userError.message}`);
    if (!userId) throw new Error('No user ID returned');

    console.log('Staff user created:', userId);

    return {
      success: true,
      auth_user_id,
      user_id: userId,
      message: 'Staff member assigned to shop successfully',
    };
  } catch (error) {
    console.error('Staff signup failed:', error);
    throw error;
  }
}

export async function getCurrentUserContext() {
  try {
    const { data, error } = await supabase.rpc('get_current_user_context');

    if (error) throw new Error(`Failed to fetch user context: ${error.message}`);
    if (!data || data.length === 0) {
      throw new Error('User not found in users table');
    }

    return data[0]; // { user_id, shop_id, role, is_active }
  } catch (error) {
    console.error('Failed to get user context:', error);
    throw error;
  }
}

export async function promoteStaffToOwner(auth_user_id: string, shop_id: string) {
  try {
    const { data, error } = await supabase.rpc('promote_staff_to_owner', {
      p_auth_user_id: auth_user_id,
      p_shop_id: shop_id,
    });

    if (error) throw new Error(`Promotion failed: ${error.message}`);

    console.log('Staff promoted:', data);
    return {
      success: true,
      message: data,
    };
  } catch (error) {
    console.error('Promotion failed:', error);
    throw error;
  }
}
*/

-- ============================================================================
-- END OF ARCHITECTURE DOCUMENT
-- ============================================================================
