-- ============================================
-- COMPLETE RLS POLICY FIX FOR ALL TABLES
-- Fixes infinite recursion and ensures proper access control
-- ============================================

-- ============================================
-- STEP 1: Create helper functions (SECURITY DEFINER to bypass RLS)
-- ============================================

-- Function to get current user's shop_id
CREATE OR REPLACE FUNCTION auth.get_user_shop_id()
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

GRANT EXECUTE ON FUNCTION auth.get_user_shop_id() TO authenticated;

-- Function to get current user's role
CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM public.users
  WHERE auth_id = auth.uid()
  LIMIT 1;
  
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION auth.get_user_role() TO authenticated;

-- ============================================
-- STEP 2: Drop ALL existing RLS policies
-- ============================================

-- Users table
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

-- Rental shops table
DROP POLICY IF EXISTS "shops_select_policy" ON rental_shops;
DROP POLICY IF EXISTS "shops_insert_policy" ON rental_shops;
DROP POLICY IF EXISTS "shops_update_policy" ON rental_shops;
DROP POLICY IF EXISTS "shops_delete_policy" ON rental_shops;

-- Vehicles table
DROP POLICY IF EXISTS "vehicles_select_policy" ON vehicles;
DROP POLICY IF EXISTS "vehicles_insert_policy" ON vehicles;
DROP POLICY IF EXISTS "vehicles_update_policy" ON vehicles;
DROP POLICY IF EXISTS "vehicles_delete_policy" ON vehicles;

-- Customers table
DROP POLICY IF EXISTS "customers_select_policy" ON customers;
DROP POLICY IF EXISTS "customers_insert_policy" ON customers;
DROP POLICY IF EXISTS "customers_update_policy" ON customers;
DROP POLICY IF EXISTS "customers_delete_policy" ON customers;

-- Bookings table
DROP POLICY IF EXISTS "bookings_select_policy" ON bookings;
DROP POLICY IF EXISTS "bookings_insert_policy" ON bookings;
DROP POLICY IF EXISTS "bookings_update_policy" ON bookings;
DROP POLICY IF EXISTS "bookings_delete_policy" ON bookings;

-- Payments table
DROP POLICY IF EXISTS "payments_select_policy" ON payments;
DROP POLICY IF EXISTS "payments_insert_policy" ON payments;
DROP POLICY IF EXISTS "payments_update_policy" ON payments;
DROP POLICY IF EXISTS "payments_delete_policy" ON payments;

-- Deposits table
DROP POLICY IF EXISTS "deposits_select_policy" ON deposits;
DROP POLICY IF EXISTS "deposits_insert_policy" ON deposits;
DROP POLICY IF EXISTS "deposits_update_policy" ON deposits;
DROP POLICY IF EXISTS "deposits_delete_policy" ON deposits;

-- Damages table
DROP POLICY IF EXISTS "damages_select_policy" ON damages;
DROP POLICY IF EXISTS "damages_insert_policy" ON damages;
DROP POLICY IF EXISTS "damages_update_policy" ON damages;
DROP POLICY IF EXISTS "damages_delete_policy" ON damages;

-- ============================================
-- STEP 3: Enable RLS on all tables
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE damages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: Create SAFE RLS policies for USERS table
-- ============================================

-- SELECT policies
CREATE POLICY "users_select_own"
ON users FOR SELECT TO authenticated
USING (auth_id = auth.uid());

CREATE POLICY "users_select_same_shop"
ON users FOR SELECT TO authenticated
USING (shop_id IS NOT NULL AND shop_id = auth.get_user_shop_id());

CREATE POLICY "users_select_superadmin"
ON users FOR SELECT TO authenticated
USING (auth.get_user_role() = 'SUPER_ADMIN');

-- INSERT policies
CREATE POLICY "users_insert_own"
ON users FOR INSERT TO authenticated
WITH CHECK (auth_id = auth.uid());

