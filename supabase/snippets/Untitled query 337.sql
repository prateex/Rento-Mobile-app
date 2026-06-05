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
      '76b61ddc-9a37-443e-b391-5695f5a86d40'::uuid,  -- Replace with actual auth_user_id
      'c215cb5c-3aff-4a17-a15d-109af704da51'::uuid,  -- Replace with shop_id from Step 1
      'Owner Name',                                   -- Replace with owner's name
      'owner@shop.com',                               -- Replace with owner's email
      'owner',
      true
    );

    -- Update rental_shops.owner_id to point to the auth user
    UPDATE rental_shops
    SET owner_id = '76b61ddc-9a37-443e-b391-5695f5a86d40'::uuid  -- Replace with auth_user_id
    WHERE id = 'c215cb5c-3aff-4a17-a15d-109af704da51'::uuid;    -- Replace with shop_id

  COMMIT;