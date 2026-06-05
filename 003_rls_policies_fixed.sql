-- ============================================
-- FIX INFINITE RECURSION IN RLS POLICIES
-- This replaces 003_rls_policies_multi_user.sql
-- Run this AFTER running 001 and 002 migrations
-- ============================================

-- ============================================
-- STEP 1: Drop ALL existing policies FIRST (before dropping function)
-- ============================================

-- Rental shops
DROP POLICY IF EXISTS "rental_shops_select_policy" ON rental_shops;
DROP POLICY IF EXISTS "rental_shops_insert_policy" ON rental_shops;
DROP POLICY IF EXISTS "rental_shops_update_policy" ON rental_shops;
DROP POLICY IF EXISTS "rental_shops_delete_policy" ON rental_shops;

-- Users
DROP POLICY IF EXISTS "users_select_policy" ON users;
DROP POLICY IF EXISTS "users_insert_policy" ON users;
DROP POLICY IF EXISTS "users_update_policy" ON users;
DROP POLICY IF EXISTS "users_delete_policy" ON users;

-- Vehicles
DROP POLICY IF EXISTS "vehicles_select_policy" ON vehicles;
DROP POLICY IF EXISTS "vehicles_insert_policy" ON vehicles;
DROP POLICY IF EXISTS "vehicles_update_policy" ON vehicles;
DROP POLICY IF EXISTS "vehicles_delete_policy" ON vehicles;

-- Customers
DROP POLICY IF EXISTS "customers_select_policy" ON customers;
DROP POLICY IF EXISTS "customers_insert_policy" ON customers;
DROP POLICY IF EXISTS "customers_update_policy" ON customers;
DROP POLICY IF EXISTS "customers_delete_policy" ON customers;

-- Bookings
DROP POLICY IF EXISTS "bookings_select_policy" ON bookings;
DROP POLICY IF EXISTS "bookings_insert_policy" ON bookings;
DROP POLICY IF EXISTS "bookings_update_policy" ON bookings;
DROP POLICY IF EXISTS "bookings_delete_policy" ON bookings;

-- Payments
DROP POLICY IF EXISTS "payments_select_policy" ON payments;
DROP POLICY IF EXISTS "payments_insert_policy" ON payments;
DROP POLICY IF EXISTS "payments_update_policy" ON payments;
DROP POLICY IF EXISTS "payments_delete_policy" ON payments;

-- Deposits
DROP POLICY IF EXISTS "deposits_select_policy" ON deposits;
DROP POLICY IF EXISTS "deposits_insert_policy" ON deposits;
DROP POLICY IF EXISTS "deposits_update_policy" ON deposits;
DROP POLICY IF EXISTS "deposits_delete_policy" ON deposits;

-- Damages
DROP POLICY IF EXISTS "damages_select_policy" ON damages;
DROP POLICY IF EXISTS "damages_insert_policy" ON damages;
DROP POLICY IF EXISTS "damages_update_policy" ON damages;
DROP POLICY IF EXISTS "damages_delete_policy" ON damages;

-- Activity logs
DROP POLICY IF EXISTS "activity_logs_select_policy" ON activity_logs;
DROP POLICY IF EXISTS "activity_logs_insert_policy" ON activity_logs;

-- ============================================
-- STEP 2: Now drop the problematic function (safe after policies are gone)
-- ============================================

DROP FUNCTION IF EXISTS get_current_user_context();

-- ============================================
-- STEP 3: Create SAFE helper functions using SECURITY DEFINER
-- These bypass RLS to avoid recursion
-- Note: Using public schema since auth schema is restricted in Supabase
-- ============================================

-- Get current user's shop_id (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_shop_id()
RETURNS UUID AS $$
DECLARE
  v_shop_id UUID;
BEGIN
  SELECT shop_id INTO v_shop_id
  FROM public.users
  WHERE auth_id = auth.uid()
  LIMIT 1;
  
  RETURN v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_user_shop_id() TO authenticated;

-- Get current user's role (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role::TEXT INTO v_role
  FROM public.users
  WHERE auth_id = auth.uid()
  LIMIT 1;
  
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;

-- Get current user's is_active status (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_user_active()
RETURNS BOOLEAN AS $$
DECLARE
  v_is_active BOOLEAN;
