-- MIGRATION 007: OWNER + CUSTOMER MARKETPLACE FEATURES
-- Safe to apply: YES (adds nullable/defaulted columns + new tables)
-- Backward compatible: YES

BEGIN;

-- 1) Vehicle publish/unpublish
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
-- Keep existing vehicles visible by default
UPDATE vehicles SET is_published = true WHERE is_published IS NULL;

-- 2) Owner pickup location + terms
ALTER TABLE rental_shops ADD COLUMN IF NOT EXISTS pickup_location_name TEXT;
ALTER TABLE rental_shops ADD COLUMN IF NOT EXISTS pickup_address TEXT;
ALTER TABLE rental_shops ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC;
ALTER TABLE rental_shops ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC;
ALTER TABLE rental_shops ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;

-- 3) Booking snapshot fields (customer + pickup)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_emergency_contact TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_id_type TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_location_name TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_address TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC;

-- 4) Customer profiles
CREATE TABLE IF NOT EXISTS customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT NOT NULL,
  emergency_contact TEXT NOT NULL,
  id_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_profiles_auth_id ON customer_profiles(auth_id);

-- Updated_at trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE TRIGGER update_customer_profiles_updated_at
      BEFORE UPDATE ON customer_profiles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 5) Customer ID documents
CREATE TABLE IF NOT EXISTS customer_id_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID REFERENCES customer_profiles(id) ON DELETE CASCADE,
  customer_auth_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  image_url TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_id_documents_auth_id ON customer_id_documents(customer_auth_id);
CREATE INDEX IF NOT EXISTS idx_customer_id_documents_profile_id ON customer_id_documents(customer_profile_id);

-- 6) Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- 7) Trigger: notify owner + staff when online booking created
CREATE OR REPLACE FUNCTION notify_online_booking() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_online_booking = true THEN
    -- Owner notification
    INSERT INTO notifications (user_id, title, message)
    SELECT rs.owner_id,
           'New Online Booking',
           'A new online booking was created: ' || COALESCE(NEW.booking_number, NEW.id::text)
    FROM rental_shops rs
    WHERE rs.id = NEW.shop_id
      AND rs.owner_id IS NOT NULL;

    -- Staff notifications (all staff for the shop)
    INSERT INTO notifications (user_id, title, message)
    SELECT u.auth_id,
           'New Online Booking',
           'A new online booking was created: ' || COALESCE(NEW.booking_number, NEW.id::text)
    FROM users u
    WHERE u.shop_id = NEW.shop_id
      AND u.role = 'staff'
      AND u.auth_id IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog, public;

DROP TRIGGER IF EXISTS trg_notify_online_booking ON bookings;
CREATE TRIGGER trg_notify_online_booking
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_online_booking();

-- 8) Update availability function to respect vehicle publish status
CREATE OR REPLACE FUNCTION get_available_vehicles(
  p_location_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_vehicle_type TEXT DEFAULT NULL,
  p_min_price NUMERIC DEFAULT NULL,
  p_max_price NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  vehicle_id UUID,
  vehicle_name TEXT,
  vehicle_type TEXT,
  brand TEXT,
  model TEXT,
  daily_rate NUMERIC,
  image_url TEXT,
  owner_name TEXT,
  rating NUMERIC,
  total_bookings INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.id,
    v.name,
    v.type,
    v.brand,
    v.model,
    v.daily_rate,
    v.image_url,
    rs.name,
    v.rating,
    v.total_bookings
  FROM vehicles v
  JOIN rental_shops rs ON v.owner_id = rs.id
  WHERE v.location_id = p_location_id
    AND v.is_listed_marketplace = true
    AND v.is_available_for_online_booking = true
    AND v.is_published = true
    AND v.status = 'Available'
    AND (p_vehicle_type IS NULL OR v.type = p_vehicle_type)
    AND (p_min_price IS NULL OR v.daily_rate >= p_min_price)
    AND (p_max_price IS NULL OR v.daily_rate <= p_max_price)
    AND NOT EXISTS (
      SELECT 1 FROM booking_availability_blocks bab
      WHERE bab.vehicle_id = v.id
        AND bab.start_date < p_end_date
        AND bab.end_date > p_start_date
    )
  ORDER BY v.rating DESC, v.daily_rate ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog, public;

COMMIT;
