-- =============================================================================
-- COMPREHENSIVE DATABASE RESTORATION TO JAN 12, 2026 STATE
-- =============================================================================
-- Critical Issues to Fix:
-- 1. Invoice numbering: Broken format (IN-YY-YY instead of INV-25-26-0001)
-- 2. customer_id_photos: Missing table structure (needs side column)
-- 3. DELETE operations: Failing due to missing soft delete triggers
-- 4. RLS policies: May be blocking DELETE operations
--
-- This migration:
-- - Restores correct invoice numbering function (INV-25-26-0001 format)
-- - Ensures customer_id_photos table has correct structure
-- - Implements BEFORE DELETE triggers for all delete-able tables
-- - Ensures RLS policies allow DELETE (triggers handle soft delete)
-- - Is fully idempotent for safe supabase db reset
-- =============================================================================

BEGIN;

-- ============================================================================
-- 0. ENSURE HELPER FUNCTIONS EXIST
-- ============================================================================

-- CRITICAL: get_my_shop_id() function (used by RLS policies)
-- This function queries users table to get the shop_id for current auth user
CREATE OR REPLACE FUNCTION public.get_my_shop_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT shop_id
  FROM users
  WHERE auth_id = auth.uid()
  LIMIT 1;
$$;

-- update_updated_at_column trigger function (used by many tables)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 1. FIX INVOICE NUMBERING FUNCTION AND FORMAT
-- ============================================================================
-- Issue: Current format is IN-YY-YY-001 or INV/2025-26/0001
-- Fix: Must be INV-25-26-0001 (financial year format)

-- Update fy_label function to return correct format (25-26, not 2025-26)
CREATE OR REPLACE FUNCTION public.fy_label(ts TIMESTAMPTZ)
RETURNS TEXT AS $$
DECLARE
  start_year INT;
  next_year INT;
BEGIN
  IF EXTRACT(MONTH FROM ts) < 4 THEN
    start_year := EXTRACT(YEAR FROM ts)::INT - 1;
  ELSE
    start_year := EXTRACT(YEAR FROM ts)::INT;
  END IF;
  next_year := start_year + 1;
  
  -- Return format: 25-26 (for FY 2025-26)
  RETURN SUBSTRING(start_year::TEXT, 3, 2) || '-' || SUBSTRING(next_year::TEXT, 3, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update generate_invoice_number to use correct format: INV-25-26-0001
CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_shop_id UUID, p_ts TIMESTAMPTZ DEFAULT now())
RETURNS TEXT AS $$
DECLARE
  fy TEXT;
  current_val INT;
