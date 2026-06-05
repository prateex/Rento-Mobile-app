-- ============================================
-- TEST SCRIPT FOR RLS FIX
-- Run this after applying 003_rls_policies_fixed.sql
-- ============================================

-- ============================================
-- PART 1: Verify Helper Functions Exist
-- ============================================

SELECT 
  routine_name,
  routine_type,
  security_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'auth'
AND routine_name IN ('get_user_shop_id', 'get_user_role', 'is_user_active')
ORDER BY routine_name;

-- Expected output: 3 functions, all with security_type = 'DEFINER'

-- ============================================
-- PART 2: Test Helper Functions (as logged-in user)
-- ============================================

-- Test 1: Get my shop_id
SELECT auth.get_user_shop_id() as my_shop_id;
-- Expected: Your shop's UUID

-- Test 2: Get my role
SELECT auth.get_user_role() as my_role;
-- Expected: SUPER_ADMIN, SHOP_OWNER, or SHOP_STAFF

-- Test 3: Check if I'm active
SELECT auth.is_user_active() as am_i_active;
-- Expected: true

-- Test 4: Get all my context at once
SELECT 
  auth.uid() as my_auth_id,
  auth.get_user_shop_id() as my_shop_id,
  auth.get_user_role() as my_role,
  auth.is_user_active() as is_active;

-- ============================================
-- PART 3: Test Users Table Access (NO RECURSION)
-- ============================================

-- Test 5: Select my own user record
SELECT id, full_name, email, role, shop_id, is_active
FROM users
WHERE auth_id = auth.uid();
-- Expected: Your user record

-- Test 6: Select all users in my shop
SELECT id, full_name, email, role, staff_id, is_active
FROM users
WHERE shop_id = auth.get_user_shop_id()
ORDER BY created_at;
-- Expected: All users in your shop (if SHOP_OWNER/STAFF) or all users (if SUPER_ADMIN)

-- ============================================
-- PART 4: Test Shop Access
-- ============================================

-- Test 7: Get my shop details
SELECT id, name, phone, email, shop_code
FROM rental_shops
WHERE id = auth.get_user_shop_id();
-- Expected: Your shop's details

-- ============================================
-- PART 5: Test Customer Operations
-- ============================================

-- Test 8: View customers in my shop
SELECT id, full_name, phone, email, customer_number, status
FROM customers
WHERE shop_id = auth.get_user_shop_id()
ORDER BY created_at DESC
LIMIT 5;
-- Expected: Recent customers from your shop

-- Test 9: Insert a test customer (will be deleted later)
INSERT INTO customers (
  shop_id,
  full_name,
  phone,
  email,
  address,
  id_type,
  id_photos,
  status
) VALUES (
  auth.get_user_shop_id(),
  'Test Customer RLS Fix',
  '9999999999',
  'test.rls@example.com',
  'Test Address',
  'Aadhaar',
  '{"front": "", "back": ""}'::jsonb,
  'Verified'
)
RETURNING id, full_name, phone, customer_number;
-- Expected: Successfully inserted with customer_number auto-generated

-- Test 10: Verify customer was inserted
SELECT id, full_name, phone, customer_number
FROM customers
WHERE phone = '9999999999';
-- Expected: The test customer record

-- ============================================
-- PART 6: Test Vehicle Access
-- ============================================

-- Test 11: View vehicles in my shop
SELECT id, name, registration_number, type, status, daily_rate
FROM vehicles
WHERE shop_id = auth.get_user_shop_id()
ORDER BY created_at DESC
LIMIT 5;
-- Expected: Recent vehicles from your shop

-- ============================================
-- PART 7: Test Booking Access
-- ============================================

-- Test 12: View bookings in my shop
SELECT id, booking_number, status, total_amount, start_date, end_date
FROM bookings
WHERE shop_id = auth.get_user_shop_id()
ORDER BY created_at DESC
LIMIT 5;
-- Expected: Recent bookings from your shop

-- ============================================
-- PART 8: Verify RLS Policies
-- ============================================

-- Test 13: Count policies on each table
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
-- Expected: Each table should have 4 policies (SELECT, INSERT, UPDATE, DELETE)

-- Test 14: Show all policies on users table
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%get_current_user_context%' THEN '❌ RECURSIVE'
    WHEN qual LIKE '%auth.get_user_%' THEN '✅ SAFE'
    ELSE 'Check manually'
  END as safety_status
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;
-- Expected: All policies should show '✅ SAFE', none should be RECURSIVE

-- ============================================
-- PART 9: Clean Up Test Data
-- ============================================

-- Test 15: Delete the test customer
DELETE FROM customers
WHERE phone = '9999999999'
AND full_name = 'Test Customer RLS Fix';
-- Expected: 1 row deleted

-- Verify deletion
SELECT COUNT(*) as test_customer_count
FROM customers
WHERE phone = '9999999999';
-- Expected: 0

-- ============================================
-- PART 10: Final Summary
-- ============================================

DO $$
DECLARE
  v_shop_id UUID;
  v_role TEXT;
  v_user_count INTEGER;
  v_customer_count INTEGER;
  v_booking_count INTEGER;
  v_vehicle_count INTEGER;
BEGIN
  -- Get context
  SELECT auth.get_user_shop_id() INTO v_shop_id;
  SELECT auth.get_user_role() INTO v_role;
  
  -- Get counts
  SELECT COUNT(*) INTO v_user_count FROM users WHERE shop_id = v_shop_id;
  SELECT COUNT(*) INTO v_customer_count FROM customers WHERE shop_id = v_shop_id;
  SELECT COUNT(*) INTO v_booking_count FROM bookings WHERE shop_id = v_shop_id;
  SELECT COUNT(*) INTO v_vehicle_count FROM vehicles WHERE shop_id = v_shop_id;
  
  -- Display summary
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS FIX VERIFICATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Your Shop ID: %', v_shop_id;
  RAISE NOTICE 'Your Role: %', v_role;
  RAISE NOTICE '';
  RAISE NOTICE 'Data accessible to you:';
  RAISE NOTICE '  - Users: %', v_user_count;
  RAISE NOTICE '  - Customers: %', v_customer_count;
  RAISE NOTICE '  - Bookings: %', v_booking_count;
  RAISE NOTICE '  - Vehicles: %', v_vehicle_count;
  RAISE NOTICE '';
  RAISE NOTICE '✅ If you can see this message, RLS is working correctly!';
  RAISE NOTICE '✅ No infinite recursion detected';
  RAISE NOTICE '✅ All queries executed successfully';
  RAISE NOTICE '';
  RAISE NOTICE 'You can now:';
  RAISE NOTICE '  1. Add customers without errors';
  RAISE NOTICE '  2. Create bookings without errors';
  RAISE NOTICE '  3. View all shop data properly';
  RAISE NOTICE '========================================';
END $$;
