-- Create locations reference table for customer-facing pickup location lists
-- Single source of truth for available state/city/location combinations

BEGIN;

-- 1) Create locations table
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  location_name TEXT NOT NULL,
  location_address TEXT,
  latitude NUMERIC CHECK (latitude >= -90 AND latitude <= 90),
  longitude NUMERIC CHECK (longitude >= -180 AND longitude <= 180),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(state, city, location_name)
);

-- 2) Enable RLS on locations
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- 3) RLS Policy: Public read-only access (no insert/update/delete policies)
CREATE POLICY "locations_select_public" ON locations
  FOR SELECT
  USING (true);

-- 4) Create index for fast queries
CREATE INDEX IF NOT EXISTS idx_locations_state_city ON locations(state, city);
CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(is_active);

-- 5) Seed default location for Goa/Panaji
INSERT INTO locations (state, city, location_name, location_address, latitude, longitude, is_active)
VALUES ('Goa', 'Panaji', 'Panjim KTC Bus Stand', 'Panaji, Goa', 15.4909, 73.8278, true)
ON CONFLICT (state, city, location_name) DO NOTHING;

COMMIT;
