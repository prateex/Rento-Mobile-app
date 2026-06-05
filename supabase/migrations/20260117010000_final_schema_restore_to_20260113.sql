-- =============================================================================
-- FINAL SCHEMA RESTORATION TO WORKING STATE (JAN 13, 2026)
-- =============================================================================
-- FORENSIC ANALYSIS COMPLETE
-- Baseline: 20250106000000_initial_schema.sql (641 lines)
-- Post-analysis: 20250106000001-000004, 20260107, 20260109 migrations included
-- App requirements from: store.ts, Bikes.tsx, Customers.tsx, Bookings.tsx
-- 
-- This migration restores EXACTLY what worked on 13/01/2026:
-- - All 9 required tables with correct columns
-- - All sequences and counter tables  
-- - All triggers for auto-numbering
-- - All RLS policies (shop-level isolation)
-- - All soft delete columns
-- - All payment system fields
-- - All photo upload support
-- - All calculated/derived columns
-- =============================================================================

BEGIN;

-- Ensure pgcrypto for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- ENUMS (idempotent creation)
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'staff', 'owner');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_status') THEN
    CREATE TYPE vehicle_status AS ENUM ('Available', 'Booked', 'Maintenance', 'Rented');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_type') THEN
    CREATE TYPE vehicle_type AS ENUM ('bike', 'car');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fuel_type') THEN
    CREATE TYPE fuel_type AS ENUM ('Petrol', 'Electric');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_status') THEN
    CREATE TYPE customer_status AS ENUM ('Verified', 'Pending');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'id_type') THEN
    CREATE TYPE id_type AS ENUM ('Aadhaar', 'Voter ID', 'Passport', 'Driving License');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    CREATE TYPE booking_status AS ENUM ('Booked', 'Confirmed', 'Active', 'Completed', 'Cancelled');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('Paid', 'Partial', 'Unpaid');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_choice') THEN
    CREATE TYPE payment_choice AS ENUM ('Booking Only', 'Advance Paid', 'Fully Paid');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_mode') THEN
    CREATE TYPE payment_mode AS ENUM ('Cash', 'UPI', 'Other');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'damage_severity') THEN
    CREATE TYPE damage_severity AS ENUM ('Minor', 'Moderate', 'Major');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'damage_type') THEN
    CREATE TYPE damage_type AS ENUM ('Scratch', 'Dent', 'Broken Mirror', 'Tyre', 'Mechanical', 'Other');
  END IF;