CREATE POLICY "users_insert_superadmin"
ON users FOR INSERT TO authenticated
WITH CHECK (auth.get_user_role() = 'SUPER_ADMIN');

CREATE POLICY "users_insert_shop_owner"
ON users FOR INSERT TO authenticated
WITH CHECK (
  auth.get_user_role() = 'SHOP_OWNER'
  AND shop_id = auth.get_user_shop_id()
);

-- UPDATE policies
CREATE POLICY "users_update_own"
ON users FOR UPDATE TO authenticated
USING (auth_id = auth.uid())
WITH CHECK (auth_id = auth.uid());

CREATE POLICY "users_update_superadmin"
ON users FOR UPDATE TO authenticated
USING (auth.get_user_role() = 'SUPER_ADMIN')
WITH CHECK (auth.get_user_role() = 'SUPER_ADMIN');

CREATE POLICY "users_update_shop_owner"
ON users FOR UPDATE TO authenticated
USING (
  auth.get_user_role() = 'SHOP_OWNER'
  AND shop_id = auth.get_user_shop_id()
)
WITH CHECK (
  auth.get_user_role() = 'SHOP_OWNER'
  AND shop_id = auth.get_user_shop_id()
);

-- DELETE policies
CREATE POLICY "users_delete_superadmin"
ON users FOR DELETE TO authenticated
USING (auth.get_user_role() = 'SUPER_ADMIN');

CREATE POLICY "users_delete_shop_owner"
ON users FOR DELETE TO authenticated
USING (
  auth.get_user_role() = 'SHOP_OWNER'
  AND shop_id = auth.get_user_shop_id()
  AND auth_id != auth.uid()
);

-- ============================================
-- STEP 5: Create RLS policies for RENTAL_SHOPS table
-- ============================================

-- SELECT: Users can view their own shop
CREATE POLICY "shops_select_own_shop"
ON rental_shops FOR SELECT TO authenticated
USING (id = auth.get_user_shop_id());

-- SELECT: SUPER_ADMIN can view all shops
CREATE POLICY "shops_select_superadmin"
ON rental_shops FOR SELECT TO authenticated
USING (auth.get_user_role() = 'SUPER_ADMIN');

-- INSERT: Only SUPER_ADMIN can create shops
CREATE POLICY "shops_insert_superadmin"
ON rental_shops FOR INSERT TO authenticated
WITH CHECK (auth.get_user_role() = 'SUPER_ADMIN');

-- UPDATE: SHOP_OWNER can update their own shop
CREATE POLICY "shops_update_own"
ON rental_shops FOR UPDATE TO authenticated
USING (id = auth.get_user_shop_id())
WITH CHECK (id = auth.get_user_shop_id());

-- UPDATE: SUPER_ADMIN can update any shop
CREATE POLICY "shops_update_superadmin"
ON rental_shops FOR UPDATE TO authenticated
USING (auth.get_user_role() = 'SUPER_ADMIN')
WITH CHECK (auth.get_user_role() = 'SUPER_ADMIN');

-- DELETE: Only SUPER_ADMIN can delete shops
CREATE POLICY "shops_delete_superadmin"
ON rental_shops FOR DELETE TO authenticated
USING (auth.get_user_role() = 'SUPER_ADMIN');

-- ============================================
-- STEP 6: Create RLS policies for VEHICLES table
-- ============================================

-- SELECT: Users can view vehicles in their shop
CREATE POLICY "vehicles_select_shop"
ON vehicles FOR SELECT TO authenticated
USING (shop_id = auth.get_user_shop_id());

-- SELECT: SUPER_ADMIN can view all vehicles
CREATE POLICY "vehicles_select_superadmin"
ON vehicles FOR SELECT TO authenticated
USING (auth.get_user_role() = 'SUPER_ADMIN');

-- INSERT: SHOP_OWNER and SHOP_STAFF can insert vehicles in their shop
CREATE POLICY "vehicles_insert_shop"
ON vehicles FOR INSERT TO authenticated
WITH CHECK (shop_id = auth.get_user_shop_id());

