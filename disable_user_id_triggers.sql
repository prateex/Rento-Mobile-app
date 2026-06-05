-- ============================================
-- DISABLE user_id TRIGGERS
-- These triggers are blocking admin client updates
-- ============================================

-- Check existing triggers
SELECT 
  trigger_name, 
  event_object_table, 
  action_statement
FROM information_schema.triggers 
WHERE trigger_name LIKE '%user_id%';

-- Disable triggers that set user_id from auth context
DROP TRIGGER IF EXISTS trg_set_user_id_vehicles ON vehicles;
DROP TRIGGER IF EXISTS trg_set_user_id_customers ON customers;
DROP TRIGGER IF EXISTS trg_set_user_id_bookings ON bookings;
DROP TRIGGER IF EXISTS trg_set_user_id_payments ON payments;
DROP TRIGGER IF EXISTS trg_set_user_id_deposits ON deposits;
DROP TRIGGER IF EXISTS trg_set_user_id_damages ON damages;

-- Also drop the function if it exists
DROP FUNCTION IF EXISTS set_user_id_from_auth() CASCADE;

-- Verify triggers are gone
SELECT 
  trigger_name, 
  event_object_table
FROM information_schema.triggers 
WHERE trigger_name LIKE '%user_id%';
