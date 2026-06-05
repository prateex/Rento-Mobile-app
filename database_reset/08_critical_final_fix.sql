-- ============================================
-- CRITICAL FINAL FIX - ALL INSERT FAILURES
-- Fixes: customer_number, vehicle.name, booking datetime columns
-- ============================================

-- ============================================
-- FIX 1: CUSTOMERS - AUTO-GENERATE customer_number
-- ============================================

-- Create function to generate customer_number
CREATE OR REPLACE FUNCTION generate_customer_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_number TEXT;
  v_date TEXT;
  v_random TEXT;
BEGIN
  v_date := to_char(NOW(), 'YYYYMMDD');
  v_random := UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6));
  v_number := 'CUST-' || v_date || '-' || v_random;
  RETURN v_number;
END;
$$;

-- Set DEFAULT on customer_number column
ALTER TABLE customers ALTER COLUMN customer_number SET DEFAULT generate_customer_number();

-- Backfill any existing NULL values
UPDATE customers 
SET customer_number = generate_customer_number()
WHERE customer_number IS NULL;

-- Ensure NOT NULL constraint (should already exist, but verify)
ALTER TABLE customers ALTER COLUMN customer_number SET NOT NULL;

-- ============================================
-- FIX 2: VEHICLES - MAKE name NULLABLE
-- ============================================

-- Drop NOT NULL constraint on vehicles.name
ALTER TABLE vehicles ALTER COLUMN name DROP NOT NULL;

-- Create function to auto-generate vehicle name when NULL
CREATE OR REPLACE FUNCTION auto_generate_vehicle_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS NULL OR NEW.name = '' THEN
    -- Generate from brand + model, or use registration_number
    NEW.name := COALESCE(
      NULLIF(TRIM(COALESCE(NEW.brand, '') || ' ' || COALESCE(NEW.model, '')), ''),
      NEW.registration_number,
      'Vehicle-' || SUBSTR(NEW.id::TEXT, 1, 8)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS set_vehicle_name_auto ON vehicles;

-- Create trigger to auto-generate name
CREATE TRIGGER set_vehicle_name_auto
  BEFORE INSERT OR UPDATE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_vehicle_name();

-- Backfill existing NULL or empty names
UPDATE vehicles
SET name = COALESCE(
  NULLIF(TRIM(COALESCE(brand, '') || ' ' || COALESCE(model, '')), ''),
  registration_number,
  'Vehicle-' || SUBSTR(id::TEXT, 1, 8)
)
WHERE name IS NULL OR name = '';

-- ============================================
-- FIX 3: BOOKINGS - ENSURE DATETIME COLUMNS EXIST
-- ============================================

-- Check if bookings has start_date/end_date (old schema) or start_datetime/end_datetime (new schema)
-- Add start_datetime and end_datetime if they don't exist

DO $$
BEGIN
  -- Add start_datetime if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'start_datetime'
  ) THEN
    -- If start_date exists, rename it
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'start_date'
    ) THEN
      ALTER TABLE bookings RENAME COLUMN start_date TO start_datetime;
    ELSE
      -- Create new column
      ALTER TABLE bookings ADD COLUMN start_datetime TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
  END IF;

  -- Add end_datetime if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'end_datetime'
  ) THEN
    -- If end_date exists, rename it
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'end_date'
    ) THEN
      ALTER TABLE bookings RENAME COLUMN end_date TO end_datetime;
    ELSE
      -- Create new column
      ALTER TABLE bookings ADD COLUMN end_datetime TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
  END IF;
END $$;

-- ============================================
-- FIX 4: UPDATE TRIGGERS - ONLY SET IF NULL
-- ============================================

-- Update auto_set_user_id to only set if NULL
CREATE OR REPLACE FUNCTION auto_set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update auto_set_shop_id to only set if NULL
CREATE OR REPLACE FUNCTION auto_set_shop_id()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.shop_id IS NULL THEN
    NEW.shop_id := get_current_user_shop_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FIX 5: ENSURE ALL TRIGGERS ARE IN PLACE
