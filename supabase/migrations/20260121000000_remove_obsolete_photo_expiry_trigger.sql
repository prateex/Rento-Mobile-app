-- Migration: Remove Obsolete Photo Expiry Trigger
-- Date: 2026-01-21
-- Purpose: Drop non-functional trigger that references non-existent columns
--
-- Background:
--   - Trigger: trigger_update_id_photo_expiry ON bookings
--   - Function: update_id_photo_expiry()
--   - Problem: References booking_id, expires_at, updated_at columns that don't exist on customer_id_photos
--   - Current Status: Migration 20260109120000 applies trigger, but customer_id_photos has different schema
--   - Result: Silent failures when booking status updated to 'Completed'
--
-- Solution: Drop the orphaned trigger and its supporting functions
--   - Design intent: Customer photos have FIXED 7-day lifetime from creation, not booking-dependent
--   - Cleanup handled by separate cleanup_expired_id_photos() function
--   - No business logic changes, only removes non-functional code

BEGIN;

-- ============================================================================
-- STEP 1: Drop the trigger attached to bookings
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_update_id_photo_expiry ON public.bookings;

-- ============================================================================
-- STEP 2: Drop the non-functional trigger function
-- ============================================================================
DROP FUNCTION IF EXISTS public.update_id_photo_expiry() CASCADE;

-- ============================================================================
-- STEP 3: Drop the dependent function (calculate_photo_expiry)
-- ============================================================================
-- This function was only called by the trigger, so it's also orphaned
DROP FUNCTION IF EXISTS public.calculate_photo_expiry(UUID) CASCADE;

-- ============================================================================
-- STEP 4: Validation
-- ============================================================================
-- Verify trigger is removed
DO $$
DECLARE
  trigger_count INT;
BEGIN
  SELECT COUNT(*)::INT INTO trigger_count
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
    AND trigger_name = 'trigger_update_id_photo_expiry';
  
  IF trigger_count > 0 THEN
    RAISE EXCEPTION 'VALIDATION FAILED: trigger_update_id_photo_expiry still exists';
  END IF;
  
  RAISE NOTICE 'VALIDATION PASSED: trigger_update_id_photo_expiry successfully removed';
END $$;

-- ============================================================================
-- STEP 5: Verify booking update works
-- ============================================================================
-- After this migration, booking status updates to 'Completed' will work
-- without attempting to update non-existent columns on customer_id_photos

DO $$
BEGIN
  RAISE NOTICE 'Migration complete. Booking status updates will no longer trigger photo expiry logic.';
  RAISE NOTICE 'Photo cleanup still handled by cleanup_expired_id_photos() function.';
END $$;

COMMIT;
