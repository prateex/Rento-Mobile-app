-- =============================================================================
-- FIX customer_id_photos RLS AND CONSTRAINTS
-- =============================================================================
-- Problem: INSERT/SELECT on customer_id_photos returns 400
-- Root cause: RLS policies may be too restrictive or referencing wrong columns
-- Solution: Drop all policies, ensure minimal required columns, recreate simple policies
-- =============================================================================

BEGIN;

-- ============================================================================
-- 1. DROP ALL EXISTING RLS POLICIES ON customer_id_photos
-- ============================================================================

DROP POLICY IF EXISTS "Staff view customer photos" ON customer_id_photos;
DROP POLICY IF EXISTS "Staff insert customer photos" ON customer_id_photos;
DROP POLICY IF EXISTS "Staff update customer photos" ON customer_id_photos;
DROP POLICY IF EXISTS "Staff delete customer photos" ON customer_id_photos;
DROP POLICY IF EXISTS "shop_access_all" ON customer_id_photos;
DROP POLICY IF EXISTS "Staff delete customer photos" ON customer_id_photos;

-- Drop any other potential policies
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customer_id_photos'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON customer_id_photos', policy_record.policyname);
  END LOOP;
END $$;

-- ============================================================================
-- 2. ENSURE MINIMAL REQUIRED COLUMNS ONLY
-- ============================================================================

-- Make sure optional columns are truly optional (no NOT NULL except essentials)
-- Essential: shop_id, customer_id, side, file_path, uploaded_at
-- Optional: everything else

ALTER TABLE customer_id_photos ALTER COLUMN storage_bucket DROP NOT NULL;
ALTER TABLE customer_id_photos ALTER COLUMN storage_bucket SET DEFAULT 'customer-id-photos';

-- Ensure uploaded_at has default (so INSERT doesn't need to provide it)
ALTER TABLE customer_id_photos ALTER COLUMN uploaded_at SET DEFAULT now();

-- Ensure uploaded_by is nullable (frontend doesn't send it)
-- Already nullable in table definition, but let's be explicit
ALTER TABLE customer_id_photos ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE customer_id_photos ALTER COLUMN file_size_bytes DROP NOT NULL;
ALTER TABLE customer_id_photos ALTER COLUMN mime_type DROP NOT NULL;
ALTER TABLE customer_id_photos ALTER COLUMN expires_at DROP NOT NULL;
ALTER TABLE customer_id_photos ALTER COLUMN booking_id DROP NOT NULL;

-- ============================================================================
-- 3. CREATE SIMPLE, PERMISSIVE RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE customer_id_photos ENABLE ROW LEVEL SECURITY;

-- SELECT: Anyone in the shop can view photos
CREATE POLICY "customer_id_photos_select" ON customer_id_photos
  FOR SELECT
  USING (shop_id = get_my_shop_id());

-- INSERT: Anyone in the shop can insert photos
-- CRITICAL: No complex conditions, just shop_id check
CREATE POLICY "customer_id_photos_insert" ON customer_id_photos
  FOR INSERT
  WITH CHECK (shop_id = get_my_shop_id());

-- UPDATE: Anyone in the shop can update photos
CREATE POLICY "customer_id_photos_update" ON customer_id_photos
  FOR UPDATE
  USING (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());

-- DELETE: Anyone in the shop can delete photos (soft delete via trigger)
CREATE POLICY "customer_id_photos_delete" ON customer_id_photos
  FOR DELETE
  USING (shop_id = get_my_shop_id());

-- ============================================================================
-- 4. ENSURE SOFT DELETE TRIGGER EXISTS
-- ============================================================================

-- Recreate soft delete trigger function
CREATE OR REPLACE FUNCTION public.trigger_soft_delete_customer_id_photos()
RETURNS TRIGGER AS $$
BEGIN
  -- Convert DELETE to UPDATE deleted_at = now()
  UPDATE customer_id_photos SET deleted_at = now() WHERE id = OLD.id;
  -- Return NULL to prevent actual deletion
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_soft_delete_customer_id_photos ON customer_id_photos;
CREATE TRIGGER trigger_soft_delete_customer_id_photos
  BEFORE DELETE ON customer_id_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_soft_delete_customer_id_photos();

-- ============================================================================
-- 5. VALIDATION
-- ============================================================================

DO $$
DECLARE
  policy_count INT;
BEGIN
  -- Check that exactly 4 policies exist
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'customer_id_photos';
  
  IF policy_count != 4 THEN
    RAISE EXCEPTION 'Expected 4 RLS policies on customer_id_photos, found %', policy_count;
  END IF;

  -- Check soft delete trigger exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_soft_delete_customer_id_photos'
  ) THEN
    RAISE EXCEPTION 'Soft delete trigger missing on customer_id_photos';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '✓✓✓ customer_id_photos RLS FIXED ✓✓✓';
  RAISE NOTICE '';
  RAISE NOTICE 'FIXES APPLIED:';
  RAISE NOTICE '  ✓ All old RLS policies dropped';
  RAISE NOTICE '  ✓ 4 simple RLS policies created (SELECT/INSERT/UPDATE/DELETE)';
  RAISE NOTICE '  ✓ All non-essential columns made nullable';
  RAISE NOTICE '  ✓ Soft delete trigger recreated';
  RAISE NOTICE '';
  RAISE NOTICE 'FRONTEND CONTRACT:';
  RAISE NOTICE '  • INSERT requires: shop_id, customer_id, side, file_path';
  RAISE NOTICE '  • storage_bucket has default: customer-id-photos';
  RAISE NOTICE '  • uploaded_at has default: now()';
  RAISE NOTICE '  • All other columns optional';
  RAISE NOTICE '';
END $$;

COMMIT;
