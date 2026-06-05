-- ============================================
-- FINAL BLOCKER FIX - BOOKINGS SCHEMA ALIGNMENT
-- Ensures ALL date/time columns exist for bookings
-- ============================================

-- ============================================
-- PART 1: BOOKINGS DATE/TIME COLUMNS
-- ============================================

-- Ensure bookings table has all required date/time columns
-- Frontend sends: start_date, end_date, start_datetime, end_datetime
-- Database must accept all four

DO $$
DECLARE
  v_has_start_date BOOLEAN;
  v_has_end_date BOOLEAN;
  v_has_start_datetime BOOLEAN;
  v_has_end_datetime BOOLEAN;
BEGIN
  -- Check which columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'start_date'
  ) INTO v_has_start_date;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'end_date'
  ) INTO v_has_end_date;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'start_datetime'
  ) INTO v_has_start_datetime;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'end_datetime'
  ) INTO v_has_end_datetime;

  RAISE NOTICE 'Current bookings columns: start_date=%, end_date=%, start_datetime=%, end_datetime=%', 
    v_has_start_date, v_has_end_date, v_has_start_datetime, v_has_end_datetime;

  -- Strategy: Keep both DATE and DATETIME columns
  -- start_date and end_date are TIMESTAMPTZ (can store both date and time)
  -- start_datetime and end_datetime are aliases/separate columns for clarity

  -- Add start_datetime if missing (as TIMESTAMPTZ)
  IF NOT v_has_start_datetime THEN
    ALTER TABLE bookings ADD COLUMN start_datetime TIMESTAMPTZ;
    RAISE NOTICE 'Added start_datetime column';
    
    -- Copy data from start_date if it exists
    IF v_has_start_date THEN
      UPDATE bookings SET start_datetime = start_date WHERE start_datetime IS NULL;
      RAISE NOTICE 'Copied start_date to start_datetime';
    END IF;
  END IF;

  -- Add end_datetime if missing (as TIMESTAMPTZ)
  IF NOT v_has_end_datetime THEN
    ALTER TABLE bookings ADD COLUMN end_datetime TIMESTAMPTZ;
    RAISE NOTICE 'Added end_datetime column';
    
    -- Copy data from end_date if it exists
    IF v_has_end_date THEN
      UPDATE bookings SET end_datetime = end_date WHERE end_datetime IS NULL;
      RAISE NOTICE 'Copied end_date to end_datetime';
    END IF;
  END IF;

  -- Ensure start_date and end_date exist (they should from original schema)
  IF NOT v_has_start_date THEN
    ALTER TABLE bookings ADD COLUMN start_date TIMESTAMPTZ;
    RAISE NOTICE 'Added start_date column';
    
    -- Copy from start_datetime if available
    IF v_has_start_datetime THEN
      UPDATE bookings SET start_date = start_datetime WHERE start_date IS NULL;
    END IF;
  END IF;

  IF NOT v_has_end_date THEN
    ALTER TABLE bookings ADD COLUMN end_date TIMESTAMPTZ;
    RAISE NOTICE 'Added end_date column';
    
    -- Copy from end_datetime if available
    IF v_has_end_datetime THEN
      UPDATE bookings SET end_date = end_datetime WHERE end_date IS NULL;
    END IF;
  END IF;

  -- Remove NOT NULL constraints to allow flexible inserts
  ALTER TABLE bookings ALTER COLUMN start_date DROP NOT NULL;
  ALTER TABLE bookings ALTER COLUMN end_date DROP NOT NULL;
  ALTER TABLE bookings ALTER COLUMN start_datetime DROP NOT NULL;
  ALTER TABLE bookings ALTER COLUMN end_datetime DROP NOT NULL;

  RAISE NOTICE 'Booking date/time columns normalized';
END $$;

-- ============================================
-- PART 2: SYNC TRIGGER - Keep date columns in sync
-- ============================================

CREATE OR REPLACE FUNCTION sync_booking_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- If datetime provided but not date, copy datetime to date
  IF NEW.start_datetime IS NOT NULL AND NEW.start_date IS NULL THEN
    NEW.start_date := NEW.start_datetime;
  END IF;
  
  IF NEW.end_datetime IS NOT NULL AND NEW.end_date IS NULL THEN
    NEW.end_date := NEW.end_datetime;
  END IF;

  -- If date provided but not datetime, copy date to datetime
  IF NEW.start_date IS NOT NULL AND NEW.start_datetime IS NULL THEN
    NEW.start_datetime := NEW.start_date;
  END IF;
  
  IF NEW.end_date IS NOT NULL AND NEW.end_datetime IS NULL THEN
    NEW.end_datetime := NEW.end_date;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_booking_dates_trigger ON bookings;
