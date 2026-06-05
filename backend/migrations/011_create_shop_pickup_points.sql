BEGIN;

CREATE TABLE IF NOT EXISTS shop_pickup_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address_text TEXT,
  city TEXT,
  pincode TEXT,
  latitude NUMERIC CHECK (latitude >= -90 AND latitude <= 90),
  longitude NUMERIC CHECK (longitude >= -180 AND longitude <= 180),
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS pickup_point_id UUID REFERENCES shop_pickup_points(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rental_shops_id_owner ON rental_shops(id, owner_id);
CREATE INDEX IF NOT EXISTS idx_shop_pickup_points_shop_id ON shop_pickup_points(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_pickup_points_active ON shop_pickup_points(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_pickup_points_default ON shop_pickup_points(shop_id) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_bookings_pickup_point_id ON bookings(pickup_point_id);

COMMIT;
