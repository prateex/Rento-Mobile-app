-- Fix invoice counter sync to extract only the sequence number (last 4 digits)
-- Not the entire year from the format INV/2025-26/0009

BEGIN;

-- Reset invoice counters with proper extraction
TRUNCATE invoice_number_counters;

INSERT INTO invoice_number_counters (shop_id, financial_year, next_invoice_number)
SELECT DISTINCT shop_id, fy_label(COALESCE(invoice_generated_at, created_at, now())), 1 
FROM bookings
WHERE invoice_number IS NOT NULL
ON CONFLICT (shop_id, financial_year) DO NOTHING;

-- Extract only the last segment after the final '/' 
UPDATE invoice_number_counters c
SET next_invoice_number = sub.mx + 1, updated_at = now()
FROM (
  SELECT 
    shop_id, 
    fy_label(COALESCE(invoice_generated_at, created_at, now())) AS fy,
    COALESCE(
      MAX(
        CAST(
          SPLIT_PART(invoice_number, '/', 3) AS INT
        )
      ), 
      0
    ) AS mx
  FROM bookings
  WHERE invoice_number IS NOT NULL
  GROUP BY shop_id, fy_label(COALESCE(invoice_generated_at, created_at, now()))
) sub
WHERE c.shop_id = sub.shop_id AND c.financial_year = sub.fy;

COMMIT;
