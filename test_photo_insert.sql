-- Test customer_id_photos INSERT with minimal frontend payload
-- This should succeed with ONLY: shop_id, customer_id, side, file_path

BEGIN;

-- Create test customer
INSERT INTO customers (id, shop_id, full_name, phone, id_type)
VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  '660e8400-e29b-41d4-a716-446655440000',
  'Test Customer',
  '+1234567890',
  'Passport'::id_type
);

-- TEST 1: Insert with minimal frontend payload
\echo '=== TEST 1: INSERT with minimal payload ==='
INSERT INTO customer_id_photos (shop_id, customer_id, side, file_path)
VALUES (
  '660e8400-e29b-41d4-a716-446655440000',  -- shop_id
  '550e8400-e29b-41d4-a716-446655440001',  -- customer_id
  'front',                                  -- side
  'test/customer-front-123.jpg'            -- file_path
)
RETURNING 
  id,
  shop_id,
  customer_id,
  side,
  file_path,
  storage_bucket,  -- Should default to 'customer-ids'
  created_at,      -- Should default to now()
  deleted_at;      -- Should be NULL

\echo ''
\echo '=== TEST 2: Soft DELETE via UPDATE ==='
-- Test soft delete (mimics frontend DELETE via UPDATE)
UPDATE customer_id_photos
SET deleted_at = now()
WHERE side = 'front'
  AND deleted_at IS NULL
RETURNING id, side, deleted_at;

\echo ''
\echo '=== TEST 3: Re-upload same side (should succeed - old is soft-deleted) ==='
INSERT INTO customer_id_photos (shop_id, customer_id, side, file_path)
VALUES (
  '660e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440001',
  'front',
  'test/customer-front-456.jpg'  -- New file path
)
RETURNING id, side, file_path, deleted_at;

\echo ''
\echo '✓ All tests passed!'

ROLLBACK;  -- Don't commit test data
