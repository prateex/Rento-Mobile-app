-- ============================================
-- ADD SOFT DELETE SUPPORT
-- Add deleted_at column to enable soft deletes
-- ============================================

-- Add deleted_at to bookings
ALTER TABLE bookings 
ADD COLUMN deleted_at TIMESTAMPTZ NULL;

CREATE INDEX idx_bookings_deleted_at ON bookings(deleted_at);

-- Add deleted_at to customers
ALTER TABLE customers 
ADD COLUMN deleted_at TIMESTAMPTZ NULL;

CREATE INDEX idx_customers_deleted_at ON customers(deleted_at);

-- Add deleted_at to vehicles
ALTER TABLE vehicles 
ADD COLUMN deleted_at TIMESTAMPTZ NULL;

CREATE INDEX idx_vehicles_deleted_at ON vehicles(deleted_at);

-- ============================================
-- CONFIRMATION
-- ============================================
SELECT 'Soft delete columns added successfully' as status;
