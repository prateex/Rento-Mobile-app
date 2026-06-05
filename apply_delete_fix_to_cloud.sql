-- ============================================================================
-- APPLY DELETE FIX TO CLOUD DATABASE
-- ============================================================================
-- SAFETY: This script only modifies RLS policies, not data or schema structure
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================================

-- STEP 1: Verify current state
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%deleted_at IS NULL%' THEN '❌ BLOCKING soft delete'
    ELSE '✅ OK'
  END as status
FROM pg_policies
WHERE tablename IN ('customers', 'vehicles', 'bookings', 'payments')
  AND cmd = 'UPDATE'
ORDER BY tablename, policyname;

-- ============================================================================
-- STEP 2: Apply the fix (from migration 20260114150000)
-- ============================================================================

BEGIN;

-- VEHICLES: Allow soft delete via UPDATE
DROP POLICY IF EXISTS vehicles_update_active ON vehicles;
DROP POLICY IF EXISTS "Staff can update vehicles in their shop" ON vehicles;

CREATE POLICY vehicles_update_active ON vehicles
  FOR UPDATE
  USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));

-- CUSTOMERS: Allow soft delete via UPDATE
DROP POLICY IF EXISTS customers_update_active ON customers;
DROP POLICY IF EXISTS "Staff can update customers in their shop" ON customers;

CREATE POLICY customers_update_active ON customers
  FOR UPDATE
  USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));

-- BOOKINGS: Allow soft delete via UPDATE
DROP POLICY IF EXISTS bookings_update_active ON bookings;
DROP POLICY IF EXISTS "Staff can update bookings in their shop" ON bookings;

CREATE POLICY bookings_update_active ON bookings
  FOR UPDATE
  USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));

-- PAYMENTS: Allow soft delete via UPDATE
DROP POLICY IF EXISTS payments_update_active ON payments;
DROP POLICY IF EXISTS "Staff can update payments in their shop" ON payments;

CREATE POLICY payments_update_active ON payments
  FOR UPDATE
  USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));

-- CUSTOMER_ID_PHOTOS: Allow soft delete via UPDATE (if exists)
DO $$
BEGIN
  IF to_regclass('public.customer_id_photos') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS customer_id_photos_update_active ON customer_id_photos';
    EXECUTE 'DROP POLICY IF EXISTS "customer_id_photos_shop_update" ON customer_id_photos';
    EXECUTE 'CREATE POLICY customer_id_photos_update_active ON customer_id_photos
      FOR UPDATE
      USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()))
      WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()))';
  END IF;
END $$;

-- VEHICLE_DAMAGE_PHOTOS: Allow soft delete via UPDATE (if exists)
DO $$
BEGIN
  IF to_regclass('public.vehicle_damage_photos') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS vehicle_damage_photos_update_active ON vehicle_damage_photos';
    EXECUTE 'DROP POLICY IF EXISTS "vehicle_damage_photos_shop_update" ON vehicle_damage_photos';
    EXECUTE 'CREATE POLICY vehicle_damage_photos_update_active ON vehicle_damage_photos
      FOR UPDATE
      USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()))
      WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()))';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- STEP 3: Verify the fix
-- ============================================================================

SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%deleted_at IS NULL%' THEN '❌ STILL BROKEN'
    ELSE '✅ FIXED'
  END as status
FROM pg_policies
WHERE tablename IN ('customers', 'vehicles', 'bookings', 'payments')
  AND cmd = 'UPDATE'
ORDER BY tablename, policyname;

-- Expected: All UPDATE policies should show ✅ FIXED

-- ============================================================================
-- VERIFICATION: Test soft delete
-- ============================================================================

-- This query should succeed (tests if UPDATE works for setting deleted_at):
-- DO NOT RUN if you don't want to test with real data
/*
BEGIN;
UPDATE customers 
SET deleted_at = now() 
WHERE id = 'some-test-id' 
  AND shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())
  AND deleted_at IS NULL;
ROLLBACK; -- Rolls back the test
*/

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ DELETE FIX APPLIED TO CLOUD DATABASE';
  RAISE NOTICE '';
  RAISE NOTICE '📋 What changed:';
  RAISE NOTICE '   - UPDATE policies no longer block soft delete';
  RAISE NOTICE '   - Users can now set deleted_at on their shop records';
  RAISE NOTICE '   - Shop isolation maintained (security intact)';
  RAISE NOTICE '   - SELECT policies still filter deleted records';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Next steps:';
  RAISE NOTICE '   1. Test delete customer in app';
  RAISE NOTICE '   2. Test delete vehicle in app';
  RAISE NOTICE '   3. Test delete booking in app';
  RAISE NOTICE '   4. Verify records disappear after refresh';
END $$;
