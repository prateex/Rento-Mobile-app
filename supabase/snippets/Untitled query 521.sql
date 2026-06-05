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
  '76b61ddc-9a37-443e-b391-5695f5a86d40'::uuid,  -- Placeholder owner_id (will be updated in step 2)
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