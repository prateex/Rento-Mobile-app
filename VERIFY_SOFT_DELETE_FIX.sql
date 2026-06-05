-- ============================================================================
-- VERIFICATION SCRIPT: Soft Delete Implementation
-- ============================================================================
-- Run this query in your Supabase SQL Editor to verify the fix is correct
-- All checks should pass with expected results

SELECT '=== SOFT DELETE VERIFICATION REPORT ===' AS status;

-- ============================================================================
-- CHECK 1: deleted_at columns exist on all required tables
-- ============================================================================
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'deleted_at'
  AND table_name IN ('vehicles', 'customers', 'bookings', 'payments', 'customer_id_photos', 'vehicle_damage_photos')
ORDER BY table_name;

-- Expected: 6 rows (one for each table)
-- All should have data_type = 'timestamp with time zone'
-- All should have is_nullable = 'YES'

-- ============================================================================
-- CHECK 2: RLS is enabled on all required tables
-- ============================================================================
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('vehicles', 'customers', 'bookings', 'payments', 'customer_id_photos', 'vehicle_damage_photos')
ORDER BY tablename;

-- Expected: All rowsecurity = true

-- ============================================================================
-- CHECK 3: SELECT policies filter by deleted_at IS NULL
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  qual as select_using_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('vehicles', 'customers', 'bookings', 'payments', 'customer_id_photos', 'vehicle_damage_photos')
  AND policyname LIKE '%select%'
ORDER BY tablename, policyname;

-- Expected: 6 policies (one SELECT per table)
-- All should have 'deleted_at IS NULL' in qual

-- ============================================================================
-- CHECK 4: UPDATE policies DO NOT have deleted_at IS NULL in USING
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  qual as update_using_clause,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('vehicles', 'customers', 'bookings', 'payments', 'customer_id_photos', 'vehicle_damage_photos')
  AND policyname LIKE '%update%'
  AND cmd = 'UPDATE'
ORDER BY tablename, policyname;

-- Expected: 6 policies (one UPDATE per table)
-- qual should have 'shop_id' check, but NOT 'deleted_at IS NULL'
-- with_check should enforce shop_id (security)

-- ============================================================================
-- CHECK 5: INSERT policies require deleted_at IS NULL
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  with_check as insert_with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('vehicles', 'customers', 'bookings', 'payments', 'customer_id_photos', 'vehicle_damage_photos')
  AND policyname LIKE '%insert%'
ORDER BY tablename, policyname;

-- Expected: 6 policies (one INSERT per table)
-- with_check should have 'deleted_at IS NULL'

-- ============================================================================
-- CHECK 6: NO DELETE policies exist for regular users
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('vehicles', 'customers', 'bookings', 'payments', 'customer_id_photos', 'vehicle_damage_photos')
  AND cmd = 'DELETE'
ORDER BY tablename, policyname;

-- Expected: 0 rows (no DELETE policies for these tables)

-- ============================================================================
-- CHECK 7: Soft-delete cascade triggers exist
-- ============================================================================
SELECT 
  trigger_schema,
  event_object_table,
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'trg_soft_delete_booking_children',
    'trg_soft_delete_customer_photos',
    'trg_soft_delete_vehicle_photos'
  )
ORDER BY event_object_table, trigger_name;

-- Expected: 3 triggers
-- trg_soft_delete_booking_children on bookings
-- trg_soft_delete_customer_photos on customers
-- trg_soft_delete_vehicle_photos on vehicles

-- ============================================================================
-- CHECK 8: No policies exist on auth.users (CRITICAL SAFETY CHECK)
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'auth'
  AND tablename = 'users'
ORDER BY tablename, policyname;

-- Expected: 0 rows
-- CRITICAL: auth.users must have NO custom policies

-- ============================================================================
-- CHECK 9: Foreign keys to auth.users are intact (not deleted)
-- ============================================================================
SELECT 
  table_name,
  column_name,
  constraint_name,
  foreign_table_name,
  foreign_column_name
FROM information_schema.key_column_usage
WHERE table_schema = 'public'
  AND foreign_table_schema = 'auth'
  AND foreign_table_name = 'users'
ORDER BY table_name, column_name;

-- Expected: Multiple rows showing:
-- - customers.created_by -> auth.users.id
-- - vehicles.created_by -> auth.users.id
-- - bookings.created_by -> auth.users.id
-- - rental_shops.owner_id -> auth.users.id
-- - users.auth_id -> auth.users.id

-- ============================================================================
-- CHECK 10: Sample data verification (if data exists)
-- ============================================================================

-- Verify soft-deleted rows are hidden from SELECT:
SELECT 'Customers (deleted_at IS NULL)' AS check_name, COUNT(*) as count
FROM customers
WHERE deleted_at IS NULL;

SELECT 'Customers (deleted_at IS NOT NULL)' AS check_name, COUNT(*) as count
FROM customers
WHERE deleted_at IS NOT NULL;

-- If delete tests were run, you should see:
-- - Some rows with deleted_at IS NULL (active)
-- - Some rows with deleted_at IS NOT NULL (soft-deleted, but still in DB)

-- ============================================================================
-- CHECK 11: Cascade functionality (if deletions were made)
-- ============================================================================

-- Verify that when a booking is soft-deleted, its payments are too:
SELECT 
  b.id as booking_id,
  b.deleted_at as booking_deleted_at,
  COUNT(p.id) as payment_count,
  COUNT(CASE WHEN p.deleted_at IS NOT NULL THEN 1 END) as deleted_payments
FROM bookings b
LEFT JOIN payments p ON p.booking_id = b.id
WHERE b.deleted_at IS NOT NULL
GROUP BY b.id, b.deleted_at
ORDER BY b.deleted_at DESC;

-- Expected: All payment_count rows should equal deleted_payments
-- (i.e., when booking is deleted, all its payments are too)

-- ============================================================================
-- SUMMARY OF EXPECTED RESULTS
-- ============================================================================
/*

✅ CHECK 1: 6 rows (deleted_at on all tables)
✅ CHECK 2: All 6 tables have rowsecurity = true
✅ CHECK 3: 6 SELECT policies with 'deleted_at IS NULL'
✅ CHECK 4: 6 UPDATE policies WITHOUT 'deleted_at IS NULL' in qual
✅ CHECK 5: 6 INSERT policies with 'deleted_at IS NULL' in with_check
✅ CHECK 6: 0 DELETE policies
✅ CHECK 7: 3 cascade triggers (bookings, customers, vehicles)
✅ CHECK 8: 0 policies on auth.users
✅ CHECK 9: Multiple FK constraints to auth.users (unchanged)
✅ CHECK 10: Sample data shows some deleted, some active rows
✅ CHECK 11: Cascade works (deleted booking → deleted payments)

If any check fails:
  1. Review the migration files for errors
  2. Check migration log: supabase db reset --no-seed --yes
  3. Contact support with check results

*/