BEGIN
  SELECT is_active INTO v_is_active
  FROM public.users
  WHERE auth_id = auth.uid()
  LIMIT 1;
  
  RETURN COALESCE(v_is_active, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.is_user_active() TO authenticated;

-- ============================================
-- STEP 4: Enable RLS on all tables
-- ============================================

ALTER TABLE rental_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE damages ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 5: RENTAL_SHOPS POLICIES (SAFE)
-- ============================================

-- SELECT: SUPER_ADMIN sees all, others see only their shop
CREATE POLICY "rental_shops_select_policy" ON rental_shops
  FOR SELECT TO authenticated
  USING (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR id = public.get_user_shop_id()
    )
  );

-- INSERT: Only SUPER_ADMIN can create shops
CREATE POLICY "rental_shops_insert_policy" ON rental_shops
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_user_active() = TRUE 
    AND public.get_user_role() = 'SUPER_ADMIN'
  );

-- UPDATE: SUPER_ADMIN or SHOP_OWNER can update their shop
CREATE POLICY "rental_shops_update_policy" ON rental_shops
  FOR UPDATE TO authenticated
  USING (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR (id = public.get_user_shop_id() AND public.get_user_role() = 'SHOP_OWNER')
    )
  )
  WITH CHECK (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR (id = public.get_user_shop_id() AND public.get_user_role() = 'SHOP_OWNER')
    )
  );

-- DELETE: Only SUPER_ADMIN can delete shops
CREATE POLICY "rental_shops_delete_policy" ON rental_shops
  FOR DELETE TO authenticated
  USING (
    public.is_user_active() = TRUE 
    AND public.get_user_role() = 'SUPER_ADMIN'
  );

-- ============================================
-- STEP 6: USERS POLICIES (SAFE - NO RECURSION)
-- ============================================

-- SELECT: Users can view their own record or users in their shop
CREATE POLICY "users_select_policy" ON users
  FOR SELECT TO authenticated
  USING (
    auth_id = auth.uid() -- Can always see own record
    OR (
      public.is_user_active() = TRUE
      AND (
        public.get_user_role() = 'SUPER_ADMIN' -- SUPER_ADMIN sees all
        OR (
          shop_id IS NOT NULL 
          AND shop_id = public.get_user_shop_id() -- Same shop users
        )
      )
    )
  );

-- INSERT: Only SUPER_ADMIN or SHOP_OWNER can create users
CREATE POLICY "users_insert_policy" ON users
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR (
        public.get_user_role() = 'SHOP_OWNER'
        AND shop_id = public.get_user_shop_id()
      )
    )
  );

-- UPDATE: SUPER_ADMIN can update any user, users can update their own profile
CREATE POLICY "users_update_policy" ON users
  FOR UPDATE TO authenticated
  USING (
    auth_id = auth.uid() -- Can update own record
    OR (
      public.is_user_active() = TRUE
      AND (
        public.get_user_role() = 'SUPER_ADMIN'
        OR (
          public.get_user_role() = 'SHOP_OWNER'
          AND shop_id = public.get_user_shop_id()
        )
      )
    )
  )
  WITH CHECK (
    auth_id = auth.uid()
    OR (
      public.is_user_active() = TRUE
      AND (
        public.get_user_role() = 'SUPER_ADMIN'
        OR (
          public.get_user_role() = 'SHOP_OWNER'
          AND shop_id = public.get_user_shop_id()
        )
      )
    )
  );

-- DELETE: Only SUPER_ADMIN can delete users (deactivation is preferred)
CREATE POLICY "users_delete_policy" ON users
  FOR DELETE TO authenticated
  USING (
    public.is_user_active() = TRUE 
    AND public.get_user_role() = 'SUPER_ADMIN'
  );

-- ============================================
-- STEP 7: VEHICLES POLICIES (SAFE)
-- ============================================

CREATE POLICY "vehicles_select_policy" ON vehicles
  FOR SELECT TO authenticated
  USING (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  );

CREATE POLICY "vehicles_insert_policy" ON vehicles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  );

CREATE POLICY "vehicles_update_policy" ON vehicles
  FOR UPDATE TO authenticated
  USING (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  )
  WITH CHECK (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  );

CREATE POLICY "vehicles_delete_policy" ON vehicles
  FOR DELETE TO authenticated
  USING (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR (shop_id = public.get_user_shop_id() AND public.get_user_role() IN ('SHOP_OWNER'))
    )
  );

-- ============================================
-- STEP 8: CUSTOMERS POLICIES (SAFE)
-- ============================================

