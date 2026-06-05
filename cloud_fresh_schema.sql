-- ============================================
-- COMPLETE FRESH SCHEMA FOR CLOUD
-- ============================================
-- Paste this entire SQL into Supabase Studio SQL Editor
-- Run after executing the reset script

-- ============================================
-- CREATE TABLES
-- ============================================

CREATE TABLE rental_shops (
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

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  auth_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff', 'owner')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE vehicles (
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
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE customers (
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
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  booking_number TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  vehicle_ids JSONB NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'Booked' CHECK (status IN ('Booked', 'Confirmed', 'Taken', 'Returned', 'Cancelled')),
  total_amount NUMERIC(10, 2) NOT NULL,
  advance_amount NUMERIC(10, 2) DEFAULT 0,
  balance_amount NUMERIC(10, 2) NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Paid', 'Partial', 'Unpaid')),
  invoice_number TEXT,
  opening_odometer INTEGER,
  closing_odometer INTEGER,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  taken_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'Card', 'UPI', 'Bank Transfer')),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('Advance', 'Balance', 'Full')),
  transaction_id TEXT,
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES users(id),
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Held' CHECK (status IN ('Held', 'Refunded', 'Deducted')),
  refunded_amount NUMERIC(10, 2) DEFAULT 0,
  deducted_amount NUMERIC(10, 2) DEFAULT 0,
  reason TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE damages (
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
  user_id UUID NOT NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  repaired_at TIMESTAMPTZ
);

-- ============================================
-- ADD FOREIGN KEY CONSTRAINTS FOR user_id
-- ============================================
ALTER TABLE vehicles ADD CONSTRAINT vehicles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE customers ADD CONSTRAINT customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE bookings ADD CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE payments ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE deposits ADD CONSTRAINT deposits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE damages ADD CONSTRAINT damages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================
-- CREATE INDEXES
-- ============================================
CREATE INDEX idx_rental_shops_owner_id ON rental_shops(owner_id);
CREATE INDEX idx_users_auth_id ON users(auth_id);
CREATE INDEX idx_users_shop_id ON users(shop_id);
CREATE INDEX idx_vehicles_shop_id ON vehicles(shop_id);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX idx_customers_shop_id ON customers(shop_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_bookings_shop_id ON bookings(shop_id);
CREATE INDEX idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_start_date ON bookings(start_date);
CREATE INDEX idx_bookings_end_date ON bookings(end_date);
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_payments_shop_id ON payments(shop_id);
CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_deposits_shop_id ON deposits(shop_id);
CREATE INDEX idx_deposits_booking_id ON deposits(booking_id);
CREATE INDEX idx_deposits_user_id ON deposits(user_id);
CREATE INDEX idx_damages_shop_id ON damages(shop_id);
CREATE INDEX idx_damages_vehicle_id ON damages(vehicle_id);
CREATE INDEX idx_damages_user_id ON damages(user_id);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rental_shops_updated_at BEFORE UPDATE ON rental_shops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deposits_updated_at BEFORE UPDATE ON deposits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- User ID enforcement function
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

CREATE TRIGGER trg_set_user_id_vehicles BEFORE INSERT OR UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION set_user_id_from_auth();
CREATE TRIGGER trg_set_user_id_customers BEFORE INSERT OR UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_user_id_from_auth();
CREATE TRIGGER trg_set_user_id_bookings BEFORE INSERT OR UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_user_id_from_auth();
CREATE TRIGGER trg_set_user_id_payments BEFORE INSERT OR UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_user_id_from_auth();
CREATE TRIGGER trg_set_user_id_deposits BEFORE INSERT OR UPDATE ON deposits FOR EACH ROW EXECUTE FUNCTION set_user_id_from_auth();
CREATE TRIGGER trg_set_user_id_damages BEFORE INSERT OR UPDATE ON damages FOR EACH ROW EXECUTE FUNCTION set_user_id_from_auth();

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE rental_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE damages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Rental shops
CREATE POLICY "Users can view their own shop" ON rental_shops FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Owners can update their own shop" ON rental_shops FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners can create their own shop" ON rental_shops FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Users (staff)
CREATE POLICY "Users can view staff in their shop" ON users FOR SELECT USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "Shop owners can add staff" ON users FOR INSERT WITH CHECK (shop_id IN (SELECT id FROM rental_shops WHERE owner_id = auth.uid()));
CREATE POLICY "Shop owners can update staff" ON users FOR UPDATE USING (shop_id IN (SELECT id FROM rental_shops WHERE owner_id = auth.uid())) WITH CHECK (shop_id IN (SELECT id FROM rental_shops WHERE owner_id = auth.uid()));
CREATE POLICY "Shop owners can delete staff" ON users FOR DELETE USING (shop_id IN (SELECT id FROM rental_shops WHERE owner_id = auth.uid()));

-- Vehicles
CREATE POLICY "vehicles_select_owner" ON vehicles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "vehicles_insert_owner" ON vehicles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "vehicles_update_owner" ON vehicles FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "vehicles_delete_owner" ON vehicles FOR DELETE USING (user_id = auth.uid());

-- Customers
CREATE POLICY "customers_select_owner" ON customers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "customers_insert_owner" ON customers FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "customers_update_owner" ON customers FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "customers_delete_owner" ON customers FOR DELETE USING (user_id = auth.uid());

-- Bookings
CREATE POLICY "bookings_select_owner" ON bookings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "bookings_insert_owner" ON bookings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "bookings_update_owner" ON bookings FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "bookings_delete_owner" ON bookings FOR DELETE USING (user_id = auth.uid());

-- Payments
CREATE POLICY "payments_select_owner" ON payments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "payments_insert_owner" ON payments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "payments_update_owner" ON payments FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "payments_delete_owner" ON payments FOR DELETE USING (user_id = auth.uid());

-- Deposits
CREATE POLICY "deposits_select_owner" ON deposits FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "deposits_insert_owner" ON deposits FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "deposits_update_owner" ON deposits FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Damages
CREATE POLICY "damages_select_owner" ON damages FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "damages_insert_owner" ON damages FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "damages_update_owner" ON damages FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "damages_delete_owner" ON damages FOR DELETE USING (user_id = auth.uid());
