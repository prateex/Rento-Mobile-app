-- ============================================
-- MIGRATION 012: BOOKINGS STATUS + AVAILABILITY FIXES
-- Align booking lifecycle + fix availability block schema
-- ============================================

-- 1) Normalize existing booking statuses
UPDATE bookings
SET status = 'requested'
WHERE status IN ('Pending', 'Booked');

UPDATE bookings
SET status = 'confirmed'
WHERE status IN ('Confirmed', 'Advance Paid');

UPDATE bookings
SET status = 'active'
WHERE status IN ('Taken', 'Active');

UPDATE bookings
SET status = 'completed'
WHERE status IN ('Returned', 'Completed');

UPDATE bookings
SET status = 'cancelled'
WHERE status IN ('Cancelled', 'Rejected');

-- 2) Normalize existing payment_status values
UPDATE bookings
SET payment_status = 'unpaid'
WHERE payment_status IN ('Unpaid', 'unpaid');

UPDATE bookings
SET payment_status = 'partial'
WHERE payment_status IN ('Partial', 'partial');

UPDATE bookings
SET payment_status = 'paid'
WHERE payment_status IN ('Paid', 'paid');

-- 3) Replace legacy status constraints
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'bookings'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  ) LOOP
    EXECUTE format('ALTER TABLE bookings DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE bookings
  ALTER COLUMN status SET DEFAULT 'requested';

ALTER TABLE bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('requested', 'confirmed', 'active', 'completed', 'cancelled', 'expired'));

ALTER TABLE bookings
  ALTER COLUMN payment_status SET DEFAULT 'unpaid';

ALTER TABLE bookings
  ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN ('paid', 'partial', 'unpaid'));

-- 3b) Update marketplace partial indexes to new status values
DROP INDEX IF EXISTS idx_bookings_vehicle_dates;
CREATE INDEX IF NOT EXISTS idx_bookings_vehicle_dates
  ON bookings(vehicle_id, start_date, end_date)
  WHERE is_online_booking = true AND status != 'cancelled' AND status != 'expired';

DROP INDEX IF EXISTS idx_bookings_location_dates;
CREATE INDEX IF NOT EXISTS idx_bookings_location_dates
  ON bookings(pickup_location_id, start_date, end_date)
  WHERE is_online_booking = true AND status IN ('confirmed', 'active');

-- 4) Availability blocks: add is_active and fix indexes
ALTER TABLE booking_availability_blocks
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

UPDATE booking_availability_blocks
SET is_active = true
WHERE is_active IS NULL;

DROP INDEX IF EXISTS idx_vehicle_availability_no_overlap;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_availability_no_overlap
  ON booking_availability_blocks(vehicle_id, tsrange(start_date, end_date))
  WHERE is_active = true;

-- 5) Update availability functions to respect is_active
CREATE OR REPLACE FUNCTION check_vehicle_available(
  p_vehicle_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  is_available BOOLEAN,
  blocking_booking_id UUID,
  block_start TIMESTAMPTZ,
  block_end TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) = 0 as is_available,
    COALESCE(booking_id, NULL::UUID),
    COALESCE(start_date, NULL::TIMESTAMPTZ),
    COALESCE(end_date, NULL::TIMESTAMPTZ)
  FROM booking_availability_blocks
  WHERE vehicle_id = p_vehicle_id
    AND is_active = true
    AND start_date < p_end_date
    AND end_date > p_start_date
  GROUP BY booking_id, start_date, end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog, public;

-- 6) Update booking trigger to clean up blocks on cancel/expire/complete
CREATE OR REPLACE FUNCTION create_availability_block_on_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_vehicle_id UUID;
BEGIN
  -- Only for online bookings
  IF NEW.is_online_booking != true THEN
    RETURN NEW;
  END IF;

  -- Create block when status becomes confirmed
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    v_vehicle_id := NEW.vehicle_id;
    v_owner_id := NEW.owner_id;

    IF v_vehicle_id IS NOT NULL AND v_owner_id IS NOT NULL THEN
      INSERT INTO booking_availability_blocks (
        vehicle_id,
        owner_id,
        start_date,
        end_date,
        booking_id,
        block_type,
        reason,
        created_by,
        is_active
      ) VALUES (
        v_vehicle_id,
        v_owner_id,
        NEW.start_date,
        NEW.end_date,
        NEW.id,
        'booking',
        'Online booking: ' || NEW.booking_number,
        COALESCE(NEW.customer_auth_id, auth.uid()),
        true
      );
    END IF;
  END IF;

  -- Remove blocks when booking is cancelled/expired/completed
  IF NEW.status IN ('cancelled', 'expired', 'completed')
     AND (OLD.status IS NULL OR OLD.status != NEW.status) THEN
    DELETE FROM booking_availability_blocks
    WHERE booking_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog, public;
