-- ============================================
-- ULTIMATE RLS FIX - COMPLETE RECURSION ELIMINATION
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: DISABLE RLS ON ALL TABLES TEMPORARILY
-- This allows us to drop all policies and functions safely
-- ============================================

ALTER TABLE rental_shops DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE deposits DISABLE ROW LEVEL SECURITY;
ALTER TABLE damages DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 2: DROP ALL EXISTING POLICIES (OLD AND NEW NAMES)
-- ============================================

-- Rental shops (old names)
DROP POLICY IF EXISTS "rental_shops_select_policy" ON rental_shops CASCADE;
DROP POLICY IF EXISTS "rental_shops_insert_policy" ON rental_shops CASCADE;
DROP POLICY IF EXISTS "rental_shops_update_policy" ON rental_shops CASCADE;
DROP POLICY IF EXISTS "rental_shops_delete_policy" ON rental_shops CASCADE;
-- Rental shops (new names)
DROP POLICY IF EXISTS "shops_select" ON rental_shops CASCADE;
DROP POLICY IF EXISTS "shops_insert" ON rental_shops CASCADE;
DROP POLICY IF EXISTS "shops_update" ON rental_shops CASCADE;
DROP POLICY IF EXISTS "shops_delete" ON rental_shops CASCADE;

-- Users (old names)
DROP POLICY IF EXISTS "users_select_policy" ON users CASCADE;
DROP POLICY IF EXISTS "users_insert_policy" ON users CASCADE;
DROP POLICY IF EXISTS "users_update_policy" ON users CASCADE;
DROP POLICY IF EXISTS "users_delete_policy" ON users CASCADE;
-- Users (new names)
DROP POLICY IF EXISTS "users_own_record" ON users CASCADE;
DROP POLICY IF EXISTS "users_same_shop" ON users CASCADE;
DROP POLICY IF EXISTS "users_superadmin_all" ON users CASCADE;
DROP POLICY IF EXISTS "users_insert" ON users CASCADE;
DROP POLICY IF EXISTS "users_update_self" ON users CASCADE;
DROP POLICY IF EXISTS "users_update_admin" ON users CASCADE;
DROP POLICY IF EXISTS "users_delete" ON users CASCADE;

-- Vehicles (old names)
DROP POLICY IF EXISTS "vehicles_select_policy" ON vehicles CASCADE;
DROP POLICY IF EXISTS "vehicles_insert_policy" ON vehicles CASCADE;
DROP POLICY IF EXISTS "vehicles_update_policy" ON vehicles CASCADE;
DROP POLICY IF EXISTS "vehicles_delete_policy" ON vehicles CASCADE;
-- Vehicles (new names)
DROP POLICY IF EXISTS "vehicles_select" ON vehicles CASCADE;
DROP POLICY IF EXISTS "vehicles_insert" ON vehicles CASCADE;
DROP POLICY IF EXISTS "vehicles_update" ON vehicles CASCADE;
DROP POLICY IF EXISTS "vehicles_delete" ON vehicles CASCADE;

-- Customers (old names)
DROP POLICY IF EXISTS "customers_select_policy" ON customers CASCADE;
DROP POLICY IF EXISTS "customers_insert_policy" ON customers CASCADE;
DROP POLICY IF EXISTS "customers_update_policy" ON customers CASCADE;
DROP POLICY IF EXISTS "customers_delete_policy" ON customers CASCADE;
-- Customers (new names)
DROP POLICY IF EXISTS "customers_select" ON customers CASCADE;
DROP POLICY IF EXISTS "customers_insert" ON customers CASCADE;
DROP POLICY IF EXISTS "customers_update" ON customers CASCADE;
DROP POLICY IF EXISTS "customers_delete" ON customers CASCADE;

-- Bookings (old names)
DROP POLICY IF EXISTS "bookings_select_policy" ON bookings CASCADE;
DROP POLICY IF EXISTS "bookings_insert_policy" ON bookings CASCADE;
DROP POLICY IF EXISTS "bookings_update_policy" ON bookings CASCADE;
DROP POLICY IF EXISTS "bookings_delete_policy" ON bookings CASCADE;
-- Bookings (new names)
DROP POLICY IF EXISTS "bookings_select" ON bookings CASCADE;
DROP POLICY IF EXISTS "bookings_insert" ON bookings CASCADE;
DROP POLICY IF EXISTS "bookings_update" ON bookings CASCADE;
DROP POLICY IF EXISTS "bookings_delete" ON bookings CASCADE;

