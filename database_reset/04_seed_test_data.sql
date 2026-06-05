-- ============================================
-- SEED TEST DATA
-- Creates 2 shops with owners, staff, customers, vehicles
-- For testing isolation and app flows
-- ============================================

-- NOTE: For Supabase Cloud, create auth users via Admin API first
-- For Local Supabase, this creates auth users directly

DO $$
DECLARE
  -- Shop A variables
  v_shop_a_id UUID := gen_random_uuid();
  v_owner_a_auth UUID := 'bb2d1cd9-4a32-4778-b072-cf8d2e7a506c'; -- owner.a@rentoshop.com
  v_staff_a_auth UUID := 'cde2d9cf-dd7c-4050-b754-30c8a629745a'; -- staff.a@rentoshop.com
  v_owner_a_user UUID;
  v_staff_a_user UUID;
  v_customer_a1 UUID;
  v_vehicle_a1 UUID;
  
  -- Shop B variables
  v_shop_b_id UUID := gen_random_uuid();
  v_owner_b_auth UUID := '79f45c88-d804-4959-a43b-badead1a9e88'; -- owner.b@rentoshop.com
  v_owner_b_user UUID;
  v_customer_b1 UUID;
  v_vehicle_b1 UUID;
BEGIN
  
  -- ============================================
  -- AUTH USERS MUST BE CREATED FIRST
  -- Use Supabase Admin API or Dashboard to create these users:
  --   1. owner.a@rentoshop.com / TestPass123!
  --   2. staff.a@rentoshop.com / TestPass123!
  --   3. owner.b@rentoshop.com / TestPass123!
  -- Then replace the UUIDs below with the actual auth.user IDs
  -- ============================================
  
  -- Check if auth users exist (will fail if not created via Admin API)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_owner_a_auth) THEN
    RAISE EXCEPTION 'Auth user % not found. Create via Supabase Admin API first with email: owner.a@rentoshop.com', v_owner_a_auth;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_staff_a_auth) THEN
    RAISE EXCEPTION 'Auth user % not found. Create via Supabase Admin API first with email: staff.a@rentoshop.com', v_staff_a_auth;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_owner_b_auth) THEN
    RAISE EXCEPTION 'Auth user % not found. Create via Supabase Admin API first with email: owner.b@rentoshop.com', v_owner_b_auth;
  END IF;
  
  -- ============================================
  -- SHOP A
  -- ============================================
  
  -- Create Shop A
  INSERT INTO shops (id, name, phone, email, address, gst_number, created_at, updated_at)
  VALUES (
    v_shop_a_id,
    'Rento Shop A',
    '+91-9876543210',
    'contact@shopA.com',
    '123 MG Road, Bangalore',
    'GST29ABCDE1234F1Z5',
    NOW(),
    NOW()
  );
  
  -- Create Owner A user
  INSERT INTO users (id, shop_id, auth_id, name, phone, email, role, is_active, created_at)
  VALUES (
    gen_random_uuid(),
    v_shop_a_id,
    v_owner_a_auth,
    'Owner A',
    '+91-9876543210',
    'owner.a@rentoshop.com',
    'owner',
    true,
    NOW()
  ) RETURNING id INTO v_owner_a_user;
  
  -- Create Staff A user
  INSERT INTO users (id, shop_id, auth_id, name, phone, email, role, is_active, created_at)
  VALUES (
    gen_random_uuid(),
    v_shop_a_id,
    v_staff_a_auth,
    'Staff A',
    '+91-9876543211',
    'staff.a@rentoshop.com',
    'staff',
    true,
    NOW()
  ) RETURNING id INTO v_staff_a_user;
  
  -- Create Customer A1
  INSERT INTO customers (id, shop_id, name, phone, email, address, id_type, id_number, id_photos, status, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    v_shop_a_id,
    'Customer A1',
    '+91-9000000001',
    'customer.a1@example.com',
    'Koramangala, Bangalore',
    'Aadhaar',
    '1234-5678-9012',
    '["https://example.com/id1.jpg"]',
    'Verified',
    NOW(),
    NOW()
  ) RETURNING id INTO v_customer_a1;
  
  -- Create Vehicle A1
  INSERT INTO vehicles (id, shop_id, name, registration_number, type, brand, model, year, color, daily_rate, status, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    v_shop_a_id,
    'Honda Activa',
    'KA-01-AB-1234',
    'Scooter',
    'Honda',
    'Activa 6G',
    2023,
    'Black',
    400.00,
    'Available',
    NOW(),
    NOW()
  ) RETURNING id INTO v_vehicle_a1;
  
  -- Create Vehicle A2
  INSERT INTO vehicles (id, shop_id, name, registration_number, type, brand, model, year, color, daily_rate, status, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    v_shop_a_id,
    'Royal Enfield Classic',
    'KA-01-CD-5678',
    'Bike',
    'Royal Enfield',
    'Classic 350',
    2022,
    'Silver',
    800.00,
    'Available',
    NOW(),
    NOW()
  );
  
  -- ============================================
  -- SHOP B
  -- ============================================
  
  -- Create Shop B
  INSERT INTO shops (id, name, phone, email, address, gst_number, created_at, updated_at)
  VALUES (
    v_shop_b_id,
    'Rento Shop B',
    '+91-8765432109',
    'contact@shopB.com',
    '456 Park Street, Delhi',
    'GST07FGHIJ5678K2L9',
    NOW(),
    NOW()
  );
  
  -- Create Owner B user
  INSERT INTO users (id, shop_id, auth_id, name, phone, email, role, is_active, created_at)
  VALUES (
    gen_random_uuid(),
    v_shop_b_id,
    v_owner_b_auth,
    'Owner B',
    '+91-8765432109',
    'owner.b@rentoshop.com',
    'owner',
    true,
    NOW()
  ) RETURNING id INTO v_owner_b_user;
  
  -- Create Customer B1
  INSERT INTO customers (id, shop_id, name, phone, email, address, id_type, id_number, id_photos, status, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    v_shop_b_id,
    'Customer B1',
    '+91-9000000002',
    'customer.b1@example.com',
    'Connaught Place, Delhi',
    'Passport',
    'P1234567',
    '["https://example.com/passport1.jpg"]',
    'Verified',
    NOW(),
    NOW()
  ) RETURNING id INTO v_customer_b1;
  
  -- Create Vehicle B1
  INSERT INTO vehicles (id, shop_id, name, registration_number, type, brand, model, year, color, daily_rate, status, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    v_shop_b_id,
    'Yamaha FZ',
    'DL-01-XY-9876',
    'Bike',
    'Yamaha',
    'FZ-S',
    2023,
    'Blue',
    600.00,
    'Available',
    NOW(),
    NOW()
  ) RETURNING id INTO v_vehicle_b1;
  
  -- ============================================
  -- CONFIRMATION
  -- ============================================
  RAISE NOTICE 'Test data seeded successfully';
  RAISE NOTICE 'Shop A ID: %', v_shop_a_id;
  RAISE NOTICE 'Shop B ID: %', v_shop_b_id;
  RAISE NOTICE '';
  RAISE NOTICE 'Login credentials:';
  RAISE NOTICE '  Shop A Owner: owner.a@rentoshop.com / TestPass123!';
  RAISE NOTICE '  Shop A Staff: staff.a@rentoshop.com / TestPass123!';
  RAISE NOTICE '  Shop B Owner: owner.b@rentoshop.com / TestPass123!';
  
END;
$$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
SELECT 'Seeding complete. Run verification queries below:' as status;

-- View all shops
SELECT 'SHOPS:' as section;
SELECT id, name, phone, email FROM shops;

-- View all users
SELECT 'USERS:' as section;
SELECT u.id, u.name, u.email, u.role, s.name as shop_name 
FROM users u 
JOIN shops s ON u.shop_id = s.id 
ORDER BY s.name, u.role;

-- View customers per shop
SELECT 'CUSTOMERS BY SHOP:' as section;
SELECT s.name as shop_name, COUNT(c.id) as customer_count
FROM shops s
LEFT JOIN customers c ON c.shop_id = s.id
GROUP BY s.id, s.name;

-- View vehicles per shop
SELECT 'VEHICLES BY SHOP:' as section;
SELECT s.name as shop_name, COUNT(v.id) as vehicle_count
FROM shops s
LEFT JOIN vehicles v ON v.shop_id = s.id
GROUP BY s.id, s.name;
