-- Fix invoice number format: INV/2025-26/0001
-- The issue: to_char pattern 'YY' must be properly quoted

BEGIN;

-- 1) Drop and recreate fy_label function with correct format
CREATE OR REPLACE FUNCTION public.fy_label(ts TIMESTAMPTZ)
RETURNS TEXT AS $$
DECLARE
  start_year INT;
  next_year INT;
BEGIN
  IF EXTRACT(MONTH FROM ts) < 4 THEN
    start_year := EXTRACT(YEAR FROM ts)::INT - 1;
  ELSE
    start_year := EXTRACT(YEAR FROM ts)::INT;
  END IF;
  next_year := start_year + 1;
  
  -- Return format: 2025-26
  RETURN start_year::TEXT || '-' || SUBSTRING(next_year::TEXT, 3, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2) Update generate_invoice_number to use correct format: INV/2025-26/0001
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

  -- Use forward slash format: INV/2025-26/0001
  RETURN 'INV/' || fy || '/' || LPAD(current_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- 3) Temporarily disable invoice trigger to allow cleanup
DROP TRIGGER IF EXISTS bookings_set_invoice_number ON bookings;

-- 4) Clear old invalid invoice numbers and reset
UPDATE bookings SET invoice_number = NULL, invoice_generated_at = NULL, invoice_pending = TRUE
WHERE invoice_number IS NOT NULL;

-- 5) Re-enable the trigger
CREATE TRIGGER bookings_set_invoice_number
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_invoice_number();

-- 6) Clear and reset invoice counters
TRUNCATE invoice_number_counters;

-- 7) Regenerate invoice numbers for completed bookings
DO $$
DECLARE
  rec RECORD;
  new_number TEXT;
BEGIN
  FOR rec IN
    SELECT id, shop_id, COALESCE(returned_at, created_at, now()) AS ts
    FROM bookings
    WHERE status = 'Completed'
    ORDER BY ts, id
  LOOP
    new_number := public.generate_invoice_number(rec.shop_id, rec.ts);
    UPDATE bookings
    SET invoice_number = new_number,
        invoice_generated_at = rec.ts,
        invoice_pending = FALSE
    WHERE id = rec.id;
  END LOOP;
END $$;

-- 8) Sync invoice counters to max+1
INSERT INTO invoice_number_counters (shop_id, financial_year, next_invoice_number)
SELECT DISTINCT shop_id, fy_label(COALESCE(invoice_generated_at, created_at, now())), 1 
FROM bookings
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

COMMIT;
