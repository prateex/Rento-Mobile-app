BEGIN;
    -- Insert the owner user record
    INSERT INTO users (
      auth_id,
      shop_id,
      name,
      email,
      role,
      is_active
    )
    VALUES (
      '40a3280f-bd58-486c-bd9e-118ce2e9deeb'::uuid,  -- Replace with actual auth_user_id
      '0dbd6263-7dcc-4e3a-b743-bb29de847b36'::uuid,  -- Replace with shop_id from Step 1
      'Owner Name',                                   -- Replace with owner's name
      'owner@shop.com',                               -- Replace with owner's email
      'owner',
      true
    );

    -- Update rental_shops.owner_id to point to the auth user
    UPDATE rental_shops
    SET owner_id = '40a3280f-bd58-486c-bd9e-118ce2e9deeb'::uuid  -- Replace with auth_user_id
    WHERE id = '0dbd6263-7dcc-4e3a-b743-bb29de847b36'::uuid;    -- Replace with shop_id

  COMMIT;
