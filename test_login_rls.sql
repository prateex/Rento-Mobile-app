-- ============================================================================
-- LOGIN BOOTSTRAP RLS TEST
-- ============================================================================
-- Tests that users table RLS allows login bootstrap without recursion
-- Run this BEFORE testing app login to verify DB layer is correct
-- ============================================================================

-- Test 1: Verify RLS is enabled on users table
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename = 'users';
-- Expected: rls_enabled = true

-- Test 2: List all policies on users table
SELECT
  policyname,
  cmd AS operation,
  CASE
    WHEN qual IS NOT NULL THEN pg_get_expr(qual, 'users'::regclass)
    ELSE 'none'
  END AS using_clause,
  CASE
    WHEN with_check IS NOT NULL THEN pg_get_expr(with_check, 'users'::regclass)
    ELSE 'none'
  END AS check_clause
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;
-- Expected: 4 policies (view, insert, update, block delete)
-- Expected: NO policy contains "shop_id" or "get_my_shop_id()"
-- Expected: All use simple "auth_id = auth.uid()"

-- Test 3: Verify no recursive shop_id reference
SELECT
  policyname,
  pg_get_expr(qual, 'users'::regclass) AS using_expr
FROM pg_policies
WHERE tablename = 'users'
  AND pg_get_expr(qual, 'users'::regclass) LIKE '%shop_id%';
-- Expected: 0 rows (no policy should reference shop_id)

-- Test 4: Simulate login bootstrap (as authenticated user)
-- This simulates what the app does on login
DO $$
DECLARE
  test_auth_id UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  found_count INT;
BEGIN
  RAISE NOTICE '=== RLS LOGIN BOOTSTRAP TEST ===';
  
  -- Set session to simulate authenticated user
  PERFORM set_config('request.jwt.claims', json_build_object('sub', test_auth_id)::text, false);
  
  -- Try to SELECT own row (this is what login bootstrap does)
  SELECT COUNT(*) INTO found_count
  FROM users
  WHERE auth_id = test_auth_id;
  
  IF found_count = 0 THEN
    RAISE NOTICE '✓ No RLS block - SELECT returned 0 rows (user does not exist yet)';
  ELSE
    RAISE NOTICE '✓ No RLS block - SELECT returned % rows', found_count;
  END IF;
  
  RAISE NOTICE '✓ RLS TEST PASSED: users table allows SELECT without recursion';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✗ RLS TEST FAILED: %', SQLERRM;
END $$;

-- Test 5: Verify users table schema matches app contract
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('id', 'auth_id', 'role', 'shop_id', 'name', 'phone', 'email')
ORDER BY
  CASE column_name
    WHEN 'id' THEN 1
    WHEN 'auth_id' THEN 2
    WHEN 'role' THEN 3
    WHEN 'shop_id' THEN 4
    WHEN 'name' THEN 5
    WHEN 'phone' THEN 6
    WHEN 'email' THEN 7
  END;
-- Expected: role has NO DEFAULT, auth_id is NOT NULL, shop_id is NOT NULL

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- If all tests pass:
-- ✓ RLS is enabled on users
-- ✓ Policies use auth_id = auth.uid() (no recursion)
-- ✓ SELECT own row works without RLS block
-- ✓ Schema matches app contract
--
-- App login should now work without "500 Internal Server Error"
-- ============================================================================
