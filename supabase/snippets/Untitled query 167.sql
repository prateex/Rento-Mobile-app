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
      'a3305c79-c1bc-49e2-8403-555653f0348f'::uuid,  -- Replace with actual auth_user_id
      'f3211e03-5fb4-4550-bc47-c8f7b9e6441d'::uuid,  -- Replace with shop_id from Step 1
      'Owner Name',                                   -- Replace with owner's name
      'owner@shop.com',                               -- Replace with owner's email
      'owner',
      true
    );

    -- Update rental_shops.owner_id to point to the auth user
    UPDATE rental_shops
    SET owner_id = 'a3305c79-c1bc-49e2-8403-555653f0348f'::uuid  -- Replace with auth_user_id
    WHERE id = 'f3211e03-5fb4-4550-bc47-c8f7b9e6441d'::uuid;    -- Replace with shop_id

  COMMIT;