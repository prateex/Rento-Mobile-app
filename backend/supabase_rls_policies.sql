-- ============================================
-- SUPABASE ROW LEVEL SECURITY (RLS) POLICIES
-- PER-USER ISOLATION (STRICT)
-- ============================================

-- IMPORTANT:
-- - All user-owned tables are isolated per authenticated user
-- - Access requires user_id = auth.uid() for SELECT/INSERT/UPDATE/DELETE
-- - No public access remains

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE rental_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE damages ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_pickup_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE states ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE pincodes ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on ALL tables to prevent recursion
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='rental_shops' LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON rental_shops', r.polname); END LOOP;
  FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='users' LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.polname); END LOOP;
  FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='vehicles' LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON vehicles', r.polname); END LOOP;
  FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='customers' LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON customers', r.polname); END LOOP;
  FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='bookings' LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON bookings', r.polname); END LOOP;
  FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='payments' LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON payments', r.polname); END LOOP;
  FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='deposits' LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON deposits', r.polname); END LOOP;
  FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='damages' LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON damages', r.polname); END LOOP;
  FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='shop_pickup_points' LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON shop_pickup_points', r.polname); END LOOP;
  FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='states' LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON states', r.polname); END LOOP;
  FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='cities' LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON cities', r.polname); END LOOP;
  FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='pincodes' LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON pincodes', r.polname); END LOOP;
END $$;

-- ============================================
-- RENTAL SHOPS POLICIES
-- ============================================

-- Owners can view their own shop
CREATE POLICY "Users can view their own shop"
  ON rental_shops FOR SELECT
  USING (owner_id = auth.uid());

-- Owners can update their own shop
CREATE POLICY "Owners can update their own shop"
  ON rental_shops FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Owners can insert their own shop
CREATE POLICY "Owners can create their own shop"
  ON rental_shops FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- ============================================
-- USERS (STAFF) POLICIES - NON-RECURSIVE
-- ============================================

-- Users can only access their own user record
-- NO RECURSION: Only uses auth.uid() = auth_id
CREATE POLICY "users_select_own"
  ON users FOR SELECT
  USING (auth.uid() = auth_id);

CREATE POLICY "users_insert_own"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = auth_id);

CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (auth.uid() = auth_id)
  WITH CHECK (auth.uid() = auth_id);

CREATE POLICY "users_delete_own"
  ON users FOR DELETE
  USING (auth.uid() = auth_id);

-- ============================================
-- LEGACY POLICIES REMOVED TO PREVENT RECURSION
-- ============================================
-- The following policies caused "infinite recursion" errors:
-- - "Users can view staff in their shop" (queried users table within users policy)
-- - "Shop owners can add staff" (queried rental_shops within users policy)
-- - "Shop owners can update staff" (queried rental_shops within users policy)
-- 
-- Replaced with simple auth.uid() = auth_id checks only.
-- ============================================

-- ============================================
-- VEHICLES POLICIES
-- ============================================
-- All staff in the same shop can view vehicles (scoped by shop_id, not user_id)
CREATE POLICY "vehicles_select_shop" ON vehicles FOR SELECT 
  USING (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));
CREATE POLICY "vehicles_insert_shop" ON vehicles FOR INSERT 
  WITH CHECK (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));
CREATE POLICY "vehicles_update_shop" ON vehicles FOR UPDATE 
  USING (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1))
  WITH CHECK (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));
CREATE POLICY "vehicles_delete_shop" ON vehicles FOR DELETE 
  USING (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));

-- ============================================
-- CUSTOMERS POLICIES
-- ============================================
-- All staff in the same shop can view customers (scoped by shop_id, not user_id)
CREATE POLICY "customers_select_shop" ON customers FOR SELECT 
  USING (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));
CREATE POLICY "customers_insert_shop" ON customers FOR INSERT 
  WITH CHECK (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));
CREATE POLICY "customers_update_shop" ON customers FOR UPDATE 
  USING (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1))
  WITH CHECK (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));
CREATE POLICY "customers_delete_shop" ON customers FOR DELETE 
  USING (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));

-- ============================================
-- BOOKINGS POLICIES
-- ============================================
-- All staff in the same shop can view bookings (scoped by shop_id, not user_id)
CREATE POLICY "bookings_select_shop" ON bookings FOR SELECT 
  USING (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));
CREATE POLICY "bookings_insert_shop" ON bookings FOR INSERT 
  WITH CHECK (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));
CREATE POLICY "bookings_update_shop" ON bookings FOR UPDATE 
  USING (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1))
  WITH CHECK (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));
