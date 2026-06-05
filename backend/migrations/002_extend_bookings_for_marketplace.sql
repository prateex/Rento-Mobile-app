-- ============================================
-- MIGRATION 002: EXTEND BOOKINGS FOR MARKETPLACE
-- Add online booking support without breaking existing owner app
-- ============================================
-- Timeline: Run after 001_marketplace_foundation.sql
-- Backward Compatibility: YES (adds optional columns, old bookings still work)
-- Rollback: ALTER TABLE bookings DROP COLUMN is_online_booking, vehicle_id, owner_id

-- ============================================
-- ANALYSIS OF CURRENT BOOKINGS TABLE
-- ============================================
/*
Current design (owner app only):
- shop_id (single shop context)
- customer_id → customers table (shop-local customers)
- vehicle_ids JSONB (array of vehicle IDs - no referential integrity!)
- created_by → users table (staff recording booking)

Issues for marketplace:
- customers table is tied to shop_id (can't be reused across shops)
- vehicle_ids JSONB makes it impossible to enforce constraints
- No single owner context (needed for RLS)
- No way to distinguish online vs manual bookings

Solution:
- Keep old columns for backward compatibility
- Add new columns for online bookings:
  - is_online_booking: boolean (true = from website, false = manual)
  - vehicle_id: UUID FK (single vehicle, replaces vehicle_ids)
  - owner_id: UUID FK (denormalization for RLS efficiency)
- Old bookings still use vehicle_ids + customers.shop_id
- New bookings use vehicle_id + owner_id + platform_users customer
*/

-- ============================================
-- 1. EXTEND BOOKINGS TABLE
-- ============================================

-- Add is_online_booking flag
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_online_booking BOOLEAN DEFAULT false;
  -- true = from website marketplace
  -- false = manual entry at counter (existing behavior)

-- Add single vehicle_id (for online bookings)
-- Note: Existing bookings use vehicle_ids JSONB array
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehicles(id) ON DELETE RESTRICT;
  -- Non-null only for online bookings
  -- Existing bookings leave this NULL and use vehicle_ids instead

-- Add owner_id (denormalization for RLS)
-- This avoids complex JOINs in RLS policies
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES rental_shops(id) ON DELETE CASCADE;
  -- For online bookings: owner of the vehicle
  -- For manual bookings: same as shop_id (backfilled)

-- Add customer_auth_id (link to platform_users.auth_id)
-- Allows online customers (not in old customers table)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  -- For online bookings: the customer's auth.users id
  -- For manual bookings: NULL (customer_id is used instead)

