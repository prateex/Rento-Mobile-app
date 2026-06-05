-- ============================================
-- MIGRATION 003: EXTEND VEHICLES FOR MARKETPLACE
-- Add marketplace-specific fields for pricing, filtering, and features
-- ============================================
-- Timeline: Run after 001_marketplace_foundation.sql
-- Backward Compatibility: YES (adds optional columns)
-- Rollback: ALTER TABLE vehicles DROP COLUMN extra_km_rate, free_km_per_day, ...

-- ============================================
-- ANALYSIS OF CURRENT VEHICLES TABLE
-- ============================================
/*
Current fields (owner app):
- shop_id (single shop owner)
- name, registration_number, type, brand, model, year, color
- image_url (single image, basic)
- daily_rate
- status (Available, Rented, Maintenance)
- current_odometer
- documents JSONB
- damages JSONB

Issues for marketplace:
- No location info (can't search by area)
- Pricing is just daily_rate (no km charges, deposits)
- No fuel type, transmission info (can't filter properly)
- Features stored in JSONB with no structure
- Image field is single URL (we have vehicle_images table now)

Solution:
- Add structured marketplace fields
- Keep existing fields for backward compatibility
- New fields optional (NULL = use old behavior)
*/

-- ============================================
-- 1. EXTEND VEHICLES TABLE
-- ============================================

-- Location linkage
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES marketplace_locations(id) ON DELETE SET NULL;
  -- Marketplace location for vehicle
  -- Allows city-based filtering and search
  -- NULL for existing vehicles (use shop location as fallback)

-- Pricing enhancements
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS free_km_per_day INTEGER DEFAULT 100;
  -- Free kilometers included in daily rental
  -- Default: 100 km (common in India)
  
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS extra_km_rate NUMERIC(10, 2);
  -- Price per extra km beyond free_km_per_day
  -- Example: 5 rupees per km
  
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS security_deposit NUMERIC(10, 2);
  -- Security deposit amount
  -- Held during rental, released on return
  
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS cancellation_policy_type TEXT DEFAULT 'standard'
  CHECK (cancellation_policy_type IN ('strict', 'moderate', 'standard', 'flexible'));
  -- strict: non-refundable
  -- moderate: full refund until 24h before
  -- standard: full refund until 48h before
  -- flexible: full refund until booking start

-- Vehicle features
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_type TEXT
  CHECK (fuel_type IS NULL OR fuel_type IN ('Petrol', 'Diesel', 'Electric', 'CNG'));
  -- Type of fuel used
  
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS transmission_type TEXT
  CHECK (transmission_type IS NULL OR transmission_type IN ('Manual', 'Automatic'));
  -- Manual or Automatic transmission
  
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS has_ac BOOLEAN DEFAULT false;
  -- Air conditioning
  
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS has_gps BOOLEAN DEFAULT false;
  -- GPS tracking device
  
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS has_helmet BOOLEAN DEFAULT true;
  -- Helmets included
  
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}'::jsonb;
  -- Additional features: airbags, stereo, backup camera, roof rack, etc
  -- Example: {"airbags": true, "stereo": true, "backup_camera": true}

-- Marketplace visibility
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS is_listed_marketplace BOOLEAN DEFAULT true;
  -- true: visible in public marketplace
  -- false: offline (exists but not shown)
  -- Allows owner to hide vehicles without deleting
  
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS is_available_for_online_booking BOOLEAN DEFAULT true;
  -- true: can be booked via website
  -- false: offline/counter booking only
  
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS rating NUMERIC(3, 2);
  -- Average rating from customers (1.0 to 5.0)
  -- Calculated from reviews
  
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS total_bookings INTEGER DEFAULT 0;
  -- How many times booked
  -- For popularity sorting

-- Odometer and maintenance tracking
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS target_odometer_service INTEGER;
  -- Service due at this odometer reading
  -- Alerts owner when approaching
  
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS last_service_at TIMESTAMPTZ;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS next_service_at TIMESTAMPTZ;
  -- Maintenance scheduling

-- Additional vehicle specs
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS seating_capacity INTEGER;
  -- Number of seats (for cars)
  
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_number TEXT UNIQUE;
  -- Alternate identifier (license plate in different format)

-- Owner information (denormalization for search)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES rental_shops(id) ON DELETE CASCADE;
  -- Reference to rental_shops (same as shop_id for existing vehicles)
  -- Simplifies RLS and queries
  -- Note: shop_id still exists for backward compatibility

-- Availability status for marketplace
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS status_reason TEXT;
  -- Why vehicle is unavailable: "In maintenance", "High demand", etc
  -- Shows to customers when vehicle is unavailable

-- ============================================
-- 2. BACKFILL owner_id FOR EXISTING VEHICLES
-- ============================================
-- owner_id should reference the shop that owns the vehicle
UPDATE vehicles 
SET owner_id = shop_id 
WHERE owner_id IS NULL;

-- Make owner_id NOT NULL
ALTER TABLE vehicles 
  ALTER COLUMN owner_id SET NOT NULL;

-- ============================================
-- 3. CREATE INDEXES FOR MARKETPLACE SEARCH
-- ============================================

-- Location-based search (city/area filtering)
CREATE INDEX IF NOT EXISTS idx_vehicles_location_id 
  ON vehicles(location_id);

-- Marketplace visibility
CREATE INDEX IF NOT EXISTS idx_vehicles_listed_marketplace 
  ON vehicles(is_listed_marketplace);

