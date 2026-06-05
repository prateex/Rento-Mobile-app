-- Migration: Add user tracking columns and fix schema mismatches
-- This migration aligns the database schema with frontend expectations

-- ============================================================================
-- ADD MISSING COLUMNS TO VEHICLES TABLE
-- ============================================================================

ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- ADD MISSING COLUMNS TO CUSTOMERS TABLE
-- ============================================================================

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- ADD MISSING COLUMNS TO BOOKINGS TABLE
-- ============================================================================

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- ADD MISSING COLUMNS TO PAYMENTS TABLE
-- ============================================================================

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- INDEXES FOR NEW COLUMNS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_created_by ON vehicles(created_by);

CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_created_by ON customers(created_by);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_created_by ON bookings(created_by);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_recorded_by ON payments(recorded_by);

-- ============================================================================
-- TRIGGERS TO AUTO-SET CREATED_BY ON INSERT
-- ============================================================================

-- Trigger for vehicles
CREATE OR REPLACE FUNCTION set_vehicles_created_by()
RETURNS TRIGGER AS $$
DECLARE
  user_rec UUID;
BEGIN
  SELECT id INTO user_rec FROM users WHERE auth_id = auth.uid() LIMIT 1;
  IF user_rec IS NOT NULL THEN
    NEW.created_by := user_rec;
    NEW.user_id := user_rec;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_vehicles_set_created_by ON vehicles;
CREATE TRIGGER trigger_vehicles_set_created_by BEFORE INSERT ON vehicles
FOR EACH ROW EXECUTE FUNCTION set_vehicles_created_by();

-- Trigger for customers
CREATE OR REPLACE FUNCTION set_customers_created_by()
RETURNS TRIGGER AS $$
DECLARE
  user_rec UUID;
BEGIN
  SELECT id INTO user_rec FROM users WHERE auth_id = auth.uid() LIMIT 1;
  IF user_rec IS NOT NULL THEN
    NEW.created_by := user_rec;
    NEW.user_id := user_rec;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_customers_set_created_by ON customers;
CREATE TRIGGER trigger_customers_set_created_by BEFORE INSERT ON customers
FOR EACH ROW EXECUTE FUNCTION set_customers_created_by();

-- Trigger for bookings
CREATE OR REPLACE FUNCTION set_bookings_created_by()
RETURNS TRIGGER AS $$
DECLARE
  user_rec UUID;
BEGIN
  SELECT id INTO user_rec FROM users WHERE auth_id = auth.uid() LIMIT 1;
  IF user_rec IS NOT NULL THEN
    NEW.created_by := user_rec;
    NEW.user_id := user_rec;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_bookings_set_created_by ON bookings;
CREATE TRIGGER trigger_bookings_set_created_by BEFORE INSERT ON bookings
FOR EACH ROW EXECUTE FUNCTION set_bookings_created_by();

-- Trigger for payments
CREATE OR REPLACE FUNCTION set_payments_recorded_by()
RETURNS TRIGGER AS $$
DECLARE
  user_rec UUID;
BEGIN
  SELECT id INTO user_rec FROM users WHERE auth_id = auth.uid() LIMIT 1;
  IF user_rec IS NOT NULL THEN
    NEW.recorded_by := user_rec;
    NEW.user_id := user_rec;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_payments_set_recorded_by ON payments;
CREATE TRIGGER trigger_payments_set_recorded_by BEFORE INSERT ON payments
FOR EACH ROW EXECUTE FUNCTION set_payments_recorded_by();
