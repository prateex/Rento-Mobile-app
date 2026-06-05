-- Test Data Seed for Local Supabase
-- Minimal seed - only users and shops
-- Bookings, customers, vehicles created during test execution

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'testlocal@rento.com',
  crypt('Password@123', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  NOW(),
  NOW()
);

INSERT INTO rental_shops (id, owner_id, name, phone, email, address, created_at, updated_at)
VALUES (
  '660e8400-e29b-41d4-a716-446655440000'::uuid,
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'Test Local Shop',
  '9876543210',
  'shop@test.com',
  'Test Address, Local',
  NOW(),
  NOW()
);

INSERT INTO users (id, shop_id, auth_id, name, phone, role, is_active, created_at)
VALUES (
  '770e8400-e29b-41d4-a716-446655440000'::uuid,
  '660e8400-e29b-41d4-a716-446655440000'::uuid,
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'Test User',
  '9876543211',
  'admin',
  true,
  NOW()
);
