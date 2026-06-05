-- ============================================
-- SECURITY HELPER FUNCTIONS
-- Used by RLS policies for shop isolation
-- ============================================

-- ============================================
-- GET CURRENT USER'S SHOP ID
-- Returns shop_id for authenticated user
-- SECURITY DEFINER to avoid recursion in RLS
-- ============================================
CREATE OR REPLACE FUNCTION get_current_user_shop_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_shop_id UUID;
BEGIN
  -- Get shop_id from users table for current auth user
  SELECT shop_id INTO v_shop_id
  FROM users
  WHERE auth_id = auth.uid()
  LIMIT 1;
  
  RETURN v_shop_id;
END;
$$;

COMMENT ON FUNCTION get_current_user_shop_id() IS 
'Returns shop_id for current authenticated user. Used in RLS policies to enforce shop isolation. SECURITY DEFINER to prevent infinite recursion.';

-- ============================================
-- CHECK IF USER IS OWNER
-- Returns true if current user has owner role
-- ============================================
CREATE OR REPLACE FUNCTION is_current_user_owner()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_is_owner BOOLEAN;
BEGIN
  SELECT (role = 'owner') INTO v_is_owner
  FROM users
  WHERE auth_id = auth.uid()
  LIMIT 1;
  
  RETURN COALESCE(v_is_owner, false);
END;
$$;

COMMENT ON FUNCTION is_current_user_owner() IS 
'Returns true if current user has owner role. Used for owner-only operations.';

-- ============================================
-- CONFIRMATION
-- ============================================
SELECT 'Security helper functions created successfully' as status;
