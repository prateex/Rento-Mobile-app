-- ============================================
-- STEP 1: VERIFY DATA EXISTS IN DATABASE
-- ============================================

-- Check users
SELECT COUNT(*) as user_count FROM users;
SELECT id, full_name, email, role, shop_id, auth_id FROM users LIMIT 10;

-- Check customers
SELECT COUNT(*) as customer_count FROM customers;
SELECT id, full_name, phone, shop_id FROM customers LIMIT 10;

-- Check vehicles
SELECT COUNT(*) as vehicle_count FROM vehicles;
SELECT id, name, registration_number, shop_id FROM vehicles LIMIT 10;

-- Check bookings
SELECT COUNT(*) as booking_count FROM bookings;
SELECT id, booking_number, shop_id FROM bookings LIMIT 10;

-- Check current user's context
SELECT 
  auth.uid() as my_auth_id,
  (SELECT id FROM users WHERE auth_id = auth.uid()) as my_user_id,
  (SELECT shop_id FROM users WHERE auth_id = auth.uid()) as my_shop_id,
  (SELECT role FROM users WHERE auth_id = auth.uid()) as my_role;
