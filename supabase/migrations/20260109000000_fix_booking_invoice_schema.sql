-- Fix booking/invoice schema alignment and sequencing
-- Scope: local only, additive changes, no data deletion

BEGIN;

-- 1) Normalize booking_status enum values and map legacy statuses
DO $$
BEGIN
  -- add missing values if the type exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum WHERE enumtypid = 'booking_status'::regtype AND enumlabel = 'Active'
    ) THEN
      ALTER TYPE booking_status ADD VALUE 'Active';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum WHERE enumtypid = 'booking_status'::regtype AND enumlabel = 'Completed'
    ) THEN
      ALTER TYPE booking_status ADD VALUE 'Completed';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum WHERE enumtypid = 'booking_status'::regtype AND enumlabel = 'Cancelled'
    ) THEN
      ALTER TYPE booking_status ADD VALUE 'Cancelled';
    END IF;
  END IF;

  -- map legacy values into canonical ones
  UPDATE bookings SET status = 'Active'    WHERE status::text = 'Taken';
  UPDATE bookings SET status = 'Completed' WHERE status::text = 'Returned';
  UPDATE bookings SET status = 'Confirmed' WHERE status::text = 'Advance Paid';
END $$;

-- 2) Ensure sequences exist for booking and invoice numbers
CREATE SEQUENCE IF NOT EXISTS public.booking_number_seq START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1 INCREMENT 1;

-- 3) Columns required on bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_number TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invoice_generated_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invoice_id UUID;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notes TEXT;

-- drop legacy triggers to allow cleanup
DROP TRIGGER IF EXISTS bookings_set_booking_number ON bookings;
DROP TRIGGER IF EXISTS bookings_set_invoice_number ON bookings;
DROP TRIGGER IF EXISTS bookings_prevent_delete_if_invoiced ON bookings;

-- 4) Functions to generate sequential numbers (BK0001, INV0001)
CREATE OR REPLACE FUNCTION public.generate_booking_number()
RETURNS TEXT AS $$
DECLARE
  next_num INT;
BEGIN
  next_num := nextval('public.booking_number_seq');
  RETURN 'BK' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  next_num INT;
BEGIN
  next_num := nextval('public.invoice_number_seq');
  RETURN 'INV' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- 5) Trigger functions to assign numbers and prevent regeneration
CREATE OR REPLACE FUNCTION public.trigger_set_booking_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.booking_number IS NULL OR NEW.booking_number = '' THEN
    NEW.booking_number := public.generate_booking_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.trigger_set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  -- prevent overwriting once set
  IF TG_OP = 'UPDATE' AND OLD.invoice_number IS NOT NULL THEN
    IF NEW.invoice_number IS DISTINCT FROM OLD.invoice_number THEN
      RAISE EXCEPTION 'Invoice already exists for this booking; cannot regenerate number.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.invoice_number IS NULL AND COALESCE(NEW.invoice_pending, FALSE) = FALSE AND NEW.status = 'Completed' THEN
    NEW.invoice_number := public.generate_invoice_number();
    NEW.invoice_generated_at := COALESCE(NEW.invoice_generated_at, now());
  ELSIF NEW.invoice_number IS NOT NULL AND OLD.invoice_number IS NULL THEN
    NEW.invoice_generated_at := COALESCE(NEW.invoice_generated_at, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.trigger_prevent_delete_if_invoiced()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.invoice_number IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot delete booking with an invoice number.' USING ERRCODE = '23503';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 6) Backfill booking numbers and align sequences
DO $$
DECLARE
  max_num INT;
  rec RECORD;
BEGIN
  UPDATE bookings
    SET booking_number = public.generate_booking_number()
    WHERE booking_number IS NULL OR booking_number = '';

  -- reassign duplicates (keep first occurrence)
  FOR rec IN (
    SELECT id
    FROM (
      SELECT id, booking_number, ROW_NUMBER() OVER (PARTITION BY booking_number ORDER BY created_at, id) AS rn
      FROM bookings
      WHERE booking_number IS NOT NULL AND booking_number <> ''
    ) t
    WHERE t.rn > 1
  ) LOOP
    UPDATE bookings SET booking_number = public.generate_booking_number() WHERE id = rec.id;
  END LOOP;

  SELECT MAX(COALESCE(NULLIF(regexp_replace(booking_number, '[^0-9]', '', 'g'), '')::INT, 0)) INTO max_num FROM bookings;
  IF max_num IS NULL OR max_num = 0 THEN
    max_num := 1;
  END IF;
  PERFORM setval('public.booking_number_seq', max_num);
END $$;

-- 8) Backfill invoice numbers only where invoice data already exists
DO $$
DECLARE
  max_num INT;
  rec RECORD;
BEGIN
  -- normalize whitespace
  -- reset invoices to allow clean sequencing
  UPDATE bookings SET invoice_number = NULL;

  UPDATE bookings
    SET invoice_number = public.generate_invoice_number(),
        invoice_generated_at = COALESCE(invoice_generated_at, now())
    WHERE invoice_generated_at IS NOT NULL
       OR invoice_locked = TRUE
       OR (status = 'Completed' AND COALESCE(invoice_pending, FALSE) = FALSE);

  SELECT MAX(COALESCE(NULLIF(regexp_replace(invoice_number, '[^0-9]', '', 'g'), '')::INT, 0)) INTO max_num FROM bookings WHERE invoice_number IS NOT NULL;
  IF max_num IS NULL OR max_num = 0 THEN
    max_num := 1;
  END IF;
  PERFORM setval('public.invoice_number_seq', max_num);
END $$;

-- 9) Uniqueness constraints / indexes
CREATE UNIQUE INDEX IF NOT EXISTS bookings_booking_number_unique ON bookings(booking_number);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_invoice_number_unique ON bookings(invoice_number) WHERE invoice_number IS NOT NULL;
-- One invoice per booking: prevent multiple invoice rows by locking the booking id when invoice_number exists
CREATE UNIQUE INDEX IF NOT EXISTS bookings_invoice_guard_unique ON bookings(id) WHERE invoice_number IS NOT NULL;

-- 10) Ensure booking_number is required going forward
ALTER TABLE bookings ALTER COLUMN booking_number SET NOT NULL;

-- 11) Attach triggers after cleanup
DROP TRIGGER IF EXISTS bookings_set_booking_number ON bookings;
CREATE TRIGGER bookings_set_booking_number
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_booking_number();

DROP TRIGGER IF EXISTS bookings_set_invoice_number ON bookings;
CREATE TRIGGER bookings_set_invoice_number
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_invoice_number();

DROP TRIGGER IF EXISTS bookings_prevent_delete_if_invoiced ON bookings;
CREATE TRIGGER bookings_prevent_delete_if_invoiced
  BEFORE DELETE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_prevent_delete_if_invoiced();

COMMIT;
