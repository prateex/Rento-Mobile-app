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
      '8717e124-20fb-4cff-a4e8-89047136d6f0'::uuid,  -- Replace with actual auth_user_id
      '0618b1ef-4d30-4d06-aa2b-8ea0661bd86f'::uuid,  -- Replace with shop_id from Step 1
      'Owner Name',                                   -- Replace with owner's name
      'owner@shop.com',                               -- Replace with owner's email
      'owner',
      true
    );

    -- Update rental_shops.owner_id to point to the auth user
    UPDATE rental_shops
    SET owner_id = '8717e124-20fb-4cff-a4e8-89047136d6f0'::uuid  -- Replace with auth_user_id
    WHERE id = '0618b1ef-4d30-4d06-aa2b-8ea0661bd86f'::uuid;    -- Replace with shop_id

  COMMIT;