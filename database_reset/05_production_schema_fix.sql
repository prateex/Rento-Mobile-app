-- ============================================
-- PRODUCTION SCHEMA FIX
-- Adds all missing columns to match frontend expectations
-- Idempotent - safe to run multiple times
-- ============================================

-- ============================================
-- FIX 1: RENTAL_SHOPS - ADD OWNER_ID
-- ============================================

-- Add owner_id column if missing
ALTER TABLE shops ADD COLUMN IF NOT EXISTS owner_id UUID;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'shops_owner_id_fkey'
  ) THEN
    ALTER TABLE shops 
    ADD CONSTRAINT shops_owner_id_fkey 
    FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create view for backward compatibility with old table name
DROP VIEW IF EXISTS rental_shops CASCADE;
CREATE VIEW rental_shops AS
SELECT 
  id,
  owner_id,
  name,
  phone,
  email,
  address,
  gst_number,
  created_at,
  updated_at
FROM shops;

-- ============================================
-- FIX 2: CUSTOMERS - ADD MISSING COLUMNS
-- ============================================

-- Add customer_number (UNIQUE, NOT NULL with default)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_number TEXT UNIQUE;

-- Generate customer_number for existing rows if null
UPDATE customers 
SET customer_number = 'CUST-' || SUBSTR(id::text, 1, 8) || '-' || to_char(created_at, 'YYYYMMDD')
WHERE customer_number IS NULL;

-- Now make it NOT NULL
ALTER TABLE customers ALTER COLUMN customer_number SET NOT NULL;

-- Add full_name if missing
ALTER TABLE customers ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Copy name to full_name if null
UPDATE customers SET full_name = name WHERE full_name IS NULL AND name IS NOT NULL;

-- Add user_id if missing
ALTER TABLE customers ADD COLUMN IF NOT EXISTS user_id UUID;

-- Backfill user_id (assume shop owner)
UPDATE customers 
SET user_id = (
  SELECT u.auth_id 
  FROM users u 
  WHERE u.shop_id = customers.shop_id 
  AND u.role = 'owner'
  LIMIT 1
)
WHERE user_id IS NULL;

-- Add missing columns with proper types
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS id_type TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS id_photos JSONB DEFAULT '[]';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Verified';

-- Update status column default
ALTER TABLE customers ALTER COLUMN status SET DEFAULT 'Verified';

-- Create indexes on customer_number
CREATE INDEX IF NOT EXISTS idx_customers_customer_number ON customers(customer_number);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);

-- ============================================
-- FIX 3: VEHICLES - ADD/VERIFY COLUMNS
-- ============================================

-- Add missing columns
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_odometer INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS damages JSONB DEFAULT '[]';

-- Create index on registration_number
CREATE INDEX IF NOT EXISTS idx_vehicles_registration_number ON vehicles(registration_number);

-- ============================================
-- FIX 4: USERS - VERIFY STRUCTURE
-- ============================================

-- Add missing columns if needed
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

-- ============================================
-- FIX 5: UPDATE RENTAL_SHOPS DATA
-- ============================================

