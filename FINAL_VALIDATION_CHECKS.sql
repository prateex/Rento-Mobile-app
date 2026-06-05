-- FINAL VALIDATION QUERIES - MANDATORY CHECKS

-- ============================================================================
-- PART 1: VERIFY RLS POLICIES ARE CORRECTLY CONFIGURED
-- ============================================================================

-- Check 1.1: Verify customer_id_photos table has RLS enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'customer_id_photos';
-- Expected: rowsecurity = true

-- Check 1.2: List all RLS policies on customer_id_photos
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'customer_id_photos'
ORDER BY policyname;
-- Expected: 4 policies (select, insert, update, delete) all permissive, uses shop_id check

-- Check 1.3: Verify policies don't have recursive logic
SELECT policyname, qual, with_check
FROM pg_policies
WHERE tablename = 'customer_id_photos'
  AND (qual ILIKE '%customer_id_photos%' OR with_check ILIKE '%customer_id_photos%');
-- Expected: No results (no recursion in policy conditions)

-- ============================================================================
-- PART 2: VERIFY DATABASE SCHEMA ALIGNMENT
-- ============================================================================

-- Check 2.1: Verify customer_id_photos table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'customer_id_photos'
ORDER BY ordinal_position;
-- Expected: customer_id, side, file_path, storage_bucket, shop_id columns

-- Check 2.2: Check if customers table still has unused photo columns
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'customers' 
  AND column_name LIKE '%photo%';
-- Expected: id_photo_front_path, id_photo_back_path (deprecated but harmless)

-- Check 2.3: Verify no data is stored in deprecated customers.id_photos columns
SELECT COUNT(*) as deprecated_photo_count
FROM customers
WHERE id_photo_front_path IS NOT NULL 
  OR id_photo_back_path IS NOT NULL;
-- Expected: 0 (no data in deprecated columns)

-- ============================================================================
-- PART 3: VERIFY CUSTOMER_ID_PHOTOS TABLE HAS DATA
-- ============================================================================

-- Check 3.1: Count photos per shop
SELECT shop_id, COUNT(*) as photo_count
FROM customer_id_photos
GROUP BY shop_id
ORDER BY shop_id;
-- Expected: Shows data distribution by shop

-- Check 3.2: Verify photo records are well-formed
SELECT 
  customer_id,
  side,
  file_path,
  storage_bucket,
  shop_id,
  created_at
FROM customer_id_photos
LIMIT 5;
-- Expected: All fields populated correctly

-- ============================================================================
-- PART 4: VERIFY AUTH SYSTEM INTEGRITY
-- ============================================================================

-- Check 4.1: Verify users table is intact
SELECT COUNT(*) as user_count FROM users;
-- Expected: More than 0

-- Check 4.2: Verify users have shop_id
SELECT COUNT(*) as users_without_shop
FROM users
WHERE shop_id IS NULL;
-- Expected: 0

-- Check 4.3: Verify auth.users exists and is untouched
SELECT COUNT(*) as auth_user_count FROM auth.users;
-- Expected: More than 0

-- ============================================================================
-- PART 5: VERIFY STORAGE BUCKET
-- ============================================================================

-- Check 5.1: Verify customer-ids bucket exists and is private
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'customer-ids';
-- Expected: id='customer-ids', public=false, file_size_limit=5242880

-- Check 5.2: Verify storage policies exist
SELECT 
  policyname,
  permissive,
  roles,
  qual
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage'
  AND policyname LIKE '%customer ID%'
ORDER BY policyname;
-- Expected: 3 policies (upload, view, delete)

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- After running these checks:
-- 1. All RLS policies should be correctly configured without recursion
-- 2. customer_id_photos table should have proper structure
-- 3. No data should be in deprecated customers.id_photo* columns
-- 4. auth.users and users table should be intact
-- 5. customer-ids bucket should be private with correct policies
