-- Test the phone column exists and INSERT works
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'rental_shops'
  AND column_name = 'phone';

-- This query should now work without error:
-- INSERT INTO rental_shops (
--   owner_id,
--   name,
--   phone,
--   email,
--   address,
--   city,
--   state,
--   pincode,
--   gst_number
-- )
-- VALUES (
--   '00000000-0000-0000-0000-000000000000'::uuid,
--   'My Rental Shop',
--   '9876543210',
--   'shop@myrental.com',
--   '123 Main St',
--   'New York',
--   'NY',
--   '10001',
--   'GST123'
-- )
-- RETURNING id AS shop_id;
