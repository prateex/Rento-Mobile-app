-- Migration: Fix booking_status enum to include 'Taken' and 'Returned'
-- Date: 2025-01-07
-- Purpose: Fix enum mismatch causing "invalid input value for enum booking_status_enum: 'Taken'" errors
-- Issue: Frontend code tries to write 'Taken' and 'Returned' which don't exist in enum

-- ============================================================================
-- ENUM FIX: Add 'Taken' and 'Returned' to booking_status enum
-- ============================================================================

-- PostgreSQL ENUM fix requires:
-- 1. Create a new type with all values
-- 2. Cast existing column to text, then update the constraint
-- 3. Drop old type and rename new type

-- Step 1: Create a temporary type with all required values
CREATE TYPE booking_status_new AS ENUM (
  'Booked', 
  'Advance Paid', 
  'Confirmed', 
  'Active', 
  'Taken',        -- NEW: Required for "Mark as Taken" flow
  'Completed', 
  'Returned',     -- NEW: Required for "Return Vehicle" flow
  'Cancelled'
);

-- Step 2: Alter the bookings table to use the new type
-- We need to cast the column through text to avoid constraint violations
ALTER TABLE bookings 
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE booking_status_new USING status::text::booking_status_new,
  ALTER COLUMN status SET DEFAULT 'Booked'::booking_status_new;

-- Step 3: Drop the old enum type
DROP TYPE booking_status;

-- Step 4: Rename the new type to the original name
ALTER TYPE booking_status_new RENAME TO booking_status;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check that the enum now has all required values
SELECT enum_range(NULL::booking_status) AS all_values;

-- Verify bookings table still works
SELECT id, status, created_at FROM bookings LIMIT 1;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================
-- Enum values and their meanings:
-- - 'Booked':        Initial booking created
-- - 'Advance Paid':  Advance payment received
-- - 'Confirmed':     Booking confirmed, ready for pickup
-- - 'Active':        Currently in use (deprecated in UI, mapped to 'Taken')
-- - 'Taken':         Vehicle taken by customer (replaces 'Active' in new flow)
-- - 'Completed':     Rental period ended (deprecated in UI, mapped to 'Returned')
-- - 'Returned':      Vehicle returned and finalized
-- - 'Cancelled':     Booking cancelled
