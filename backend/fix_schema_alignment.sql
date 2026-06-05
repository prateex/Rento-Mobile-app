-- Fix schema alignment for bookings table
-- Ensure all columns referenced in code exist

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_auth_id UUID,
  ADD COLUMN IF NOT EXISTS is_online_booking BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS owner_id UUID,
  ADD COLUMN IF NOT EXISTS vehicle_id UUID,
  ADD COLUMN IF NOT EXISTS payment_choice TEXT,
  ADD COLUMN IF NOT EXISTS payment_mode TEXT,
  ADD COLUMN IF NOT EXISTS pickup_location_id UUID,
  ADD COLUMN IF NOT EXISTS dropoff_location_id UUID,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS customer_address TEXT,
  ADD COLUMN IF NOT EXISTS customer_emergency_contact TEXT,
  ADD COLUMN IF NOT EXISTS customer_id_type TEXT,
  ADD COLUMN IF NOT EXISTS pickup_location_name TEXT,
  ADD COLUMN IF NOT EXISTS pickup_address TEXT,
  ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC,
  ADD COLUMN IF NOT EXISTS base_rental_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS km_charge_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS security_deposit_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS payment_gateway TEXT;