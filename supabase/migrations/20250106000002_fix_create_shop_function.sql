-- Migration: Fix create_rental_shop function to accept owner_id parameter
-- This allows the function to work both from app code and SQL Editor

-- Drop and recreate the function with owner_id as a required parameter
DROP FUNCTION IF EXISTS create_rental_shop(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION create_rental_shop(
  p_owner_id UUID,
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
  IF p_owner_id IS NULL THEN
    RAISE EXCEPTION 'Owner ID is required';
  END IF;

  IF p_name IS NULL OR TRIM(p_name) = '' THEN
    RAISE EXCEPTION 'Shop name is required and cannot be empty';
  END IF;

  -- Check if owner (auth user) exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_owner_id) THEN
    RAISE EXCEPTION 'Owner (auth user) does not exist: %', p_owner_id;
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
    p_owner_id,
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
