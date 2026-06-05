ALTER TABLE rental_shops
  ADD COLUMN IF NOT EXISTS pickup_latitude NUMERIC CHECK (pickup_latitude >= -90 AND pickup_latitude <= 90),
  ADD COLUMN IF NOT EXISTS pickup_longitude NUMERIC CHECK (pickup_longitude >= -180 AND pickup_longitude <= 180),
  ADD COLUMN IF NOT EXISTS pickup_address_text TEXT,
  ADD COLUMN IF NOT EXISTS pickup_city TEXT,
  ADD COLUMN IF NOT EXISTS pickup_pincode TEXT;
