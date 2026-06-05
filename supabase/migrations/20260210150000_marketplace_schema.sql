-- Promote marketplace schema from backend migrations into Supabase
BEGIN;

-- 1) marketplace_locations
CREATE TABLE IF NOT EXISTS marketplace_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'India',
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_locations_is_active
  ON marketplace_locations(is_active);

CREATE INDEX IF NOT EXISTS idx_marketplace_locations_city
  ON marketplace_locations(city);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_marketplace_locations_updated_at'
  ) THEN
    CREATE TRIGGER update_marketplace_locations_updated_at
      BEFORE UPDATE ON marketplace_locations
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 2) platform_users
CREATE TABLE IF NOT EXISTS platform_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  phone_number TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer', 'owner', 'admin')),
  email_verified BOOLEAN NOT NULL DEFAULT false,
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  profile_picture_url TEXT,
  address TEXT,
  city TEXT,
  onboarded_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_users_auth_id
  ON platform_users(auth_id);

CREATE INDEX IF NOT EXISTS idx_platform_users_role
  ON platform_users(role);

CREATE INDEX IF NOT EXISTS idx_platform_users_email
  ON platform_users(email);

CREATE INDEX IF NOT EXISTS idx_platform_users_phone_number
  ON platform_users(phone_number);

CREATE INDEX IF NOT EXISTS idx_platform_users_is_active
  ON platform_users(is_active);

