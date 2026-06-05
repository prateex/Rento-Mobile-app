-- Add pickup location fields to rental_shops
-- Purpose: Store standardized state, city, and pickup location with coordinates

BEGIN;

-- 1) Add new columns to rental_shops
ALTER TABLE rental_shops 
ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'Goa',
ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT 'Panaji',
ADD COLUMN IF NOT EXISTS pickup_location_name TEXT NOT NULL DEFAULT 'Panjim KTC Bus Stand',
ADD COLUMN IF NOT EXISTS pickup_address TEXT,
ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC CHECK (pickup_lat >= -90 AND pickup_lat <= 90),
ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC CHECK (pickup_lng >= -180 AND pickup_lng <= 180);

-- 2) Backfill existing records with default values
UPDATE rental_shops 
SET 
  state = COALESCE(state, 'Goa'),
  city = COALESCE(city, 'Panaji'),
  pickup_location_name = COALESCE(pickup_location_name, 'Panjim KTC Bus Stand'),
  pickup_address = COALESCE(pickup_address, address)
WHERE state IS NULL OR city IS NULL;

-- 3) Set Panaji coordinates
UPDATE rental_shops
SET 
  pickup_lat = 15.4909,
  pickup_lng = 73.8278
WHERE pickup_lat IS NULL OR pickup_lng IS NULL;

-- 4) Create index for location queries
CREATE INDEX IF NOT EXISTS idx_rental_shops_state_city 
ON rental_shops(state, city);

COMMIT;