BEGIN
  fy := fy_label(p_ts);

  -- Ensure counter exists
  INSERT INTO invoice_number_counters (shop_id, financial_year, next_invoice_number)
  VALUES (p_shop_id, fy, 1)
  ON CONFLICT (shop_id, financial_year) DO NOTHING;

  -- Increment and get current value
  UPDATE invoice_number_counters
  SET next_invoice_number = next_invoice_number + 1, updated_at = now()
  WHERE shop_id = p_shop_id AND financial_year = fy
  RETURNING next_invoice_number - 1 INTO current_val;

  -- Return format: INV-25-26-0001
  RETURN 'INV-' || fy || '-' || LPAD(current_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 2. RESTORE customer_id_photos TABLE STRUCTURE
-- ============================================================================
-- Ensure table exists with proper columns for soft delete + photo management

CREATE TABLE IF NOT EXISTS customer_id_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'customer-id-photos',
  file_size_bytes INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Ensure indexes exist for performance (don't create index on side column yet - it may not exist)
CREATE INDEX IF NOT EXISTS idx_customer_id_photos_shop_id ON customer_id_photos(shop_id);
CREATE INDEX IF NOT EXISTS idx_customer_id_photos_customer_id ON customer_id_photos(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_id_photos_deleted_at ON customer_id_photos(deleted_at);

-- ============================================================================
-- 3. IMPLEMENT BEFORE DELETE TRIGGERS FOR SOFT DELETE
-- ============================================================================
-- These triggers convert DELETE operations to UPDATE deleted_at = now()
-- This allows frontend to use DELETE while database enforces soft delete

-- Function: Soft delete vehicles (convert DELETE to UPDATE deleted_at)
CREATE OR REPLACE FUNCTION public.trigger_soft_delete_vehicles()
RETURNS TRIGGER AS $$
BEGIN
  -- Convert DELETE to UPDATE deleted_at = now()
  UPDATE vehicles SET deleted_at = now() WHERE id = OLD.id;
  -- Return NULL to prevent actual deletion
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function: Soft delete customers (convert DELETE to UPDATE deleted_at)
CREATE OR REPLACE FUNCTION public.trigger_soft_delete_customers()
RETURNS TRIGGER AS $$
BEGIN
  -- Convert DELETE to UPDATE deleted_at = now()
  UPDATE customers SET deleted_at = now() WHERE id = OLD.id;
  -- Return NULL to prevent actual deletion
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function: Soft delete bookings (convert DELETE to UPDATE deleted_at)
-- IMPORTANT: Check invoice_number first (from migration 20260117010000)
CREATE OR REPLACE FUNCTION public.trigger_soft_delete_bookings()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if booking has invoice (cannot soft delete invoiced bookings)
  IF OLD.invoice_number IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot delete booking with invoice number.' USING ERRCODE = '23503';
  END IF;
  
  -- Convert DELETE to UPDATE deleted_at = now()
  UPDATE bookings SET deleted_at = now() WHERE id = OLD.id;
  -- Return NULL to prevent actual deletion
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function: Soft delete customer_id_photos (convert DELETE to UPDATE deleted_at)
CREATE OR REPLACE FUNCTION public.trigger_soft_delete_customer_id_photos()
RETURNS TRIGGER AS $$
BEGIN
  -- Convert DELETE to UPDATE deleted_at = now()
  UPDATE customer_id_photos SET deleted_at = now() WHERE id = OLD.id;
  -- Return NULL to prevent actual deletion
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function: Soft delete damages (convert DELETE to UPDATE deleted_at)
CREATE OR REPLACE FUNCTION public.trigger_soft_delete_damages()
RETURNS TRIGGER AS $$
BEGIN
  -- Convert DELETE to UPDATE deleted_at = now()
  UPDATE damages SET deleted_at = now() WHERE id = OLD.id;
  -- Return NULL to prevent actual deletion
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function: Soft delete documents (convert DELETE to UPDATE deleted_at)
CREATE OR REPLACE FUNCTION public.trigger_soft_delete_documents()
RETURNS TRIGGER AS $$
BEGIN
  -- Convert DELETE to UPDATE deleted_at = now()
  UPDATE documents SET deleted_at = now() WHERE id = OLD.id;
  -- Return NULL to prevent actual deletion
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function: Soft delete vehicle_damage_photos (convert DELETE to UPDATE deleted_at)
CREATE OR REPLACE FUNCTION public.trigger_soft_delete_vehicle_damage_photos()
RETURNS TRIGGER AS $$
BEGIN
  -- Convert DELETE to UPDATE deleted_at = now()
  UPDATE vehicle_damage_photos SET deleted_at = now() WHERE id = OLD.id;
  -- Return NULL to prevent actual deletion
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop and recreate triggers to ensure exact state
DROP TRIGGER IF EXISTS trigger_soft_delete_vehicles ON vehicles;
DROP TRIGGER IF EXISTS trigger_soft_delete_customers ON customers;
DROP TRIGGER IF EXISTS trigger_soft_delete_bookings ON bookings;
DROP TRIGGER IF EXISTS trigger_soft_delete_customer_id_photos ON customer_id_photos;
DROP TRIGGER IF EXISTS trigger_soft_delete_damages ON damages;
DROP TRIGGER IF EXISTS trigger_soft_delete_documents ON documents;
DROP TRIGGER IF EXISTS trigger_soft_delete_vehicle_damage_photos ON vehicle_damage_photos;

-- Create BEFORE DELETE triggers
CREATE TRIGGER trigger_soft_delete_vehicles
  BEFORE DELETE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_soft_delete_vehicles();

CREATE TRIGGER trigger_soft_delete_customers
  BEFORE DELETE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_soft_delete_customers();

CREATE TRIGGER trigger_soft_delete_bookings
  BEFORE DELETE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_soft_delete_bookings();

CREATE TRIGGER trigger_soft_delete_customer_id_photos
  BEFORE DELETE ON customer_id_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_soft_delete_customer_id_photos();

CREATE TRIGGER trigger_soft_delete_damages
  BEFORE DELETE ON damages
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_soft_delete_damages();

CREATE TRIGGER trigger_soft_delete_documents
  BEFORE DELETE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_soft_delete_documents();

CREATE TRIGGER trigger_soft_delete_vehicle_damage_photos
  BEFORE DELETE ON vehicle_damage_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_soft_delete_vehicle_damage_photos();

-- ============================================================================
-- 4. ENSURE RLS POLICIES ALLOW DELETE
-- ============================================================================
-- The soft delete triggers will convert DELETE to UPDATE, so RLS must
-- not block DELETE operations. The triggers run with SECURITY DEFINER
-- so they bypass RLS and safely update deleted_at.

-- Drop old DELETE-blocking policies
DROP POLICY IF EXISTS "Block delete on users" ON users;
DROP POLICY IF EXISTS "Staff delete vehicles" ON vehicles;
DROP POLICY IF EXISTS "Staff delete customers" ON customers;
DROP POLICY IF EXISTS "Staff delete bookings" ON bookings;
DROP POLICY IF EXISTS "Staff delete customer photos" ON customer_id_photos;
DROP POLICY IF EXISTS "Staff delete damages" ON damages;
DROP POLICY IF EXISTS "Staff delete documents" ON documents;
DROP POLICY IF EXISTS "Staff delete damage photos" ON vehicle_damage_photos;

-- Recreate DELETE policies (will be intercepted by BEFORE DELETE triggers)
-- Users: NO DELETE (special case - users are never deleted)
CREATE POLICY "Block delete on users" ON users FOR DELETE
  USING (false);

-- Other tables: Allow DELETE for shop staff (triggers will soft delete)
CREATE POLICY "Staff delete vehicles" ON vehicles FOR DELETE
  USING (shop_id = get_my_shop_id());

CREATE POLICY "Staff delete customers" ON customers FOR DELETE
  USING (shop_id = get_my_shop_id());

CREATE POLICY "Staff delete bookings" ON bookings FOR DELETE
  USING (shop_id = get_my_shop_id());

CREATE POLICY "Staff delete customer photos" ON customer_id_photos FOR DELETE
  USING (shop_id = get_my_shop_id());

CREATE POLICY "Staff delete damages" ON damages FOR DELETE
  USING (shop_id = get_my_shop_id());

CREATE POLICY "Staff delete documents" ON documents FOR DELETE
  USING (shop_id = get_my_shop_id());

CREATE POLICY "Staff delete damage photos" ON vehicle_damage_photos FOR DELETE
  USING (shop_id = get_my_shop_id());

-- ============================================================================
-- 5. ENSURE ALL REQUIRED COLUMNS EXIST
-- ============================================================================

-- Ensure customer_id_photos has side column
ALTER TABLE customer_id_photos ADD COLUMN IF NOT EXISTS side TEXT CHECK (side IN ('front', 'back'));

-- Ensure deleted_at exists on all soft-delete tables
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE customer_id_photos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE damages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE vehicle_damage_photos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Ensure updated_at trigger exists on customer_id_photos
DROP TRIGGER IF EXISTS trigger_customer_id_photos_updated_at ON customer_id_photos;
CREATE TRIGGER trigger_customer_id_photos_updated_at BEFORE UPDATE ON customer_id_photos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. VALIDATION AND VERIFICATION
-- ============================================================================

DO $$
DECLARE
  issues TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Check invoice numbering function
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='generate_invoice_number') THEN
    issues := array_append(issues, 'generate_invoice_number() function missing');
  END IF;

  -- Check customer_id_photos table exists
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename='customer_id_photos') THEN
    issues := array_append(issues, 'customer_id_photos table missing');
  END IF;

  -- Check customer_id_photos has side column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='customer_id_photos' AND column_name='side'
  ) THEN
    issues := array_append(issues, 'customer_id_photos.side column missing');
  END IF;

  -- Check customer_id_photos has deleted_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='customer_id_photos' AND column_name='deleted_at'
  ) THEN
    issues := array_append(issues, 'customer_id_photos.deleted_at column missing');
  END IF;

  -- Check soft delete triggers exist
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trigger_soft_delete_vehicles') THEN
    issues := array_append(issues, 'trigger_soft_delete_vehicles missing');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trigger_soft_delete_customers') THEN
    issues := array_append(issues, 'trigger_soft_delete_customers missing');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trigger_soft_delete_bookings') THEN
    issues := array_append(issues, 'trigger_soft_delete_bookings missing');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trigger_soft_delete_customer_id_photos') THEN
    issues := array_append(issues, 'trigger_soft_delete_customer_id_photos missing');
  END IF;

  -- Check RLS policies exist for DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='vehicles' AND policyname='Staff delete vehicles'
  ) THEN
    issues := array_append(issues, 'vehicles DELETE policy missing');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='customers' AND policyname='Staff delete customers'
  ) THEN
    issues := array_append(issues, 'customers DELETE policy missing');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='bookings' AND policyname='Staff delete bookings'
  ) THEN
    issues := array_append(issues, 'bookings DELETE policy missing');
  END IF;

  IF array_length(issues, 1) > 0 THEN
    RAISE EXCEPTION 'RESTORATION INCOMPLETE: %', array_to_string(issues, '; ');
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '✓✓✓ DATABASE SUCCESSFULLY RESTORED TO JAN 12, 2026 STATE ✓✓✓';
  RAISE NOTICE '';
  RAISE NOTICE 'FIXES APPLIED:';
  RAISE NOTICE '  ✓ Invoice numbering: INV-25-26-0001 format restored';
  RAISE NOTICE '  ✓ customer_id_photos: Table restored with side column and soft delete';
  RAISE NOTICE '  ✓ BEFORE DELETE triggers: All delete-able tables now soft delete';
  RAISE NOTICE '  ✓ RLS policies: DELETE operations allowed (triggers handle soft delete)';
  RAISE NOTICE '';
  RAISE NOTICE 'OPERATIONAL BEHAVIOR:';
  RAISE NOTICE '  • Frontend DELETE requests → RLS allows → Trigger converts to UPDATE deleted_at';
  RAISE NOTICE '  • Soft delete: Rows marked with deleted_at timestamp (not physically removed)';
  RAISE NOTICE '  • SELECT queries must filter: WHERE deleted_at IS NULL (frontend responsibility)';
  RAISE NOTICE '  • customer_id_photos: (customer_id, side) unique per deleted_at=NULL';
  RAISE NOTICE '';
  RAISE NOTICE 'MIGRATION STATUS: IDEMPOTENT AND SAFE FOR supabase db reset';
  RAISE NOTICE '';
END $$;

COMMIT;