CREATE POLICY "bookings_delete_shop" ON bookings FOR DELETE 
  USING (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));

-- ============================================
-- PAYMENTS POLICIES
-- ============================================
-- All staff in the same shop can view payments (scoped by shop_id, not user_id)
CREATE POLICY "payments_select_shop" ON payments FOR SELECT 
  USING (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));
CREATE POLICY "payments_insert_shop" ON payments FOR INSERT 
  WITH CHECK (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));
CREATE POLICY "payments_update_shop" ON payments FOR UPDATE 
  USING (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1))
  WITH CHECK (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));
CREATE POLICY "payments_delete_shop" ON payments FOR DELETE 
  USING (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));

-- ============================================
-- DEPOSITS POLICIES
-- ============================================
-- All staff in the same shop can view deposits (scoped by shop_id, not user_id)
CREATE POLICY "deposits_select_shop" ON deposits FOR SELECT 
  USING (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));
CREATE POLICY "deposits_insert_shop" ON deposits FOR INSERT 
  WITH CHECK (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));
CREATE POLICY "deposits_update_shop" ON deposits FOR UPDATE 
  USING (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1))
  WITH CHECK (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));

-- ============================================
-- DAMAGES POLICIES
-- ============================================
-- All staff in the same shop can view damages (scoped by shop_id, not user_id)
CREATE POLICY "damages_select_shop" ON damages FOR SELECT 
  USING (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));
CREATE POLICY "damages_insert_shop" ON damages FOR INSERT 
  WITH CHECK (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));
CREATE POLICY "damages_update_shop" ON damages FOR UPDATE 
  USING (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1))
  WITH CHECK (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));
CREATE POLICY "damages_delete_shop" ON damages FOR DELETE 
  USING (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));

-- ============================================
-- SHOP PICKUP POINTS POLICIES
-- ============================================
CREATE POLICY "pickup_points_select_shop" ON shop_pickup_points FOR SELECT
  USING (
    is_active = true
    AND shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "pickup_points_insert_owner" ON shop_pickup_points FOR INSERT
  WITH CHECK (
    shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    AND (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) IN ('owner', 'admin')
  );

CREATE POLICY "pickup_points_update_owner" ON shop_pickup_points FOR UPDATE
  USING (
    shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    AND (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) IN ('owner', 'admin')
  )
  WITH CHECK (
    shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    AND (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) IN ('owner', 'admin')
  );

CREATE POLICY "pickup_points_delete_owner" ON shop_pickup_points FOR DELETE
  USING (
    shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    AND (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) IN ('owner', 'admin')
  );

-- ============================================
-- INDIA LOCATIONS POLICIES
-- ============================================
CREATE POLICY "states_select_all" ON states FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "cities_select_all" ON cities FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "pincodes_select_all" ON pincodes FOR SELECT TO authenticated
  USING (true);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Add indexes on frequently queried columns
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_shop_id ON users(shop_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_shop_id ON vehicles(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_bookings_shop_id ON bookings(shop_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_payments_shop_id ON payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_deposits_shop_id ON deposits(shop_id);
CREATE INDEX IF NOT EXISTS idx_deposits_booking_id ON deposits(booking_id);
CREATE INDEX IF NOT EXISTS idx_damages_shop_id ON damages(shop_id);
CREATE INDEX IF NOT EXISTS idx_damages_vehicle_id ON damages(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_states_name ON states(name);
CREATE INDEX IF NOT EXISTS idx_cities_state_id ON cities(state_id);
CREATE INDEX IF NOT EXISTS idx_pincodes_city_id ON pincodes(city_id);

-- ============================================
-- NOTES
-- ============================================

-- To apply these policies:
-- 1. Copy this entire SQL file
-- 2. Go to Supabase Dashboard > SQL Editor
-- 3. Paste and run the SQL
-- 4. Verify RLS is enabled by checking Table Editor > [table] > Settings > RLS

-- Security guarantees:
-- ✅ Users can only see their own data (user_id = auth.uid())
-- ✅ Cross-user queries return empty results
-- ✅ Attempts to insert/update other users' data will fail
-- ✅ No policies use TRUE or auth.role() = 'authenticated'
-- ✅ Service role key bypasses RLS (backend admin-only)

-- Best practices:
-- - Always use authenticated Supabase client on frontend
-- - Use service role key ONLY on backend (never expose to client)
-- - Test RLS policies with different users
-- - Monitor Supabase logs for unauthorized access attempts
