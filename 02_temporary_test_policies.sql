-- ============================================
-- STEP 2: TEMPORARY TEST POLICIES
-- These allow ANY authenticated user to read ALL data
-- If app shows data with these, we KNOW the issue is RLS policies
-- ============================================

-- Temporarily allow all users to read all rows
CREATE POLICY "test_users_select" ON users FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "test_customers_select" ON customers FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "test_vehicles_select" ON vehicles FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "test_bookings_select" ON bookings FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

-- ============================================
-- NOTE: Test in your app now:
-- 1. Refresh customers page
-- 2. Refresh vehicles page
-- 3. Refresh bookings page
--
-- If data appears = RLS policies are the problem (expected)
-- If data still blank = Different issue (schema, auth, triggers)
-- ============================================
