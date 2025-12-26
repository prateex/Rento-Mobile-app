-- ============================================
-- SUPABASE DATABASE SCHEMA
-- For Rento Bike Rental Management System
-- ============================================

-- Run this SQL in Supabase SQL Editor to create all tables

-- ============================================
-- CREATE TABLES
-- ============================================

-- Rental Shops (owners)
CREATE TABLE IF NOT EXISTS rental_shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  gst_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Staff/Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  auth_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  type TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  year INTEGER,
  color TEXT,
  image_url TEXT,
  daily_rate NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Rented', 'Maintenance')),
  current_odometer INTEGER DEFAULT 0,
  documents JSONB,
  damages JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  id_type TEXT NOT NULL CHECK (id_type IN ('Aadhaar', 'Voter ID', 'Passport', 'Driving License')),
  id_photos JSONB NOT NULL,
  documents JSONB,
  status TEXT NOT NULL DEFAULT 'Verified' CHECK (status IN ('Verified', 'Pending')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  booking_number TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  vehicle_ids JSONB NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'Confirmed' CHECK (status IN ('Confirmed', 'Taken', 'Returned', 'Cancelled')),
  total_amount NUMERIC(10, 2) NOT NULL,
  advance_amount NUMERIC(10, 2) DEFAULT 0,
  balance_amount NUMERIC(10, 2) NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Paid', 'Partial', 'Unpaid')),
  invoice_number TEXT,
  opening_odometer INTEGER,
  closing_odometer INTEGER,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  taken_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'Card', 'UPI', 'Bank Transfer')),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('Advance', 'Balance', 'Full')),
  transaction_id TEXT,
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deposits
CREATE TABLE IF NOT EXISTS deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Held' CHECK (status IN ('Held', 'Refunded', 'Deducted')),
  refunded_amount NUMERIC(10, 2) DEFAULT 0,
  deducted_amount NUMERIC(10, 2) DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Damages
CREATE TABLE IF NOT EXISTS damages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('Scratch', 'Dent', 'Mechanical', 'Other')),
  severity TEXT NOT NULL CHECK (severity IN ('Minor', 'Moderate', 'Major')),
  description TEXT,
  photo_urls JSONB,
  estimated_cost NUMERIC(10, 2),
  actual_cost NUMERIC(10, 2),
  reported_by UUID NOT NULL REFERENCES users(id),
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  repaired_at TIMESTAMPTZ
);

