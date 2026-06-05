-- Automated Booking Flow Test Script
-- Execute via: docker exec supabase_db psql -U postgres -d postgres -f test_booking_automation.sql

ALTER TABLE customers DISABLE TRIGGER trg_set_user_id_customers;
ALTER TABLE vehicles DISABLE TRIGGER set_user_id_from_auth;

-- PHASE 2: Create Customer
INSERT INTO customers (shop_id, user_id, name, phone, email, address, id_type, id_photos, status)
VALUES ('660e8400-e29b-41d4-a716-446655440000'::uuid, '770e8400-e29b-41d4-a716-446655440000'::uuid, 'John Doe', '9123456789', 'john@test.com', '123 Main St', 'Driving License', '[]'::jsonb, 'Verified')
RETURNING id as customer_id;

-- PHASE 3: Create Vehicle
INSERT INTO vehicles (shop_id, user_id, name, registration_number, type, brand, model, year, color, daily_rate, status, current_odometer)
VALUES ('660e8400-e29b-41d4-a716-446655440000'::uuid, '770e8400-e29b-41d4-a716-446655440000'::uuid, 'Test Bike 001', 'REG12345', 'Two-wheeler', 'Hero', 'HF100', 2023, 'Red', 50.0, 'Available', 1000)
RETURNING id as vehicle_id;

ALTER TABLE customers ENABLE TRIGGER trg_set_user_id_customers;
ALTER TABLE vehicles ENABLE TRIGGER set_user_id_from_auth;

-- PHASE 4-9: Display results for manual verification
SELECT 'TEST COMPLETE' as status;
SELECT COUNT(*) as customer_count FROM customers WHERE user_id = '770e8400-e29b-41d4-a716-446655440000'::uuid;
SELECT COUNT(*) as vehicle_count FROM vehicles WHERE user_id = '770e8400-e29b-41d4-a716-446655440000'::uuid;