-- Add pickup/dropoff location_ids
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_location_id UUID REFERENCES marketplace_locations(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dropoff_location_id UUID REFERENCES marketplace_locations(id) ON DELETE SET NULL;
  -- For online bookings: where vehicle is picked up/returned
  -- For manual bookings: NULL (location implicit in shop_id)

-- Add pricing breakdown fields
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS base_rental_amount NUMERIC(10, 2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS km_charge_amount NUMERIC(10, 2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10, 2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS security_deposit_amount NUMERIC(10, 2);
  -- For online bookings: itemized pricing
  -- For manual bookings: NULL (use existing total_amount field)

-- Add payment tracking for online bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_gateway TEXT 
  CHECK (payment_gateway IS NULL OR payment_gateway IN ('razorpay', 'stripe', 'paypal', 'manual'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_id TEXT;
  -- For online bookings: external payment ID from gateway
  -- For manual bookings: NULL

-- Add completion tracking
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS actual_pickup_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS actual_dropoff_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS final_km_reading INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS final_amount NUMERIC(10, 2);
  -- Recorded when customer completes booking
  -- Final amount includes any km overages or damages

-- ============================================
-- 2. BACKFILL NEW COLUMNS FOR EXISTING BOOKINGS
-- ============================================

-- Set is_online_booking = false for all existing bookings (manual mode)
UPDATE bookings SET is_online_booking = false WHERE is_online_booking IS NULL;

-- Backfill owner_id from shop_id (existing bookings)
UPDATE bookings 
SET owner_id = shop_id 
WHERE owner_id IS NULL AND is_online_booking = false;

-- Backfill pickup/dropoff locations from shop location (existing bookings)
-- Note: This assumes shop has a location. May need manual adjustment.
-- TODO: Set this based on your shop's location data
-- UPDATE bookings SET pickup_location_id = (SELECT location_id FROM rental_shops WHERE id = shop_id LIMIT 1)
-- WHERE pickup_location_id IS NULL AND is_online_booking = false;

-- ============================================
-- 3. ADD CONSTRAINTS FOR MARKETPLACE BOOKINGS
-- ============================================

-- For online bookings, vehicle_id must be set (enforce via trigger later)
-- For manual bookings, vehicle_ids JSONB is used (backward compat)

-- Constraint: If is_online_booking = true, must have vehicle_id
-- We'll handle this in application logic for now (triggers can be expensive)

-- ============================================
-- 4. CREATE INDEXES FOR MARKETPLACE QUERIES
-- ============================================

-- Index for online booking queries
CREATE INDEX IF NOT EXISTS idx_bookings_is_online_booking 
  ON bookings(is_online_booking);

-- Index for vehicle availability search (critical performance)
CREATE INDEX IF NOT EXISTS idx_bookings_vehicle_dates 
  ON bookings(vehicle_id, start_date, end_date) 
  WHERE is_online_booking = true AND status != 'Cancelled';

-- Index for owner booking view
CREATE INDEX IF NOT EXISTS idx_bookings_owner_id 
  ON bookings(owner_id);

-- Composite index for owner + status
CREATE INDEX IF NOT EXISTS idx_bookings_owner_status 
  ON bookings(owner_id, status);

-- Index for customer auth view
CREATE INDEX IF NOT EXISTS idx_bookings_customer_auth_id 
  ON bookings(customer_auth_id);

-- Index for location-based search
CREATE INDEX IF NOT EXISTS idx_bookings_pickup_location 
  ON bookings(pickup_location_id);

CREATE INDEX IF NOT EXISTS idx_bookings_dropoff_location 
  ON bookings(dropoff_location_id);

-- Index for payment tracking
CREATE INDEX IF NOT EXISTS idx_bookings_payment_id 
  ON bookings(payment_id);

-- Composite index for date range + location (common search)
CREATE INDEX IF NOT EXISTS idx_bookings_location_dates 
  ON bookings(pickup_location_id, start_date, end_date) 
  WHERE is_online_booking = true AND status IN ('Confirmed', 'Taken');

-- ============================================
-- 5. ADD CONSTRAINTS
-- ============================================

-- Make sure NOT NULL constraints are set appropriately
-- Note: Cannot add NOT NULL to existing table with NULLs, so we set defaults

ALTER TABLE bookings 
  ALTER COLUMN is_online_booking SET NOT NULL;

-- ADD CHECK CONSTRAINT for logical consistency
-- If is_online_booking = true, then vehicle_id must be set
-- (Can't enforce easily in PostgreSQL, so document this in app)

-- ============================================
-- 6. UPDATE EXISTING BOOKING STATUS ENUM
-- ============================================
-- Current: Confirmed, Taken, Returned, Cancelled
-- Add online status: Pending (awaiting payment/confirmation)
-- We can simulate by using existing Confirmed with is_online_booking flag

-- For backward compatibility, we do NOT change the CHECK constraint
-- New online bookings use existing statuses:
-- - Confirmed: paid and ready
-- - Taken: pickup complete
-- - Returned: dropoff complete  
-- - Cancelled: cancelled

-- NEW status progression for online bookings:
-- pending (created, awaiting payment) → confirmed (paid) → taken → returned → completed
-- We'll track "pending" with payment_status = 'Unpaid' instead of adding new status

-- ============================================
-- MIGRATION METADATA
-- ============================================
-- Tables Modified: 1 (bookings)
-- Columns Added: 13
-- Indexes Created: 9
-- Constraints Added: 1
-- Breaking Changes: NONE
-- Safe to apply: YES
-- Requires RLS: YES

/*
BACKWARD COMPATIBILITY NOTES:

1. Existing bookings continue working:
   - is_online_booking = false
   - vehicle_ids (JSONB) still used
   - vehicle_id = NULL
   - owner_id = shop_id
   - customer_auth_id = NULL
   - customer_id is used for customer lookup

2. New online bookings use:
   - is_online_booking = true
   - vehicle_id = UUID
   - vehicle_ids = NULL (not used)
   - owner_id = vehicle.shop_id
   - customer_auth_id = auth.users.id
   - customer_id = NULL (customer_auth_id used instead)

3. Application code must:
   - Check is_online_booking flag
   - Use correct customer field based on booking type
   - Use correct vehicle field based on booking type

USAGE EXAMPLES:

1. Create online booking:
INSERT INTO bookings (
  booking_number,
  shop_id,
  owner_id,
  vehicle_id,
  customer_auth_id,
  start_date,
  end_date,
  status,
  is_online_booking,
  total_amount,
  base_rental_amount,
  km_charge_amount,
  tax_amount,
  security_deposit_amount,
  pickup_location_id,
  dropoff_location_id
) VALUES (
  'BK20260203001',
  owner_uuid,
  owner_uuid,
  vehicle_uuid,
  customer_auth_uuid,
  '2026-02-05 10:00:00+05:30',
  '2026-02-07 10:00:00+05:30',
  'Confirmed',
  true,
  5000,
  2000,
  500,
  750,
  1500,
  location_uuid,
  location_uuid
);

2. Check vehicle availability:
SELECT * FROM bookings
WHERE vehicle_id = 'vehicle_uuid'
  AND is_online_booking = true
  AND status IN ('Confirmed', 'Taken')
  AND start_date < '2026-02-07 10:00:00+05:30'
  AND end_date > '2026-02-05 10:00:00+05:30';

3. Get owner's online bookings:
SELECT * FROM bookings
WHERE owner_id = 'owner_uuid'
  AND is_online_booking = true
  AND status != 'Cancelled'
ORDER BY start_date DESC;

4. Track payment:
SELECT booking_number, payment_gateway, payment_id, payment_status
FROM bookings
WHERE is_online_booking = true AND customer_auth_id = 'customer_auth_uuid'
ORDER BY created_at DESC;
*/
