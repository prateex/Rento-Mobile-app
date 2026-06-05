-- ============================================================================
-- POST-MIGRATION VERIFICATION QUERIES
-- ============================================================================
-- Run these in Supabase SQL Editor to verify the migration was successful
-- ============================================================================

-- 1. Check that NO DELETE policies exist
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
AND cmd = 'DELETE'
AND tablename IN ('customers', 'vehicles', 'bookings', 'payments', 'customer_id_photos', 'vehicle_damage_photos');
-- Expected: 0 rows

-- 2. Verify all tables have exactly 3 policies (SELECT, INSERT, UPDATE)
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('customers', 'vehicles', 'bookings', 'payments', 'customer_id_photos', 'vehicle_damage_photos')
GROUP BY tablename
ORDER BY tablename;
-- Expected: 6 rows, each with policy_count = 3

-- 3. Verify helper function exists
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'current_shop_id'
AND pronamespace = 'public'::regnamespace;
-- Expected: 1 row

-- 4. List all policies for each table
SELECT 
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('customers', 'vehicles', 'bookings', 'payments', 'customer_id_photos', 'vehicle_damage_photos')
ORDER BY tablename, cmd;

-- 5. Verify RLS is enabled but NOT FORCED
SELECT 
  tablename,
  rowsecurity as rls_enabled,
  relforcerowsecurity as rls_forced
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public'
AND tablename IN ('customers', 'vehicles', 'bookings', 'payments', 'customer_id_photos', 'vehicle_damage_photos')
ORDER BY tablename;
-- Expected: rls_enabled = true, rls_forced = false for all tables
