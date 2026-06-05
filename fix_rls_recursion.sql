-- ============================================
-- FIX RLS INFINITE RECURSION ON USERS TABLE
-- ============================================

-- Step 1: Drop ALL existing RLS policies on users table to start fresh
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Users can view same shop users" ON users;
DROP POLICY IF EXISTS "Users can insert own record" ON users;
DROP POLICY IF EXISTS "Users can update own record" ON users;
DROP POLICY IF EXISTS "SUPER_ADMIN can view all users" ON users;
DROP POLICY IF EXISTS "SUPER_ADMIN can manage all users" ON users;
DROP POLICY IF EXISTS "SHOP_OWNER can view shop users" ON users;
DROP POLICY IF EXISTS "SHOP_OWNER can manage shop users" ON users;
DROP POLICY IF EXISTS "users_select_policy" ON users;
DROP POLICY IF EXISTS "users_insert_policy" ON users;
DROP POLICY IF EXISTS "users_update_policy" ON users;
DROP POLICY IF EXISTS "users_delete_policy" ON users;

-- Step 2: Create SECURITY DEFINER function to get user's shop_id WITHOUT recursion
-- This function bypasses RLS to fetch shop_id safely
CREATE OR REPLACE FUNCTION auth.get_user_shop_id()
RETURNS UUID AS $$
DECLARE
  v_shop_id UUID;
BEGIN
  -- Bypass RLS by using SECURITY DEFINER
  SELECT shop_id INTO v_shop_id
  FROM public.users
  WHERE auth_id = auth.uid()
  LIMIT 1;
  
  RETURN v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION auth.get_user_shop_id() TO authenticated;

-- Step 3: Create SECURITY DEFINER function to get user's role WITHOUT recursion
CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Bypass RLS by using SECURITY DEFINER
  SELECT role INTO v_role
  FROM public.users
  WHERE auth_id = auth.uid()
  LIMIT 1;
  
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION auth.get_user_role() TO authenticated;

-- Step 4: Create NEW SAFE RLS policies using the helper functions

-- Policy 1: Users can SELECT their own record
CREATE POLICY "users_select_own"
ON users FOR SELECT
TO authenticated
USING (auth_id = auth.uid());

-- Policy 2: Users can SELECT other users in the same shop
CREATE POLICY "users_select_same_shop"
ON users FOR SELECT
TO authenticated
USING (
  shop_id IS NOT NULL 
  AND shop_id = auth.get_user_shop_id()
);

-- Policy 3: SUPER_ADMIN can SELECT all users
CREATE POLICY "users_select_superadmin"
ON users FOR SELECT
TO authenticated
USING (
  auth.get_user_role() = 'SUPER_ADMIN'
);

-- Policy 4: Users can INSERT their own record during signup
CREATE POLICY "users_insert_own"
ON users FOR INSERT
TO authenticated
WITH CHECK (auth_id = auth.uid());

-- Policy 5: SUPER_ADMIN can INSERT any user
CREATE POLICY "users_insert_superadmin"
ON users FOR INSERT
TO authenticated
WITH CHECK (
  auth.get_user_role() = 'SUPER_ADMIN'
);

-- Policy 6: SHOP_OWNER can INSERT users in their shop
CREATE POLICY "users_insert_shop_owner"
ON users FOR INSERT
TO authenticated
WITH CHECK (
  auth.get_user_role() = 'SHOP_OWNER'
  AND shop_id = auth.get_user_shop_id()
);

-- Policy 7: Users can UPDATE their own record
CREATE POLICY "users_update_own"
ON users FOR UPDATE
TO authenticated
USING (auth_id = auth.uid())
WITH CHECK (auth_id = auth.uid());

-- Policy 8: SUPER_ADMIN can UPDATE any user
CREATE POLICY "users_update_superadmin"
ON users FOR UPDATE
TO authenticated
USING (auth.get_user_role() = 'SUPER_ADMIN')
WITH CHECK (auth.get_user_role() = 'SUPER_ADMIN');

-- Policy 9: SHOP_OWNER can UPDATE users in their shop
CREATE POLICY "users_update_shop_owner"
ON users FOR UPDATE
TO authenticated
USING (
  auth.get_user_role() = 'SHOP_OWNER'
  AND shop_id = auth.get_user_shop_id()
)
WITH CHECK (
  auth.get_user_role() = 'SHOP_OWNER'
  AND shop_id = auth.get_user_shop_id()
);

-- Policy 10: SUPER_ADMIN can DELETE any user
CREATE POLICY "users_delete_superadmin"
ON users FOR DELETE
TO authenticated
USING (auth.get_user_role() = 'SUPER_ADMIN');

-- Policy 11: SHOP_OWNER can DELETE users in their shop (except themselves)
CREATE POLICY "users_delete_shop_owner"
ON users FOR DELETE
TO authenticated
USING (
  auth.get_user_role() = 'SHOP_OWNER'
  AND shop_id = auth.get_user_shop_id()
  AND auth_id != auth.uid()
);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify policies are created
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'users' 
ORDER BY policyname;

-- Verify functions exist
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'auth'
AND routine_name IN ('get_user_shop_id', 'get_user_role');

-- ============================================
-- TEST QUERIES (Run these after logging in)
-- ============================================

/*
-- Test 1: Check if current user can read their own record
SELECT * FROM users WHERE auth_id = auth.uid();

-- Test 2: Check if user can read other users in same shop
SELECT * FROM users WHERE shop_id = auth.get_user_shop_id();

-- Test 3: Verify helper functions work
SELECT auth.get_user_shop_id() as my_shop_id, auth.get_user_role() as my_role;

-- Test 4: Check all users (should work for SUPER_ADMIN, fail for others)
SELECT id, full_name, email, role, shop_id FROM users;
*/
