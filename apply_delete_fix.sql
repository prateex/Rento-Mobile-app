-- ============================================================================
-- CRITICAL DELETE FIX - COMBINED MIGRATIONS
-- ============================================================================
-- Date: January 14, 2026
-- 
-- This script combines two migrations:
-- 1. Enable safe deletes (columns, triggers)
-- 2. Fix RLS policies for soft delete
--
-- BACKUP YOUR DATA BEFORE RUNNING THIS IN PRODUCTION
-- ============================================================================

-- Migration 1: Enable Safe Deletes
-- Source: supabase/migrations/20260114100000_enable_safe_deletes.sql
-- ============================================================================

BEGIN;

-- Add deleted_at columns (idempotent)
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS bookings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS booking_payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS customer_id_photos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS vehicle_damage_photos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_at ON vehicles(deleted_at);
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON customers(deleted_at);
CREATE INDEX IF NOT EXISTS idx_bookings_deleted_at ON bookings(deleted_at);
CREATE INDEX IF NOT EXISTS idx_payments_deleted_at ON payments(deleted_at);

DO $$
BEGIN
  IF to_regclass('public.booking_payments') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_booking_payments_deleted_at ON booking_payments(deleted_at)';
  END IF;
  IF to_regclass('public.customer_id_photos') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_customer_id_photos_deleted_at ON customer_id_photos(deleted_at)';
  END IF;
  IF to_regclass('public.vehicle_damage_photos') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_vehicle_damage_photos_deleted_at ON vehicle_damage_photos(deleted_at)';
  END IF;
END $$;

-- Enable RLS on all tables
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.customer_id_photos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE customer_id_photos ENABLE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.vehicle_damage_photos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE vehicle_damage_photos ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- Create SELECT policies (filter out deleted records)
DROP POLICY IF EXISTS vehicles_select_active ON vehicles;
CREATE POLICY vehicles_select_active ON vehicles
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS customers_select_active ON customers;
CREATE POLICY customers_select_active ON customers
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS bookings_select_active ON bookings;
CREATE POLICY bookings_select_active ON bookings
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS payments_select_active ON payments;
CREATE POLICY payments_select_active ON payments
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())
  );

-- Create INSERT policies
DROP POLICY IF EXISTS vehicles_insert_active ON vehicles;
CREATE POLICY vehicles_insert_active ON vehicles
  FOR INSERT
  WITH CHECK (
    deleted_at IS NULL
    AND shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS customers_insert_active ON customers;
CREATE POLICY customers_insert_active ON customers
  FOR INSERT
  WITH CHECK (
    deleted_at IS NULL
    AND shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS bookings_insert_active ON bookings;
CREATE POLICY bookings_insert_active ON bookings
  FOR INSERT
  WITH CHECK (
    deleted_at IS NULL
    AND shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS payments_insert_active ON payments;
CREATE POLICY payments_insert_active ON payments
  FOR INSERT
  WITH CHECK (
    deleted_at IS NULL
    AND shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())
  );

-- Soft-delete cascade triggers
CREATE OR REPLACE FUNCTION public.soft_delete_booking_children()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE payments
    SET deleted_at = now(), updated_at = now()
    WHERE booking_id = NEW.id AND deleted_at IS NULL;

    IF to_regclass('public.booking_payments') IS NOT NULL THEN
      EXECUTE 'UPDATE booking_payments SET deleted_at = now(), updated_at = now() WHERE booking_id = $1 AND deleted_at IS NULL' USING NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_soft_delete_booking_children ON bookings;
CREATE TRIGGER trg_soft_delete_booking_children
  AFTER UPDATE ON bookings
  FOR EACH ROW
  WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  EXECUTE FUNCTION public.soft_delete_booking_children();

CREATE OR REPLACE FUNCTION public.soft_delete_customer_photos()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    IF to_regclass('public.customer_id_photos') IS NOT NULL THEN
      EXECUTE 'UPDATE customer_id_photos SET deleted_at = now(), updated_at = now() WHERE customer_id = $1 AND deleted_at IS NULL' USING NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_soft_delete_customer_photos ON customers;
CREATE TRIGGER trg_soft_delete_customer_photos
  AFTER UPDATE ON customers
  FOR EACH ROW
  WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  EXECUTE FUNCTION public.soft_delete_customer_photos();

CREATE OR REPLACE FUNCTION public.soft_delete_vehicle_photos()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    IF to_regclass('public.vehicle_damage_photos') IS NOT NULL THEN
      EXECUTE 'UPDATE vehicle_damage_photos SET deleted_at = now(), updated_at = now() WHERE vehicle_id = $1 AND deleted_at IS NULL' USING NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_soft_delete_vehicle_photos ON vehicles;
CREATE TRIGGER trg_soft_delete_vehicle_photos
  AFTER UPDATE ON vehicles
  FOR EACH ROW
  WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  EXECUTE FUNCTION public.soft_delete_vehicle_photos();

COMMIT;

-- ============================================================================
-- Migration 2: Fix RLS UPDATE Policies
-- Source: supabase/migrations/20260114150000_fix_delete_policies.sql
-- ============================================================================

BEGIN;

-- VEHICLES: Allow soft delete via UPDATE
DROP POLICY IF EXISTS vehicles_update_active ON vehicles;
CREATE POLICY vehicles_update_active ON vehicles
  FOR UPDATE
  USING (
    shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())
  );

-- CUSTOMERS: Allow soft delete via UPDATE
DROP POLICY IF EXISTS customers_update_active ON customers;
CREATE POLICY customers_update_active ON customers
  FOR UPDATE
  USING (
    shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())
  );

