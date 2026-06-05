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
      '1504daa7-d004-424d-b4f8-22a82b05c8c2'::uuid,  -- Replace with actual auth_user_id
      '28966a4e-a34e-43c7-9a54-e3068c583410'::uuid,  -- Replace with shop_id from Step 1
      'Owner Name',                                   -- Replace with owner's name
      'owner@shop.com',                               -- Replace with owner's email
      'owner',
      true
    );

    -- Update rental_shops.owner_id to point to the auth user
    UPDATE rental_shops
    SET owner_id = '1504daa7-d004-424d-b4f8-22a82b05c8c2'::uuid  -- Replace with auth_user_id
    WHERE id = '28966a4e-a34e-43c7-9a54-e3068c583410'::uuid;    -- Replace with shop_id

  COMMIT;