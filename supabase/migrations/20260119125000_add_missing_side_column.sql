-- =============================================================================
-- ADD MISSING 'side' COLUMN TO customer_id_photos
-- =============================================================================
-- The existing customer_id_photos table is missing the 'side' column
-- This migration adds it safely without breaking existing data
-- =============================================================================

BEGIN;

-- Add the 'side' column if it doesn't exist
-- Use ALTER TABLE ADD COLUMN IF NOT EXISTS (PostgreSQL 10+)
ALTER TABLE customer_id_photos
ADD COLUMN IF NOT EXISTS side TEXT DEFAULT 'front' CHECK (side IN ('front', 'back'));

-- Drop old constraints that may exist
ALTER TABLE customer_id_photos DROP CONSTRAINT IF EXISTS customer_id_photos_customer_id_side_key;
ALTER TABLE customer_id_photos DROP CONSTRAINT IF EXISTS unique_customer_id_photos_side;

-- Add the unique constraint index on (customer_id, side) where not soft deleted
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_id_photos_customer_side
  ON customer_id_photos(customer_id, side)
  WHERE deleted_at IS NULL;

COMMIT;
