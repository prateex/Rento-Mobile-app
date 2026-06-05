-- =============================================================================
-- ADD VEHICLE PUBLISHING COLUMNS
-- =============================================================================
-- Date: February 21, 2026
-- Purpose: Enable vehicle publishing for marketplace visibility
-- 
-- Changes:
-- 1. Add is_published column to vehicles table (default: false)
-- 2. Add is_listed_marketplace column to vehicles table (default: false)
-- 
-- Impact:
-- - Allows owner app to mark vehicles as published
-- - Allows customer app to filter published vehicles (.eq('is_published', true))
-- - All existing vehicles default to unpublished (backward compatible)
-- - No data loss or existing column modification
-- =============================================================================

BEGIN;

-- Add publishing columns to vehicles table
-- These columns control visibility in the customer marketplace app

ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_listed_marketplace BOOLEAN NOT NULL DEFAULT false;

-- Create index on is_published for faster customer app queries
CREATE INDEX IF NOT EXISTS idx_vehicles_is_published 
ON vehicles(shop_id, is_published) 
WHERE deleted_at IS NULL;

-- Create index on is_listed_marketplace for marketplace filtering
CREATE INDEX IF NOT EXISTS idx_vehicles_is_listed_marketplace 
ON vehicles(shop_id, is_listed_marketplace) 
WHERE deleted_at IS NULL;

COMMIT;