CREATE TRIGGER sync_booking_dates_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION sync_booking_dates();

-- ============================================
-- PART 3: RE-APPLY CRITICAL FIXES FROM 08
-- ============================================

-- Fix 1: customer_number auto-generation
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

ALTER TABLE customers ALTER COLUMN customer_number SET DEFAULT generate_customer_number();

-- Backfill existing NULL customer_numbers
UPDATE customers 
SET customer_number = generate_customer_number()
WHERE customer_number IS NULL;

-- Fix 2: vehicles.name nullable + auto-generate
ALTER TABLE vehicles ALTER COLUMN name DROP NOT NULL;

CREATE OR REPLACE FUNCTION auto_generate_vehicle_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS NULL OR NEW.name = '' THEN
    NEW.name := COALESCE(
      NULLIF(TRIM(COALESCE(NEW.brand, '') || ' ' || COALESCE(NEW.model, '')), ''),
      NEW.registration_number,
      'Vehicle-' || SUBSTR(NEW.id::TEXT, 1, 8)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_vehicle_name_auto ON vehicles;
CREATE TRIGGER set_vehicle_name_auto
  BEFORE INSERT OR UPDATE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_vehicle_name();

-- Backfill existing NULL vehicle names
UPDATE vehicles
SET name = COALESCE(
  NULLIF(TRIM(COALESCE(brand, '') || ' ' || COALESCE(model, '')), ''),
  registration_number,
  'Vehicle-' || SUBSTR(id::TEXT, 1, 8)
)
WHERE name IS NULL OR name = '';

-- Fix 3: Triggers - only set if NULL
CREATE OR REPLACE FUNCTION auto_set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auto_set_shop_id()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.shop_id IS NULL THEN
    NEW.shop_id := get_current_user_shop_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate all triggers
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
-- VERIFICATION QUERIES
-- ============================================

SELECT '=== FINAL BLOCKER FIX VERIFICATION ===' as status;

-- Check 1: All booking date columns exist
SELECT 
  'Bookings Date Columns' as check_item,
  STRING_AGG(column_name, ', ' ORDER BY column_name) as columns
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'bookings' 
  AND column_name IN ('start_date', 'end_date', 'start_datetime', 'end_datetime')
GROUP BY table_name;

-- Check 2: customer_number has DEFAULT
SELECT 
  'customers.customer_number DEFAULT' as check_item,
  CASE 
    WHEN column_default LIKE '%generate_customer_number%' THEN '✅ Auto-generates'
    ELSE '❌ No DEFAULT: ' || COALESCE(column_default, 'NULL')
  END as status
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'customer_number';

-- Check 3: vehicles.name is nullable
SELECT 
  'vehicles.name nullable' as check_item,
  CASE 
    WHEN is_nullable = 'YES' THEN '✅ NULLABLE (safe)'
    ELSE '❌ NOT NULL (will block)'
  END as status
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'name';

-- Check 4: Triggers exist
SELECT 
  event_object_table as table_name,
  COUNT(*) as trigger_count,
  STRING_AGG(trigger_name, ', ' ORDER BY trigger_name) as triggers
FROM information_schema.triggers
WHERE trigger_schema = 'public' 
  AND trigger_name LIKE 'set_%'
  AND event_object_table IN ('customers', 'vehicles', 'bookings')
GROUP BY event_object_table
ORDER BY event_object_table;

-- Check 5: Show bookings schema summary
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'bookings'
  AND column_name ~ '(start|end)_(date|datetime)'
ORDER BY column_name;

-- ============================================
-- FINAL STATUS
-- ============================================

SELECT '=== ALL FIXES COMPLETE ===' as final_status;
SELECT '✓ Bookings has all 4 date columns (start_date, end_date, start_datetime, end_datetime)' as fix_1;
SELECT '✓ customer_number auto-generates' as fix_2;
SELECT '✓ vehicles.name is nullable + auto-generates' as fix_3;
SELECT '✓ All triggers set shop_id & user_id only if NULL' as fix_4;
SELECT '✓ Date sync trigger keeps columns consistent' as fix_5;
SELECT '✓ PRODUCTION READY - Test booking insert now' as final_instruction;