-- UPDATE: SHOP_OWNER and SHOP_STAFF can update vehicles in their shop
CREATE POLICY "vehicles_update_shop"
ON vehicles FOR UPDATE TO authenticated
USING (shop_id = auth.get_user_shop_id())
WITH CHECK (shop_id = auth.get_user_shop_id());

-- DELETE: Only SHOP_OWNER can delete vehicles
CREATE POLICY "vehicles_delete_shop_owner"
ON vehicles FOR DELETE TO authenticated
USING (
  shop_id = auth.get_user_shop_id()
  AND auth.get_user_role() IN ('SHOP_OWNER', 'SUPER_ADMIN')
);

-- ============================================
-- STEP 7: Create RLS policies for CUSTOMERS table
-- ============================================

-- SELECT: Users can view customers in their shop
CREATE POLICY "customers_select_shop"
ON customers FOR SELECT TO authenticated
USING (shop_id = auth.get_user_shop_id());

-- SELECT: SUPER_ADMIN can view all customers
CREATE POLICY "customers_select_superadmin"
ON customers FOR SELECT TO authenticated
USING (auth.get_user_role() = 'SUPER_ADMIN');

-- INSERT: Users can insert customers in their shop
CREATE POLICY "customers_insert_shop"
ON customers FOR INSERT TO authenticated
WITH CHECK (shop_id = auth.get_user_shop_id());

-- UPDATE: Users can update customers in their shop
CREATE POLICY "customers_update_shop"
ON customers FOR UPDATE TO authenticated
USING (shop_id = auth.get_user_shop_id())
WITH CHECK (shop_id = auth.get_user_shop_id());

-- DELETE: Only SHOP_OWNER can delete customers
CREATE POLICY "customers_delete_shop_owner"
ON customers FOR DELETE TO authenticated
USING (
  shop_id = auth.get_user_shop_id()
  AND auth.get_user_role() IN ('SHOP_OWNER', 'SUPER_ADMIN')
);

-- ============================================
-- STEP 8: Create RLS policies for BOOKINGS table
-- ============================================

-- SELECT: Users can view bookings in their shop
CREATE POLICY "bookings_select_shop"
ON bookings FOR SELECT TO authenticated
USING (shop_id = auth.get_user_shop_id());

-- SELECT: SUPER_ADMIN can view all bookings
CREATE POLICY "bookings_select_superadmin"
ON bookings FOR SELECT TO authenticated
USING (auth.get_user_role() = 'SUPER_ADMIN');

-- INSERT: Users can insert bookings in their shop
CREATE POLICY "bookings_insert_shop"
ON bookings FOR INSERT TO authenticated
WITH CHECK (shop_id = auth.get_user_shop_id());

-- UPDATE: Users can update bookings in their shop
CREATE POLICY "bookings_update_shop"
ON bookings FOR UPDATE TO authenticated
USING (shop_id = auth.get_user_shop_id())
WITH CHECK (shop_id = auth.get_user_shop_id());

-- DELETE: Only SHOP_OWNER can delete bookings
CREATE POLICY "bookings_delete_shop_owner"
ON bookings FOR DELETE TO authenticated
USING (
  shop_id = auth.get_user_shop_id()
  AND auth.get_user_role() IN ('SHOP_OWNER', 'SUPER_ADMIN')
);

-- ============================================
-- STEP 9: Create RLS policies for PAYMENTS table
-- ============================================

CREATE POLICY "payments_select_shop"
ON payments FOR SELECT TO authenticated
USING (shop_id = auth.get_user_shop_id());

CREATE POLICY "payments_select_superadmin"
ON payments FOR SELECT TO authenticated
USING (auth.get_user_role() = 'SUPER_ADMIN');

CREATE POLICY "payments_insert_shop"
ON payments FOR INSERT TO authenticated
WITH CHECK (shop_id = auth.get_user_shop_id());

