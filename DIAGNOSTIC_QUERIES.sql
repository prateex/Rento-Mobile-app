-- ============================================
-- DIAGNOSTIC QUERIES - Run to diagnose issues
-- ============================================

-- 1. Check current logged-in user
SELECT 
  'Current Auth ID' as field,
  auth.uid()::text as value

UNION ALL

SELECT 'Current User ID',
  (SELECT id::text FROM users WHERE auth_id = auth.uid())

UNION ALL

SELECT 'Current User Shop ID',
  (SELECT shop_id::text FROM users WHERE auth_id = auth.uid())

UNION ALL

SELECT 'Current User Role',
  (SELECT role::text FROM users WHERE auth_id = auth.uid());

-- 2. Check if users have shop_id
SELECT 
  id,
  full_name,
  auth_id,
  shop_id,
  role,
  is_active
FROM users
LIMIT 20;

-- 3. Check if data exists in main tables
SELECT 'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'customers', COUNT(*) FROM customers
UNION ALL
SELECT 'vehicles', COUNT(*) FROM vehicles
UNION ALL
SELECT 'bookings', COUNT(*) FROM bookings
UNION ALL
SELECT 'rental_shops', COUNT(*) FROM rental_shops;

-- 4. Check RLS is enabled
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users', 'customers', 'vehicles', 'bookings')
ORDER BY tablename;

-- 5. List ALL policies on critical tables
SELECT 
  tablename,
  policyname,
  cmd,
  CASE WHEN qual IS NOT NULL THEN '✓ Has USING' ELSE '✗ No USING' END as using_clause,
  CASE WHEN with_check IS NOT NULL THEN '✓ Has WITH CHECK' ELSE '✗ No WITH CHECK' END as check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('users', 'customers', 'vehicles', 'bookings')
ORDER BY tablename, policyname;

-- 6. Check helper function
SELECT 
  routine_name,
  routine_type,
  security_type,
  routine_definition
FROM information_schema.routines
WHERE routine_name LIKE 'get_%'
  AND routine_schema = 'public';

-- 7. Test helper function
SELECT 
  'Function: get_current_user_shop_id()' as test,
  get_current_user_shop_id()::text as result;

-- 8. Manually test SELECT queries
SELECT 
  'SELECT from users' as query,
  COUNT(*)::text as rows_returned
FROM users;

SELECT 
  'SELECT from customers',
  COUNT(*)::text
FROM customers;

SELECT 
  'SELECT from vehicles',
  COUNT(*)::text
FROM vehicles;

SELECT 
  'SELECT from bookings',
  COUNT(*)::text
FROM bookings;

-- 9. Check if data is for your shop
SELECT 
  'My shop customers' as query,
  COUNT(*)::text as count
FROM customers
WHERE shop_id = get_current_user_shop_id();

SELECT 
  'My shop vehicles',
  COUNT(*)::text
FROM vehicles
WHERE shop_id = get_current_user_shop_id();

SELECT 
  'My shop bookings',
  COUNT(*)::text
FROM bookings
WHERE shop_id = get_current_user_shop_id();

-- 10. Check auth.uid() is working
SELECT 
  'auth.uid() returns:' as field,
  auth.uid()::text as value;
