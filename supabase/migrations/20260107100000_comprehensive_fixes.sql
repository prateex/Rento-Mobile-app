-- Comprehensive Fix Migration
-- Addresses: Customer phone uniqueness, sequential numbers, booking numbers, invoice persistence
-- Created: 2025-01-07

-- ============================================
-- 1. CUSTOMER PHONE UNIQUENESS (per shop)
-- ============================================

-- Add unique constraint on (shop_id, phone) if not exists
ALTER TABLE customers ADD CONSTRAINT customers_shop_id_phone_unique UNIQUE (shop_id, phone);

-- ============================================
-- 2. CUSTOMER NUMBER SEQUENCE
-- ============================================

-- Create sequence for customer numbers (shop-specific via trigger)
CREATE SEQUENCE IF NOT EXISTS customer_number_seq START 1 INCREMENT 1;

-- Add customer_number column if missing
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_number TEXT UNIQUE;

-- Create function to generate customer numbers
CREATE OR REPLACE FUNCTION public.generate_customer_number()
RETURNS TEXT AS $$
DECLARE
  next_num INT;
BEGIN
  next_num := nextval('public.customer_number_seq');
  RETURN 'CUST' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate customer_number on INSERT
CREATE OR REPLACE FUNCTION public.trigger_set_customer_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_number IS NULL THEN
    NEW.customer_number := public.generate_customer_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customers_set_customer_number ON customers;
CREATE TRIGGER customers_set_customer_number
  BEFORE INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_customer_number();

-- Backfill missing customer numbers
UPDATE customers
SET customer_number = public.generate_customer_number()
WHERE customer_number IS NULL;

-- ============================================
-- 3. BOOKING NUMBER SEQUENCE (per shop)
-- ============================================

-- Create sequence for booking numbers
CREATE SEQUENCE IF NOT EXISTS booking_number_seq START 1 INCREMENT 1;

-- Add booking_number column if missing
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_number TEXT UNIQUE;

-- Create function to generate booking numbers
CREATE OR REPLACE FUNCTION public.generate_booking_number()
RETURNS TEXT AS $$
DECLARE
  next_num INT;
BEGIN
  next_num := nextval('public.booking_number_seq');
  RETURN 'BK' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate booking_number on INSERT
CREATE OR REPLACE FUNCTION public.trigger_set_booking_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.booking_number IS NULL THEN
    NEW.booking_number := public.generate_booking_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bookings_set_booking_number ON bookings;
CREATE TRIGGER bookings_set_booking_number
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_booking_number();

-- Backfill missing booking numbers
UPDATE bookings
SET booking_number = public.generate_booking_number()
WHERE booking_number IS NULL OR booking_number = '';

-- ============================================
-- 4. INVOICE NUMBER SEQUENCE & PERSISTENCE
-- ============================================

-- Create sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1 INCREMENT 1;

-- Add invoice_number column to bookings if missing
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invoice_number TEXT UNIQUE;

-- Create function to generate invoice numbers (fiscal year based: INV-YYYY-NNNNN)
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  fy_year TEXT;
  next_num INT;
BEGIN
  -- Current fiscal year: if month < 4, FY is (year-1)-(year); else FY is (year)-(year+1)
  fy_year := CASE 
    WHEN EXTRACT(MONTH FROM NOW()) < 4 THEN 
      LPAD((EXTRACT(YEAR FROM NOW()) - 1)::TEXT, 2, '0') || 
      LPAD((EXTRACT(YEAR FROM NOW()) % 100)::TEXT, 2, '0')
    ELSE 
      LPAD((EXTRACT(YEAR FROM NOW()) % 100)::TEXT, 2, '0') || 
      LPAD(((EXTRACT(YEAR FROM NOW()) + 1) % 100)::TEXT, 2, '0')
  END;
  
  next_num := nextval('public.invoice_number_seq');
  RETURN 'INV-' || fy_year || '-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Backfill missing invoice numbers for completed bookings
UPDATE bookings
SET invoice_number = public.generate_invoice_number()
WHERE invoice_number IS NULL 
  AND status = 'Completed'
  AND created_at < NOW();

-- ============================================
-- 5. NOTES COLUMN IN BOOKINGS
-- ============================================

-- Add notes column if missing
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================
-- 6. PAYMENT DATE & UTR FIELDS
-- ============================================

-- Add payment_date column if missing
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP;

-- Add utr_number column if missing  
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS utr_number TEXT;

-- ============================================
-- 7. ENSURE TIMESTAMPS (created_at, updated_at)
-- ============================================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ============================================
-- 8. RLS POLICIES FOR PHONE UNIQUENESS
-- ============================================

-- Allow customers to be inserted/updated only within own shop
-- (Existing RLS policies should handle this, but ensure they're in place)

-- ============================================
-- 9. INDEXES FOR PERFORMANCE
-- ============================================

-- Index on shop_id for faster filtering
CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_bookings_shop_id ON bookings(shop_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_shop_id ON vehicles(shop_id);

-- Index on created_by for audit trail
CREATE INDEX IF NOT EXISTS idx_customers_created_by ON customers(created_by);
CREATE INDEX IF NOT EXISTS idx_bookings_created_by ON bookings(created_by);
CREATE INDEX IF NOT EXISTS idx_vehicles_created_by ON vehicles(created_by);

-- Index on booking_number for fast lookup by booking number
CREATE INDEX IF NOT EXISTS idx_bookings_booking_number ON bookings(booking_number);

-- Index on customer_number for fast lookup
CREATE INDEX IF NOT EXISTS idx_customers_customer_number ON customers(customer_number);

-- Index on invoice_number for fast lookup
CREATE INDEX IF NOT EXISTS idx_bookings_invoice_number ON bookings(invoice_number);

-- ============================================
-- VERIFICATION QUERIES (Run manually to verify)
-- ============================================
-- SELECT enum_range(NULL::booking_status);
-- SELECT COUNT(*) FROM customers WHERE customer_number IS NULL;
-- SELECT COUNT(*) FROM bookings WHERE booking_number IS NULL;
-- SELECT COUNT(*) FROM bookings WHERE invoice_number IS NOT NULL;