CREATE POLICY "payments_update_shop"
ON payments FOR UPDATE TO authenticated
USING (shop_id = auth.get_user_shop_id())
WITH CHECK (shop_id = auth.get_user_shop_id());

CREATE POLICY "payments_delete_shop_owner"
ON payments FOR DELETE TO authenticated
USING (
  shop_id = auth.get_user_shop_id()
  AND auth.get_user_role() IN ('SHOP_OWNER', 'SUPER_ADMIN')
);

-- ============================================
-- STEP 10: Create RLS policies for DEPOSITS table
-- ============================================

CREATE POLICY "deposits_select_shop"
ON deposits FOR SELECT TO authenticated
USING (shop_id = auth.get_user_shop_id());

CREATE POLICY "deposits_select_superadmin"
ON deposits FOR SELECT TO authenticated
USING (auth.get_user_role() = 'SUPER_ADMIN');

CREATE POLICY "deposits_insert_shop"
ON deposits FOR INSERT TO authenticated
WITH CHECK (shop_id = auth.get_user_shop_id());

CREATE POLICY "deposits_update_shop"
ON deposits FOR UPDATE TO authenticated
USING (shop_id = auth.get_user_shop_id())
WITH CHECK (shop_id = auth.get_user_shop_id());

CREATE POLICY "deposits_delete_shop_owner"
ON deposits FOR DELETE TO authenticated
USING (
  shop_id = auth.get_user_shop_id()
  AND auth.get_user_role() IN ('SHOP_OWNER', 'SUPER_ADMIN')
);

-- ============================================
-- STEP 11: Create RLS policies for DAMAGES table
-- ============================================

CREATE POLICY "damages_select_shop"
ON damages FOR SELECT TO authenticated
USING (shop_id = auth.get_user_shop_id());

CREATE POLICY "damages_select_superadmin"
ON damages FOR SELECT TO authenticated
USING (auth.get_user_role() = 'SUPER_ADMIN');

CREATE POLICY "damages_insert_shop"
ON damages FOR INSERT TO authenticated
WITH CHECK (shop_id = auth.get_user_shop_id());

CREATE POLICY "damages_update_shop"
ON damages FOR UPDATE TO authenticated
USING (shop_id = auth.get_user_shop_id())
WITH CHECK (shop_id = auth.get_user_shop_id());

CREATE POLICY "damages_delete_shop_owner"
ON damages FOR DELETE TO authenticated
USING (
  shop_id = auth.get_user_shop_id()
  AND auth.get_user_role() IN ('SHOP_OWNER', 'SUPER_ADMIN')
);

-- ============================================
-- VERIFICATION & TEST QUERIES
-- ============================================

-- Check all policies
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check helper functions
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'auth'
AND routine_name IN ('get_user_shop_id', 'get_user_role');

-- ============================================
-- TEST QUERIES (Run after login)
-- ============================================

/*
-- Test 1: Get my user info
SELECT id, full_name, email, role, shop_id FROM users WHERE auth_id = auth.uid();

-- Test 2: Get my shop_id and role
SELECT auth.get_user_shop_id() as my_shop_id, auth.get_user_role() as my_role;

-- Test 3: Get all users in my shop
SELECT id, full_name, email, role FROM users WHERE shop_id = auth.get_user_shop_id();

-- Test 4: Get my shop details
SELECT * FROM rental_shops WHERE id = auth.get_user_shop_id();

-- Test 5: Get customers in my shop
SELECT id, full_name, phone FROM customers WHERE shop_id = auth.get_user_shop_id() LIMIT 5;

-- Test 6: Get vehicles in my shop
SELECT id, name, registration_number, status FROM vehicles WHERE shop_id = auth.get_user_shop_id() LIMIT 5;

-- Test 7: Get bookings in my shop
SELECT id, booking_number, status FROM bookings WHERE shop_id = auth.get_user_shop_id() LIMIT 5;
*/
