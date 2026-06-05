-- MIGRATION 008: RLS POLICIES FOR NEW TABLES
-- Safe to apply: YES (additive policies)

BEGIN;

-- Enable RLS
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_id_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Customer profiles: customers can manage their own profile
CREATE POLICY "Customers can manage own profile"
  ON customer_profiles
  FOR ALL
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- Owners/staff can view booking-related customer profiles
CREATE POLICY "Owners and staff can view customer profiles for their bookings"
  ON customer_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM bookings b
      JOIN rental_shops rs ON rs.id = b.shop_id
      WHERE b.customer_auth_id = customer_profiles.auth_id
        AND rs.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM bookings b
      JOIN users u ON u.shop_id = b.shop_id
      WHERE b.customer_auth_id = customer_profiles.auth_id
        AND u.auth_id = auth.uid()
    )
  );

-- Customer ID documents: customers can manage their own docs
CREATE POLICY "Customers can manage own ID documents"
  ON customer_id_documents
  FOR ALL
  USING (customer_auth_id = auth.uid())
  WITH CHECK (customer_auth_id = auth.uid());

-- Owners/staff can view ID docs for their bookings
CREATE POLICY "Owners and staff can view ID documents for their bookings"
  ON customer_id_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM bookings b
      JOIN rental_shops rs ON rs.id = b.shop_id
      WHERE b.customer_auth_id = customer_id_documents.customer_auth_id
        AND rs.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM bookings b
      JOIN users u ON u.shop_id = b.shop_id
      WHERE b.customer_auth_id = customer_id_documents.customer_auth_id
        AND u.auth_id = auth.uid()
    )
  );

-- Notifications: user can view/update own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMIT;
