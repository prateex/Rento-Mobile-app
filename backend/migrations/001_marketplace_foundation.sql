-- ============================================
-- MIGRATION 001: MARKETPLACE FOUNDATION
-- Add core tables for multi-vendor marketplace
-- ============================================
-- Timeline: Run after existing schema
-- Backward Compatibility: YES (new tables only)
-- Rollback: DROP TABLE platform_users, marketplace_locations, vehicle_images

-- ============================================
-- 1. MARKETPLACE LOCATIONS TABLE
-- ============================================
-- Purpose: Support city-based vehicle search
-- Used by: Vehicle search, filtering, availability
-- Schema: Simple location master

CREATE TABLE IF NOT EXISTS marketplace_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Location info
  name TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'India',
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for active locations (common query)
CREATE INDEX IF NOT EXISTS idx_marketplace_locations_is_active 
  ON marketplace_locations(is_active);

-- Index for city-based search
CREATE INDEX IF NOT EXISTS idx_marketplace_locations_city 
  ON marketplace_locations(city);

-- Update trigger for timestamp
CREATE TRIGGER update_marketplace_locations_updated_at
  BEFORE UPDATE ON marketplace_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. PLATFORM USERS TABLE
-- ============================================
-- Purpose: Marketplace users (customers, admins)
-- Differs from 'users' table: No shop_id, auth-linked only
-- Schema: Auth-user profiles for marketplace roles
-- NOTE: Existing 'users' table is shop-specific. This is separate for platform users.

CREATE TABLE IF NOT EXISTS platform_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Auth link
  auth_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- User info
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  phone_number TEXT UNIQUE,
  
  -- Role on platform
  role TEXT NOT NULL DEFAULT 'customer' 
    CHECK (role IN ('customer', 'owner', 'admin')),
  
  -- Verification
  email_verified BOOLEAN NOT NULL DEFAULT false,
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Profile
  profile_picture_url TEXT,
  address TEXT,
  city TEXT,
  
  -- Onboarding
  onboarded_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
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

-- Composite index for role-based queries
CREATE INDEX IF NOT EXISTS idx_platform_users_role_active 
  ON platform_users(role, is_active);

-- Update trigger
CREATE TRIGGER update_platform_users_updated_at
  BEFORE UPDATE ON platform_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. VEHICLE IMAGES TABLE
-- ============================================
-- Purpose: Support multiple images per vehicle
-- Used by: Vehicle gallery, listing display, detail page
-- Design: Separate images from vehicles table for flexibility
-- NOTE: Coexists with vehicles.image_url (single image) for backward compatibility

CREATE TABLE IF NOT EXISTS vehicle_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationship
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  
  -- Image data
  image_url TEXT NOT NULL,
  alt_text TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  
  -- Type
  is_primary BOOLEAN NOT NULL DEFAULT false,
  
  -- Audit
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for vehicle image lookup
CREATE INDEX IF NOT EXISTS idx_vehicle_images_vehicle_id 
  ON vehicle_images(vehicle_id);

-- Index for primary image lookup (optimize gallery display)
CREATE INDEX IF NOT EXISTS idx_vehicle_images_vehicle_primary 
  ON vehicle_images(vehicle_id, is_primary);

-- Constraint: Only one primary image per vehicle
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_images_primary_per_vehicle 
  ON vehicle_images(vehicle_id) 
  WHERE is_primary = true;

-- Constraint: Images in order
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_images_order_per_vehicle 
  ON vehicle_images(vehicle_id, display_order);

-- ============================================
-- MIGRATION METADATA
-- ============================================
-- Tables Created: 3
-- Indexes Created: 12
-- Constraints: 3 unique, 3 FK
-- Breaking Changes: NONE
-- Safe to apply: YES - only new tables
-- Requires RLS: YES (must apply 006 after this)

/*
USAGE EXAMPLES:

1. Add location:
INSERT INTO marketplace_locations (name, city, state) 
VALUES ('Bangalore Downtown', 'Bangalore', 'Karnataka');

2. Create customer user:
INSERT INTO platform_users (auth_id, email, full_name, role) 
VALUES (auth_id_uuid, 'customer@example.com', 'John Doe', 'customer');

3. Add vehicle images:
INSERT INTO vehicle_images (vehicle_id, image_url, display_order, is_primary, uploaded_by)
VALUES (vehicle_uuid, 'https://...', 0, true, auth_id_uuid);

4. Query vehicles with location:
SELECT v.* FROM vehicles v
JOIN marketplace_locations ml ON v.location_id = ml.id
WHERE ml.city = 'Bangalore';

5. Count vehicles by location:
SELECT ml.name, COUNT(v.id) as vehicle_count
FROM marketplace_locations ml
LEFT JOIN vehicles v ON v.location_id = ml.id
GROUP BY ml.id, ml.name;
*/