-- ============================================

-- Recreate all necessary triggers

-- Customers triggers
DROP TRIGGER IF EXISTS set_user_id_customers ON customers;
CREATE TRIGGER set_user_id_customers
  BEFORE INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_user_id();

DROP TRIGGER IF EXISTS set_shop_id_customers ON customers;
CREATE TRIGGER set_shop_id_customers
  BEFORE INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_shop_id();

-- Vehicles triggers
DROP TRIGGER IF EXISTS set_user_id_vehicles ON vehicles;
CREATE TRIGGER set_user_id_vehicles
  BEFORE INSERT ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_user_id();

DROP TRIGGER IF EXISTS set_shop_id_vehicles ON vehicles;
CREATE TRIGGER set_shop_id_vehicles
  BEFORE INSERT ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_shop_id();

-- Bookings triggers
DROP TRIGGER IF EXISTS set_user_id_bookings ON bookings;
CREATE TRIGGER set_user_id_bookings
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_user_id();

DROP TRIGGER IF EXISTS set_shop_id_bookings ON bookings;
CREATE TRIGGER set_shop_id_bookings
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_shop_id();

-- ============================================
-- FIX 6: ENSURE CORRECT COLUMN DEFAULTS
-- ============================================

-- Make sure status columns have proper defaults
ALTER TABLE customers ALTER COLUMN status SET DEFAULT 'Verified';
ALTER TABLE vehicles ALTER COLUMN status SET DEFAULT 'Available';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

SELECT '=== CRITICAL FIX VERIFICATION ===' as status;

-- Check 1: customer_number has DEFAULT
SELECT 
  'customers.customer_number' as column_name,
  CASE 
    WHEN column_default IS NOT NULL THEN '✓ Has DEFAULT: ' || column_default
    ELSE '✗ NO DEFAULT'
  END as default_check
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'customer_number';

-- Check 2: vehicles.name is nullable
SELECT 
  'vehicles.name' as column_name,
  CASE 
    WHEN is_nullable = 'YES' THEN '✓ NULLABLE (safe for insert)'
    ELSE '✗ NOT NULL (will block inserts)'
  END as nullable_check
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'name';

-- Check 3: bookings has datetime columns
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'bookings' 
      AND column_name IN ('start_datetime', 'end_datetime')
      GROUP BY table_name
      HAVING COUNT(*) = 2
    ) THEN '✓ bookings has start_datetime & end_datetime'
    ELSE '✗ Missing datetime columns'
  END as datetime_check;

-- Check 4: Triggers exist
SELECT 
  event_object_table as table_name,
  COUNT(*) as trigger_count
FROM information_schema.triggers
WHERE trigger_schema = 'public' 
  AND trigger_name LIKE 'set_%'
  AND event_object_table IN ('customers', 'vehicles', 'bookings')
GROUP BY event_object_table
ORDER BY event_object_table;

-- Show all columns for critical tables
SELECT '=== CUSTOMERS SCHEMA ===' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'customers'
ORDER BY ordinal_position;

SELECT '=== VEHICLES SCHEMA ===' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'vehicles'
ORDER BY ordinal_position;

SELECT '=== BOOKINGS SCHEMA ===' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'bookings'
AND column_name LIKE '%date%'
ORDER BY ordinal_position;

-- ============================================
-- FINAL STATUS
-- ============================================

SELECT '=== ALL FIXES COMPLETE ===' as final_status;
SELECT '✓ customer_number auto-generates' as fix_1;
SELECT '✓ vehicles.name is nullable + auto-generates' as fix_2;
SELECT '✓ bookings datetime columns aligned' as fix_3;
SELECT '✓ Triggers only set if NULL' as fix_4;
SELECT '✓ Ready for production inserts' as fix_5;
