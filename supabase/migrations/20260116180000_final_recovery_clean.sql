-- ============================================================================
-- FINAL DATABASE RECOVERY - CLEANED AND TESTED
-- ============================================================================
-- Date: 2026-01-16 17:00
-- Purpose: Ensure all critical columns exist and RLS policies work
-- 
-- Based on audit: Local database HAS all columns, but may have RLS issues
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Verify Critical Columns (Defensive - Should All Exist)
-- ============================================================================

-- Add bookings.notes if missing (crucial for app)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='bookings' AND column_name='notes'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN notes TEXT;
    RAISE NOTICE 'Added bookings.notes column';
  ELSE
    RAISE NOTICE 'bookings.notes already exists';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Ensure RLS Policies Are Functional
-- ============================================================================

-- Verify vehicles RLS
DO $$
BEGIN
  -- Remove DELETE policies (not used by app - soft delete only)
  DROP POLICY IF EXISTS "Staff can delete vehicles in their shop" ON vehicles;
  
  -- Ensure basic CRUD policies exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='vehicles' 
      AND policyname='Staff can view vehicles in their shop'
  ) THEN
    CREATE POLICY "Staff can view vehicles in their shop"
    ON vehicles FOR SELECT
    USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='vehicles' 
      AND policyname='Staff can insert vehicles in their shop'
  ) THEN
    CREATE POLICY "Staff can insert vehicles in their shop"
    ON vehicles FOR INSERT
    WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='vehicles' 
      AND policyname='Staff can update vehicles in their shop'
  ) THEN
    CREATE POLICY "Staff can update vehicles in their shop"
    ON vehicles FOR UPDATE
    USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()))
    WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));
  END IF;
END $$;

-- Verify customers RLS
DO $$
BEGIN
  DROP POLICY IF EXISTS "Staff can delete customers in their shop" ON customers;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='customers' 
      AND policyname='Staff can update customers in their shop'
  ) THEN
    CREATE POLICY "Staff can update customers in their shop"
    ON customers FOR UPDATE
    USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()))
    WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));
  END IF;
END $$;

-- Verify bookings RLS
DO $$
BEGIN
  DROP POLICY IF EXISTS "Staff can delete bookings in their shop" ON bookings;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='bookings' 
      AND policyname='Staff can insert bookings in their shop'
  ) THEN
    CREATE POLICY "Staff can insert bookings in their shop"
    ON bookings FOR INSERT
    WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='bookings' 
      AND policyname='Staff can update bookings in their shop'
  ) THEN
    CREATE POLICY "Staff can update bookings in their shop"
    ON bookings FOR UPDATE
    USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()))
    WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Final Verification
-- ============================================================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Check critical columns
  SELECT COUNT(*) INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (
      (table_name = 'vehicles' AND column_name IN ('category', 'cc', 'segment', 'gear_type'))
      OR (table_name = 'customers' AND column_name = 'notes')
      OR (table_name = 'bookings' AND column_name = 'notes')
    );
  
  IF v_count >= 6 THEN
    RAISE NOTICE '✓ All critical columns present (found %)', v_count;
  ELSE
    RAISE WARNING '✗ Missing columns (found % of 6)', v_count;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- RECOVERY COMPLETE
-- ============================================================================
