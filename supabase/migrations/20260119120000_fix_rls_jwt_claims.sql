-- =============================================================================
-- FIX RLS POLICIES: USE JWT CLAIMS INSTEAD OF HELPER FUNCTIONS
-- =============================================================================
-- ROOT CAUSE: get_my_shop_id() queries users table, causing recursion
-- SOLUTION: Use auth.jwt() ->> 'shop_id' directly in all RLS policies
-- =============================================================================

BEGIN;

-- ============================================================================
-- 1. DROP ALL EXISTING RLS POLICIES
-- ============================================================================

-- Drop all policies on customer_id_photos
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

-- Drop all policies on customers
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customers'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON customers', policy_record.policyname);
  END LOOP;
END $$;

-- Drop all policies on vehicles
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vehicles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON vehicles', policy_record.policyname);
  END LOOP;
END $$;

-- Drop all policies on bookings
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bookings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON bookings', policy_record.policyname);
  END LOOP;
END $$;

-- Drop all policies on damages
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'damages'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON damages', policy_record.policyname);
  END LOOP;
END $$;

-- Drop all policies on documents
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'documents'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON documents', policy_record.policyname);
  END LOOP;
END $$;

-- Drop all policies on vehicle_damage_photos
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vehicle_damage_photos'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON vehicle_damage_photos', policy_record.policyname);
  END LOOP;
END $$;

-- ============================================================================
-- 2. CREATE JWT-BASED RLS POLICIES (NO HELPER FUNCTIONS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE customer_id_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE damages ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_damage_photos ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- customer_id_photos: JWT-based policies
-- ============================================================================

CREATE POLICY "customer_id_photos_select" ON customer_id_photos
  FOR SELECT
  USING (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

CREATE POLICY "customer_id_photos_insert" ON customer_id_photos
  FOR INSERT
  WITH CHECK (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

CREATE POLICY "customer_id_photos_update" ON customer_id_photos
  FOR UPDATE
  USING (shop_id = (auth.jwt() ->> 'shop_id')::uuid)
  WITH CHECK (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

CREATE POLICY "customer_id_photos_delete" ON customer_id_photos
  FOR DELETE
  USING (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

-- ============================================================================
-- customers: JWT-based policies
-- ============================================================================

CREATE POLICY "customers_select" ON customers
  FOR SELECT
  USING (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

CREATE POLICY "customers_insert" ON customers
  FOR INSERT
  WITH CHECK (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

CREATE POLICY "customers_update" ON customers
  FOR UPDATE
  USING (shop_id = (auth.jwt() ->> 'shop_id')::uuid)
  WITH CHECK (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

CREATE POLICY "customers_delete" ON customers
  FOR DELETE
  USING (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

-- ============================================================================
-- vehicles: JWT-based policies
-- ============================================================================

CREATE POLICY "vehicles_select" ON vehicles
  FOR SELECT
  USING (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

CREATE POLICY "vehicles_insert" ON vehicles
  FOR INSERT
  WITH CHECK (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

CREATE POLICY "vehicles_update" ON vehicles
  FOR UPDATE
  USING (shop_id = (auth.jwt() ->> 'shop_id')::uuid)
  WITH CHECK (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

CREATE POLICY "vehicles_delete" ON vehicles
  FOR DELETE
  USING (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

-- ============================================================================
-- bookings: JWT-based policies
-- ============================================================================

CREATE POLICY "bookings_select" ON bookings
  FOR SELECT
  USING (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

CREATE POLICY "bookings_insert" ON bookings
  FOR INSERT
  WITH CHECK (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

CREATE POLICY "bookings_update" ON bookings
  FOR UPDATE
  USING (shop_id = (auth.jwt() ->> 'shop_id')::uuid)
  WITH CHECK (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

CREATE POLICY "bookings_delete" ON bookings
  FOR DELETE
  USING (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

-- ============================================================================
-- damages: JWT-based policies
-- ============================================================================

CREATE POLICY "damages_select" ON damages
  FOR SELECT
  USING (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

CREATE POLICY "damages_insert" ON damages
  FOR INSERT
  WITH CHECK (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

CREATE POLICY "damages_update" ON damages
  FOR UPDATE
  USING (shop_id = (auth.jwt() ->> 'shop_id')::uuid)
  WITH CHECK (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

CREATE POLICY "damages_delete" ON damages
  FOR DELETE
  USING (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

-- ============================================================================
-- documents: JWT-based policies
-- ============================================================================

CREATE POLICY "documents_select" ON documents
  FOR SELECT
  USING (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

CREATE POLICY "documents_insert" ON documents
  FOR INSERT
  WITH CHECK (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

CREATE POLICY "documents_update" ON documents
  FOR UPDATE
  USING (shop_id = (auth.jwt() ->> 'shop_id')::uuid)
  WITH CHECK (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

CREATE POLICY "documents_delete" ON documents
  FOR DELETE
  USING (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

-- ============================================================================
-- vehicle_damage_photos: JWT-based policies
-- ============================================================================

CREATE POLICY "vehicle_damage_photos_select" ON vehicle_damage_photos
  FOR SELECT
  USING (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

CREATE POLICY "vehicle_damage_photos_insert" ON vehicle_damage_photos
  FOR INSERT
  WITH CHECK (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

CREATE POLICY "vehicle_damage_photos_update" ON vehicle_damage_photos
  FOR UPDATE
  USING (shop_id = (auth.jwt() ->> 'shop_id')::uuid)
  WITH CHECK (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

CREATE POLICY "vehicle_damage_photos_delete" ON vehicle_damage_photos
  FOR DELETE
  USING (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

-- ============================================================================
-- 3. VALIDATION
-- ============================================================================

DO $$
DECLARE
  policy_count INT;
BEGIN
  -- Verify customer_id_photos has 4 policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'customer_id_photos';
  
  IF policy_count != 4 THEN
    RAISE EXCEPTION 'customer_id_photos: Expected 4 policies, found %', policy_count;
  END IF;

  -- Verify customers has 4 policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'customers';
  
  IF policy_count != 4 THEN
    RAISE EXCEPTION 'customers: Expected 4 policies, found %', policy_count;
  END IF;

  -- Verify vehicles has 4 policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'vehicles';
  
  IF policy_count != 4 THEN
    RAISE EXCEPTION 'vehicles: Expected 4 policies, found %', policy_count;
  END IF;

  -- Verify bookings has 4 policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'bookings';
  
  IF policy_count != 4 THEN
    RAISE EXCEPTION 'bookings: Expected 4 policies, found %', policy_count;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '✓✓✓ RLS POLICIES FIXED - JWT-BASED ✓✓✓';
  RAISE NOTICE '';
  RAISE NOTICE 'ALL POLICIES NOW USE: shop_id = (auth.jwt() ->> ''shop_id'')::uuid';
  RAISE NOTICE '';
  RAISE NOTICE 'TABLES FIXED:';
  RAISE NOTICE '  ✓ customer_id_photos (4 policies)';
  RAISE NOTICE '  ✓ customers (4 policies)';
  RAISE NOTICE '  ✓ vehicles (4 policies)';
  RAISE NOTICE '  ✓ bookings (4 policies)';
  RAISE NOTICE '  ✓ damages (4 policies)';
  RAISE NOTICE '  ✓ documents (4 policies)';
  RAISE NOTICE '  ✓ vehicle_damage_photos (4 policies)';
  RAISE NOTICE '';
  RAISE NOTICE 'NO HELPER FUNCTIONS - NO RECURSION - NO 400 ERRORS';
  RAISE NOTICE '';
END $$;

COMMIT;