-- ============================================
-- CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_rental_shops_owner_id ON rental_shops(owner_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_shop_id ON users(shop_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_shop_id ON vehicles(shop_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_bookings_shop_id ON bookings(shop_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_start_date ON bookings(start_date);
CREATE INDEX IF NOT EXISTS idx_bookings_end_date ON bookings(end_date);
CREATE INDEX IF NOT EXISTS idx_payments_shop_id ON payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_deposits_shop_id ON deposits(shop_id);
CREATE INDEX IF NOT EXISTS idx_deposits_booking_id ON deposits(booking_id);
CREATE INDEX IF NOT EXISTS idx_damages_shop_id ON damages(shop_id);
CREATE INDEX IF NOT EXISTS idx_damages_vehicle_id ON damages(vehicle_id);

-- ============================================
-- UPDATE TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_rental_shops_updated_at
  BEFORE UPDATE ON rental_shops
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deposits_updated_at
  BEFORE UPDATE ON deposits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- NOTES
-- ============================================

-- After running this SQL:
-- 1. Run the RLS policies SQL (supabase_rls_policies.sql)
-- 2. Create your first user in Supabase Auth
-- 3. Create a rental_shop linked to that user
-- 4. Create a user record linking auth user to the shop
-- 5. Test the API endpoints with proper JWT token

-- ============================================
-- USER OWNERSHIP ENFORCEMENT (PER-USER ISOLATION)
-- ============================================

-- 1) Add user_id to all user-owned tables (if missing)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE damages ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2) Backfill user_id for existing rows
-- Vehicles: fallback to shop owner
UPDATE vehicles v
SET user_id = rs.owner_id
FROM rental_shops rs
WHERE v.user_id IS NULL AND v.shop_id = rs.id;

-- Customers: fallback to shop owner
UPDATE customers c
SET user_id = rs.owner_id
FROM rental_shops rs
WHERE c.user_id IS NULL AND c.shop_id = rs.id;

-- Bookings: prefer created_by -> users.auth_id; else fallback to shop owner
UPDATE bookings b
SET user_id = COALESCE(u.auth_id, rs.owner_id)
FROM users u
JOIN rental_shops rs ON rs.id = b.shop_id
WHERE b.user_id IS NULL AND u.id = b.created_by;

UPDATE bookings b
SET user_id = rs.owner_id
FROM rental_shops rs
WHERE b.user_id IS NULL AND b.shop_id = rs.id;

-- Payments: prefer recorded_by -> users.auth_id; else fallback to booking -> shop owner
UPDATE payments p
SET user_id = u.auth_id
FROM users u
WHERE p.user_id IS NULL AND u.id = p.recorded_by;

UPDATE payments p
SET user_id = rs.owner_id
FROM bookings b
JOIN rental_shops rs ON rs.id = b.shop_id
WHERE p.user_id IS NULL AND p.booking_id = b.id;

-- Deposits: fallback to booking -> shop owner
UPDATE deposits d
SET user_id = rs.owner_id
FROM bookings b
JOIN rental_shops rs ON rs.id = b.shop_id
WHERE d.user_id IS NULL AND d.booking_id = b.id;

-- Damages: prefer reported_by -> users.auth_id; else fallback to booking -> shop owner
UPDATE damages d
SET user_id = u.auth_id
FROM users u
WHERE d.user_id IS NULL AND u.id = d.reported_by;

UPDATE damages d
SET user_id = rs.owner_id
FROM bookings b
JOIN rental_shops rs ON rs.id = b.shop_id
WHERE d.user_id IS NULL AND d.booking_id = b.id;

-- 3) Constraints: NOT NULL + FK to auth.users
ALTER TABLE vehicles ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE customers ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE bookings ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE payments ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE deposits ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE damages ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_user_id_fkey;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_user_id_fkey;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_user_id_fkey;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_user_id_fkey;
ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_user_id_fkey;
ALTER TABLE damages DROP CONSTRAINT IF EXISTS damages_user_id_fkey;

ALTER TABLE vehicles ADD CONSTRAINT vehicles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE customers ADD CONSTRAINT customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE bookings ADD CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE payments ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE deposits ADD CONSTRAINT deposits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE damages ADD CONSTRAINT damages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4) Useful indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_damages_user_id ON damages(user_id);

-- 5) Triggers to enforce user_id on INSERT and prevent updates
CREATE OR REPLACE FUNCTION set_user_id_from_auth()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.user_id := auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_user_id_vehicles ON vehicles;
DROP TRIGGER IF EXISTS trg_set_user_id_customers ON customers;
DROP TRIGGER IF EXISTS trg_set_user_id_bookings ON bookings;
DROP TRIGGER IF EXISTS trg_set_user_id_payments ON payments;
DROP TRIGGER IF EXISTS trg_set_user_id_deposits ON deposits;
DROP TRIGGER IF EXISTS trg_set_user_id_damages ON damages;

CREATE TRIGGER trg_set_user_id_vehicles BEFORE INSERT OR UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION set_user_id_from_auth();
CREATE TRIGGER trg_set_user_id_customers BEFORE INSERT OR UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_user_id_from_auth();
CREATE TRIGGER trg_set_user_id_bookings BEFORE INSERT OR UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_user_id_from_auth();
CREATE TRIGGER trg_set_user_id_payments BEFORE INSERT OR UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_user_id_from_auth();
CREATE TRIGGER trg_set_user_id_deposits BEFORE INSERT OR UPDATE ON deposits FOR EACH ROW EXECUTE FUNCTION set_user_id_from_auth();
CREATE TRIGGER trg_set_user_id_damages BEFORE INSERT OR UPDATE ON damages FOR EACH ROW EXECUTE FUNCTION set_user_id_from_auth();

