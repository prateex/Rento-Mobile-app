-- Photo Storage and Lifecycle Management Migration
-- Implements secure storage for Customer ID photos and Vehicle Damage photos
-- with shop-level access control and automatic expiry for ID photos

BEGIN;

-- ============================================================================
-- STORAGE BUCKETS (Run via Supabase Studio or CLI)
-- ============================================================================

-- Note: Storage buckets must be created manually or via Supabase CLI:
-- supabase storage create customer-id-photos --public false
-- supabase storage create vehicle-damage-photos --public false

-- ============================================================================
-- TABLES
-- ============================================================================

-- Customer ID Photos with Expiry Tracking
CREATE TABLE IF NOT EXISTS customer_id_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  photo_type TEXT NOT NULL CHECK (photo_type IN ('front', 'back')),
  file_path TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'customer-id-photos',
  file_size_bytes INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id, photo_type, deleted_at)
);

-- Vehicle Damage Photos (No Expiry)
CREATE TABLE IF NOT EXISTS vehicle_damage_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  damage_id UUID REFERENCES damages(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'vehicle-damage-photos',
  file_size_bytes INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_customer_id_photos_shop_id ON customer_id_photos(shop_id);
CREATE INDEX IF NOT EXISTS idx_customer_id_photos_customer_id ON customer_id_photos(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_id_photos_booking_id ON customer_id_photos(booking_id);
CREATE INDEX IF NOT EXISTS idx_customer_id_photos_expires_at ON customer_id_photos(expires_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_id_photos_active ON customer_id_photos(customer_id, deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicle_damage_photos_shop_id ON vehicle_damage_photos(shop_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_damage_photos_vehicle_id ON vehicle_damage_photos(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_damage_photos_damage_id ON vehicle_damage_photos(damage_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_damage_photos_active ON vehicle_damage_photos(vehicle_id, deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE customer_id_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_damage_photos ENABLE ROW LEVEL SECURITY;

-- Customer ID Photos: Shop-level access only
CREATE POLICY customer_id_photos_shop_access ON customer_id_photos
  FOR SELECT
  USING (
    shop_id IN (
      SELECT u.shop_id 
      FROM users u 
      WHERE u.auth_id = auth.uid()
    )
  );

CREATE POLICY customer_id_photos_shop_insert ON customer_id_photos
  FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT u.shop_id 
      FROM users u 
      WHERE u.auth_id = auth.uid()
    )
  );

CREATE POLICY customer_id_photos_shop_update ON customer_id_photos
  FOR UPDATE
  USING (
    shop_id IN (
      SELECT u.shop_id 
      FROM users u 
      WHERE u.auth_id = auth.uid()
    )
  );

CREATE POLICY customer_id_photos_shop_delete ON customer_id_photos
  FOR DELETE
  USING (
    shop_id IN (
      SELECT u.shop_id 
      FROM users u 
      WHERE u.auth_id = auth.uid()
    )
  );

-- Vehicle Damage Photos: Shop-level access only
CREATE POLICY vehicle_damage_photos_shop_access ON vehicle_damage_photos
  FOR SELECT
  USING (
    shop_id IN (
      SELECT u.shop_id 
      FROM users u 
      WHERE u.auth_id = auth.uid()
    )
  );

CREATE POLICY vehicle_damage_photos_shop_insert ON vehicle_damage_photos
  FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT u.shop_id 
      FROM users u 
      WHERE u.auth_id = auth.uid()
    )
  );

CREATE POLICY vehicle_damage_photos_shop_update ON vehicle_damage_photos
  FOR UPDATE
  USING (
    shop_id IN (
      SELECT u.shop_id 
      FROM users u 
      WHERE u.auth_id = auth.uid()
    )
  );

CREATE POLICY vehicle_damage_photos_shop_delete ON vehicle_damage_photos
  FOR DELETE
  USING (
    shop_id IN (
      SELECT u.shop_id 
      FROM users u 
      WHERE u.auth_id = auth.uid()
    )
  );

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Calculate expiry date (7 days after booking completion)
CREATE OR REPLACE FUNCTION public.calculate_photo_expiry(p_booking_id UUID)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_completed_at TIMESTAMPTZ;
BEGIN
  SELECT 
    COALESCE(returned_at, updated_at) INTO v_completed_at
  FROM bookings
  WHERE id = p_booking_id AND status = 'Completed';
  
  IF v_completed_at IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN v_completed_at + INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Update expiry date when booking is completed
CREATE OR REPLACE FUNCTION public.update_id_photo_expiry()
RETURNS TRIGGER AS $$
BEGIN
  -- Only when booking is marked as completed
  IF NEW.status = 'Completed' AND (OLD.status IS NULL OR OLD.status != 'Completed') THEN
    UPDATE customer_id_photos
    SET 
      expires_at = NEW.returned_at + INTERVAL '7 days',
      updated_at = now()
    WHERE 
      booking_id = NEW.id 
      AND deleted_at IS NULL
      AND expires_at IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update expiry on booking completion
DROP TRIGGER IF EXISTS trigger_update_id_photo_expiry ON bookings;
CREATE TRIGGER trigger_update_id_photo_expiry
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_id_photo_expiry();

-- Function: Cleanup expired customer ID photos
CREATE OR REPLACE FUNCTION public.cleanup_expired_id_photos()
RETURNS TABLE(
  deleted_count INTEGER,
  file_paths TEXT[]
) AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_file_paths TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Find expired photos
  SELECT 
    COUNT(*)::INTEGER,
    ARRAY_AGG(file_path)
  INTO v_deleted_count, v_file_paths
  FROM customer_id_photos
  WHERE 
    expires_at IS NOT NULL 
    AND expires_at < now() 
    AND deleted_at IS NULL;
  
  -- Soft delete expired photos
  UPDATE customer_id_photos
  SET 
    deleted_at = now(),
    updated_at = now()
  WHERE 
    expires_at IS NOT NULL 
    AND expires_at < now() 
    AND deleted_at IS NULL;
  
  RETURN QUERY SELECT v_deleted_count, v_file_paths;
END;
$$ LANGUAGE plpgsql;

-- Function: Get days until photo expiry
CREATE OR REPLACE FUNCTION public.days_until_expiry(p_expires_at TIMESTAMPTZ)
RETURNS INTEGER AS $$
BEGIN
  IF p_expires_at IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN GREATEST(0, EXTRACT(DAY FROM (p_expires_at - now()))::INTEGER);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Soft delete damage photos when damage is removed
CREATE OR REPLACE FUNCTION public.cleanup_damage_photos()
RETURNS TRIGGER AS $$
BEGIN
  -- When damage is deleted, soft delete associated photos
  UPDATE vehicle_damage_photos
  SET 
    deleted_at = now(),
    updated_at = now()
  WHERE 
    damage_id = OLD.id 
    AND deleted_at IS NULL;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-cleanup damage photos on damage deletion
DROP TRIGGER IF EXISTS trigger_cleanup_damage_photos ON damages;
CREATE TRIGGER trigger_cleanup_damage_photos
  BEFORE DELETE ON damages
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_damage_photos();

-- ============================================================================
-- VIEWS FOR EASY ACCESS
-- ============================================================================

-- View: Active customer ID photos with expiry info
CREATE OR REPLACE VIEW v_customer_id_photos WITH (security_invoker) AS
SELECT 
  cip.*,
  c.full_name as customer_name,
  c.phone as customer_phone
FROM customer_id_photos cip
LEFT JOIN customers c ON cip.customer_id = c.id
WHERE cip.deleted_at IS NULL;

-- View: Active vehicle damage photos
CREATE OR REPLACE VIEW v_vehicle_damage_photos WITH (security_invoker) AS
SELECT 
  vdp.*,
  v.name as vehicle_name,
  v.registration_number as vehicle_reg,
  d.type as damage_type,
  d.severity as damage_severity,
  b.booking_number
FROM vehicle_damage_photos vdp
LEFT JOIN vehicles v ON vdp.vehicle_id = v.id
LEFT JOIN damages d ON vdp.damage_id = d.id
LEFT JOIN bookings b ON vdp.booking_id = b.id
WHERE vdp.deleted_at IS NULL;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON customer_id_photos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON vehicle_damage_photos TO authenticated;
GRANT SELECT ON v_customer_id_photos TO authenticated;
GRANT SELECT ON v_vehicle_damage_photos TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_photo_expiry TO authenticated;
GRANT EXECUTE ON FUNCTION public.days_until_expiry TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_id_photos TO authenticated;

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================

-- 1. Create storage buckets via Supabase CLI:
--    supabase storage create customer-id-photos --public false
--    supabase storage create vehicle-damage-photos --public false

-- 2. Configure storage bucket policies via Supabase Studio or SQL:
--    - Allow shop-level read/write access
--    - Restrict by shop_id in file path structure

-- 3. Set up periodic cleanup job (via pg_cron or edge function):
--    SELECT * FROM public.cleanup_expired_id_photos();

-- 4. File path structure recommendation:
--    customer-id-photos: {shop_id}/{customer_id}/{photo_type}_{timestamp}.jpg
--    vehicle-damage-photos: {shop_id}/{vehicle_id}/{damage_id}_{timestamp}.jpg
