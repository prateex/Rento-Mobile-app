-- Rento App Initial Schema Migration
-- This migration creates the complete database schema for the Rento rental application
-- Compatible with Supabase CLI and PostgreSQL

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_role AS ENUM ('admin', 'staff', 'owner');
CREATE TYPE vehicle_status AS ENUM ('Available', 'Booked', 'Maintenance');
CREATE TYPE vehicle_type AS ENUM ('bike', 'car');
CREATE TYPE fuel_type AS ENUM ('Petrol', 'Electric');
CREATE TYPE customer_status AS ENUM ('Verified', 'Pending');
CREATE TYPE id_type AS ENUM ('Aadhaar', 'Voter ID', 'Passport', 'Driving License');
CREATE TYPE booking_status AS ENUM ('Booked', 'Advance Paid', 'Confirmed', 'Active', 'Completed', 'Cancelled');
CREATE TYPE payment_status AS ENUM ('Paid', 'Partial', 'Unpaid');
CREATE TYPE payment_choice AS ENUM ('Booking Only', 'Advance Paid', 'Fully Paid');
CREATE TYPE payment_mode AS ENUM ('Cash', 'UPI', 'Other');
CREATE TYPE damage_severity AS ENUM ('Minor', 'Moderate', 'Major');
CREATE TYPE damage_type AS ENUM ('Scratch', 'Dent', 'Broken Mirror', 'Tyre', 'Mechanical', 'Other');

-- ============================================================================
-- TABLES
-- ============================================================================

-- Rental Shops (Owner has multiple shops)
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

-- Users (staff, owners, admins)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role user_role NOT NULL DEFAULT 'staff',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Vehicles (bikes and cars)
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
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Customers
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
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Bookings
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
  utr_number TEXT,
  start_image TEXT,
  end_image TEXT,
  opening_odometer DECIMAL(10, 2),
  closing_odometer DECIMAL(10, 2),
  damages_during_rental JSONB,
  deposit_deduction DECIMAL(10, 2) DEFAULT 0,
  damage_notes TEXT,
  invoice_number TEXT,
  invoice_generated_at TIMESTAMPTZ,
  invoice_generated_by UUID,
  refund_amount DECIMAL(10, 2),
  history JSONB DEFAULT '[]'::jsonb,
  taken_at TIMESTAMPTZ,
  taken_by UUID,
  returned_at TIMESTAMPTZ,
  returned_by UUID,
  paid_at TIMESTAMPTZ,
  paid_by UUID,
  cancelled_at TIMESTAMPTZ,
  finalized BOOLEAN DEFAULT false,
  invoice_pending BOOLEAN DEFAULT false,
  invoice_locked BOOLEAN DEFAULT false,
  whatsapp_sent JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Payments (detailed payment records)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_mode payment_mode NOT NULL,
  utr_number TEXT,
  paid_by UUID REFERENCES users(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Damages (vehicle damage records)
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
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Documents (generic document storage)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  url TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Invoice Sequences (for generating sequential invoice numbers per shop, per FY)
CREATE TABLE IF NOT EXISTS invoice_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  fiscal_year TEXT NOT NULL,
  sequence_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shop_id, fiscal_year)
);

-- Customer Sequences (for generating sequential customer numbers)
CREATE TABLE IF NOT EXISTS customer_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shop_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- rental_shops indexes
CREATE INDEX IF NOT EXISTS idx_rental_shops_owner_id ON rental_shops(owner_id);

