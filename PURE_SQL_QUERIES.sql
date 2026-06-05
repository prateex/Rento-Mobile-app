-- ============================================================================
-- PURE SQL QUERIES FOR MULTI-TENANT RENTAL APP
-- ============================================================================
-- All queries use direct SQL - NO functions, NO RPC, NO JavaScript
-- Copy-paste ready for Supabase SQL Editor or psql
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE A NEW SHOP
-- ============================================================================
-- Inserts a new rental shop
-- Returns: shop_id (UUID)
-- Usage: Fill in the shop details, run the query, copy the returned shop_id

INSERT INTO rental_shops (
  owner_id,
  name,
  phone,
  email,
  address,
  city,
  state,
  pincode,
  gst_number
)
VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,  -- Placeholder owner_id (will be updated in step 2)
  'My Rental Shop',                              -- Change this to your shop name
  '9876543210',                                  -- Change to phone
  'shop@myrental.com',                           -- Change to email
  '123 Main St',                                 -- Change to address
  'New York',                                    -- Change to city
  'NY',                                          -- Change to state
  '10001',                                       -- Change to pincode
  'GST123'                                       -- Change to GST number
)
RETURNING id AS shop_id;

-- After running this, save the shop_id returned (e.g., 5a572e3f-1453-46a1-9151-86ef715d45d3)

-- ============================================================================
-- STEP 2: ADD AN OWNER TO A SHOP
-- ============================================================================
-- Links an authenticated user as OWNER to a shop
-- Prerequisites:
--   - auth_user_id must exist in auth.users
--   - shop_id must exist in rental_shops
-- Rules:
--   - Only ONE owner allowed per shop
--   - Fails if owner already exists for this shop

-- QUERY 2A: Check if shop already has an owner (optional, for verification)
SELECT COUNT(*) as owner_count
FROM users
WHERE shop_id = '5a572e3f-1453-46a1-9151-86ef715d45d3'::uuid  -- Replace with your shop_id
  AND role = 'owner'
  AND is_active = true;

-- If owner_count is 0, proceed to QUERY 2B

-- QUERY 2B: Add owner to shop
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
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,  -- Replace with actual auth_user_id
      '5a572e3f-1453-46a1-9151-86ef715d45d3'::uuid,  -- Replace with shop_id from Step 1
      'Owner Name',                                   -- Replace with owner's name
      'owner@shop.com',                               -- Replace with owner's email
      'owner',
      true
    );

    -- Update rental_shops.owner_id to point to the auth user
    UPDATE rental_shops
    SET owner_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid  -- Replace with auth_user_id
    WHERE id = '5a572e3f-1453-46a1-9151-86ef715d45d3'::uuid;    -- Replace with shop_id

  COMMIT;

-- If successful, you'll see "INSERT 1" or "UPDATE 1" messages

-- ============================================================================
-- STEP 3: ADD A STAFF USER TO A SHOP
-- ============================================================================
-- Links an authenticated user as STAFF to a shop
-- Prerequisites:
--   - auth_user_id must exist in auth.users
--   - shop_id must exist in rental_shops
-- Rules:
--   - Multiple staff allowed per shop
--   - Same user cannot be added twice to same shop

INSERT INTO users (
  auth_id,
  shop_id,
  name,
  email,
  role,
  is_active
)
VALUES (
  'c3d4e5f6-a7b8-9012-cdef-123456789012'::uuid,  -- Replace with actual auth_user_id
  '5a572e3f-1453-46a1-9151-86ef715d45d3'::uuid,  -- Replace with shop_id
  'Staff Name',                                   -- Replace with staff name
  'staff@shop.com',                               -- Replace with staff email
  'staff',
  true
);

-- If successful, you'll see "INSERT 1" message

-- ============================================================================
-- STEP 4: PROMOTE STAFF TO OWNER
-- ============================================================================
-- Demotes current owner to staff, promotes selected staff to owner
-- Prerequisites:
--   - auth_user_id (staff member to promote) must exist in users
--   - shop_id must exist
--   - User must currently have role = 'staff'
-- Result:
--   - Old owner → role = 'staff'
--   - New owner → role = 'owner'
--   - Only ONE owner per shop

