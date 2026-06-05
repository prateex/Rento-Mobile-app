-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- Strict shop isolation with NO recursion
-- ============================================

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE damages ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SHOPS POLICIES
-- Users can only see/update their own shop
-- ============================================
CREATE POLICY shops_select_own 
  ON shops FOR SELECT 
  USING (id = get_current_user_shop_id());

CREATE POLICY shops_update_own 
  ON shops FOR UPDATE 
  USING (id = get_current_user_shop_id());

-- ============================================
-- USERS POLICIES
-- Users can see their own record + users in same shop
-- Only owners can insert/update/delete users
-- ============================================
CREATE POLICY users_select_own_or_same_shop 
  ON users FOR SELECT 
  USING (
    auth_id = auth.uid() 
    OR shop_id = get_current_user_shop_id()
  );

CREATE POLICY users_insert_owner_only 
  ON users FOR INSERT 
  WITH CHECK (
    is_current_user_owner() 
    AND shop_id = get_current_user_shop_id()
  );

CREATE POLICY users_update_owner_only 
  ON users FOR UPDATE 
  USING (
    is_current_user_owner() 
    AND shop_id = get_current_user_shop_id()
  );

CREATE POLICY users_delete_owner_only 
  ON users FOR DELETE 
  USING (
    is_current_user_owner() 
    AND shop_id = get_current_user_shop_id()
  );

-- ============================================
-- CUSTOMERS POLICIES
-- Full CRUD within own shop
-- ============================================
CREATE POLICY customers_select_own_shop 
  ON customers FOR SELECT 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY customers_insert_own_shop 
  ON customers FOR INSERT 
  WITH CHECK (shop_id = get_current_user_shop_id());

CREATE POLICY customers_update_own_shop 
  ON customers FOR UPDATE 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY customers_delete_owner_only 
  ON customers FOR DELETE 
  USING (
    shop_id = get_current_user_shop_id() 
    AND is_current_user_owner()
  );

-- ============================================
-- VEHICLES POLICIES
-- Full CRUD within own shop
-- ============================================
CREATE POLICY vehicles_select_own_shop 
  ON vehicles FOR SELECT 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY vehicles_insert_own_shop 
  ON vehicles FOR INSERT 
  WITH CHECK (shop_id = get_current_user_shop_id());

CREATE POLICY vehicles_update_own_shop 
  ON vehicles FOR UPDATE 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY vehicles_delete_owner_only 
  ON vehicles FOR DELETE 
  USING (
    shop_id = get_current_user_shop_id() 
    AND is_current_user_owner()
  );

-- ============================================
-- BOOKINGS POLICIES
-- Full CRUD within own shop
-- ============================================
CREATE POLICY bookings_select_own_shop 
  ON bookings FOR SELECT 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY bookings_insert_own_shop 
  ON bookings FOR INSERT 
  WITH CHECK (shop_id = get_current_user_shop_id());

CREATE POLICY bookings_update_own_shop 
  ON bookings FOR UPDATE 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY bookings_delete_owner_only 
  ON bookings FOR DELETE 
  USING (
    shop_id = get_current_user_shop_id() 
    AND is_current_user_owner()
  );

-- ============================================
-- PAYMENTS POLICIES
-- Full CRUD within own shop
-- ============================================
CREATE POLICY payments_select_own_shop 
  ON payments FOR SELECT 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY payments_insert_own_shop 
  ON payments FOR INSERT 
  WITH CHECK (shop_id = get_current_user_shop_id());

CREATE POLICY payments_update_own_shop 
  ON payments FOR UPDATE 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY payments_delete_owner_only 
  ON payments FOR DELETE 
  USING (
    shop_id = get_current_user_shop_id() 
    AND is_current_user_owner()
  );

-- ============================================
-- DAMAGES POLICIES
-- Full CRUD within own shop
-- ============================================
CREATE POLICY damages_select_own_shop 
  ON damages FOR SELECT 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY damages_insert_own_shop 
  ON damages FOR INSERT 
  WITH CHECK (shop_id = get_current_user_shop_id());

CREATE POLICY damages_update_own_shop 
  ON damages FOR UPDATE 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY damages_delete_owner_only 
  ON damages FOR DELETE 
  USING (
    shop_id = get_current_user_shop_id() 
    AND is_current_user_owner()
  );

-- ============================================
-- DOCUMENTS POLICIES
-- Full CRUD within own shop
-- ============================================
CREATE POLICY documents_select_own_shop 
  ON documents FOR SELECT 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY documents_insert_own_shop 
  ON documents FOR INSERT 
  WITH CHECK (shop_id = get_current_user_shop_id());

CREATE POLICY documents_update_own_shop 
  ON documents FOR UPDATE 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY documents_delete_own_shop 
  ON documents FOR DELETE 
  USING (shop_id = get_current_user_shop_id());

-- ============================================
-- CONFIRMATION
-- ============================================
SELECT 'RLS policies created successfully - NO recursion, strict shop isolation' as status;