CREATE INDEX IF NOT EXISTS idx_platform_users_role_active
  ON platform_users(role, is_active);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_platform_users_updated_at'
  ) THEN
    CREATE TRIGGER update_platform_users_updated_at
      BEFORE UPDATE ON platform_users
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 3) vehicle_images
CREATE TABLE IF NOT EXISTS vehicle_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_images_vehicle_id
  ON vehicle_images(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_images_vehicle_primary
  ON vehicle_images(vehicle_id, is_primary);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_images_primary_per_vehicle
  ON vehicle_images(vehicle_id)
  WHERE is_primary = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_images_order_per_vehicle
  ON vehicle_images(vehicle_id, display_order);

-- 4) Extend vehicles for marketplace
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES marketplace_locations(id) ON DELETE SET NULL;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS free_km_per_day INTEGER DEFAULT 100;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS extra_km_rate NUMERIC(10, 2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS security_deposit NUMERIC(10, 2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS cancellation_policy_type TEXT DEFAULT 'standard'
  CHECK (cancellation_policy_type IN ('strict', 'moderate', 'standard', 'flexible'));
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_type TEXT
  CHECK (fuel_type IS NULL OR fuel_type IN ('Petrol', 'Diesel', 'Electric', 'CNG'));
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS transmission_type TEXT
  CHECK (transmission_type IS NULL OR transmission_type IN ('Manual', 'Automatic'));
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS has_ac BOOLEAN DEFAULT false;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS has_gps BOOLEAN DEFAULT false;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS has_helmet BOOLEAN DEFAULT true;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}'::jsonb;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS is_listed_marketplace BOOLEAN DEFAULT true;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS is_available_for_online_booking BOOLEAN DEFAULT true;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS rating NUMERIC(3, 2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS total_bookings INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS target_odometer_service INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS last_service_at TIMESTAMPTZ;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS next_service_at TIMESTAMPTZ;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS seating_capacity INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_number TEXT UNIQUE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES rental_shops(id) ON DELETE CASCADE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS status_reason TEXT;

UPDATE vehicles
SET owner_id = shop_id
WHERE owner_id IS NULL;

ALTER TABLE vehicles ALTER COLUMN owner_id SET NOT NULL;

UPDATE vehicles
SET
  is_listed_marketplace = true,
  is_available_for_online_booking = true,
  cancellation_policy_type = 'standard',
  transmission_type = 'Manual',
  has_helmet = true
WHERE is_listed_marketplace IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_location_id
  ON vehicles(location_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_listed_marketplace
  ON vehicles(is_listed_marketplace);

CREATE INDEX IF NOT EXISTS idx_vehicles_online_booking
  ON vehicles(is_available_for_online_booking);

CREATE INDEX IF NOT EXISTS idx_vehicles_marketplace_active
  ON vehicles(is_listed_marketplace, is_available_for_online_booking, location_id)
  WHERE status = 'Available';

CREATE INDEX IF NOT EXISTS idx_vehicles_type_location
  ON vehicles(type, location_id)
  WHERE is_listed_marketplace = true AND status = 'Available';

CREATE INDEX IF NOT EXISTS idx_vehicles_fuel_transmission
  ON vehicles(fuel_type, transmission_type)
  WHERE is_listed_marketplace = true;

CREATE INDEX IF NOT EXISTS idx_vehicles_daily_rate
  ON vehicles(daily_rate)
  WHERE is_listed_marketplace = true AND status = 'Available';

CREATE INDEX IF NOT EXISTS idx_vehicles_rating
  ON vehicles(rating DESC)
  WHERE is_listed_marketplace = true AND status = 'Available';

CREATE INDEX IF NOT EXISTS idx_vehicles_owner_id
  ON vehicles(owner_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_vehicles_free_km_positive'
  ) THEN
    ALTER TABLE vehicles
      ADD CONSTRAINT chk_vehicles_free_km_positive
      CHECK (free_km_per_day >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_vehicles_extra_km_rate_positive'
  ) THEN
    ALTER TABLE vehicles
      ADD CONSTRAINT chk_vehicles_extra_km_rate_positive
      CHECK (extra_km_rate IS NULL OR extra_km_rate > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_vehicles_security_deposit_positive'
  ) THEN
    ALTER TABLE vehicles
      ADD CONSTRAINT chk_vehicles_security_deposit_positive
      CHECK (security_deposit IS NULL OR security_deposit > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_vehicles_rating_range'
  ) THEN
    ALTER TABLE vehicles
      ADD CONSTRAINT chk_vehicles_rating_range
      CHECK (rating IS NULL OR (rating >= 1.0 AND rating <= 5.0));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_vehicles_seating_capacity'
  ) THEN
    ALTER TABLE vehicles
      ADD CONSTRAINT chk_vehicles_seating_capacity
      CHECK (seating_capacity IS NULL OR (seating_capacity > 0 AND seating_capacity <= 10));
  END IF;
END $$;

-- 5) Extend bookings for marketplace
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_online_booking BOOLEAN DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehicles(id) ON DELETE RESTRICT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES rental_shops(id) ON DELETE CASCADE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_location_id UUID REFERENCES marketplace_locations(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dropoff_location_id UUID REFERENCES marketplace_locations(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS base_rental_amount NUMERIC(10, 2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS km_charge_amount NUMERIC(10, 2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10, 2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS security_deposit_amount NUMERIC(10, 2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_gateway TEXT
  CHECK (payment_gateway IS NULL OR payment_gateway IN ('razorpay', 'stripe', 'paypal', 'manual'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS actual_pickup_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS actual_dropoff_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS final_km_reading INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS final_amount NUMERIC(10, 2);

UPDATE bookings SET is_online_booking = false WHERE is_online_booking IS NULL;

UPDATE bookings
SET owner_id = shop_id
WHERE owner_id IS NULL AND is_online_booking = false;

ALTER TABLE bookings ALTER COLUMN is_online_booking SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_is_online_booking
  ON bookings(is_online_booking);

CREATE INDEX IF NOT EXISTS idx_bookings_vehicle_dates
  ON bookings(vehicle_id, start_date, end_date)
  WHERE is_online_booking = true AND status != 'Cancelled';

CREATE INDEX IF NOT EXISTS idx_bookings_owner_id
  ON bookings(owner_id);

CREATE INDEX IF NOT EXISTS idx_bookings_owner_status
  ON bookings(owner_id, status);

CREATE INDEX IF NOT EXISTS idx_bookings_customer_auth_id
  ON bookings(customer_auth_id);

CREATE INDEX IF NOT EXISTS idx_bookings_pickup_location
  ON bookings(pickup_location_id);

CREATE INDEX IF NOT EXISTS idx_bookings_dropoff_location
  ON bookings(dropoff_location_id);

CREATE INDEX IF NOT EXISTS idx_bookings_payment_id
  ON bookings(payment_id);



-- 6) marketplace_payments and related tables
CREATE TABLE IF NOT EXISTS marketplace_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  payment_type TEXT NOT NULL DEFAULT 'booking'
    CHECK (payment_type IN ('booking', 'security_deposit', 'refund', 'damage_deduction')),
  payment_method TEXT NOT NULL
    CHECK (payment_method IN ('card', 'upi', 'netbanking', 'wallet', 'manual')),
  payment_gateway TEXT
    CHECK (payment_gateway IS NULL OR payment_gateway IN ('razorpay', 'stripe', 'paypal', 'manual')),
  external_payment_id TEXT,
  external_order_id TEXT,
  external_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'initiated', 'authorized', 'captured', 'refunded', 'failed', 'cancelled')),
  status_reason TEXT,
  failure_reason TEXT,
  transaction_id TEXT UNIQUE,
  merchant_reference_id TEXT,
  initiated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_payments_booking_id
  ON marketplace_payments(booking_id);

CREATE INDEX IF NOT EXISTS idx_marketplace_payments_external_id
  ON marketplace_payments(external_payment_id);

CREATE INDEX IF NOT EXISTS idx_marketplace_payments_order_id
  ON marketplace_payments(external_order_id);

CREATE INDEX IF NOT EXISTS idx_marketplace_payments_status
  ON marketplace_payments(status);

CREATE INDEX IF NOT EXISTS idx_marketplace_payments_created_at
  ON marketplace_payments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketplace_payments_gateway_status
  ON marketplace_payments(payment_gateway, status);

CREATE INDEX IF NOT EXISTS idx_marketplace_payments_transaction_id
  ON marketplace_payments(transaction_id);

CREATE TABLE IF NOT EXISTS marketplace_payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES marketplace_payments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL
    CHECK (event_source IN ('razorpay', 'stripe', 'paypal', 'manual')),
  webhook_payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processing_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id
  ON marketplace_payment_events(payment_id);

CREATE INDEX IF NOT EXISTS idx_payment_events_processed
  ON marketplace_payment_events(processed);

CREATE INDEX IF NOT EXISTS idx_payment_events_received_at
  ON marketplace_payment_events(received_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_payment_reconciliation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_date DATE NOT NULL,
  payment_gateway TEXT NOT NULL
    CHECK (payment_gateway IN ('razorpay', 'stripe', 'paypal')),
  total_payments INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  successful_payments INTEGER NOT NULL DEFAULT 0,
  failed_payments INTEGER NOT NULL DEFAULT 0,
  pending_refunds NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'mismatch')),
  expected_amount NUMERIC(14, 2),
  actual_amount NUMERIC(14, 2),
  variance NUMERIC(14, 2),
  notes TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_date_gateway
  ON marketplace_payment_reconciliation(reconciliation_date, payment_gateway);

CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_status
  ON marketplace_payment_reconciliation(status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_marketplace_payments_updated_at'
  ) THEN
    CREATE TRIGGER update_marketplace_payments_updated_at
      BEFORE UPDATE ON marketplace_payments
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION mark_payment_completed(
  p_payment_id UUID,
  p_external_payment_id TEXT DEFAULT NULL,
  p_transaction_id TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE marketplace_payments
  SET
    status = 'captured',
    external_payment_id = COALESCE(p_external_payment_id, external_payment_id),
    transaction_id = COALESCE(p_transaction_id, transaction_id),
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_payment_id;

  UPDATE bookings
  SET
    payment_status = 'Paid',
    status = 'Confirmed',
    updated_at = NOW()
  WHERE id = (SELECT booking_id FROM marketplace_payments WHERE id = p_payment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog, public;

CREATE OR REPLACE FUNCTION mark_payment_failed(
  p_payment_id UUID,
  p_failure_reason TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE marketplace_payments
  SET
    status = 'failed',
    failure_reason = p_failure_reason,
    updated_at = NOW()
  WHERE id = p_payment_id;

  UPDATE bookings
  SET
    payment_status = 'Unpaid',
    status = 'Cancelled',
    updated_at = NOW()
  WHERE id = (SELECT booking_id FROM marketplace_payments WHERE id = p_payment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog, public;

CREATE OR REPLACE FUNCTION refund_payment(
  p_payment_id UUID,
  p_refund_amount NUMERIC,
  p_reason TEXT
)
RETURNS void AS $$
DECLARE
  v_booking_id UUID;
BEGIN
  UPDATE marketplace_payments
  SET
    status = 'refunded',
    refunded_at = NOW(),
    status_reason = p_reason,
    amount = amount - p_refund_amount,
    updated_at = NOW()
  WHERE id = p_payment_id
  RETURNING booking_id INTO v_booking_id;

  INSERT INTO marketplace_payments (
    booking_id, amount, payment_type, status,
    status_reason, created_by
  ) VALUES (
    v_booking_id, p_refund_amount, 'refund', 'captured',
    'Refund: ' || p_reason, auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog, public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_payment_amount_positive'
  ) THEN
    ALTER TABLE marketplace_payments
      ADD CONSTRAINT chk_payment_amount_positive
      CHECK (amount > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_payment_external_id'
  ) THEN
    ALTER TABLE marketplace_payments
      ADD CONSTRAINT chk_payment_external_id
      CHECK (
        (payment_gateway IS NULL AND external_payment_id IS NULL) OR
        (payment_gateway IS NOT NULL AND external_payment_id IS NOT NULL)
      );
  END IF;
END $$;

COMMIT;
