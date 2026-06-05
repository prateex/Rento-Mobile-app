-- Add is_published column to vehicles table
-- Purpose: Enable vehicle publish/unpublish functionality for marketplace

BEGIN;

ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false;

-- Set all existing vehicles to published (backward compatibility)
UPDATE vehicles 
SET is_published = true 
WHERE is_published = false;

COMMIT;