-- Payments (old names)
DROP POLICY IF EXISTS "payments_select_policy" ON payments CASCADE;
DROP POLICY IF EXISTS "payments_insert_policy" ON payments CASCADE;
DROP POLICY IF EXISTS "payments_update_policy" ON payments CASCADE;
DROP POLICY IF EXISTS "payments_delete_policy" ON payments CASCADE;
-- Payments (new names)
DROP POLICY IF EXISTS "payments_select" ON payments CASCADE;
DROP POLICY IF EXISTS "payments_insert" ON payments CASCADE;
DROP POLICY IF EXISTS "payments_update" ON payments CASCADE;
DROP POLICY IF EXISTS "payments_delete" ON payments CASCADE;

-- Deposits (old names)
DROP POLICY IF EXISTS "deposits_select_policy" ON deposits CASCADE;
DROP POLICY IF EXISTS "deposits_insert_policy" ON deposits CASCADE;
DROP POLICY IF EXISTS "deposits_update_policy" ON deposits CASCADE;
DROP POLICY IF EXISTS "deposits_delete_policy" ON deposits CASCADE;
-- Deposits (new names)
DROP POLICY IF EXISTS "deposits_select" ON deposits CASCADE;
DROP POLICY IF EXISTS "deposits_insert" ON deposits CASCADE;
DROP POLICY IF EXISTS "deposits_update" ON deposits CASCADE;
DROP POLICY IF EXISTS "deposits_delete" ON deposits CASCADE;

-- Damages (old names)
DROP POLICY IF EXISTS "damages_select_policy" ON damages CASCADE;
DROP POLICY IF EXISTS "damages_insert_policy" ON damages CASCADE;
DROP POLICY IF EXISTS "damages_update_policy" ON damages CASCADE;
DROP POLICY IF EXISTS "damages_delete_policy" ON damages CASCADE;
-- Damages (new names)
DROP POLICY IF EXISTS "damages_select" ON damages CASCADE;
DROP POLICY IF EXISTS "damages_insert" ON damages CASCADE;
DROP POLICY IF EXISTS "damages_update" ON damages CASCADE;
DROP POLICY IF EXISTS "damages_delete" ON damages CASCADE;

-- Activity logs (old names)
DROP POLICY IF EXISTS "activity_logs_select_policy" ON activity_logs CASCADE;
DROP POLICY IF EXISTS "activity_logs_insert_policy" ON activity_logs CASCADE;
-- Activity logs (new names)
DROP POLICY IF EXISTS "activity_logs_select" ON activity_logs CASCADE;
DROP POLICY IF EXISTS "activity_logs_insert" ON activity_logs CASCADE;

-- ============================================
-- STEP 3: DROP ALL EXISTING FUNCTIONS (especially recursive ones)
-- ============================================

DROP FUNCTION IF EXISTS get_current_user_context() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_shop_id() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role() CASCADE;
DROP FUNCTION IF EXISTS public.is_user_active() CASCADE;

-- ============================================
-- STEP 4: CREATE NEW SAFE HELPER FUNCTIONS
-- These ONLY return values, never used in subqueries
-- ============================================

-- Get current user's shop_id
CREATE OR REPLACE FUNCTION public.get_user_shop_id()
RETURNS UUID AS $$
SELECT shop_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_user_shop_id() TO authenticated;

-- Get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
SELECT COALESCE(role::TEXT, 'GUEST') FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;

-- Check if user is active
CREATE OR REPLACE FUNCTION public.is_user_active()
RETURNS BOOLEAN AS $$
SELECT COALESCE(is_active, FALSE) FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.is_user_active() TO authenticated;

-- ============================================
-- STEP 5: RE-ENABLE RLS ON ALL TABLES
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
-- STEP 6: CREATE NEW SAFE RLS POLICIES
-- USERS TABLE (CRITICAL - NO RECURSION)
-- ============================================

-- Users can always see their own record
CREATE POLICY "users_own_record" ON users FOR SELECT TO authenticated
USING (auth_id = auth.uid());

-- Users can see other users in their shop
CREATE POLICY "users_same_shop" ON users FOR SELECT TO authenticated
USING (
  shop_id IS NOT NULL 
  AND shop_id = public.get_user_shop_id()
);