BEGIN;
  -- Find current owner of the shop
  WITH current_owner AS (
    SELECT auth_id FROM users
    WHERE shop_id = '5a572e3f-1453-46a1-9151-86ef715d45d3'::uuid
      AND role = 'owner'
      AND is_active = true
    LIMIT 1
  )
  -- Demote current owner to staff
  UPDATE users
  SET role = 'staff'
  WHERE auth_id IN (SELECT auth_id FROM current_owner)
    AND shop_id = '5a572e3f-1453-46a1-9151-86ef715d45d3'::uuid;

  -- Promote selected staff to owner
  UPDATE users
  SET role = 'owner'
  WHERE auth_id = 'c3d4e5f6-a7b8-9012-cdef-123456789012'::uuid  -- Replace with staff auth_user_id
    AND shop_id = '5a572e3f-1453-46a1-9151-86ef715d45d3'::uuid;

  -- Update rental_shops.owner_id to the new owner
  UPDATE rental_shops
  SET owner_id = 'c3d4e5f6-a7b8-9012-cdef-123456789012'::uuid  -- Replace with new owner's auth_user_id
  WHERE id = '5a572e3f-1453-46a1-9151-86ef715d45d3'::uuid;

COMMIT;

-- If successful, you'll see update confirmation messages

-- ============================================================================
-- STEP 5: DEACTIVATE A USER (SOFT DELETE)
-- ============================================================================
-- Sets is_active = false so user cannot access the app
-- Does NOT delete from auth.users (preserves audit trail)
-- Does NOT delete related records (bookings, vehicles, etc.)
-- Prerequisites:
--   - auth_user_id must exist in users table

UPDATE users
SET is_active = false, updated_at = now()
WHERE auth_id = 'c3d4e5f6-a7b8-9012-cdef-123456789012'::uuid;  -- Replace with auth_user_id

-- If successful, you'll see "UPDATE 1" message

-- ============================================================================
-- STEP 6: RE-ACTIVATE A USER
-- ============================================================================
-- Sets is_active = true to restore access
-- Prerequisites:
--   - User previously deactivated

UPDATE users
SET is_active = true, updated_at = now()
WHERE auth_id = 'c3d4e5f6-a7b8-9012-cdef-123456789012'::uuid;  -- Replace with auth_user_id

-- ============================================================================
-- STEP 7: LIST ALL USERS OF A SHOP
-- ============================================================================
-- Shows all users (active and inactive) for a given shop
-- Includes: user_id, auth_id, name, email, role, is_active, created_at

SELECT
  id AS user_id,
  auth_id,
  name,
  email,
  role,
  is_active,
  created_at
FROM users
WHERE shop_id = '5a572e3f-1453-46a1-9151-86ef715d45d3'::uuid  -- Replace with shop_id
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 8: LIST ONLY ACTIVE USERS OF A SHOP
-- ============================================================================
-- Shows only active users

SELECT
  id AS user_id,
  auth_id,
  name,
  email,
  role,
  created_at
FROM users
WHERE shop_id = '5a572e3f-1453-46a1-9151-86ef715d45d3'::uuid  -- Replace with shop_id
  AND is_active = true
ORDER BY role DESC, created_at ASC;

-- ============================================================================
-- STEP 9: GET CURRENT USER CONTEXT
-- ============================================================================
-- Given an auth_user_id, returns their role, shop_id, and active status
-- Useful for determining what the user can access after login
-- Prerequisites:
--   - auth_user_id must exist in users table

SELECT
  id AS user_id,
  auth_id,
  shop_id,
  role,
  is_active,
  created_at
FROM users
WHERE auth_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid  -- Replace with auth_user_id
LIMIT 1;

-- Returns: user_id, shop_id, role, is_active
-- Use this to determine what data the user can see in the app

-- ============================================================================
-- STEP 10: GET ALL SHOPS FOR AN OWNER
-- ============================================================================
-- Lists all shops owned by a specific auth user

SELECT
  id AS shop_id,
  name,
  email,
  city,
  state,
  created_at
FROM rental_shops
WHERE owner_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid  -- Replace with owner's auth_user_id
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 11: GET SHOP DETAILS
-- ============================================================================
-- View complete information about a shop

SELECT
  id AS shop_id,
  owner_id,
  name,
  phone,
  email,
  address,
  city,
  state,
  pincode,
  gst_number,
  created_at,
  updated_at
FROM rental_shops
WHERE id = '5a572e3f-1453-46a1-9151-86ef715d45d3'::uuid;  -- Replace with shop_id

