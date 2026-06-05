-- Create test owner and shop for local development
DO $$
DECLARE
  test_owner_id UUID;
  test_shop_id UUID;
  test_user_id UUID;
BEGIN
  -- Create auth user
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'owner@test.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Test Owner"}',
    NOW(),
    NOW(),
    ''
  )
  RETURNING id INTO test_owner_id;
  
  -- Create rental shop
  INSERT INTO rental_shops (name, owner_id, created_at, updated_at)
  VALUES ('Test Rentals', test_owner_id, NOW(), NOW())
  RETURNING id INTO test_shop_id;
  
  -- Create user record
  INSERT INTO users (auth_id, shop_id, name, email, phone, role, created_at, updated_at)
  VALUES (test_owner_id, test_shop_id, 'Test Owner', 'owner@test.com', '9999999999', 'owner', NOW(), NOW())
  RETURNING id INTO test_user_id;
  
  RAISE NOTICE 'Created test user: %', test_owner_id;
  RAISE NOTICE 'Created test shop: %', test_shop_id;
  RAISE NOTICE 'Created user record: %', test_user_id;
  RAISE NOTICE 'Login with: owner@test.com / password123';
END $$;
