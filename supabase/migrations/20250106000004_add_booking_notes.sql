-- Migration: Add notes column to bookings table
-- Issue: Frontend tries to insert 'notes' field but column doesn't exist
-- This causes "Could not find the 'notes' column of 'bookings' in the schema cache" error

-- Add notes column to bookings table (for general booking notes)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comment for clarity
COMMENT ON COLUMN bookings.notes IS 'General notes about the booking (separate from damage_notes)';

-- Add payment_date column to support payment date tracking
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ;

COMMENT ON COLUMN bookings.payment_date IS 'Date when payment was received';