-- SUPER_ADMIN can see all users
CREATE POLICY "users_superadmin_all" ON users FOR SELECT TO authenticated
USING (public.get_user_role() = 'SUPER_ADMIN');

-- Only SUPER_ADMIN can insert users
CREATE POLICY "users_insert" ON users FOR INSERT TO authenticated
WITH CHECK (public.get_user_role() = 'SUPER_ADMIN');

-- Users can update themselves
CREATE POLICY "users_update_self" ON users FOR UPDATE TO authenticated
USING (auth_id = auth.uid())
WITH CHECK (auth_id = auth.uid());

-- SUPER_ADMIN can update any user
CREATE POLICY "users_update_admin" ON users FOR UPDATE TO authenticated
USING (public.get_user_role() = 'SUPER_ADMIN')
WITH CHECK (public.get_user_role() = 'SUPER_ADMIN');

-- Only SUPER_ADMIN can delete users
CREATE POLICY "users_delete" ON users FOR DELETE TO authenticated
USING (public.get_user_role() = 'SUPER_ADMIN');

-- ============================================
-- STEP 7: RENTAL_SHOPS POLICIES
-- ============================================

CREATE POLICY "shops_select" ON rental_shops FOR SELECT TO authenticated
USING (
  public.get_user_role() = 'SUPER_ADMIN'
  OR id = public.get_user_shop_id()
);

CREATE POLICY "shops_insert" ON rental_shops FOR INSERT TO authenticated
WITH CHECK (public.get_user_role() = 'SUPER_ADMIN');

CREATE POLICY "shops_update" ON rental_shops FOR UPDATE TO authenticated
USING (
  public.get_user_role() = 'SUPER_ADMIN'
  OR (id = public.get_user_shop_id() AND public.get_user_role() = 'SHOP_OWNER')
);

CREATE POLICY "shops_delete" ON rental_shops FOR DELETE TO authenticated
USING (public.get_user_role() = 'SUPER_ADMIN');

-- ============================================
-- STEP 8: VEHICLES POLICIES
-- ============================================

CREATE POLICY "vehicles_select" ON vehicles FOR SELECT TO authenticated
USING (
  public.get_user_role() = 'SUPER_ADMIN'
  OR shop_id = public.get_user_shop_id()
);

CREATE POLICY "vehicles_insert" ON vehicles FOR INSERT TO authenticated
WITH CHECK (shop_id = public.get_user_shop_id());

CREATE POLICY "vehicles_update" ON vehicles FOR UPDATE TO authenticated
USING (shop_id = public.get_user_shop_id());

CREATE POLICY "vehicles_delete" ON vehicles FOR DELETE TO authenticated
USING (
  public.get_user_role() = 'SUPER_ADMIN'
  OR (shop_id = public.get_user_shop_id() AND public.get_user_role() = 'SHOP_OWNER')
);

-- ============================================
-- STEP 9: CUSTOMERS POLICIES
-- ============================================

CREATE POLICY "customers_select" ON customers FOR SELECT TO authenticated
USING (
  public.get_user_role() = 'SUPER_ADMIN'
  OR shop_id = public.get_user_shop_id()
);

CREATE POLICY "customers_insert" ON customers FOR INSERT TO authenticated
WITH CHECK (shop_id = public.get_user_shop_id());

CREATE POLICY "customers_update" ON customers FOR UPDATE TO authenticated
USING (shop_id = public.get_user_shop_id());

CREATE POLICY "customers_delete" ON customers FOR DELETE TO authenticated
USING (
  public.get_user_role() = 'SUPER_ADMIN'
  OR (shop_id = public.get_user_shop_id() AND public.get_user_role() = 'SHOP_OWNER')
);

-- ============================================
-- STEP 10: BOOKINGS POLICIES
-- ============================================

CREATE POLICY "bookings_select" ON bookings FOR SELECT TO authenticated
USING (
  public.get_user_role() = 'SUPER_ADMIN'
  OR shop_id = public.get_user_shop_id()
);

CREATE POLICY "bookings_insert" ON bookings FOR INSERT TO authenticated
WITH CHECK (shop_id = public.get_user_shop_id());

CREATE POLICY "bookings_update" ON bookings FOR UPDATE TO authenticated
USING (shop_id = public.get_user_shop_id());

CREATE POLICY "bookings_delete" ON bookings FOR DELETE TO authenticated
USING (
  public.get_user_role() = 'SUPER_ADMIN'
  OR (shop_id = public.get_user_shop_id() AND public.get_user_role() = 'SHOP_OWNER')
);

