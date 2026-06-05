INSERT INTO rental_shops (
  owner_id,
  name,
  phone,
  email,
  address,
  city,
  state,
  pincode,
  gst_number
)
VALUES (
  '1504daa7-d004-424d-b4f8-22a82b05c8c2'::uuid,  -- Placeholder owner_id (will be updated in step 2)
  'My Rental Shop',                              -- Change this to your shop name
  '9876543210',                                  -- Change to phone
  'shop@myrental.com',                           -- Change to email
  '123 Main St',                                 -- Change to address
  'New York',                                    -- Change to city
  'NY',                                          -- Change to state
  '10001',                                       -- Change to pincode
  'GST123'                                       -- Change to GST number
)
RETURNING id AS shop_id;
