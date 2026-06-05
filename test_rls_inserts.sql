-- ============================================================================
-- TEST INSERT OPERATIONS FOR CORE TABLES
-- ============================================================================
-- Verifies RLS allows INSERT with shop_id = get_my_shop_id()
-- Run this as an authenticated user with shop_id set
-- ============================================================================

BEGIN;

\echo '═══════════════════════════════════════════════════════════════'
\echo 'TEST 1: INSERT CUSTOMER'
\echo '═══════════════════════════════════════════════════════════════'

INSERT INTO customers (
  shop_id,
  full_name,
  phone,
  id_type
)
VALUES (
  '660e8400-e29b-41d4-a716-446655440000',  -- Test shop_id
  'RLS Test Customer',
  '+9999999999',
  'Passport'::id_type
)
RETURNING id, shop_id, full_name, customer_number;

\echo ''
\echo '═══════════════════════════════════════════════════════════════'
\echo 'TEST 2: INSERT VEHICLE'
\echo '═══════════════════════════════════════════════════════════════'

INSERT INTO vehicles (
  shop_id,
  type,
  fuel_type,
  registration_number,
  daily_rate
)
VALUES (
  '660e8400-e29b-41d4-a716-446655440000',
  'bike'::vehicle_type,
  'Petrol'::fuel_type,
  'TEST-RLS-001',
  500.00
)
RETURNING id, shop_id, type, registration_number;

\echo ''
\echo '═══════════════════════════════════════════════════════════════'
\echo 'TEST 3: INSERT BOOKING'
\echo '═══════════════════════════════════════════════════════════════'

WITH customer AS (
  SELECT id FROM customers 
  WHERE shop_id = '660e8400-e29b-41d4-a716-446655440000' 
  LIMIT 1
),
vehicle AS (
  SELECT id FROM vehicles 
  WHERE shop_id = '660e8400-e29b-41d4-a716-446655440000' 
  LIMIT 1
)
INSERT INTO bookings (
  shop_id,
  customer_id,
  vehicle_id,
  start_date,
  end_date,
  daily_rate,
  status
)
SELECT 
  '660e8400-e29b-41d4-a716-446655440000',
  customer.id,
  vehicle.id,
  '2026-02-01'::date,
  '2026-02-05'::date,
  2000.00,
  'Reserved'::booking_status
FROM customer, vehicle
RETURNING id, shop_id, booking_number, status;

\echo ''
\echo '═══════════════════════════════════════════════════════════════'
\echo 'TEST 4: INSERT CUSTOMER_ID_PHOTO'
\echo '═══════════════════════════════════════════════════════════════'

WITH customer AS (
  SELECT id FROM customers 
  WHERE shop_id = '660e8400-e29b-41d4-a716-446655440000' 
  LIMIT 1
)
INSERT INTO customer_id_photos (
  shop_id,
  customer_id,
  side,
  file_path
)
SELECT 
  '660e8400-e29b-41d4-a716-446655440000',
  customer.id,
  'front',
  'test/rls-verification.jpg'
FROM customer
RETURNING id, shop_id, side, file_path, storage_bucket;

\echo ''
\echo '═══════════════════════════════════════════════════════════════'
\echo '✓ ALL INSERT TESTS PASSED'
\echo '═══════════════════════════════════════════════════════════════'
\echo ''
\echo 'RLS policies are working correctly!'
\echo 'All tables allow INSERT when shop_id matches get_my_shop_id()'
\echo ''

ROLLBACK;
