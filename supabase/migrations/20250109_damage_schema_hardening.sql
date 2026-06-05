-- Migration: Harden damages table schema
-- Date: 2025-01-09
-- Purpose: Enforce NOT NULL constraints, add FK constraints, prepare to deprecate vehicles.damages

-- STEP 1: Set NOT NULL on critical fields
-- These should never be null for a valid damage record
ALTER TABLE damages
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN reported_by SET NOT NULL,
  ALTER COLUMN vehicle_id SET NOT NULL,
  ALTER COLUMN shop_id SET NOT NULL,
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN severity SET NOT NULL;

-- STEP 2: Add foreign key constraints (if not already present)
-- Ensures referential integrity
DO $$
BEGIN
  -- FK to vehicles table
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'damages_vehicle_id_fkey'
  ) THEN
    ALTER TABLE damages
      ADD CONSTRAINT damages_vehicle_id_fkey
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;
  END IF;

  -- FK to bookings table (nullable, as damages can exist without bookings)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'damages_booking_id_fkey'
  ) THEN
    ALTER TABLE damages
      ADD CONSTRAINT damages_booking_id_fkey
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
  END IF;

  -- FK to shops table
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'damages_shop_id_fkey'
  ) THEN
    ALTER TABLE damages
      ADD CONSTRAINT damages_shop_id_fkey
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
  END IF;
END $$;

-- STEP 3: Add indexes for common queries
-- Note: idx_damages_deleted_at will be added in a later migration when deleted_at column is added

-- STEP 4: Add index for vehicle lookup (most common query)
CREATE INDEX IF NOT EXISTS idx_damages_vehicle_id ON damages(vehicle_id);

-- STEP 5: Add index for shop-scoped queries
CREATE INDEX IF NOT EXISTS idx_damages_shop_id ON damages(shop_id);

-- STEP 6: Comment documenting the new architecture
COMMENT ON TABLE damages IS 'Single source of truth for vehicle damages. The vehicles.damages JSONB column is deprecated and should not be written to.';
COMMENT ON COLUMN vehicles.damages IS 'DEPRECATED: Do not write to this column. Read damages from the damages table instead. This column may be removed in a future migration.';

-- STEP 7: Optional - Add CHECK constraint to ensure severity is valid
ALTER TABLE damages DROP CONSTRAINT IF EXISTS damages_severity_check;
ALTER TABLE damages
  ADD CONSTRAINT damages_severity_check
  CHECK (severity IN ('Minor', 'Moderate', 'Major'));

-- STEP 8: Optional - Add CHECK constraint to ensure type is valid
ALTER TABLE damages DROP CONSTRAINT IF EXISTS damages_type_check;
ALTER TABLE damages
  ADD CONSTRAINT damages_type_check
  CHECK (type IN ('Scratch', 'Dent', 'Broken Mirror', 'Tyre', 'Mechanical', 'Other'));

-- End of migration