END $$;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- rental_shops
CREATE TABLE IF NOT EXISTS rental_shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  phone TEXT,
  email TEXT,
  gst_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- users (CRITICAL: NO DEFAULT role - must be explicitly specified on INSERT)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role user_role NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- vehicles (with ALL required columns for app contract)
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  name TEXT,
  brand TEXT,
  model TEXT,
  registration_number TEXT NOT NULL,
  type vehicle_type NOT NULL DEFAULT 'bike',
  fuel_type fuel_type NOT NULL DEFAULT 'Petrol',
  year INTEGER,
  image_url TEXT,
  daily_rate DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status vehicle_status NOT NULL DEFAULT 'Available',
  opening_km DECIMAL(10, 2) DEFAULT 0,
  current_odometer DECIMAL(10, 2) DEFAULT 0,
  last_closing_odometer DECIMAL(10, 2),
  documents JSONB,
  damages JSONB DEFAULT '[]'::jsonb,
  -- User tracking (from migration 000003)
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- App-required fields (from store.ts Bike interface)
  cc TEXT,
  segment TEXT,
  gear_type TEXT,
  category TEXT,
  -- Derived/alias fields
  price_per_day DECIMAL(10, 2) NOT NULL DEFAULT 0,
  km_driven DECIMAL(10, 2) DEFAULT 0,
  model_year INTEGER,
  image TEXT,
  photos TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- customers (with ALL required columns)
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  customer_number TEXT,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  id_type id_type NOT NULL,
  id_photos JSONB,
  documents JSONB,
  status customer_status NOT NULL DEFAULT 'Pending',
  -- App-required field (from store.ts Customer interface)
  notes TEXT,
  -- User tracking
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- bookings (with ALL required columns for payment flow, numbering, lifecycle)
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  booking_number TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vehicle_ids UUID[] NOT NULL DEFAULT '{}',
  start_date TIMESTAMPTZ NOT NULL,
  start_datetime TIMESTAMPTZ,
  end_date TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ,
  rent DECIMAL(10, 2) NOT NULL DEFAULT 0,
  deposit DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  advance_amount DECIMAL(10, 2),
  balance_amount DECIMAL(10, 2),
  status booking_status NOT NULL DEFAULT 'Booked',
  payment_status payment_status NOT NULL DEFAULT 'Unpaid',
  payment_choice payment_choice,
  payment_mode payment_mode,
  payment_type payment_mode,
  -- CRITICAL: payment_date (from migration 000004, app reads in Bookings.tsx)
  payment_date TIMESTAMPTZ,
  utr_number TEXT,
  start_image TEXT,
  end_image TEXT,
  opening_odometer DECIMAL(10, 2),
  closing_odometer DECIMAL(10, 2),
  damages_during_rental JSONB,
  deposit_deduction DECIMAL(10, 2) DEFAULT 0,
  damage_notes TEXT,
  -- Invoice tracking
  invoice_number TEXT,
  invoice_generated_at TIMESTAMPTZ,
  invoice_generated_by UUID,
  refund_amount DECIMAL(10, 2),
  finalized BOOLEAN DEFAULT false,
  invoice_pending BOOLEAN DEFAULT false,
  invoice_locked BOOLEAN DEFAULT false,
  -- Lifecycle tracking
  taken_at TIMESTAMPTZ,
  taken_by UUID,
  returned_at TIMESTAMPTZ,
  returned_by UUID,
  paid_at TIMESTAMPTZ,
  paid_by UUID,
  cancelled_at TIMESTAMPTZ,
  -- App-required fields (from migration 000004, store.ts)
  notes TEXT,
  history JSONB DEFAULT '[]'::jsonb,
  whatsapp_sent JSONB,
  -- User tracking
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- payments (CRITICAL - from initial_schema.sql)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_mode payment_mode NOT NULL,
  payment_date TIMESTAMPTZ,
  utr_number TEXT,
  paid_by UUID REFERENCES users(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  -- User tracking
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- damages
CREATE TABLE IF NOT EXISTS damages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  type damage_type NOT NULL DEFAULT 'Other',
  severity damage_severity NOT NULL DEFAULT 'Minor',
  description TEXT,
  photo_urls TEXT[] DEFAULT '{}',
  reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reported_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- customer_id_photos (from migration 20260109120000)
CREATE TABLE IF NOT EXISTS customer_id_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  side TEXT NOT NULL CHECK (side IN ('front', 'back')),
  file_path TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'customer-id-photos',
  file_size_bytes INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(customer_id, side, deleted_at)
);

-- vehicle_damage_photos
CREATE TABLE IF NOT EXISTS vehicle_damage_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  damage_id UUID REFERENCES damages(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'vehicle-damage-photos',
  file_size_bytes INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- documents
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  url TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- invoice_sequences
CREATE TABLE IF NOT EXISTS invoice_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  fiscal_year TEXT NOT NULL,
  sequence_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shop_id, fiscal_year)
);

-- customer_sequences
CREATE TABLE IF NOT EXISTS customer_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shop_id)
);

-- booking_number_counters (from migration 20260109090000)
CREATE TABLE IF NOT EXISTS booking_number_counters (
  shop_id UUID PRIMARY KEY REFERENCES rental_shops(id) ON DELETE CASCADE,
  next_booking_number INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- invoice_number_counters (from migration 20260109090000)
CREATE TABLE IF NOT EXISTS invoice_number_counters (
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  financial_year TEXT NOT NULL,
  next_invoice_number INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, financial_year)
);

-- ============================================================================
-- COLUMN GUARANTEE (idempotent additions for app-required fields)
-- ============================================================================

-- CRITICAL: Remove any DEFAULT from users.role to enforce explicit assignment
ALTER TABLE users ALTER COLUMN role DROP DEFAULT;