-- ============================================================================
-- STEP 12: UPDATE SHOP DETAILS
-- ============================================================================
-- Modify shop information

UPDATE rental_shops
SET
  name = 'Updated Shop Name',
  phone = '1234567890',
  email = 'newemail@shop.com',
  address = '456 New St',
  city = 'Los Angeles',
  state = 'CA',
  pincode = '90001',
  gst_number = 'GST456',
  updated_at = now()
WHERE id = '5a572e3f-1453-46a1-9151-86ef715d45d3'::uuid;  -- Replace with shop_id

-- If successful, you'll see "UPDATE 1" message

-- ============================================================================
-- STEP 13: UPDATE USER PROFILE
-- ============================================================================
-- Modify user's name, email, or other details

UPDATE users
SET
  name = 'Updated Name',
  email = 'newemail@user.com',
  updated_at = now()
WHERE auth_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid;  -- Replace with auth_user_id

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if a user exists in the users table
SELECT COUNT(*) as user_exists
FROM users
WHERE auth_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid;

-- Check how many shops exist
SELECT COUNT(*) as total_shops
FROM rental_shops;

-- Check how many users exist across all shops
SELECT COUNT(*) as total_users
FROM users;

-- Check active vs inactive users
SELECT
  is_active,
  COUNT(*) as user_count
FROM users
GROUP BY is_active;

-- Check owners vs staff
SELECT
  role,
  COUNT(*) as count
FROM users
WHERE is_active = true
GROUP BY role;

-- ============================================================================
-- USEFUL DATA CLEANUP QUERIES (USE WITH CAUTION)
-- ============================================================================

-- DEACTIVATE ALL STAFF IN A SHOP (keep owner active)
UPDATE users
SET is_active = false, updated_at = now()
WHERE shop_id = '5a572e3f-1453-46a1-9151-86ef715d45d3'::uuid
  AND role = 'staff';

-- DEACTIVATE ALL USERS IN A SHOP (including owner)
UPDATE users
SET is_active = false, updated_at = now()
WHERE shop_id = '5a572e3f-1453-46a1-9151-86ef715d45d3'::uuid;

-- DELETE SOFT-DELETED USERS (PERMANENT - be careful!)
-- Only deletes records where is_active = false AND deleted more than 30 days ago
DELETE FROM users
WHERE is_active = false
  AND updated_at < NOW() - INTERVAL '30 days';

-- ============================================================================
-- TRANSACTION EXAMPLE: COMPLETE SHOP + OWNER + STAFF SETUP
-- ============================================================================
-- This creates a complete shop with owner and multiple staff members
-- All operations succeed together or all fail together

BEGIN;

  -- Create shop
  WITH new_shop AS (
    INSERT INTO rental_shops (
      owner_id,
      name,
      phone,
      email,
      address,
      city,
      state,
      pincode,
      gst_number
    )
    VALUES (
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,  -- Owner auth_user_id
      'Complete Setup Shop',
      '9999999999',
      'complete@shop.com',
      '999 Test Ave',
      'Chicago',
      'IL',
      '60601',
      'GST999'
    )
    RETURNING id
  )
  -- Add owner
  INSERT INTO users (auth_id, shop_id, name, email, role, is_active)
  SELECT
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
    new_shop.id,
    'Owner Name',
    'owner@complete.com',
    'owner',
    true
  FROM new_shop;

  -- Add staff member 1
  INSERT INTO users (auth_id, shop_id, name, email, role, is_active)
  VALUES (
    'c3d4e5f6-a7b8-9012-cdef-123456789012'::uuid,
    (SELECT id FROM rental_shops WHERE name = 'Complete Setup Shop' LIMIT 1),
    'Staff 1',
    'staff1@complete.com',
    'staff',
    true
  );

  -- Add staff member 2
  INSERT INTO users (auth_id, shop_id, name, email, role, is_active)
  VALUES (
    'd4e5f6a7-b8c9-0123-def0-234567890123'::uuid,
    (SELECT id FROM rental_shops WHERE name = 'Complete Setup Shop' LIMIT 1),
    'Staff 2',
    'staff2@complete.com',
    'staff',
    true
  );

COMMIT;

-- If all succeed, you'll see confirmation messages
-- If any fail, all changes are rolled back

-- ============================================================================
-- END OF SQL QUERIES
-- ============================================================================
