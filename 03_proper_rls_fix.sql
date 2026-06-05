-- ============================================
-- STEP 3: PROPER FIX - Replace temporary policies with correct ones
-- Run AFTER confirming temporary policies show data
-- ============================================

-- ============================================
-- Remove temporary test policies
-- ============================================

DROP POLICY IF EXISTS "test_users_select" ON users;
DROP POLICY IF EXISTS "test_customers_select" ON customers;
DROP POLICY IF EXISTS "test_vehicles_select" ON vehicles;
DROP POLICY IF EXISTS "test_bookings_select" ON bookings;

-- ============================================
-- Drop old incorrect helper functions
-- ============================================

DROP FUNCTION IF EXISTS public.get_user_shop_id() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role() CASCADE;
DROP FUNCTION IF EXISTS public.is_user_active() CASCADE;
DROP FUNCTION IF EXISTS get_current_user_shop_id() CASCADE;

-- ============================================
-- Create CORRECT helper function
-- This function gets the current logged-in user's shop_id
-- Uses auth_id to match Supabase Auth
-- ============================================

CREATE OR REPLACE FUNCTION get_current_user_shop_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT shop_id 
  FROM users 
  WHERE auth_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_current_user_shop_id() TO authenticated;

-- ============================================
-- Create CORRECT SELECT POLICIES FOR USERS TABLE
-- This is the critical one - no recursion!
-- ============================================

-- Drop old policies
DROP POLICY IF EXISTS "users_own_record" ON users;
DROP POLICY IF EXISTS "users_same_shop" ON users;
DROP POLICY IF EXISTS "users_superadmin_all" ON users;

-- New policies - simple and safe
CREATE POLICY "users_select_own_or_shop" ON users 
FOR SELECT TO authenticated
USING (
  auth_id = auth.uid()  -- User can see their own record
  OR shop_id = get_current_user_shop_id()  -- User can see shop members
  OR (SELECT role FROM users WHERE auth_id = auth.uid()) = 'SUPER_ADMIN'  -- SUPER_ADMIN sees all
);

-- ============================================
-- Create CORRECT SELECT POLICIES FOR CUSTOMERS TABLE
-- ============================================

DROP POLICY IF EXISTS "customers_select" ON customers;

CREATE POLICY "customers_select" ON customers
FOR SELECT TO authenticated
USING (
  -- User can see customers from their shop only
  shop_id = get_current_user_shop_id()
  -- SUPER_ADMIN can see all
  OR (SELECT role FROM users WHERE auth_id = auth.uid()) = 'SUPER_ADMIN'
);

-- ============================================
-- Create CORRECT SELECT POLICIES FOR VEHICLES TABLE
-- ============================================

DROP POLICY IF EXISTS "vehicles_select" ON vehicles;

CREATE POLICY "vehicles_select" ON vehicles
FOR SELECT TO authenticated
USING (
  -- User can see vehicles from their shop only
  shop_id = get_current_user_shop_id()
  -- SUPER_ADMIN can see all
  OR (SELECT role FROM users WHERE auth_id = auth.uid()) = 'SUPER_ADMIN'
);

-- ============================================
-- Create CORRECT SELECT POLICIES FOR BOOKINGS TABLE
-- ============================================

DROP POLICY IF EXISTS "bookings_select" ON bookings;

CREATE POLICY "bookings_select" ON bookings
FOR SELECT TO authenticated
USING (
  -- User can see bookings from their shop only
  shop_id = get_current_user_shop_id()
  -- SUPER_ADMIN can see all
  OR (SELECT role FROM users WHERE auth_id = auth.uid()) = 'SUPER_ADMIN'
);

-- ============================================
-- Keep INSERT/UPDATE/DELETE policies from before
-- (They were correct, just SELECT was broken)
-- ============================================

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify helper function exists
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_name = 'get_current_user_shop_id';

-- Count policies
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('users', 'customers', 'vehicles', 'bookings')
GROUP BY tablename
ORDER BY tablename;

-- Show users table policies specifically
SELECT 
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'users'
ORDER BY policyname;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ RLS SELECT POLICIES FIXED';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '✓ Dropped temporary test policies';
  RAISE NOTICE '✓ Created correct helper function';
  RAISE NOTICE '✓ Replaced broken SELECT policies';
  RAISE NOTICE '';
  RAISE NOTICE 'Key fix:';
  RAISE NOTICE '  Helper function: get_current_user_shop_id()';
  RAISE NOTICE '  Uses: auth_id = auth.uid()';
  RAISE NOTICE '  Returns: user shop_id';
  RAISE NOTICE '';
  RAISE NOTICE 'Policies now use:';
  RAISE NOTICE '  USING (shop_id = get_current_user_shop_id())';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Test in app';
  RAISE NOTICE '  1. Refresh customers';
  RAISE NOTICE '  2. Refresh vehicles';
  RAISE NOTICE '  3. Refresh bookings';
  RAISE NOTICE '  4. Add new customer';
  RAISE NOTICE '  5. Create booking';
  RAISE NOTICE '========================================';
END $$;
