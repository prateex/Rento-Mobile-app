-- ============================================
-- MIGRATION 006: RLS POLICIES FOR MARKETPLACE
-- Role-based access control for all tables
-- ============================================
-- Timeline: Run LAST, after all other migrations
-- Backward Compatibility: DEPENDS (may restrict existing owner app access)
-- Rollback: ALTER TABLE [...] DISABLE ROW LEVEL SECURITY

-- ============================================
-- CRITICAL NOTES
-- ============================================
/*
RLS (Row Level Security) enforces access at database level:
- Customer can only see/modify own bookings
- Owner can only manage own vehicles
- Admin has full access

MUST apply this LAST after all migrations.
Test thoroughly with owner app after applying.

Existing owner app tables:
- rental_shops: no RLS (admin only read)
- users: no RLS (staff mgmt)
- vehicles: RLS based on owner
- customers: RLS based on user/shop
- bookings: RLS based on owner
- payments: RLS based on user
- deposits: RLS based on owner
- damages: RLS based on owner

New marketplace tables:
- platform_users: RLS based on auth user
- marketplace_locations: no RLS (public read)
- vehicle_images: RLS same as vehicles
- booking_availability_blocks: no RLS (internal)
- marketplace_payments: RLS based on customer/owner
*/

-- ============================================
-- HELPER: USER ROLE FUNCTION
-- ============================================
-- Determine current user's role on platform
-- Used in all RLS policies

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Get role from platform_users table
  SELECT role INTO v_role
  FROM platform_users
  WHERE auth_id = auth.uid()
  LIMIT 1;
  
  -- Fallback to staff/owner role from users table
  IF v_role IS NULL THEN
    SELECT role INTO v_role
    FROM users
    WHERE auth_id = auth.uid()
    LIMIT 1;
  END IF;
  
  RETURN COALESCE(v_role, 'customer');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog, public;

-- ============================================
-- HELPER: IS OWNER FUNCTION
-- ============================================
-- Check if current user is owner of a shop

