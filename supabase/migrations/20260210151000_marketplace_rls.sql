-- Marketplace RLS policies from backend migrations
BEGIN;

-- Helper functions
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM platform_users
  WHERE auth_id = auth.uid()
  LIMIT 1;

  IF v_role IS NULL THEN
    SELECT role INTO v_role
    FROM users
    WHERE auth_id = auth.uid()
    LIMIT 1;
  END IF;

  RETURN COALESCE(v_role, 'customer');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog, public;

CREATE OR REPLACE FUNCTION is_owner_of_shop(p_shop_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM rental_shops
    WHERE id = p_shop_id AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog, public;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role() = 'admin';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog, public;

-- Enable RLS on marketplace tables
ALTER TABLE platform_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_payments ENABLE ROW LEVEL SECURITY;

-- Enable RLS on existing tables used by marketplace policies
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- platform_users policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'platform_users'
      AND policyname = 'Users can view own profile'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view own profile" ON platform_users FOR SELECT USING (auth_id = auth.uid() OR is_admin())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'platform_users'
      AND policyname = 'Users can update own profile'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update own profile" ON platform_users FOR UPDATE USING (auth_id = auth.uid()) WITH CHECK (auth_id = auth.uid())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'platform_users'
      AND policyname = 'Only system can create users'
  ) THEN
    EXECUTE 'CREATE POLICY "Only system can create users" ON platform_users FOR INSERT WITH CHECK (is_admin())';
  END IF;
END $$;

-- vehicle_images policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vehicle_images'
      AND policyname = 'View images for visible vehicles'
  ) THEN
    EXECUTE 'CREATE POLICY "View images for visible vehicles" ON vehicle_images FOR SELECT USING ((SELECT owner_id FROM vehicles WHERE id = vehicle_id) = (SELECT id FROM rental_shops WHERE owner_id = auth.uid()) OR (SELECT is_listed_marketplace FROM vehicles WHERE id = vehicle_id) = true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vehicle_images'
      AND policyname = 'Owners can manage vehicle images'
  ) THEN
    EXECUTE 'CREATE POLICY "Owners can manage vehicle images" ON vehicle_images FOR INSERT WITH CHECK ((SELECT owner_id FROM vehicles WHERE id = vehicle_id) IN (SELECT id FROM rental_shops WHERE owner_id = auth.uid()))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vehicle_images'
      AND policyname = 'Owners can delete own images'
  ) THEN
    EXECUTE 'CREATE POLICY "Owners can delete own images" ON vehicle_images FOR DELETE USING ((SELECT owner_id FROM vehicles WHERE id = vehicle_id) IN (SELECT id FROM rental_shops WHERE owner_id = auth.uid()))';
  END IF;
END $$;

-- marketplace_payments policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'marketplace_payments'
      AND policyname = 'Customers view own payments'
  ) THEN
    EXECUTE 'CREATE POLICY "Customers view own payments" ON marketplace_payments FOR SELECT USING ((SELECT customer_auth_id FROM bookings WHERE id = booking_id) = auth.uid() OR (SELECT owner_id FROM bookings WHERE id = booking_id) IN (SELECT id FROM rental_shops WHERE owner_id = auth.uid()) OR is_admin())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'marketplace_payments'
      AND policyname = 'Only system can modify payments'
  ) THEN
    EXECUTE 'CREATE POLICY "Only system can modify payments" ON marketplace_payments FOR ALL WITH CHECK (is_admin())';
  END IF;
END $$;

-- vehicles policies (marketplace + owner access)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vehicles'
      AND policyname = 'View public marketplace vehicles'
  ) THEN
    EXECUTE 'CREATE POLICY "View public marketplace vehicles" ON vehicles FOR SELECT USING ((is_listed_marketplace = true AND status = ''Available'') OR (owner_id IN (SELECT id FROM rental_shops WHERE owner_id = auth.uid())) OR (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())) OR is_admin())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vehicles'
      AND policyname = 'Owners can insert vehicles'
  ) THEN
    EXECUTE 'CREATE POLICY "Owners can insert vehicles" ON vehicles FOR INSERT WITH CHECK (owner_id IN (SELECT id FROM rental_shops WHERE owner_id = auth.uid()))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vehicles'
      AND policyname = 'Owners can update own vehicles'
  ) THEN
    EXECUTE 'CREATE POLICY "Owners can update own vehicles" ON vehicles FOR UPDATE USING (owner_id IN (SELECT id FROM rental_shops WHERE owner_id = auth.uid()) OR is_admin()) WITH CHECK (owner_id IN (SELECT id FROM rental_shops WHERE owner_id = auth.uid()) OR is_admin())';
  END IF;
END $$;

-- bookings policies (online + owner/staff access)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bookings'
      AND policyname = 'Customers view own bookings'
  ) THEN
    EXECUTE 'CREATE POLICY "Customers view own bookings" ON bookings FOR SELECT USING ((is_online_booking = true AND customer_auth_id = auth.uid()) OR (is_online_booking = false AND customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())) OR (owner_id IN (SELECT id FROM rental_shops WHERE owner_id = auth.uid())) OR (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())) OR is_admin())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bookings'
      AND policyname = 'Customers can create online bookings'
  ) THEN
    EXECUTE 'CREATE POLICY "Customers can create online bookings" ON bookings FOR INSERT WITH CHECK (is_online_booking = true AND customer_auth_id = auth.uid() AND get_user_role() = ''customer'')';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bookings'
      AND policyname = 'Customers can update own bookings'
  ) THEN
    EXECUTE 'CREATE POLICY "Customers can update own bookings" ON bookings FOR UPDATE USING ((is_online_booking = true AND customer_auth_id = auth.uid()) OR (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())) OR is_admin()) WITH CHECK ((is_online_booking = true AND customer_auth_id = auth.uid()) OR (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())) OR is_admin())';
  END IF;
END $$;

-- customers policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customers'
      AND policyname = 'View customers in accessible shops'
  ) THEN
    EXECUTE 'CREATE POLICY "View customers in accessible shops" ON customers FOR SELECT USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()) OR is_admin())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customers'
      AND policyname = 'Staff can manage customers'
  ) THEN
    EXECUTE 'CREATE POLICY "Staff can manage customers" ON customers FOR UPDATE USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()) OR is_admin()) WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()) OR is_admin())';
  END IF;
END $$;

COMMIT;