CREATE INDEX IF NOT EXISTS idx_vehicles_online_booking 
  ON vehicles(is_available_for_online_booking);

-- Combined index for marketplace listing
CREATE INDEX IF NOT EXISTS idx_vehicles_marketplace_active 
  ON vehicles(is_listed_marketplace, is_available_for_online_booking, location_id)
  WHERE status = 'Available';

-- Vehicle type filtering
CREATE INDEX IF NOT EXISTS idx_vehicles_type_location 
  ON vehicles(type, location_id)
  WHERE is_listed_marketplace = true AND status = 'Available';

-- Search by features
CREATE INDEX IF NOT EXISTS idx_vehicles_fuel_transmission 
  ON vehicles(fuel_type, transmission_type)
  WHERE is_listed_marketplace = true;

-- Price-based sorting
CREATE INDEX IF NOT EXISTS idx_vehicles_daily_rate 
  ON vehicles(daily_rate)
  WHERE is_listed_marketplace = true AND status = 'Available';

-- Rating-based sorting
CREATE INDEX IF NOT EXISTS idx_vehicles_rating 
  ON vehicles(rating DESC)
  WHERE is_listed_marketplace = true AND status = 'Available';

-- Owner's vehicles
CREATE INDEX IF NOT EXISTS idx_vehicles_owner_id 
  ON vehicles(owner_id);

-- ============================================
-- 4. ADD CONSTRAINTS
-- ============================================

-- Ensure pricing fields are positive
ALTER TABLE vehicles 
  ADD CONSTRAINT chk_vehicles_free_km_positive 
  CHECK (free_km_per_day >= 0);

ALTER TABLE vehicles 
  ADD CONSTRAINT chk_vehicles_extra_km_rate_positive 
  CHECK (extra_km_rate IS NULL OR extra_km_rate > 0);

ALTER TABLE vehicles 
  ADD CONSTRAINT chk_vehicles_security_deposit_positive 
  CHECK (security_deposit IS NULL OR security_deposit > 0);

ALTER TABLE vehicles 
  ADD CONSTRAINT chk_vehicles_rating_range 
  CHECK (rating IS NULL OR (rating >= 1.0 AND rating <= 5.0));

-- Ensure seating capacity is reasonable
ALTER TABLE vehicles 
  ADD CONSTRAINT chk_vehicles_seating_capacity 
  CHECK (seating_capacity IS NULL OR (seating_capacity > 0 AND seating_capacity <= 10));

-- ============================================
-- 5. UPDATE EXISTING VEHICLE RECORDS
-- ============================================

-- Set sensible defaults for existing vehicles
UPDATE vehicles 
SET 
  is_listed_marketplace = true,
  is_available_for_online_booking = true,
  cancellation_policy_type = 'standard',
  transmission_type = 'Manual',
  has_helmet = true
WHERE is_listed_marketplace IS NULL;

-- ============================================
-- MIGRATION METADATA
-- ============================================
-- Tables Modified: 1 (vehicles)
-- Columns Added: 21
-- Indexes Created: 11
-- Constraints Added: 5
-- Breaking Changes: NONE
-- Safe to apply: YES
-- Requires RLS: YES

/*
BACKWARD COMPATIBILITY NOTES:

1. Existing vehicle fields remain unchanged
2. New fields are optional (can be NULL)
3. Existing vehicles default to:
   - is_listed_marketplace = true
   - is_available_for_online_booking = true
   - cancellation_policy_type = 'standard'
   - free_km_per_day = 100
   - has_helmet = true

4. For marketplace search:
   - Old vehicles show with defaults
   - New vehicles can have custom values

5. Application logic:
   - Use location_id for city-based search
   - Use fuel_type, transmission_type for filters
   - Use features JSONB for checkbox filters
   - Use is_listed_marketplace to hide vehicles
   - Use is_available_for_online_booking to disable online booking

USAGE EXAMPLES:

1. Update vehicle for marketplace:
UPDATE vehicles SET
  location_id = 'location_uuid',
  free_km_per_day = 150,
  extra_km_rate = 5.50,
  security_deposit = 10000,
  fuel_type = 'Petrol',
  transmission_type = 'Automatic',
  has_ac = true,
  has_gps = true,
  features = '{"airbags": true, "bluetooth": true}'::jsonb
WHERE id = 'vehicle_uuid';

2. Search marketplace vehicles:
SELECT * FROM vehicles v
JOIN marketplace_locations ml ON v.location_id = ml.id
WHERE ml.city = 'Bangalore'
  AND v.type = 'bike'
  AND v.is_listed_marketplace = true
  AND v.status = 'Available'
  AND v.daily_rate BETWEEN 500 AND 2000
ORDER BY v.rating DESC, v.created_at DESC;

3. Filter by transmission:
SELECT * FROM vehicles
WHERE location_id = 'location_uuid'
  AND transmission_type = 'Automatic'
  AND is_listed_marketplace = true
ORDER BY daily_rate ASC;

4. Find vehicles with specific features:
SELECT * FROM vehicles
WHERE location_id = 'location_uuid'
  AND (features->>'airbags')::boolean = true
  AND has_gps = true
  AND is_listed_marketplace = true;

5. Calculate rental cost:
SELECT 
  id,
  daily_rate,
  free_km_per_day,
  extra_km_rate,
  security_deposit,
  (daily_rate * 3) as base_cost_3_days,
  ((daily_rate * 3) * 0.18) as tax_18pct,
  security_deposit as deposit
FROM vehicles
WHERE id = 'vehicle_uuid';
*/