-- BOOKINGS: Allow soft delete via UPDATE
DROP POLICY IF EXISTS bookings_update_active ON bookings;
CREATE POLICY bookings_update_active ON bookings
  FOR UPDATE
  USING (
    shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())
  );

-- PAYMENTS: Allow soft delete via UPDATE
DROP POLICY IF EXISTS payments_update_active ON payments;
CREATE POLICY payments_update_active ON payments
  FOR UPDATE
  USING (
    shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())
  );

-- CUSTOMER_ID_PHOTOS: Allow soft delete via UPDATE
DROP POLICY IF EXISTS customer_id_photos_update_active ON customer_id_photos;
DO $$
BEGIN
  IF to_regclass('public.customer_id_photos') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY customer_id_photos_update_active ON customer_id_photos
      FOR UPDATE
      USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()))
      WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()))';
  END IF;
END $$;

-- VEHICLE_DAMAGE_PHOTOS: Allow soft delete via UPDATE
DROP POLICY IF EXISTS vehicle_damage_photos_update_active ON vehicle_damage_photos;
DO $$
BEGIN
  IF to_regclass('public.vehicle_damage_photos') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY vehicle_damage_photos_update_active ON vehicle_damage_photos
      FOR UPDATE
      USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()))
      WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()))';
  END IF;
END $$;

-- BOOKING_PAYMENTS: Allow soft delete via UPDATE (if exists)
DROP POLICY IF EXISTS booking_payments_update_active ON booking_payments;
DO $$
BEGIN
  IF to_regclass('public.booking_payments') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY booking_payments_update_active ON booking_payments
      FOR UPDATE
      USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()))
      WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()))';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check deleted_at columns exist
SELECT 
  table_name, 
  column_name,
  data_type
FROM information_schema.columns 
WHERE 
  column_name = 'deleted_at' 
  AND table_schema = 'public'
ORDER BY table_name;

-- Check UPDATE policies
SELECT 
  tablename,
  policyname,
  permissive,
  cmd,
  CASE 
    WHEN qual LIKE '%deleted_at IS NULL%' THEN '❌ Has deleted_at check (BAD)'
    ELSE '✅ No deleted_at check (GOOD)'
  END as policy_status
FROM pg_policies
WHERE 
  tablename IN ('customers', 'vehicles', 'bookings', 'payments')
  AND cmd = 'UPDATE'
ORDER BY tablename;

-- Check triggers
SELECT 
  trigger_name,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE '%soft_delete%'
ORDER BY event_object_table;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ DELETE FIX MIGRATIONS APPLIED SUCCESSFULLY';
  RAISE NOTICE '   - Soft delete columns added';
  RAISE NOTICE '   - RLS UPDATE policies fixed';
  RAISE NOTICE '   - Cascade triggers configured';
  RAISE NOTICE '   - Shop isolation maintained';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Next: Test delete operations in the app';
END $$;
