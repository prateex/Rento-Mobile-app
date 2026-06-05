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
      'b817dab5-ed5f-4c80-8835-ce2f21b37ed5'::uuid,  -- Replace with actual auth_user_id
      '3df3f176-b492-4eb9-b17b-ca0fcebf0318'::uuid,  -- Replace with shop_id from Step 1
      'Owner Name',                                   -- Replace with owner's name
      'owner@shop.com',                               -- Replace with owner's email
      'owner',
      true
    );

    -- Update rental_shops.owner_id to point to the auth user
    UPDATE rental_shops
    SET owner_id = 'b817dab5-ed5f-4c80-8835-ce2f21b37ed5'::uuid  -- Replace with auth_user_id
    WHERE id = '3df3f176-b492-4eb9-b17b-ca0fcebf0318'::uuid;    -- Replace with shop_id

  COMMIT;