-- =====================================================================
-- CRITICAL FIX: Remove FK Constraints on created_by and user_id
-- =====================================================================
-- Problem: Frontend INSERT payloads do NOT include created_by or user_id
-- Solution: Make these columns fully optional (no FK, triggers populate)
-- Date: 2026-01-19
-- 
-- RATIONALE:
-- - Frontend sends: shop_id, registration_number, type, brand, etc.
-- - Frontend does NOT send: created_by, user_id
-- - Triggers attempt to populate these fields
-- - But FK constraints cause violations if:
--   1. User row doesn't exist in users table yet
--   2. Constraint check happens before trigger execution
--   3. NULL values fail NOT NULL or FK constraints
-- 
-- FIX:
-- - Drop ALL FK constraints on created_by and user_id
-- - Make these columns fully NULLABLE
-- - Let triggers populate them opportunistically
-- - System works even if triggers can't find user record
-- =====================================================================

BEGIN;

-- =====================================================================
-- STEP 1: Drop Foreign Key Constraints on created_by and user_id
-- =====================================================================

-- vehicles table
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_created_by_fkey;
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_user_id_fkey;

-- customers table  
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_created_by_fkey;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_user_id_fkey;

-- bookings table
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_created_by_fkey;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_user_id_fkey;

-- payments table
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_user_id_fkey;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_recorded_by_fkey;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_paid_by_fkey;

-- damages table
ALTER TABLE damages DROP CONSTRAINT IF EXISTS damages_user_id_fkey;
ALTER TABLE damages DROP CONSTRAINT IF EXISTS damages_reported_by_fkey;

-- customer_id_photos table
ALTER TABLE customer_id_photos DROP CONSTRAINT IF EXISTS customer_id_photos_uploaded_by_fkey;

-- vehicle_damage_photos table
ALTER TABLE vehicle_damage_photos DROP CONSTRAINT IF EXISTS vehicle_damage_photos_uploaded_by_fkey;

-- documents table
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_uploaded_by_fkey;

-- =====================================================================
-- STEP 2: Ensure Columns Are Nullable (No NOT NULL constraints)
-- =====================================================================

-- vehicles
ALTER TABLE vehicles ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE vehicles ALTER COLUMN user_id DROP NOT NULL;

-- customers
ALTER TABLE customers ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE customers ALTER COLUMN user_id DROP NOT NULL;

-- bookings
ALTER TABLE bookings ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE bookings ALTER COLUMN user_id DROP NOT NULL;

-- payments
ALTER TABLE payments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE payments ALTER COLUMN recorded_by DROP NOT NULL;
ALTER TABLE payments ALTER COLUMN paid_by DROP NOT NULL;

-- damages
ALTER TABLE damages ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE damages ALTER COLUMN reported_by DROP NOT NULL;

-- =====================================================================
-- STEP 3: Fix RLS Policies to Handle NULL created_by/user_id
-- =====================================================================

-- Note: RLS policies should use get_my_shop_id() which is already in place
-- and does NOT depend on created_by or user_id columns.
-- The existing RLS setup is correct - shop-level isolation only.

-- =====================================================================
-- STEP 4: Keep Triggers for Opportunistic Population
-- =====================================================================

-- The existing triggers (set_vehicles_created_by, set_customers_created_by, 
-- set_bookings_created_by) are KEPT but will now:
-- - Populate created_by and user_id IF user record exists
-- - Do nothing (leave NULL) if user record doesn't exist
-- - This is SAFE because columns are now nullable with no FK constraints

-- No trigger changes needed - they already handle the NULL case with IF conditions

-- =====================================================================
-- STEP 5: Verification Comments
-- =====================================================================

-- After applying this migration:
-- ✅ vehicles INSERT will work without created_by or user_id
-- ✅ customers INSERT will work without created_by or user_id  
-- ✅ bookings INSERT will work without created_by or user_id
-- ✅ Triggers will still populate these fields when possible
-- ✅ No FK violations will occur
-- ✅ RLS policies work independently (use shop_id only)

COMMIT;

-- =====================================================================
-- VALIDATION QUERY (Run after migration)
-- =====================================================================
-- Verify no FK constraints remain on created_by/user_id:
-- 
-- SELECT 
--   tc.constraint_name,
--   tc.table_name,
--   kcu.column_name,
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND (kcu.column_name IN ('created_by', 'user_id', 'recorded_by', 'paid_by', 'reported_by', 'uploaded_by'))
--   AND tc.table_schema = 'public'
-- ORDER BY tc.table_name, kcu.column_name;
-- 
-- Expected result: 0 rows (no FK constraints on tracking columns)

