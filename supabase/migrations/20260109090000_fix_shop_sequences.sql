-- Per-shop booking and invoice sequencing with fiscal-year invoice format
-- Safe, additive changes; no auth schema touched

BEGIN;

-- 1) Drop legacy global unique indexes (to allow per-shop scoping)
DROP INDEX IF EXISTS bookings_booking_number_unique;
DROP INDEX IF EXISTS bookings_invoice_number_unique;
DROP INDEX IF EXISTS bookings_invoice_guard_unique;

-- 2) Ensure required columns exist on bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_number TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invoice_generated_at TIMESTAMPTZ;

-- 3) Per-shop booking number counters
CREATE TABLE IF NOT EXISTS booking_number_counters (
  shop_id UUID PRIMARY KEY REFERENCES rental_shops(id) ON DELETE CASCADE,
  next_booking_number INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) Per-shop invoice number counters (per financial year)
CREATE TABLE IF NOT EXISTS invoice_number_counters (
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  financial_year TEXT NOT NULL,
  next_invoice_number INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, financial_year)
);

-- 5) Functions to compute financial year text (e.g., '25-26')
CREATE OR REPLACE FUNCTION public.fy_label(ts TIMESTAMPTZ)
RETURNS TEXT AS $$
DECLARE
  start_year INT;
BEGIN
  IF EXTRACT(MONTH FROM ts) < 4 THEN
    start_year := EXTRACT(YEAR FROM ts)::INT - 1;
  ELSE
    start_year := EXTRACT(YEAR FROM ts)::INT;
  END IF;
  RETURN to_char(start_year, 'YY') || '-' || to_char(start_year + 1, 'YY');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6) Generate booking number per shop (BK0001...)
CREATE OR REPLACE FUNCTION public.generate_booking_number(p_shop_id UUID)
RETURNS TEXT AS $$
DECLARE
  current_val INT;
BEGIN
  INSERT INTO booking_number_counters (shop_id, next_booking_number)
  VALUES (p_shop_id, 1)
  ON CONFLICT (shop_id) DO NOTHING;

  UPDATE booking_number_counters
  SET next_booking_number = next_booking_number + 1, updated_at = now()
  WHERE shop_id = p_shop_id
  RETURNING next_booking_number - 1 INTO current_val;

  RETURN 'BK' || LPAD(current_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- 7) Generate invoice number per shop and financial year (INV-25-26-0001)
CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_shop_id UUID, p_ts TIMESTAMPTZ DEFAULT now())
RETURNS TEXT AS $$
DECLARE
  fy TEXT;
  current_val INT;
BEGIN
  fy := fy_label(p_ts);

  INSERT INTO invoice_number_counters (shop_id, financial_year, next_invoice_number)
  VALUES (p_shop_id, fy, 1)
  ON CONFLICT (shop_id, financial_year) DO NOTHING;

  UPDATE invoice_number_counters
  SET next_invoice_number = next_invoice_number + 1, updated_at = now()
  WHERE shop_id = p_shop_id AND financial_year = fy
  RETURNING next_invoice_number - 1 INTO current_val;

  RETURN 'INV-' || fy || '-' || LPAD(current_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- 8) Triggers for booking_number and invoice_number
CREATE OR REPLACE FUNCTION public.trigger_set_booking_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.booking_number IS NULL OR NEW.booking_number = '' THEN
    NEW.booking_number := public.generate_booking_number(NEW.shop_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.trigger_set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.invoice_number IS NOT NULL AND NEW.invoice_number IS DISTINCT FROM OLD.invoice_number THEN
      RAISE EXCEPTION 'Invoice already exists for this booking; cannot regenerate number.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.invoice_number IS NULL AND NEW.shop_id IS NOT NULL AND NEW.status = 'Completed' AND COALESCE(NEW.invoice_pending, FALSE) = FALSE THEN
    NEW.invoice_number := public.generate_invoice_number(NEW.shop_id, COALESCE(NEW.invoice_generated_at, now()));
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

-- 9) Attach triggers (drop if exist to avoid duplicates)
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

-- 10) Normalize booking_status enum values
DO $$
BEGIN
  UPDATE bookings SET status = 'Active' WHERE status::text = 'Taken';
  UPDATE bookings SET status = 'Completed' WHERE status::text = 'Returned';
  UPDATE bookings SET status = 'Confirmed' WHERE status::text = 'Advance Paid';
END $$;

-- 11) Backfill booking_number per shop ordered by created_at
WITH ranked AS (
  SELECT id, shop_id, row_number() OVER (PARTITION BY shop_id ORDER BY COALESCE(created_at, now()), id) AS rn
  FROM bookings
)
UPDATE bookings b
SET booking_number = 'BK' || LPAD(r.rn::TEXT, 4, '0')
FROM ranked r
WHERE b.id = r.id;

-- 12) Backfill invoice_number per shop and FY ordered by invoice_generated_at/created_at
DO $$
DECLARE
  rec RECORD;
  new_number TEXT;
BEGIN
  FOR rec IN
    SELECT id, shop_id, COALESCE(invoice_generated_at, created_at, now()) AS ts
    FROM bookings
    WHERE invoice_number IS NULL AND status = 'Completed'
    ORDER BY ts, id
  LOOP
    new_number := public.generate_invoice_number(rec.shop_id, rec.ts);
    UPDATE bookings
    SET invoice_number = new_number,
      invoice_generated_at = COALESCE(invoice_generated_at, rec.ts)
    WHERE id = rec.id AND invoice_number IS NULL;
  END LOOP;
END $$;

-- 13) Sync counters to max+1
-- booking counters
INSERT INTO booking_number_counters (shop_id, next_booking_number)
SELECT DISTINCT shop_id, 1 FROM bookings
ON CONFLICT (shop_id) DO NOTHING;

UPDATE booking_number_counters c
SET next_booking_number = sub.mx + 1, updated_at = now()
FROM (
  SELECT shop_id, COALESCE(MAX(CAST(regexp_replace(booking_number, '[^0-9]', '', 'g') AS INT)), 0) AS mx
  FROM bookings
  GROUP BY shop_id
) sub
WHERE c.shop_id = sub.shop_id;

-- invoice counters
INSERT INTO invoice_number_counters (shop_id, financial_year, next_invoice_number)
SELECT DISTINCT shop_id, fy_label(COALESCE(invoice_generated_at, created_at, now())), 1 FROM bookings
WHERE invoice_number IS NOT NULL
ON CONFLICT (shop_id, financial_year) DO NOTHING;

UPDATE invoice_number_counters c
SET next_invoice_number = sub.mx + 1, updated_at = now()
FROM (
  SELECT shop_id, fy_label(COALESCE(invoice_generated_at, created_at, now())) AS fy,
         COALESCE(MAX(CAST(regexp_replace(invoice_number, '[^0-9]', '', 'g') AS INT)), 0) AS mx
  FROM bookings
  WHERE invoice_number IS NOT NULL
  GROUP BY shop_id, fy_label(COALESCE(invoice_generated_at, created_at, now()))
) sub
WHERE c.shop_id = sub.shop_id AND c.financial_year = sub.fy;

-- 14) Enforce uniqueness per shop
CREATE UNIQUE INDEX IF NOT EXISTS bookings_shop_booking_number_unique ON bookings(shop_id, booking_number);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_shop_invoice_number_unique ON bookings(shop_id, invoice_number) WHERE invoice_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bookings_invoice_guard_unique ON bookings(id) WHERE invoice_number IS NOT NULL;

COMMIT;