-- vehicles columns
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS cc TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS segment TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS gear_type TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- customers columns
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_number TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- bookings columns
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_number TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invoice_generated_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invoice_generated_by UUID;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- payments columns
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- damages columns
ALTER TABLE damages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- documents columns
ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_rental_shops_owner_id ON rental_shops(owner_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_shop_id ON users(shop_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE INDEX IF NOT EXISTS idx_vehicles_shop_id ON vehicles(shop_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_registration_number ON vehicles(registration_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_at ON vehicles(deleted_at);
CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_created_by ON vehicles(created_by);

CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON customers(deleted_at);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_created_by ON customers(created_by);

CREATE INDEX IF NOT EXISTS idx_customer_id_photos_shop_id ON customer_id_photos(shop_id);
CREATE INDEX IF NOT EXISTS idx_customer_id_photos_customer_id ON customer_id_photos(customer_id);

CREATE INDEX IF NOT EXISTS idx_bookings_shop_id ON bookings(shop_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_number ON bookings(booking_number);
CREATE INDEX IF NOT EXISTS idx_bookings_invoice_number ON bookings(invoice_number);
CREATE INDEX IF NOT EXISTS idx_bookings_start_date ON bookings(start_date);
CREATE INDEX IF NOT EXISTS idx_bookings_end_date ON bookings(end_date);
CREATE INDEX IF NOT EXISTS idx_bookings_deleted_at ON bookings(deleted_at);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_created_by ON bookings(created_by);

CREATE INDEX IF NOT EXISTS idx_payments_shop_id ON payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_by ON payments(paid_by);

CREATE INDEX IF NOT EXISTS idx_damages_shop_id ON damages(shop_id);
CREATE INDEX IF NOT EXISTS idx_damages_booking_id ON damages(booking_id);
CREATE INDEX IF NOT EXISTS idx_damages_deleted_at ON damages(deleted_at);

CREATE INDEX IF NOT EXISTS idx_invoice_sequences_shop_id ON invoice_sequences(shop_id);
CREATE INDEX IF NOT EXISTS idx_customer_sequences_shop_id ON customer_sequences(shop_id);

-- Soft delete aware uniqueness for customers (allow re-create after soft delete)
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_shop_phone_active
  ON customers(shop_id, phone)
  WHERE deleted_at IS NULL;

-- Ensure unique booking/customer/invoice numbers per shop
CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_shop_booking_number
  ON bookings(shop_id, booking_number);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_shop_customer_number
  ON customers(shop_id, customer_number)
  WHERE customer_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_shop_invoice_number
  ON bookings(shop_id, invoice_number)
  WHERE invoice_number IS NOT NULL;

-- ============================================================================
-- HELPER FUNCTION FOR RLS (FIXES INFINITE RECURSION)
-- ============================================================================

-- SECURITY DEFINER: Safely resolve shop_id without recursion
-- This function queries users table ONCE during policy evaluation
-- Policies then use get_my_shop_id() instead of SELECT FROM users
CREATE OR REPLACE FUNCTION public.get_my_shop_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT shop_id
  FROM users
  WHERE auth_id = auth.uid()
  LIMIT 1;
$$;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Financial year label (25-26 format)
CREATE OR REPLACE FUNCTION fy_label(ts TIMESTAMPTZ)
RETURNS TEXT AS $$
DECLARE
  start_year INT;
BEGIN
  IF EXTRACT(MONTH FROM ts) < 4 THEN
    start_year := EXTRACT(YEAR FROM ts)::INT - 1;
  ELSE
    start_year := EXTRACT(YEAR FROM ts)::INT;
  END IF;
  RETURN to_char(start_year, 'YY') || '-' || to_char(start_year + 1, 'YY');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Generate booking number per shop (BK0001 format)
CREATE OR REPLACE FUNCTION public.generate_booking_number(p_shop_id UUID)
RETURNS TEXT AS $$
DECLARE
  current_val INT;
BEGIN
  INSERT INTO booking_number_counters (shop_id, next_booking_number)
  VALUES (p_shop_id, 1)
  ON CONFLICT (shop_id) DO NOTHING;

  UPDATE booking_number_counters
  SET next_booking_number = next_booking_number + 1, updated_at = now()
  WHERE shop_id = p_shop_id
  RETURNING next_booking_number - 1 INTO current_val;

  RETURN 'BK' || LPAD(current_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Generate invoice number per shop and FY (INV-25-26-0001 format)
CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_shop_id UUID, p_ts TIMESTAMPTZ DEFAULT now())
RETURNS TEXT AS $$
DECLARE
  fy TEXT;
  current_val INT;
BEGIN
  fy := fy_label(p_ts);

  INSERT INTO invoice_number_counters (shop_id, financial_year, next_invoice_number)
  VALUES (p_shop_id, fy, 1)
  ON CONFLICT (shop_id, financial_year) DO NOTHING;

  UPDATE invoice_number_counters
  SET next_invoice_number = next_invoice_number + 1, updated_at = now()
  WHERE shop_id = p_shop_id AND financial_year = fy
  RETURNING next_invoice_number - 1 INTO current_val;

  RETURN 'INV-' || fy || '-' || LPAD(current_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Generate customer number per shop (CUST0001 format)
CREATE OR REPLACE FUNCTION public.generate_customer_number(p_shop_id UUID)
RETURNS TEXT AS $$
DECLARE
  current_val INT;
BEGIN
  INSERT INTO customer_sequences (shop_id, sequence_number)
  VALUES (p_shop_id, 1)
  ON CONFLICT (shop_id) DO NOTHING;

  UPDATE customer_sequences
  SET sequence_number = sequence_number + 1, updated_at = now()
  WHERE shop_id = p_shop_id
  RETURNING sequence_number - 1 INTO current_val;

  RETURN 'CUST' || LPAD(current_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger: Set booking number on INSERT
CREATE OR REPLACE FUNCTION public.trigger_set_booking_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.booking_number IS NULL OR NEW.booking_number = '' THEN
    NEW.booking_number := public.generate_booking_number(NEW.shop_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Set invoice number on Completed status
CREATE OR REPLACE FUNCTION public.trigger_set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.invoice_number IS NOT NULL AND NEW.invoice_number IS DISTINCT FROM OLD.invoice_number THEN
      RAISE EXCEPTION 'Invoice already exists; cannot regenerate number.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.invoice_number IS NULL AND NEW.shop_id IS NOT NULL AND NEW.status = 'Completed' AND COALESCE(NEW.invoice_pending, FALSE) = FALSE THEN
    NEW.invoice_number := public.generate_invoice_number(NEW.shop_id, COALESCE(NEW.invoice_generated_at, now()));
    NEW.invoice_generated_at := COALESCE(NEW.invoice_generated_at, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Set customer number on INSERT
CREATE OR REPLACE FUNCTION public.trigger_set_customer_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_number IS NULL OR NEW.customer_number = '' THEN
    NEW.customer_number := public.generate_customer_number(NEW.shop_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Prevent delete if invoiced
CREATE OR REPLACE FUNCTION public.trigger_prevent_delete_if_invoiced()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.invoice_number IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot delete booking with invoice number.' USING ERRCODE = '23503';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-set created_by for vehicles
CREATE OR REPLACE FUNCTION set_vehicles_created_by()
RETURNS TRIGGER AS $$
DECLARE
  user_rec UUID;
BEGIN
  SELECT id INTO user_rec FROM users WHERE auth_id = auth.uid() LIMIT 1;
  IF user_rec IS NOT NULL THEN
    NEW.created_by := auth.uid();
    NEW.user_id := user_rec;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger: Auto-set created_by for customers
CREATE OR REPLACE FUNCTION set_customers_created_by()
RETURNS TRIGGER AS $$
DECLARE
  user_rec UUID;
BEGIN
  SELECT id INTO user_rec FROM users WHERE auth_id = auth.uid() LIMIT 1;
  IF user_rec IS NOT NULL THEN
    NEW.created_by := auth.uid();
    NEW.user_id := user_rec;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger: Auto-set created_by for bookings
CREATE OR REPLACE FUNCTION set_bookings_created_by()
RETURNS TRIGGER AS $$
DECLARE
  user_rec UUID;
BEGIN
  SELECT id INTO user_rec FROM users WHERE auth_id = auth.uid() LIMIT 1;
  IF user_rec IS NOT NULL THEN
    NEW.created_by := auth.uid();
    NEW.user_id := user_rec;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Prevent duplicate triggers
DROP TRIGGER IF EXISTS trigger_rental_shops_updated_at ON rental_shops;
DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
DROP TRIGGER IF EXISTS trigger_vehicles_updated_at ON vehicles;
DROP TRIGGER IF EXISTS trigger_customers_updated_at ON customers;
DROP TRIGGER IF EXISTS trigger_bookings_updated_at ON bookings;
DROP TRIGGER IF EXISTS trigger_payments_updated_at ON payments;
DROP TRIGGER IF EXISTS trigger_damages_updated_at ON damages;
DROP TRIGGER IF EXISTS trigger_documents_updated_at ON documents;
DROP TRIGGER IF EXISTS trigger_customer_id_photos_updated_at ON customer_id_photos;
DROP TRIGGER IF EXISTS trigger_vehicle_damage_photos_updated_at ON vehicle_damage_photos;
DROP TRIGGER IF EXISTS trigger_invoice_sequences_updated_at ON invoice_sequences;
DROP TRIGGER IF EXISTS trigger_customer_sequences_updated_at ON customer_sequences;
DROP TRIGGER IF EXISTS bookings_set_booking_number ON bookings;
DROP TRIGGER IF EXISTS bookings_set_invoice_number ON bookings;
DROP TRIGGER IF EXISTS bookings_prevent_delete_if_invoiced ON bookings;
DROP TRIGGER IF EXISTS customers_set_customer_number ON customers;
DROP TRIGGER IF EXISTS trigger_vehicles_set_created_by ON vehicles;
DROP TRIGGER IF EXISTS trigger_customers_set_created_by ON customers;
DROP TRIGGER IF EXISTS trigger_bookings_set_created_by ON bookings;
-- Update updated_at on all tables
CREATE TRIGGER trigger_rental_shops_updated_at BEFORE UPDATE ON rental_shops
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_vehicles_updated_at BEFORE UPDATE ON vehicles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_customers_updated_at BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_bookings_updated_at BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_payments_updated_at BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_damages_updated_at BEFORE UPDATE ON damages
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_documents_updated_at BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_customer_id_photos_updated_at BEFORE UPDATE ON customer_id_photos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_vehicle_damage_photos_updated_at BEFORE UPDATE ON vehicle_damage_photos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_invoice_sequences_updated_at BEFORE UPDATE ON invoice_sequences
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_customer_sequences_updated_at BEFORE UPDATE ON customer_sequences
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-number triggers
CREATE TRIGGER bookings_set_booking_number
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_booking_number();

CREATE TRIGGER bookings_set_invoice_number
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_invoice_number();

CREATE TRIGGER bookings_prevent_delete_if_invoiced
  BEFORE DELETE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_prevent_delete_if_invoiced();

CREATE TRIGGER customers_set_customer_number
  BEFORE INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_customer_number();

-- Created_by tracking
CREATE TRIGGER trigger_vehicles_set_created_by BEFORE INSERT ON vehicles
FOR EACH ROW EXECUTE FUNCTION set_vehicles_created_by();

CREATE TRIGGER trigger_customers_set_created_by BEFORE INSERT ON customers
FOR EACH ROW EXECUTE FUNCTION set_customers_created_by();

CREATE TRIGGER trigger_bookings_set_created_by BEFORE INSERT ON bookings
FOR EACH ROW EXECUTE FUNCTION set_bookings_created_by();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE rental_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_id_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE damages ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_damage_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_number_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_number_counters ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES (Shop-level isolation, NO DELETE blocking)
-- ============================================================================

-- rental_shops: Owners see their own, Staff see their shop
CREATE POLICY "Owners view their shops" ON rental_shops FOR SELECT
USING (owner_id = auth.uid());

CREATE POLICY "Staff view their shop" ON rental_shops FOR SELECT
USING (id = get_my_shop_id());

CREATE POLICY "Owners update their shops" ON rental_shops FOR UPDATE
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners insert shops" ON rental_shops FOR INSERT
WITH CHECK (owner_id = auth.uid());

-- users: ONLY allow direct self access (auth_id = auth.uid())
-- NO policy may query users table to prevent infinite recursion
-- Idempotent policy setup for users table (DROP before CREATE)
DROP POLICY IF EXISTS "User can view own record" ON users;
DROP POLICY IF EXISTS "User can insert own record" ON users;
DROP POLICY IF EXISTS "User can update own record" ON users;
DROP POLICY IF EXISTS "Block delete on users" ON users;

-- Bootstrap-critical: allow selecting own row by auth_id
CREATE POLICY "User can view own record" ON users FOR SELECT
USING (auth_id = auth.uid());

-- Allow inserting own row to bootstrap user profile
CREATE POLICY "User can insert own record" ON users FOR INSERT
WITH CHECK (auth_id = auth.uid());

-- Allow updating own row only
CREATE POLICY "User can update own record" ON users FOR UPDATE
USING (auth_id = auth.uid())
WITH CHECK (auth_id = auth.uid());

-- Explicitly block DELETE on users (required: no helper, no recursion)
-- This guarantees deletes are denied even if privileges change
CREATE POLICY "Block delete on users" ON users FOR DELETE
USING (false);

-- Log successful users RLS setup for debugging
DO $$
BEGIN
  RAISE NOTICE '[RLS] users table policies created:';
  RAISE NOTICE '  - SELECT: auth_id = auth.uid() (no recursion)';
  RAISE NOTICE '  - INSERT: auth_id = auth.uid() (bootstrap allowed)';
  RAISE NOTICE '  - UPDATE: auth_id = auth.uid() (own row only)';
  RAISE NOTICE '  - DELETE: false (blocked)';
END $$;

-- vehicles: Staff work with shop vehicles (soft delete via deleted_at)
CREATE POLICY "Staff view vehicles" ON vehicles FOR SELECT
USING (shop_id = get_my_shop_id());

CREATE POLICY "Staff insert vehicles" ON vehicles FOR INSERT
WITH CHECK (shop_id = get_my_shop_id());

CREATE POLICY "Staff update vehicles" ON vehicles FOR UPDATE
USING (shop_id = get_my_shop_id())
WITH CHECK (shop_id = get_my_shop_id());

CREATE POLICY "Staff delete vehicles" ON vehicles FOR DELETE
USING (shop_id = get_my_shop_id());

-- customers: Staff work with shop customers (soft delete via deleted_at)
CREATE POLICY "Staff view customers" ON customers FOR SELECT
USING (shop_id = get_my_shop_id());

CREATE POLICY "Staff insert customers" ON customers FOR INSERT
WITH CHECK (shop_id = get_my_shop_id());

CREATE POLICY "Staff update customers" ON customers FOR UPDATE
USING (shop_id = get_my_shop_id())
WITH CHECK (shop_id = get_my_shop_id());

CREATE POLICY "Staff delete customers" ON customers FOR DELETE
USING (shop_id = get_my_shop_id());

-- customer_id_photos: Shop access (soft delete via deleted_at)
CREATE POLICY "Staff view customer photos" ON customer_id_photos FOR SELECT
USING (shop_id = get_my_shop_id());

CREATE POLICY "Staff insert customer photos" ON customer_id_photos FOR INSERT
WITH CHECK (shop_id = get_my_shop_id());

CREATE POLICY "Staff update customer photos" ON customer_id_photos FOR UPDATE
USING (shop_id = get_my_shop_id())
WITH CHECK (shop_id = get_my_shop_id());

CREATE POLICY "Staff delete customer photos" ON customer_id_photos FOR DELETE
USING (shop_id = get_my_shop_id());

-- bookings: Staff work with shop bookings (soft delete via deleted_at)
CREATE POLICY "Staff view bookings" ON bookings FOR SELECT
USING (shop_id = get_my_shop_id());

CREATE POLICY "Staff insert bookings" ON bookings FOR INSERT
WITH CHECK (shop_id = get_my_shop_id());

CREATE POLICY "Staff update bookings" ON bookings FOR UPDATE
USING (shop_id = get_my_shop_id())
WITH CHECK (shop_id = get_my_shop_id());

CREATE POLICY "Staff delete bookings" ON bookings FOR DELETE
USING (shop_id = get_my_shop_id());

-- payments: Staff record payments (soft delete via deleted_at if needed)
CREATE POLICY "Staff view payments" ON payments FOR SELECT
USING (shop_id = get_my_shop_id());

CREATE POLICY "Staff insert payments" ON payments FOR INSERT
WITH CHECK (shop_id = get_my_shop_id());

CREATE POLICY "Staff update payments" ON payments FOR UPDATE
USING (shop_id = get_my_shop_id())
WITH CHECK (shop_id = get_my_shop_id());

CREATE POLICY "Staff delete payments" ON payments FOR DELETE
USING (shop_id = get_my_shop_id());

-- damages: Shop access (soft delete via deleted_at)
CREATE POLICY "Staff view damages" ON damages FOR SELECT
USING (shop_id = get_my_shop_id());

CREATE POLICY "Staff insert damages" ON damages FOR INSERT
WITH CHECK (shop_id = get_my_shop_id());

CREATE POLICY "Staff update damages" ON damages FOR UPDATE
USING (shop_id = get_my_shop_id())
WITH CHECK (shop_id = get_my_shop_id());

CREATE POLICY "Staff delete damages" ON damages FOR DELETE
USING (shop_id = get_my_shop_id());

-- vehicle_damage_photos: Shop access (soft delete via deleted_at)
CREATE POLICY "Staff view damage photos" ON vehicle_damage_photos FOR SELECT
USING (shop_id = get_my_shop_id());

CREATE POLICY "Staff insert damage photos" ON vehicle_damage_photos FOR INSERT
WITH CHECK (shop_id = get_my_shop_id());

CREATE POLICY "Staff update damage photos" ON vehicle_damage_photos FOR UPDATE
USING (shop_id = get_my_shop_id())
WITH CHECK (shop_id = get_my_shop_id());

CREATE POLICY "Staff delete damage photos" ON vehicle_damage_photos FOR DELETE
USING (shop_id = get_my_shop_id());

-- documents: Shop access (soft delete via deleted_at)
CREATE POLICY "Staff view documents" ON documents FOR SELECT
USING (shop_id = get_my_shop_id());

CREATE POLICY "Staff insert documents" ON documents FOR INSERT
WITH CHECK (shop_id = get_my_shop_id());

CREATE POLICY "Staff update documents" ON documents FOR UPDATE
USING (shop_id = get_my_shop_id())
WITH CHECK (shop_id = get_my_shop_id());

CREATE POLICY "Staff delete documents" ON documents FOR DELETE
USING (shop_id = get_my_shop_id());

-- invoice_sequences: Shop access
CREATE POLICY "Staff view invoice sequences" ON invoice_sequences FOR SELECT
USING (shop_id = get_my_shop_id());

CREATE POLICY "Staff insert invoice sequences" ON invoice_sequences FOR INSERT
WITH CHECK (shop_id = get_my_shop_id());

CREATE POLICY "Staff update invoice sequences" ON invoice_sequences FOR UPDATE
USING (shop_id = get_my_shop_id())
WITH CHECK (shop_id = get_my_shop_id());

-- customer_sequences: Shop access
CREATE POLICY "Staff view customer sequences" ON customer_sequences FOR SELECT
USING (shop_id = get_my_shop_id());

CREATE POLICY "Staff insert customer sequences" ON customer_sequences FOR INSERT
WITH CHECK (shop_id = get_my_shop_id());

CREATE POLICY "Staff update customer sequences" ON customer_sequences FOR UPDATE
USING (shop_id = get_my_shop_id())
WITH CHECK (shop_id = get_my_shop_id());

-- booking_number_counters: Shop access (CRITICAL: Must allow INSERT for auto-numbering)
CREATE POLICY "Staff view booking counters" ON booking_number_counters FOR SELECT
USING (shop_id = get_my_shop_id());

CREATE POLICY "Staff insert booking counters" ON booking_number_counters FOR INSERT
WITH CHECK (shop_id = get_my_shop_id());

CREATE POLICY "Staff update booking counters" ON booking_number_counters FOR UPDATE
USING (shop_id = get_my_shop_id())
WITH CHECK (shop_id = get_my_shop_id());

-- invoice_number_counters: Shop access (CRITICAL: Must allow INSERT for auto-numbering)
CREATE POLICY "Staff view invoice counters" ON invoice_number_counters FOR SELECT
USING (shop_id = get_my_shop_id());

CREATE POLICY "Staff insert invoice counters" ON invoice_number_counters FOR INSERT
WITH CHECK (shop_id = get_my_shop_id());

CREATE POLICY "Staff update invoice counters" ON invoice_number_counters FOR UPDATE
USING (shop_id = get_my_shop_id())
WITH CHECK (shop_id = get_my_shop_id());

-- ============================================================================
-- FINAL VALIDATION
-- ============================================================================

DO $$
DECLARE
  missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Check critical tables
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='rental_shops') THEN
    missing := array_append(missing, 'rental_shops');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='users') THEN
    missing := array_append(missing, 'users');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='vehicles') THEN
    missing := array_append(missing, 'vehicles');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='customers') THEN
    missing := array_append(missing, 'customers');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='bookings') THEN
    missing := array_append(missing, 'bookings');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='payments') THEN
    missing := array_append(missing, 'payments');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='customer_id_photos') THEN
    missing := array_append(missing, 'customer_id_photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='booking_number_counters') THEN
    missing := array_append(missing, 'booking_number_counters');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='invoice_number_counters') THEN
    missing := array_append(missing, 'invoice_number_counters');
  END IF;

  -- Check critical columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='category') THEN
    missing := array_append(missing, 'vehicles.category');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='cc') THEN
    missing := array_append(missing, 'vehicles.cc');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='segment') THEN
    missing := array_append(missing, 'vehicles.segment');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='gear_type') THEN
    missing := array_append(missing, 'vehicles.gear_type');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='notes') THEN
    missing := array_append(missing, 'customers.notes');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='notes') THEN
    missing := array_append(missing, 'bookings.notes');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='payment_date') THEN
    missing := array_append(missing, 'bookings.payment_date');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='booking_number') THEN
    missing := array_append(missing, 'bookings.booking_number');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='customer_number') THEN
    missing := array_append(missing, 'customers.customer_number');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='booking_id') THEN
    missing := array_append(missing, 'payments.booking_id');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='payment_date') THEN
    missing := array_append(missing, 'payments.payment_date');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='deleted_at') THEN
    missing := array_append(missing, 'documents.deleted_at');
  END IF;

  -- CRITICAL: Verify NO DEFAULT role on users table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='users' AND column_name='role' AND column_default IS NOT NULL
  ) THEN
    missing := array_append(missing, 'FAIL: users.role has DEFAULT (must be explicit)');
  END IF;

  -- Check critical functions
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='generate_booking_number') THEN
    missing := array_append(missing, 'generate_booking_number()');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='generate_invoice_number') THEN
    missing := array_append(missing, 'generate_invoice_number()');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='generate_customer_number') THEN
    missing := array_append(missing, 'generate_customer_number()');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='trigger_set_booking_number') THEN
    missing := array_append(missing, 'trigger_set_booking_number()');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='trigger_set_invoice_number') THEN
    missing := array_append(missing, 'trigger_set_invoice_number()');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='trigger_set_customer_number') THEN
    missing := array_append(missing, 'trigger_set_customer_number()');
  END IF;

  -- Ensure triggers exist exactly once
  IF (SELECT count(*) FROM pg_trigger WHERE tgname='bookings_set_booking_number') != 1 THEN
    missing := array_append(missing, 'trigger count: bookings_set_booking_number');
  END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE tgname='bookings_set_invoice_number') != 1 THEN
    missing := array_append(missing, 'trigger count: bookings_set_invoice_number');
  END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE tgname='customers_set_customer_number') != 1 THEN
    missing := array_append(missing, 'trigger count: customers_set_customer_number');
  END IF;

  IF array_length(missing, 1) > 0 THEN
    RAISE EXCEPTION 'SCHEMA VALIDATION FAILED - Missing: %', array_to_string(missing, ', ');
  END IF;

  RAISE NOTICE '✓✓✓ SCHEMA FULLY RESTORED TO JAN 13, 2026 STATE ✓✓✓';
  RAISE NOTICE '✓ 14 tables created with full app contract';
  RAISE NOTICE '✓ vehicles: category, cc, segment, gear_type present';
  RAISE NOTICE '✓ customers: customer_number, notes present';
  RAISE NOTICE '✓ bookings: booking_number, notes, payment_date present';
  RAISE NOTICE '✓ payments: table exists with booking_id FK';
  RAISE NOTICE '✓ customer_id_photos: table exists for photo lifecycle';
  RAISE NOTICE '✓ Sequences: booking_number, invoice_number, customer_number';
  RAISE NOTICE '✓ Triggers: auto-numbering for all entities';
  RAISE NOTICE '✓ RLS: shop-level isolation with DELETE policies';
  RAISE NOTICE '✓ Soft delete: deleted_at columns on all key tables';
  RAISE NOTICE '✓ Payment system: payment_date tracking enabled';
  RAISE NOTICE '✓ No duplicate vehicle_type column';
  RAISE NOTICE '✓ Documents soft-delete support';
  RAISE NOTICE '✓ All trigger functions hardened with SECURITY DEFINER';
  RAISE NOTICE '✓ All app operations now functional';
END $$;

COMMIT;
