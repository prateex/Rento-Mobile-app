-- ============================================
-- QUICK FIX: Apply this in Supabase SQL Editor
-- ============================================

-- Step 1: Drop old recursive function
DROP FUNCTION IF EXISTS get_current_user_context();

-- Step 2: Create safe helper functions
CREATE OR REPLACE FUNCTION auth.get_user_shop_id()
RETURNS UUID AS $$
DECLARE v_shop_id UUID;
BEGIN
  SELECT shop_id INTO v_shop_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
  RETURN v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS TEXT AS $$
DECLARE v_role TEXT;
BEGIN
  SELECT role::TEXT INTO v_role FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.is_user_active()
RETURNS BOOLEAN AS $$
DECLARE v_is_active BOOLEAN;
BEGIN
  SELECT is_active INTO v_is_active FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
  RETURN COALESCE(v_is_active, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION auth.get_user_shop_id() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_user_active() TO authenticated;

-- Step 3: Drop ALL old policies
DROP POLICY IF EXISTS "users_select_policy" ON users;
DROP POLICY IF EXISTS "users_insert_policy" ON users;
DROP POLICY IF EXISTS "users_update_policy" ON users;
DROP POLICY IF EXISTS "users_delete_policy" ON users;

-- Step 4: Create NEW safe policies for users table
CREATE POLICY "users_select_policy" ON users FOR SELECT TO authenticated
USING (
  auth_id = auth.uid()
  OR (auth.is_user_active() = TRUE AND (
    auth.get_user_role() = 'SUPER_ADMIN'
    OR (shop_id IS NOT NULL AND shop_id = auth.get_user_shop_id())
  ))
);

CREATE POLICY "users_insert_policy" ON users FOR INSERT TO authenticated
WITH CHECK (
  auth.is_user_active() = TRUE
  AND (
    auth.get_user_role() = 'SUPER_ADMIN'
    OR (auth.get_user_role() = 'SHOP_OWNER' AND shop_id = auth.get_user_shop_id())
  )
);

CREATE POLICY "users_update_policy" ON users FOR UPDATE TO authenticated
USING (
  auth_id = auth.uid()
  OR (auth.is_user_active() = TRUE AND (
    auth.get_user_role() = 'SUPER_ADMIN'
    OR (auth.get_user_role() = 'SHOP_OWNER' AND shop_id = auth.get_user_shop_id())
  ))
)
WITH CHECK (
  auth_id = auth.uid()
  OR (auth.is_user_active() = TRUE AND (
    auth.get_user_role() = 'SUPER_ADMIN'
    OR (auth.get_user_role() = 'SHOP_OWNER' AND shop_id = auth.get_user_shop_id())
  ))
);

CREATE POLICY "users_delete_policy" ON users FOR DELETE TO authenticated
USING (auth.is_user_active() = TRUE AND auth.get_user_role() = 'SUPER_ADMIN');

-- Step 5: Verify
SELECT 'DONE! Test with: SELECT * FROM users WHERE auth_id = auth.uid();' as status;