CREATE POLICY "customers_select_policy" ON customers
  FOR SELECT TO authenticated
  USING (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  );

CREATE POLICY "customers_insert_policy" ON customers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  );

CREATE POLICY "customers_update_policy" ON customers
  FOR UPDATE TO authenticated
  USING (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  )
  WITH CHECK (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  );

CREATE POLICY "customers_delete_policy" ON customers
  FOR DELETE TO authenticated
  USING (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR (shop_id = public.get_user_shop_id() AND public.get_user_role() IN ('SHOP_OWNER'))
    )
  );

-- ============================================
-- STEP 9: BOOKINGS POLICIES (SAFE)
-- ============================================

CREATE POLICY "bookings_select_policy" ON bookings
  FOR SELECT TO authenticated
  USING (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  );

CREATE POLICY "bookings_insert_policy" ON bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  );

CREATE POLICY "bookings_update_policy" ON bookings
  FOR UPDATE TO authenticated
  USING (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  )
  WITH CHECK (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  );

CREATE POLICY "bookings_delete_policy" ON bookings
  FOR DELETE TO authenticated
  USING (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR (shop_id = public.get_user_shop_id() AND public.get_user_role() IN ('SHOP_OWNER'))
    )
  );

-- ============================================
-- STEP 10: PAYMENTS POLICIES (SAFE)
-- ============================================

CREATE POLICY "payments_select_policy" ON payments
  FOR SELECT TO authenticated
  USING (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  );

CREATE POLICY "payments_insert_policy" ON payments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  );

CREATE POLICY "payments_update_policy" ON payments
  FOR UPDATE TO authenticated
  USING (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  )
  WITH CHECK (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  );

CREATE POLICY "payments_delete_policy" ON payments
  FOR DELETE TO authenticated
  USING (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR (shop_id = public.get_user_shop_id() AND public.get_user_role() IN ('SHOP_OWNER'))
    )
  );

-- ============================================
-- STEP 11: DEPOSITS POLICIES (SAFE)
-- ============================================

CREATE POLICY "deposits_select_policy" ON deposits
  FOR SELECT TO authenticated
  USING (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  );

CREATE POLICY "deposits_insert_policy" ON deposits
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  );

CREATE POLICY "deposits_update_policy" ON deposits
  FOR UPDATE TO authenticated
  USING (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  )
  WITH CHECK (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  );

CREATE POLICY "deposits_delete_policy" ON deposits
  FOR DELETE TO authenticated
  USING (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR (shop_id = public.get_user_shop_id() AND public.get_user_role() IN ('SHOP_OWNER'))
    )
  );

-- ============================================
-- STEP 12: DAMAGES POLICIES (SAFE)
-- ============================================

CREATE POLICY "damages_select_policy" ON damages
  FOR SELECT TO authenticated
  USING (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  );

CREATE POLICY "damages_insert_policy" ON damages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  );

CREATE POLICY "damages_update_policy" ON damages
  FOR UPDATE TO authenticated
  USING (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  )
  WITH CHECK (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  );

CREATE POLICY "damages_delete_policy" ON damages
  FOR DELETE TO authenticated
  USING (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR (shop_id = public.get_user_shop_id() AND public.get_user_role() IN ('SHOP_OWNER'))
    )
  );

-- ============================================
-- STEP 13: ACTIVITY_LOGS POLICIES (SAFE)
-- ============================================

CREATE POLICY "activity_logs_select_policy" ON activity_logs
  FOR SELECT TO authenticated
  USING (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  );

-- Activity logs are inserted automatically by triggers, so no explicit INSERT policy needed
-- But we'll add one for completeness
CREATE POLICY "activity_logs_insert_policy" ON activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_user_active() = TRUE
    AND (
      public.get_user_role() = 'SUPER_ADMIN'
      OR shop_id = public.get_user_shop_id()
    )
  );

-- ============================================
-- VERIFICATION
-- ============================================

-- List all policies
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- List helper functions
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('get_user_shop_id', 'get_user_role', 'is_user_active');

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ RLS policies successfully updated with NO RECURSION';
  RAISE NOTICE '✅ Helper functions created: public.get_user_shop_id(), public.get_user_role(), public.is_user_active()';
  RAISE NOTICE '✅ All policies now use SECURITY DEFINER functions to avoid infinite recursion';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Test customer creation';
  RAISE NOTICE '2. Test booking creation';
  RAISE NOTICE '3. Verify users can query their shop data';
END $$;