-- Link shops to users (owner_id = owner's auth_id)
UPDATE shops s
SET owner_id = u.auth_id
FROM users u
WHERE s.id = u.shop_id 
  AND u.role = 'owner'
  AND s.owner_id IS NULL;

-- ============================================
-- FIX 6: RLS POLICIES - ENSURE THEY WORK
-- ============================================

-- Enable RLS on all tables
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE damages ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Drop and recreate helper function to avoid recursion
DROP FUNCTION IF EXISTS get_current_user_shop_id() CASCADE;
DROP FUNCTION IF EXISTS is_current_user_owner() CASCADE;

-- Helper: Get current user's shop ID
CREATE OR REPLACE FUNCTION get_current_user_shop_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_shop_id UUID;
BEGIN
  SELECT shop_id INTO v_shop_id
  FROM users
  WHERE auth_id = auth.uid()
  LIMIT 1;
  
  RETURN v_shop_id;
END;
$$;

-- Helper: Check if owner
CREATE OR REPLACE FUNCTION is_current_user_owner()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_is_owner BOOLEAN;
BEGIN
  SELECT (role = 'owner') INTO v_is_owner
  FROM users
  WHERE auth_id = auth.uid()
  LIMIT 1;
  
  RETURN COALESCE(v_is_owner, false);
END;
$$;

-- Drop existing policies to replace them
DROP POLICY IF EXISTS shops_select_own ON shops;
DROP POLICY IF EXISTS shops_update_own ON shops;
DROP POLICY IF EXISTS users_select_own_or_same_shop ON users;
DROP POLICY IF EXISTS users_insert_owner_only ON users;
DROP POLICY IF EXISTS users_update_owner_only ON users;
DROP POLICY IF EXISTS users_delete_owner_only ON users;
DROP POLICY IF EXISTS customers_select_own_shop ON customers;
DROP POLICY IF EXISTS customers_insert_own_shop ON customers;
DROP POLICY IF EXISTS customers_update_own_shop ON customers;
DROP POLICY IF EXISTS customers_delete_owner_only ON customers;
DROP POLICY IF EXISTS vehicles_select_own_shop ON vehicles;
DROP POLICY IF EXISTS vehicles_insert_own_shop ON vehicles;
DROP POLICY IF EXISTS vehicles_update_own_shop ON vehicles;
DROP POLICY IF EXISTS vehicles_delete_owner_only ON vehicles;
DROP POLICY IF EXISTS bookings_select_own_shop ON bookings;
DROP POLICY IF EXISTS bookings_insert_own_shop ON bookings;
DROP POLICY IF EXISTS bookings_update_own_shop ON bookings;
DROP POLICY IF EXISTS bookings_delete_owner_only ON bookings;
DROP POLICY IF EXISTS payments_select_own_shop ON payments;
DROP POLICY IF EXISTS payments_insert_own_shop ON payments;
DROP POLICY IF EXISTS payments_update_own_shop ON payments;
DROP POLICY IF EXISTS payments_delete_owner_only ON payments;
DROP POLICY IF EXISTS damages_select_own_shop ON damages;
DROP POLICY IF EXISTS damages_insert_own_shop ON damages;
DROP POLICY IF EXISTS damages_update_own_shop ON damages;
DROP POLICY IF EXISTS damages_delete_owner_only ON damages;
DROP POLICY IF EXISTS documents_select_own_shop ON documents;
DROP POLICY IF EXISTS documents_insert_own_shop ON documents;
DROP POLICY IF EXISTS documents_update_own_shop ON documents;
DROP POLICY IF EXISTS documents_delete_own_shop ON documents;

-- ============================================
-- SHOPS POLICIES
-- ============================================
CREATE POLICY shops_select_own 
  ON shops FOR SELECT 
  USING (id = get_current_user_shop_id());

CREATE POLICY shops_update_own 
  ON shops FOR UPDATE 
  USING (id = get_current_user_shop_id());

-- ============================================
-- USERS POLICIES
-- ============================================
CREATE POLICY users_select_own_or_same_shop 
  ON users FOR SELECT 
  USING (
    auth_id = auth.uid() 
    OR shop_id = get_current_user_shop_id()
  );

CREATE POLICY users_insert_owner_only 
  ON users FOR INSERT 
  WITH CHECK (
    is_current_user_owner() 
    AND shop_id = get_current_user_shop_id()
  );

CREATE POLICY users_update_owner_only 
  ON users FOR UPDATE 
  USING (
    is_current_user_owner() 
    AND shop_id = get_current_user_shop_id()
  );

CREATE POLICY users_delete_owner_only 
  ON users FOR DELETE 
  USING (
    is_current_user_owner() 
    AND shop_id = get_current_user_shop_id()
  );

-- ============================================
-- CUSTOMERS POLICIES
-- ============================================
CREATE POLICY customers_select_own_shop 
  ON customers FOR SELECT 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY customers_insert_own_shop 
  ON customers FOR INSERT 
  WITH CHECK (shop_id = get_current_user_shop_id());

CREATE POLICY customers_update_own_shop 
  ON customers FOR UPDATE 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY customers_delete_owner_only 
  ON customers FOR DELETE 
  USING (
    shop_id = get_current_user_shop_id() 
    AND is_current_user_owner()
  );

-- ============================================
-- VEHICLES POLICIES
-- ============================================
CREATE POLICY vehicles_select_own_shop 
  ON vehicles FOR SELECT 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY vehicles_insert_own_shop 
  ON vehicles FOR INSERT 
  WITH CHECK (shop_id = get_current_user_shop_id());

CREATE POLICY vehicles_update_own_shop 
  ON vehicles FOR UPDATE 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY vehicles_delete_owner_only 
  ON vehicles FOR DELETE 
  USING (
    shop_id = get_current_user_shop_id() 
    AND is_current_user_owner()
  );

-- ============================================
-- BOOKINGS POLICIES
-- ============================================
CREATE POLICY bookings_select_own_shop 
  ON bookings FOR SELECT 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY bookings_insert_own_shop 
  ON bookings FOR INSERT 
  WITH CHECK (shop_id = get_current_user_shop_id());

CREATE POLICY bookings_update_own_shop 
  ON bookings FOR UPDATE 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY bookings_delete_owner_only 
  ON bookings FOR DELETE 
  USING (
    shop_id = get_current_user_shop_id() 
    AND is_current_user_owner()
  );

-- ============================================
-- PAYMENTS POLICIES
-- ============================================
CREATE POLICY payments_select_own_shop 
  ON payments FOR SELECT 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY payments_insert_own_shop 
  ON payments FOR INSERT 
  WITH CHECK (shop_id = get_current_user_shop_id());

CREATE POLICY payments_update_own_shop 
  ON payments FOR UPDATE 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY payments_delete_owner_only 
  ON payments FOR DELETE 
  USING (
    shop_id = get_current_user_shop_id() 
    AND is_current_user_owner()
  );

-- ============================================
-- DAMAGES POLICIES
-- ============================================
CREATE POLICY damages_select_own_shop 
  ON damages FOR SELECT 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY damages_insert_own_shop 
  ON damages FOR INSERT 
  WITH CHECK (shop_id = get_current_user_shop_id());

CREATE POLICY damages_update_own_shop 
  ON damages FOR UPDATE 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY damages_delete_owner_only 
  ON damages FOR DELETE 
  USING (
    shop_id = get_current_user_shop_id() 
    AND is_current_user_owner()
  );

-- ============================================
-- DOCUMENTS POLICIES
-- ============================================
CREATE POLICY documents_select_own_shop 
  ON documents FOR SELECT 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY documents_insert_own_shop 
  ON documents FOR INSERT 
  WITH CHECK (shop_id = get_current_user_shop_id());

CREATE POLICY documents_update_own_shop 
  ON documents FOR UPDATE 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY documents_delete_own_shop 
  ON documents FOR DELETE 
  USING (shop_id = get_current_user_shop_id());

-- ============================================
-- FINAL VERIFICATION
-- ============================================

-- Verify all columns exist
SELECT 'SCHEMA FIX COMPLETE' as status;

-- Show customers columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'customers'
ORDER BY ordinal_position;

-- Show vehicles columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'vehicles'
ORDER BY ordinal_position;

-- Show shops columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'shops'
ORDER BY ordinal_position;

-- Show RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('shops', 'users', 'customers', 'vehicles', 'bookings', 'payments', 'damages', 'documents')
ORDER BY tablename;

-- Show all policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;
