-- Fix RLS policies for customers/vehicles/rental_shops and add missing shop columns

BEGIN;

-- Ensure rental_shops has required columns
ALTER TABLE rental_shops
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS pickup_location_name TEXT,
ADD COLUMN IF NOT EXISTS pickup_address TEXT,
ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC,
ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC,
ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;

-- Ensure RLS is enabled
ALTER TABLE rental_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on rental_shops
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'rental_shops'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON rental_shops', policy_record.policyname);
  END LOOP;
END $$;

-- Drop existing policies on customers
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

-- Drop existing policies on vehicles
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

-- rental_shops policies
CREATE POLICY "rental_shops_select_own" ON rental_shops
  FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "rental_shops_insert_owner" ON rental_shops
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "rental_shops_update_owner" ON rental_shops
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- customers policies
CREATE POLICY "customers_select_own_shop" ON customers
  FOR SELECT
  USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "customers_insert_own_shop" ON customers
  FOR INSERT
  WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "customers_update_own_shop" ON customers
  FOR UPDATE
  USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "customers_delete_own_shop" ON customers
  FOR DELETE
  USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));

-- vehicles policies
CREATE POLICY "vehicles_select_own_shop" ON vehicles
  FOR SELECT
  USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "vehicles_insert_own_shop" ON vehicles
  FOR INSERT
  WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "vehicles_update_own_shop" ON vehicles
  FOR UPDATE
  USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "vehicles_delete_own_shop" ON vehicles
  FOR DELETE
  USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));

COMMIT;
