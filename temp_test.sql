-- Test vehicle insert and fetch
INSERT INTO vehicles (shop_id, registration_number, type, brand, model, daily_rate, status) 
VALUES ('550e8400-e29b-41d4-a716-446655440000'::uuid, 'TEST-001', 'bike'::vehicle_type, 'Hero', 'Splendor', 250, 'Available'::vehicle_status) 
RETURNING id, type, brand, model, registration_number;
