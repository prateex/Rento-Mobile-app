-- Link rental shop and staff user for usera@test.com
DO $$
DECLARE
  v_auth uuid;
BEGIN
  SELECT id INTO v_auth FROM auth.users WHERE email='usera@test.com';
  IF v_auth IS NULL THEN
    RAISE EXCEPTION 'Auth user not found';
  END IF;
  INSERT INTO rental_shops (id, owner_id, name, phone, email, address, created_at, updated_at)
  VALUES ('660e8400-e29b-41d4-a716-446655440001'::uuid, v_auth, 'UserA Shop', '9876543212', 'shopa@test.com', 'Test Address A', now(), now())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO users (id, shop_id, auth_id, name, phone, role, is_active, created_at)
  VALUES ('770e8400-e29b-41d4-a716-446655440001'::uuid, '660e8400-e29b-41d4-a716-446655440001'::uuid, v_auth, 'User A', '9876543213', 'admin', true, now())
  ON CONFLICT (id) DO UPDATE SET auth_id=EXCLUDED.auth_id, is_active=EXCLUDED.is_active;
END$$;