-- users indexes
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_shop_id ON users(shop_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- vehicles indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_shop_id ON vehicles(shop_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_registration_number ON vehicles(registration_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_at ON vehicles(deleted_at);

-- customers indexes
CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON customers(deleted_at);

-- bookings indexes
CREATE INDEX IF NOT EXISTS idx_bookings_shop_id ON bookings(shop_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_number ON bookings(booking_number);
CREATE INDEX IF NOT EXISTS idx_bookings_invoice_number ON bookings(invoice_number);
CREATE INDEX IF NOT EXISTS idx_bookings_start_date ON bookings(start_date);
CREATE INDEX IF NOT EXISTS idx_bookings_end_date ON bookings(end_date);
CREATE INDEX IF NOT EXISTS idx_bookings_deleted_at ON bookings(deleted_at);

-- payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_shop_id ON payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_by ON payments(paid_by);

-- damages indexes
CREATE INDEX IF NOT EXISTS idx_damages_shop_id ON damages(shop_id);
CREATE INDEX IF NOT EXISTS idx_damages_vehicle_id ON damages(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_damages_booking_id ON damages(booking_id);

-- documents indexes
CREATE INDEX IF NOT EXISTS idx_documents_shop_id ON documents(shop_id);
CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);

-- invoice_sequences indexes
CREATE INDEX IF NOT EXISTS idx_invoice_sequences_shop_id ON invoice_sequences(shop_id);

-- customer_sequences indexes
CREATE INDEX IF NOT EXISTS idx_customer_sequences_shop_id ON customer_sequences(shop_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  fy TEXT;
  seq_num INTEGER;
  shop_id_param UUID;
BEGIN
  -- Get current shop_id from auth context (assumes it's set in JWT)
  -- This is a placeholder; actual implementation may need adjustment based on your auth setup
  shop_id_param := auth.uid();
  
  -- Get fiscal year (FY2025-26 format: "25-26")
  fy := to_char(CURRENT_DATE, 'YY') || '-' || to_char(CURRENT_DATE + INTERVAL '1 year', 'YY');
  
  -- Increment sequence for this shop and fiscal year
  INSERT INTO invoice_sequences (shop_id, fiscal_year, sequence_number)
  VALUES (shop_id_param, fy, 1)
  ON CONFLICT (shop_id, fiscal_year)
  DO UPDATE SET sequence_number = invoice_sequences.sequence_number + 1
  RETURNING invoice_sequences.sequence_number INTO seq_num;
  
  -- Return formatted invoice number: INV-252600001 (FY + 4-digit sequence)
  RETURN 'INV-' || REPLACE(fy, '-', '') || LPAD(seq_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at on rental_shops
CREATE TRIGGER trigger_rental_shops_updated_at BEFORE UPDATE ON rental_shops
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at on users
CREATE TRIGGER trigger_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at on vehicles
CREATE TRIGGER trigger_vehicles_updated_at BEFORE UPDATE ON vehicles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at on customers
CREATE TRIGGER trigger_customers_updated_at BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at on bookings
CREATE TRIGGER trigger_bookings_updated_at BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at on payments
CREATE TRIGGER trigger_payments_updated_at BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at on damages
CREATE TRIGGER trigger_damages_updated_at BEFORE UPDATE ON damages
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at on documents
CREATE TRIGGER trigger_documents_updated_at BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at on invoice_sequences
CREATE TRIGGER trigger_invoice_sequences_updated_at BEFORE UPDATE ON invoice_sequences
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at on customer_sequences
CREATE TRIGGER trigger_customer_sequences_updated_at BEFORE UPDATE ON customer_sequences
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE rental_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE damages ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_sequences ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLICIES
-- ============================================================================

-- rental_shops policies
CREATE POLICY "Owners can view their own shops"
ON rental_shops FOR SELECT
USING (owner_id = auth.uid());

CREATE POLICY "Owners can update their own shops"
ON rental_shops FOR UPDATE
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- users policies
CREATE POLICY "Users can view their own shop's staff"
ON users FOR SELECT
USING (
  shop_id IN (
    SELECT id FROM rental_shops WHERE owner_id = auth.uid()
  )
  OR
  auth_id = auth.uid()
);

CREATE POLICY "Owners can insert staff for their shops"
ON users FOR INSERT
WITH CHECK (
  shop_id IN (
    SELECT id FROM rental_shops WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Owners can update staff for their shops"
ON users FOR UPDATE
USING (
  shop_id IN (
    SELECT id FROM rental_shops WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  shop_id IN (
    SELECT id FROM rental_shops WHERE owner_id = auth.uid()
  )
);

-- vehicles policies
CREATE POLICY "Staff can view vehicles in their shop"
ON vehicles FOR SELECT
USING (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
);

CREATE POLICY "Staff can insert vehicles in their shop"
ON vehicles FOR INSERT
WITH CHECK (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
);

CREATE POLICY "Staff can update vehicles in their shop"
ON vehicles FOR UPDATE
USING (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
)
WITH CHECK (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
);

-- customers policies
CREATE POLICY "Staff can view customers in their shop"
ON customers FOR SELECT
USING (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
);

CREATE POLICY "Staff can insert customers in their shop"
ON customers FOR INSERT
WITH CHECK (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
);

CREATE POLICY "Staff can update customers in their shop"
ON customers FOR UPDATE
USING (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
)
WITH CHECK (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
);

-- bookings policies
CREATE POLICY "Staff can view bookings in their shop"
ON bookings FOR SELECT
USING (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
);

CREATE POLICY "Staff can insert bookings in their shop"
ON bookings FOR INSERT
WITH CHECK (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
);

CREATE POLICY "Staff can update bookings in their shop"
ON bookings FOR UPDATE
USING (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
)
WITH CHECK (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
);

-- payments policies
CREATE POLICY "Staff can view payments in their shop"
ON payments FOR SELECT
USING (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
);

CREATE POLICY "Staff can insert payments in their shop"
ON payments FOR INSERT
WITH CHECK (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
);

CREATE POLICY "Staff can update payments in their shop"
ON payments FOR UPDATE
USING (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
)
WITH CHECK (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
);

-- damages policies
CREATE POLICY "Staff can view damages in their shop"
ON damages FOR SELECT
USING (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
);

CREATE POLICY "Staff can insert damages in their shop"
ON damages FOR INSERT
WITH CHECK (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
);

CREATE POLICY "Staff can update damages in their shop"
ON damages FOR UPDATE
USING (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
)
WITH CHECK (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
);

-- documents policies
CREATE POLICY "Staff can view documents in their shop"
ON documents FOR SELECT
USING (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
);

CREATE POLICY "Staff can insert documents in their shop"
ON documents FOR INSERT
WITH CHECK (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
);

CREATE POLICY "Staff can update documents in their shop"
ON documents FOR UPDATE
USING (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
)
WITH CHECK (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
);

-- invoice_sequences policies
CREATE POLICY "Staff can view invoice sequences in their shop"
ON invoice_sequences FOR SELECT
USING (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
);

CREATE POLICY "Staff can update invoice sequences in their shop"
ON invoice_sequences FOR UPDATE
USING (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
)
WITH CHECK (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
);

-- customer_sequences policies
CREATE POLICY "Staff can view customer sequences in their shop"
ON customer_sequences FOR SELECT
USING (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
);

CREATE POLICY "Staff can update customer sequences in their shop"
ON customer_sequences FOR UPDATE
USING (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
)
WITH CHECK (
  shop_id IN (
    SELECT shop_id FROM users WHERE auth_id = auth.uid()
  )
);
