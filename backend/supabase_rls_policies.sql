-- ============================================
-- SUPABASE ROW LEVEL SECURITY (RLS) POLICIES
-- For Rento Bike Rental Management System
-- ============================================

-- IMPORTANT: These policies ensure that:
-- 1. Owners can only access data for their own shop
-- 2. Staff can only access data for their assigned shop
-- 3. No cross-shop data leakage is possible
-- 4. All queries use auth.uid() to verify ownership

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

-- Users can view vehicles in their shop
CREATE POLICY "Users can view vehicles in their shop"
  ON vehicles FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Users can insert vehicles in their shop
CREATE POLICY "Users can add vehicles to their shop"
  ON vehicles FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Users can update vehicles in their shop
CREATE POLICY "Users can update vehicles in their shop"
  ON vehicles FOR UPDATE
  USING (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  )
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Users can delete vehicles in their shop
CREATE POLICY "Users can delete vehicles in their shop"
  ON vehicles FOR DELETE
  USING (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- ============================================
-- CUSTOMERS POLICIES
-- ============================================

-- Users can view customers in their shop
CREATE POLICY "Users can view customers in their shop"
  ON customers FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Users can insert customers in their shop
CREATE POLICY "Users can add customers to their shop"
  ON customers FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Users can update customers in their shop
CREATE POLICY "Users can update customers in their shop"
  ON customers FOR UPDATE
  USING (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  )
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Users can delete customers in their shop
CREATE POLICY "Users can delete customers in their shop"
  ON customers FOR DELETE
  USING (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- ============================================
-- BOOKINGS POLICIES
-- ============================================

-- Users can view bookings in their shop
CREATE POLICY "Users can view bookings in their shop"
  ON bookings FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Users can insert bookings in their shop
CREATE POLICY "Users can create bookings in their shop"
  ON bookings FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Users can update bookings in their shop
CREATE POLICY "Users can update bookings in their shop"
  ON bookings FOR UPDATE
  USING (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  )
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Users can delete bookings in their shop (soft delete via status update preferred)
CREATE POLICY "Users can delete bookings in their shop"
  ON bookings FOR DELETE
  USING (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- ============================================
-- PAYMENTS POLICIES
-- ============================================

-- Users can view payments in their shop
CREATE POLICY "Users can view payments in their shop"
  ON payments FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Users can insert payments in their shop
CREATE POLICY "Users can record payments in their shop"
  ON payments FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Users can update payments in their shop
CREATE POLICY "Users can update payments in their shop"
  ON payments FOR UPDATE
  USING (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  )
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Users can delete payments in their shop
CREATE POLICY "Users can delete payments in their shop"
  ON payments FOR DELETE
  USING (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- ============================================
-- DEPOSITS POLICIES
-- ============================================

-- Users can view deposits in their shop
CREATE POLICY "Users can view deposits in their shop"
  ON deposits FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Users can insert deposits in their shop
CREATE POLICY "Users can create deposits in their shop"
  ON deposits FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Users can update deposits in their shop
CREATE POLICY "Users can update deposits in their shop"
  ON deposits FOR UPDATE
  USING (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  )
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- ============================================
-- DAMAGES POLICIES
-- ============================================

-- Users can view damages for vehicles in their shop
CREATE POLICY "Users can view damages in their shop"
  ON damages FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Users can report damages for vehicles in their shop
CREATE POLICY "Users can report damages in their shop"
  ON damages FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Users can update damages in their shop
CREATE POLICY "Users can update damages in their shop"
  ON damages FOR UPDATE
  USING (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  )
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Users can delete damages in their shop
CREATE POLICY "Users can delete damages in their shop"
  ON damages FOR DELETE
  USING (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
  );

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
-- ✅ Users can only see data for their assigned shop
-- ✅ Cross-shop queries will return empty results
-- ✅ Attempts to insert/update data for other shops will fail
-- ✅ auth.uid() ensures user is authenticated
-- ✅ Service role key bypasses RLS (used by backend for admin operations)

-- Best practices:
-- - Always use authenticated Supabase client on frontend
-- - Use service role key ONLY on backend (never expose to client)
-- - Test RLS policies with different users
-- - Monitor Supabase logs for unauthorized access attempts