CREATE OR REPLACE FUNCTION is_owner_of_shop(p_shop_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM rental_shops
    WHERE id = p_shop_id AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog, public;

-- ============================================
-- HELPER: IS ADMIN FUNCTION
-- ============================================
-- Check if current user is admin

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role() = 'admin';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog, public;

-- ============================================
-- ENABLE RLS ON MARKETPLACE TABLES
-- ============================================

-- platform_users (authentication users)
ALTER TABLE platform_users ENABLE ROW LEVEL SECURITY;

-- marketplace_locations (public, no RLS needed)
-- ALTER TABLE marketplace_locations ENABLE ROW LEVEL SECURITY;

-- vehicle_images (tied to vehicle RLS)
ALTER TABLE vehicle_images ENABLE ROW LEVEL SECURITY;

-- booking_availability_blocks (internal, no RLS)
-- Blocks are system-managed, not user-controlled

-- marketplace_payments (user-scoped)
ALTER TABLE marketplace_payments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICY: platform_users
-- ============================================
-- Users can view own profile + admins see all

CREATE POLICY "Users can view own profile"
  ON platform_users
  FOR SELECT
  USING (auth_id = auth.uid() OR is_admin());

CREATE POLICY "Users can update own profile"
  ON platform_users
  FOR UPDATE
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- Only admins/system can insert users
CREATE POLICY "Only system can create users"
  ON platform_users
  FOR INSERT
  WITH CHECK (is_admin());

-- ============================================
-- RLS POLICY: vehicle_images
-- ============================================
-- Images visible where vehicle is visible
-- Owners can manage own vehicle images

CREATE POLICY "View images for visible vehicles"
  ON vehicle_images
  FOR SELECT
  USING (
    -- Owner can see all images of own vehicle
    (
      SELECT owner_id FROM vehicles WHERE id = vehicle_id
    ) = (
      SELECT id FROM rental_shops 
      WHERE owner_id = auth.uid()
    )
    OR
    -- Customers can see images of vehicles they're viewing
    -- (vehicle is public and marketplace-listed)
    (
      SELECT is_listed_marketplace FROM vehicles 
      WHERE id = vehicle_id
    ) = true
  );

CREATE POLICY "Owners can manage vehicle images"
  ON vehicle_images
  FOR INSERT
  WITH CHECK (
    (
      SELECT owner_id FROM vehicles WHERE id = vehicle_id
    ) IN (
      SELECT id FROM rental_shops WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can delete own images"
  ON vehicle_images
  FOR DELETE
  USING (
    (
      SELECT owner_id FROM vehicles WHERE id = vehicle_id
    ) IN (
      SELECT id FROM rental_shops WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICY: marketplace_payments
-- ============================================
-- Customers see own payments
-- Owners see payments for their bookings
-- Admin sees all

CREATE POLICY "Customers view own payments"
  ON marketplace_payments
  FOR SELECT
  USING (
    -- Customer viewing own payment
    (
      SELECT customer_auth_id FROM bookings WHERE id = booking_id
    ) = auth.uid()
    OR
    -- Owner viewing payment for their vehicle booking
    (
      SELECT owner_id FROM bookings WHERE id = booking_id
    ) IN (
        SELECT id FROM rental_shops WHERE owner_id = auth.uid()
      )
    OR
    -- Admin
    is_admin()
  );

-- Only system can insert/modify payments (via functions)
CREATE POLICY "Only system can modify payments"
  ON marketplace_payments
  FOR ALL
  WITH CHECK (is_admin());

-- ============================================
-- ENABLE RLS ON EXISTING TABLES
-- ============================================
-- These need updating to support marketplace

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICY: vehicles (CRITICAL)
-- ============================================
-- Key policy: marketplace + owner management

CREATE POLICY "View public marketplace vehicles"
  ON vehicles
  FOR SELECT
  USING (
    -- Public marketplace listing
    (is_listed_marketplace = true AND status = 'Available')
    OR
    -- Owner viewing own vehicles
    (owner_id IN (
      SELECT id FROM rental_shops WHERE owner_id = auth.uid()
    ))
    OR
    -- Staff viewing shop vehicles
    (shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    ))
    OR
    -- Admin
    is_admin()
  );

CREATE POLICY "Owners can insert vehicles"
  ON vehicles
  FOR INSERT
  WITH CHECK (
    owner_id IN (
      SELECT id FROM rental_shops WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update own vehicles"
  ON vehicles
  FOR UPDATE
  USING (
    owner_id IN (
      SELECT id FROM rental_shops WHERE owner_id = auth.uid()
    )
    OR is_admin()
  )
  WITH CHECK (
    owner_id IN (
      SELECT id FROM rental_shops WHERE owner_id = auth.uid()
    )
    OR is_admin()
  );

-- ============================================
-- RLS POLICY: bookings (CRITICAL)
-- ============================================
-- Complex: online vs manual, customer vs owner

CREATE POLICY "Customers view own bookings"
  ON bookings
  FOR SELECT
  USING (
    -- Online booking customer
    (is_online_booking = true AND customer_auth_id = auth.uid())
    OR
    -- Manual booking: customer is linked via shop
    (
      is_online_booking = false 
      AND customer_id IN (
        SELECT id FROM customers 
        WHERE user_id = auth.uid()
      )
    )
    OR
    -- Owner viewing own vehicle bookings
    (
      owner_id IN (
        SELECT id FROM rental_shops WHERE owner_id = auth.uid()
      )
    )
    OR
    -- Staff viewing shop bookings
    (
      shop_id IN (
        SELECT shop_id FROM users WHERE auth_id = auth.uid()
      )
    )
    OR
    -- Admin
    is_admin()
  );

CREATE POLICY "Customers can create online bookings"
  ON bookings
  FOR INSERT
  WITH CHECK (
    is_online_booking = true
    AND customer_auth_id = auth.uid()
    AND get_user_role() = 'customer'
  );

CREATE POLICY "Customers can update own bookings"
  ON bookings
  FOR UPDATE
  USING (
    (is_online_booking = true AND customer_auth_id = auth.uid())
    OR
    (shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    ))
    OR
    is_admin()
  )
  WITH CHECK (
    (is_online_booking = true AND customer_auth_id = auth.uid())
    OR
    (shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    ))
    OR
    is_admin()
  );

-- ============================================
-- RLS POLICY: customers (existing table)
-- ============================================
-- Backward compat: shop staff can view shop customers

CREATE POLICY "View customers in accessible shops"
  ON customers
  FOR SELECT
  USING (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
    OR is_admin()
  );

CREATE POLICY "Staff can manage customers"
  ON customers
  FOR UPDATE
  USING (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
    OR is_admin()
  )
  WITH CHECK (
    shop_id IN (
      SELECT shop_id FROM users WHERE auth_id = auth.uid()
    )
    OR is_admin()
  );

-- ============================================
-- OPTIONAL: RLS ON OTHER TABLES
-- ============================================
-- Uncomment if needed for stricter security

-- ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "View payments for accessible shops"
--   ON payments
--   FOR SELECT
--   USING (
--     shop_id IN (
--       SELECT shop_id FROM users WHERE auth_id = auth.uid()
--     )
--     OR is_admin()
--   );

-- ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "View deposits for accessible shops"
--   ON deposits
--   FOR SELECT
--   USING (
--     shop_id IN (
--       SELECT shop_id FROM users WHERE auth_id = auth.uid()
--     )
--     OR is_admin()
--   );

-- ALTER TABLE damages ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "View damages for accessible shops"
--   ON damages
--   FOR SELECT
--   USING (
--     shop_id IN (
--       SELECT shop_id FROM users WHERE auth_id = auth.uid()
--     )
--     OR is_admin()
--   );

-- ============================================
-- TESTING QUERIES
-- ============================================
/*
After applying RLS, test with different users:

1. TEST AS CUSTOMER:
   SET ROLE customer_user_id;
   
   -- Should see public vehicles
   SELECT * FROM vehicles WHERE is_listed_marketplace = true;
   
   -- Should NOT see private vehicles
   SELECT * FROM vehicles WHERE is_listed_marketplace = false;
   -- Result: 0 rows
   
   -- Should see own bookings
   SELECT * FROM bookings WHERE customer_auth_id = auth.uid();
   
   -- Should NOT see other bookings
   SELECT * FROM bookings WHERE customer_auth_id != auth.uid();
   -- Result: 0 rows

2. TEST AS OWNER:
   SET ROLE owner_user_id;
   
   -- Should see own vehicles
   SELECT * FROM vehicles 
   WHERE owner_id IN (
     SELECT id FROM rental_shops WHERE owner_id = auth.uid()
   );
   
   -- Should see own bookings
   SELECT * FROM bookings 
   WHERE owner_id IN (
     SELECT id FROM rental_shops WHERE owner_id = auth.uid()
   );
   
   -- Should NOT see competitor vehicles
   SELECT * FROM vehicles 
   WHERE owner_id NOT IN (
     SELECT id FROM rental_shops WHERE owner_id = auth.uid()
   );
   -- Result: Only public listed vehicles

3. TEST AS ADMIN:
   SET ROLE admin_user_id;
   
   -- Should see all vehicles
   SELECT COUNT(*) FROM vehicles;
   
   -- Should see all bookings
   SELECT COUNT(*) FROM bookings;
   
   -- Should see all users
   SELECT COUNT(*) FROM platform_users;
*/

-- ============================================
-- MIGRATION METADATA
-- ============================================
-- RLS Policies Created: 12
-- Helper Functions: 3
-- Tables with RLS: 5
-- Breaking Changes: YES (restricts access)
-- Must apply: LAST (after other migrations)
-- Test Required: YES (verify owner app still works)

/*
BACKWARD COMPATIBILITY NOTES:

⚠️ CRITICAL: This may break existing owner app if:
1. Owner app queries vehicles without proper auth
2. Owner app assumes access to all vehicles
3. Bookings table assumptions change

VERIFICATION CHECKLIST AFTER APPLYING:

✓ Owner can view own vehicles
✓ Owner can view own bookings
✓ Staff can view shop data
✓ Customer cannot see other customer bookings
✓ Admin can see all data
✓ Public vehicle listing works
✓ Online booking creation works
✓ No unintended access restrictions
✓ Performance acceptable (test with 10k+ vehicles)

TROUBLESHOOTING:

If owner app breaks after RLS:
1. Check owner_id is properly populated
2. Verify auth.uid() is being set correctly
3. Test with SET ROLE and specific user_id
4. Check application JWT token includes user info
5. Review Supabase logs for RLS violations
6. May need to add service role bypass for admin functions

If queries are slow:
1. Check indexes are created (should be from migrations)
2. RLS functions should be STABLE/SECURITY DEFINER
3. Consider query plans with EXPLAIN ANALYZE
4. May need additional composite indexes
*/