-- ============================================
-- STEP 11: PAYMENTS POLICIES
-- ============================================

CREATE POLICY "payments_select" ON payments FOR SELECT TO authenticated
USING (
  public.get_user_role() = 'SUPER_ADMIN'
  OR shop_id = public.get_user_shop_id()
);

CREATE POLICY "payments_insert" ON payments FOR INSERT TO authenticated
WITH CHECK (shop_id = public.get_user_shop_id());

CREATE POLICY "payments_update" ON payments FOR UPDATE TO authenticated
USING (shop_id = public.get_user_shop_id());

CREATE POLICY "payments_delete" ON payments FOR DELETE TO authenticated
USING (
  public.get_user_role() = 'SUPER_ADMIN'
  OR (shop_id = public.get_user_shop_id() AND public.get_user_role() = 'SHOP_OWNER')
);

-- ============================================
-- STEP 12: DEPOSITS POLICIES
-- ============================================

CREATE POLICY "deposits_select" ON deposits FOR SELECT TO authenticated
USING (
  public.get_user_role() = 'SUPER_ADMIN'
  OR shop_id = public.get_user_shop_id()
);

CREATE POLICY "deposits_insert" ON deposits FOR INSERT TO authenticated
WITH CHECK (shop_id = public.get_user_shop_id());

CREATE POLICY "deposits_update" ON deposits FOR UPDATE TO authenticated
USING (shop_id = public.get_user_shop_id());

CREATE POLICY "deposits_delete" ON deposits FOR DELETE TO authenticated
USING (
  public.get_user_role() = 'SUPER_ADMIN'
  OR (shop_id = public.get_user_shop_id() AND public.get_user_role() = 'SHOP_OWNER')
);

-- ============================================
-- STEP 13: DAMAGES POLICIES
-- ============================================

CREATE POLICY "damages_select" ON damages FOR SELECT TO authenticated
USING (
  public.get_user_role() = 'SUPER_ADMIN'
  OR shop_id = public.get_user_shop_id()
);

CREATE POLICY "damages_insert" ON damages FOR INSERT TO authenticated
WITH CHECK (shop_id = public.get_user_shop_id());

CREATE POLICY "damages_update" ON damages FOR UPDATE TO authenticated
USING (shop_id = public.get_user_shop_id());

CREATE POLICY "damages_delete" ON damages FOR DELETE TO authenticated
USING (
  public.get_user_role() = 'SUPER_ADMIN'
  OR (shop_id = public.get_user_shop_id() AND public.get_user_role() = 'SHOP_OWNER')
);

-- ============================================
-- STEP 14: ACTIVITY_LOGS POLICIES
-- ============================================

CREATE POLICY "activity_logs_select" ON activity_logs FOR SELECT TO authenticated
USING (
  public.get_user_role() = 'SUPER_ADMIN'
  OR shop_id = public.get_user_shop_id()
);

CREATE POLICY "activity_logs_insert" ON activity_logs FOR INSERT TO authenticated
WITH CHECK (
  public.get_user_role() = 'SUPER_ADMIN'
  OR shop_id = public.get_user_shop_id()
);

-- ============================================
-- VERIFICATION & SUCCESS MESSAGE
-- ============================================

SELECT 
  '✅ RLS COMPLETELY FIXED' as status,
  COUNT(*) as total_policies
FROM pg_policies 
WHERE schemaname = 'public';

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ RLS INFINITE RECURSION COMPLETELY FIXED';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '✓ All old policies dropped (with CASCADE)';
  RAISE NOTICE '✓ All recursive functions dropped';
  RAISE NOTICE '✓ New SECURITY DEFINER functions created';
  RAISE NOTICE '✓ All 9 tables have new safe RLS policies';
  RAISE NOTICE '✓ Zero recursion - only function calls';
  RAISE NOTICE '';
  RAISE NOTICE 'Helper functions:';
  RAISE NOTICE '  • public.get_user_shop_id()';
  RAISE NOTICE '  • public.get_user_role()';
  RAISE NOTICE '  • public.is_user_active()';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Test in app';
  RAISE NOTICE '  1. Login with shop user';
  RAISE NOTICE '  2. Add customer';
  RAISE NOTICE '  3. Add booking';
  RAISE NOTICE '  4. View all data';
  RAISE NOTICE '========================================';
END $$;
