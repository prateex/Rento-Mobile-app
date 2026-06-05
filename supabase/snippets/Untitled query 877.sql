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
      '74d05a44-4f84-4519-86ad-b5b92553278d'::uuid,  -- Replace with actual auth_user_id
      '720e8733-ffa3-4969-8b07-e350a33d134a'::uuid,  -- Replace with shop_id from Step 1
      'Owner Name',                                   -- Replace with owner's name
      'owner@shop.com',                               -- Replace with owner's email
      'owner',
      true
    );

    -- Update rental_shops.owner_id to point to the auth user
    UPDATE rental_shops
    SET owner_id = '74d05a44-4f84-4519-86ad-b5b92553278d'::uuid  -- Replace with auth_user_id
    WHERE id = '720e8733-ffa3-4969-8b07-e350a33d134a'::uuid;    -- Replace with shop_id

  COMMIT;
