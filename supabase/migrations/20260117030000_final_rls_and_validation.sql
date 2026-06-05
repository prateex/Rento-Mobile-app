-- Final schema validation and RLS fix

BEGIN;

-- Ensure pgcrypto is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure RLS is properly configured
ALTER TABLE rental_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_id_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE damages ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_damage_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_number_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_number_counters ENABLE ROW LEVEL SECURITY;

-- Ensure all critical policies exist
DROP POLICY IF EXISTS shop_access_all ON rental_shops;
DROP POLICY IF EXISTS shop_access_all ON users;
DROP POLICY IF EXISTS shop_access_all ON vehicles;
DROP POLICY IF EXISTS shop_access_all ON customers;
DROP POLICY IF EXISTS shop_access_all ON customer_id_photos;
DROP POLICY IF EXISTS shop_access_all ON bookings;
DROP POLICY IF EXISTS shop_access_all ON payments;
DROP POLICY IF EXISTS shop_access_all ON damages;
DROP POLICY IF EXISTS shop_access_all ON vehicle_damage_photos;
DROP POLICY IF EXISTS shop_access_all ON documents;
DROP POLICY IF EXISTS shop_access_all ON invoice_sequences;
DROP POLICY IF EXISTS shop_access_all ON customer_sequences;
DROP POLICY IF EXISTS shop_access_all ON booking_number_counters;
DROP POLICY IF EXISTS shop_access_all ON invoice_number_counters;

-- Create unified shop access policy
CREATE POLICY shop_access_all ON rental_shops FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- CRITICAL: users table uses auth_id directly (NO recursion, NO shop lookup)
-- These policies were already defined correctly in 010000 migration
-- DO NOT override them with shop_id checks that cause recursion

CREATE POLICY shop_access_all ON vehicles FOR ALL USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())) WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY shop_access_all ON customers FOR ALL USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())) WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY shop_access_all ON customer_id_photos FOR ALL USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())) WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY shop_access_all ON bookings FOR ALL USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())) WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY shop_access_all ON payments FOR ALL USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())) WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY shop_access_all ON damages FOR ALL USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())) WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY shop_access_all ON vehicle_damage_photos FOR ALL USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())) WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY shop_access_all ON documents FOR ALL USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())) WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY shop_access_all ON invoice_sequences FOR ALL USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())) WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY shop_access_all ON customer_sequences FOR ALL USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())) WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY shop_access_all ON booking_number_counters FOR ALL USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())) WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY shop_access_all ON invoice_number_counters FOR ALL USING (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())) WITH CHECK (shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid()));

-- Validation block
DO $$
BEGIN
  RAISE NOTICE '✓✓✓ MIGRATION COMPLETE ✓✓✓';
  RAISE NOTICE '✓ pgcrypto enabled';
  RAISE NOTICE '✓ RLS enabled on all tables';
  RAISE NOTICE '✓ Shop access policies created';
  RAISE NOTICE '✓ All operations ready to test';
END $$;

COMMIT;
