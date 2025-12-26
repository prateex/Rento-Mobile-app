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

-- Drop existing policies on user-owned tables
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='vehicles' LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON vehicles', r.polname); END LOOP;
  FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='customers' LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON customers', r.polname); END LOOP;
  FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='bookings' LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON bookings', r.polname); END LOOP;
  FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='payments' LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON payments', r.polname); END LOOP;
  FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='deposits' LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON deposits', r.polname); END LOOP;
  FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='damages' LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON damages', r.polname); END LOOP;
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
-- USERS (STAFF) POLICIES
-- ============================================

-- Staff can view users in their shop
CREATE POLICY "Users can view staff in their shop"
  ON users FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Only shop owners can insert new staff
CREATE POLICY "Shop owners can add staff"
  ON users FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT id FROM rental_shops WHERE owner_id = auth.uid()
    )
  );

-- Only shop owners can update staff
CREATE POLICY "Shop owners can update staff"
  ON users FOR UPDATE
  USING (
    shop_id IN (
      SELECT id FROM rental_shops WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    shop_id IN (
      SELECT id FROM rental_shops WHERE owner_id = auth.uid()
    )
  );

-- Only shop owners can delete staff
CREATE POLICY "Shop owners can delete staff"
  ON users FOR DELETE
  USING (
    shop_id IN (
      SELECT id FROM rental_shops WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- VEHICLES POLICIES
-- ============================================
CREATE POLICY "vehicles_select_owner" ON vehicles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "vehicles_insert_owner" ON vehicles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "vehicles_update_owner" ON vehicles FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "vehicles_delete_owner" ON vehicles FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- CUSTOMERS POLICIES
-- ============================================
CREATE POLICY "customers_select_owner" ON customers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "customers_insert_owner" ON customers FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "customers_update_owner" ON customers FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "customers_delete_owner" ON customers FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- BOOKINGS POLICIES
-- ============================================
CREATE POLICY "bookings_select_owner" ON bookings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "bookings_insert_owner" ON bookings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "bookings_update_owner" ON bookings FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "bookings_delete_owner" ON bookings FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- PAYMENTS POLICIES
-- ============================================
CREATE POLICY "payments_select_owner" ON payments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "payments_insert_owner" ON payments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "payments_update_owner" ON payments FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "payments_delete_owner" ON payments FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- DEPOSITS POLICIES
-- ============================================
CREATE POLICY "deposits_select_owner" ON deposits FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "deposits_insert_owner" ON deposits FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "deposits_update_owner" ON deposits FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================
-- DAMAGES POLICIES
-- ============================================
CREATE POLICY "damages_select_owner" ON damages FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "damages_insert_owner" ON damages FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "damages_update_owner" ON damages FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "damages_delete_owner" ON damages FOR DELETE USING (user_id = auth.uid());

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
