-- Migration: Add multi-tenant user and shop management functions
-- This migration adds 6 SQL functions for safe, repeatable shop and user creation
-- Functions enforce RLS, validate inputs, and prevent data inconsistencies

-- ============================================================================
-- FUNCTION 1: Create a rental shop
-- ============================================================================

CREATE OR REPLACE FUNCTION create_rental_shop(
  p_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_pincode TEXT DEFAULT NULL,
  p_gst_number TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_shop_id UUID;
BEGIN
  -- Validate required inputs
  IF p_name IS NULL OR TRIM(p_name) = '' THEN
    RAISE EXCEPTION 'Shop name is required and cannot be empty';
  END IF;

  -- Create shop
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
    auth.uid(),
    TRIM(p_name),
    TRIM(p_phone),
    TRIM(p_email),
    TRIM(p_address),
    TRIM(p_city),
    TRIM(p_state),
    TRIM(p_pincode),
    TRIM(p_gst_number)
  )
  RETURNING id INTO v_shop_id;

  RETURN v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION 2: Create and assign shop owner
-- ============================================================================

CREATE OR REPLACE FUNCTION create_owner(
  p_auth_user_id UUID,
  p_shop_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_existing_owner_count INTEGER;
BEGIN
  -- Validate inputs
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth user ID is required';
  END IF;
  
  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'Shop ID is required';
  END IF;

  -- Check if shop exists
  IF NOT EXISTS (SELECT 1 FROM rental_shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'Shop does not exist: %', p_shop_id;
  END IF;

  -- Check if auth user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_auth_user_id) THEN
    RAISE EXCEPTION 'Auth user does not exist: %', p_auth_user_id;
  END IF;

  -- Check if user already exists in this shop
  IF EXISTS (SELECT 1 FROM users WHERE auth_id = p_auth_user_id AND shop_id = p_shop_id) THEN
    RAISE EXCEPTION 'User already exists in this shop';
  END IF;

  -- Check if shop already has an owner
  SELECT COUNT(*) INTO v_existing_owner_count
  FROM users
  WHERE shop_id = p_shop_id AND role = 'owner';

  IF v_existing_owner_count > 0 THEN
    RAISE EXCEPTION 'Shop already has an owner. Promote an existing staff member instead.';
  END IF;

  -- Create owner user record
  INSERT INTO users (
    auth_id,
    shop_id,
    name,
    email,
    role,
    is_active
  )
  VALUES (
    p_auth_user_id,
    p_shop_id,
    COALESCE((SELECT email FROM auth.users WHERE id = p_auth_user_id), 'Unknown'),
    (SELECT email FROM auth.users WHERE id = p_auth_user_id),
    'owner',
    true
  )
  RETURNING id INTO v_user_id;

  -- Update rental_shops.owner_id to point to the actual auth user
  UPDATE rental_shops
  SET owner_id = p_auth_user_id
  WHERE id = p_shop_id;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION 3: Create and assign staff member
-- ============================================================================

CREATE OR REPLACE FUNCTION create_staff(
  p_auth_user_id UUID,
  p_shop_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Validate inputs
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth user ID is required';
  END IF;
  
  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'Shop ID is required';
  END IF;

  -- Check if shop exists
  IF NOT EXISTS (SELECT 1 FROM rental_shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'Shop does not exist: %', p_shop_id;
  END IF;

  -- Check if auth user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_auth_user_id) THEN
    RAISE EXCEPTION 'Auth user does not exist: %', p_auth_user_id;
  END IF;

  -- Check if user already exists in this shop (any role)
  IF EXISTS (SELECT 1 FROM users WHERE auth_id = p_auth_user_id AND shop_id = p_shop_id) THEN
    RAISE EXCEPTION 'User already exists in this shop';
  END IF;

  -- Create staff user record
  INSERT INTO users (
    auth_id,
    shop_id,
    name,
    email,
    role,
    is_active
  )
  VALUES (
    p_auth_user_id,
    p_shop_id,
    COALESCE((SELECT email FROM auth.users WHERE id = p_auth_user_id), 'Unknown'),
    (SELECT email FROM auth.users WHERE id = p_auth_user_id),
    'staff',
    true
  )
  RETURNING id INTO v_user_id;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION 4: Promote staff member to owner
-- ============================================================================

CREATE OR REPLACE FUNCTION promote_staff_to_owner(
  p_auth_user_id UUID,
  p_shop_id UUID
)
RETURNS TEXT AS $$
DECLARE
  v_current_owner_auth_id UUID;
  v_user_role user_role;
BEGIN
  -- Validate inputs
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth user ID is required';
  END IF;
  
  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'Shop ID is required';
  END IF;

  -- Check if shop exists
  IF NOT EXISTS (SELECT 1 FROM rental_shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'Shop does not exist: %', p_shop_id;
  END IF;

  -- Check if user exists in this shop
  IF NOT EXISTS (SELECT 1 FROM users WHERE auth_id = p_auth_user_id AND shop_id = p_shop_id) THEN
    RAISE EXCEPTION 'User does not exist in this shop: %', p_auth_user_id;
  END IF;

  -- Check if user is already owner
  SELECT role INTO v_user_role
  FROM users
  WHERE auth_id = p_auth_user_id AND shop_id = p_shop_id;

  IF v_user_role = 'owner' THEN
    RETURN 'User is already the owner of this shop';
  END IF;

  -- Find current owner (if any)
  SELECT auth_id INTO v_current_owner_auth_id
  FROM users
  WHERE shop_id = p_shop_id AND role = 'owner'
  LIMIT 1;

  -- If there's a current owner, demote them to staff
  IF v_current_owner_auth_id IS NOT NULL THEN
    UPDATE users
    SET role = 'staff'
    WHERE auth_id = v_current_owner_auth_id AND shop_id = p_shop_id;
  END IF;

  -- Promote the staff member to owner
  UPDATE users
  SET role = 'owner'
  WHERE auth_id = p_auth_user_id AND shop_id = p_shop_id;

  -- Update rental_shops.owner_id to the new owner
  UPDATE rental_shops
  SET owner_id = p_auth_user_id
  WHERE id = p_shop_id;

  RETURN 'User promoted to owner successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION 5: Deactivate user (soft delete)
-- ============================================================================

CREATE OR REPLACE FUNCTION deactivate_user(
  p_auth_user_id UUID
)
RETURNS TEXT AS $$
DECLARE
  v_rows_affected INTEGER;
BEGIN
  -- Validate input
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth user ID is required';
  END IF;

  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE auth_id = p_auth_user_id) THEN
    RAISE EXCEPTION 'User does not exist: %', p_auth_user_id;
  END IF;

  -- Deactivate user (soft delete)
  UPDATE users
  SET is_active = false, updated_at = now()
  WHERE auth_id = p_auth_user_id;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  RETURN 'User deactivated successfully. ' || v_rows_affected || ' record(s) updated.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION 6: Get current user context
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_user_context()
RETURNS TABLE (
  user_id UUID,
  shop_id UUID,
  role user_role,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    users.id,
    users.shop_id,
    users.role,
    users.is_active
  FROM users
  WHERE users.auth_id = auth.uid()
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Add unique constraint to prevent multiple owners per shop
-- ============================================================================

CREATE UNIQUE INDEX idx_unique_owner_per_shop
ON users (shop_id, role)
WHERE role = 'owner';
