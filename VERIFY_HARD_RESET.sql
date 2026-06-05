-- ============================================================================
-- VERIFICATION: HARD RESET RLS POLICIES
-- ============================================================================
-- Run these queries to verify the hard reset was successful
-- ============================================================================

-- 1. Verify NO DELETE policies exist
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
AND cmd = 'DELETE'
AND tablename IN ('customers', 'vehicles', 'bookings', 'payments', 'customer_id_photos', 'vehicle_damage_photos');
-- Expected: 0 rows

-- 2. Verify EXACTLY 3 policies per table (SELECT, INSERT, UPDATE)
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('customers', 'vehicles', 'bookings', 'payments', 'customer_id_photos', 'vehicle_damage_photos')
GROUP BY tablename
ORDER BY tablename;
-- Expected: 6 rows, each with policy_count = 3

-- 3. List all policies by table and command
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('customers', 'vehicles', 'bookings', 'payments', 'customer_id_photos', 'vehicle_damage_photos')
ORDER BY tablename, cmd;
-- Expected: 18 rows total (6 tables × 3 policies)

-- 4. Verify helper function exists
SELECT 
  proname as function_name,
  provolatile as volatility,
  prosecdef as security_definer
FROM pg_proc
WHERE proname = 'current_shop_id'
AND pronamespace = 'public'::regnamespace;
-- Expected: 1 row with volatility='s' (STABLE) and security_definer=true

-- 5. Verify RLS is ENABLED but NOT FORCED
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('customers', 'vehicles', 'bookings', 'payments', 'customer_id_photos', 'vehicle_damage_photos')
ORDER BY tablename;
-- Expected: 6 rows, all with rls_enabled = true

-- 6. Check policy details for customers table (sample)
SELECT 
  policyname,
  cmd,
  qual as using_clause,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'customers'
ORDER BY cmd;
-- Expected: 
--   INSERT: with_check contains shop_id check
--   SELECT: qual contains deleted_at IS NULL AND shop_id check
--   UPDATE: both qual and with_check contain shop_id check

-- 7. Verify UPDATE policies allow deleted_at changes
SELECT 
  tablename,
  policyname,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
AND cmd = 'UPDATE'
AND tablename IN ('customers', 'vehicles', 'bookings', 'payments', 'customer_id_photos', 'vehicle_damage_photos')
ORDER BY tablename;
-- Expected: 6 rows, with_check should NOT reference deleted_at

-- ============================================================================
-- SUCCESS INDICATORS
-- ============================================================================
-- ✅ 0 DELETE policies
-- ✅ 18 total policies (6 tables × 3 policies)
-- ✅ RLS enabled on all tables
-- ✅ current_shop_id() function exists
-- ✅ UPDATE policies don't block deleted_at changes
-- ============================================================================
