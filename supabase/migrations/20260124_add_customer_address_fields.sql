-- =============================================================================
-- ADD CUSTOMER ADDRESS FIELDS
-- =============================================================================
-- DATE: 2026-01-24
-- GOAL: Add city, state, pincode columns to customers table to match UI contract
--
-- ISSUE: Customer edit form collects city/state/pincode but columns don't exist
-- FIX: Add columns safely without breaking existing data
-- =============================================================================

BEGIN;

-- Add address detail columns to customers table
ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS pincode TEXT;

-- Verify damages table has soft delete support
ALTER TABLE public.damages
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_damages_deleted_at ON public.damages(deleted_at);

COMMIT;
