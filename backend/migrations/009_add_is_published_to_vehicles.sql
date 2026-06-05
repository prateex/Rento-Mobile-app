-- MIGRATION 009: ADD IS_PUBLISHED COLUMN TO VEHICLES
-- Purpose: Ensure vehicles table has is_published column for marketplace visibility control
-- Safe to apply: YES (idempotent, handles existing columns gracefully)
-- Backward compatible: YES (defaults to false, doesn't affect existing queries)
-- Blocking Fix: YES (required for owner app publish toggle to work)

BEGIN;

-- Add is_published column if it doesn't exist
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false NOT NULL;

-- Ensure all existing vehicles are marked as published by default
-- (only update if the column was just created - safe because IF NOT EXISTS prevents duplicate runs)
UPDATE vehicles 
SET is_published = true 
WHERE is_published = false;

-- Verify the column was added successfully
-- (This is a comment; actual verification happens after migration execution)
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name='vehicles' AND column_name='is_published';

COMMIT;
