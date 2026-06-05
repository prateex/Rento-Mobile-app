-- ============================================================================
-- SOFT DELETE RLS FIX - COMPLETE DATABASE POLICIES
-- ============================================================================
-- This migration fixes RLS policies to support SOFT DELETE ONLY
-- NO hard deletes are allowed. All deletes are UPDATE deleted_at = now()
-- ============================================================================

-- PART 1: Helper function for shop context resolution
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_shop_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT shop_id
  FROM public.users
  WHERE auth_id = (
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
  )::uuid
$$;

COMMENT ON FUNCTION public.current_shop_id() IS 
'Returns the shop_id for the currently authenticated user based on JWT sub claim';

-- ============================================================================
-- PART 2: RLS POLICIES FOR CUSTOMERS
-- ============================================================================

-- Enable RLS (NOT FORCED)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY; -- Set to false
ALTER TABLE public.customers NO FORCE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS customers_select ON public.customers;
DROP POLICY IF EXISTS customers_insert ON public.customers;
DROP POLICY IF EXISTS customers_update ON public.customers;
DROP POLICY IF EXISTS customers_delete ON public.customers;
DROP POLICY IF EXISTS customer_select ON public.customers;
DROP POLICY IF EXISTS customer_insert ON public.customers;
DROP POLICY IF EXISTS customer_update ON public.customers;
DROP POLICY IF EXISTS customer_delete ON public.customers;

-- SELECT: Only active rows from current shop
CREATE POLICY customers_select
ON public.customers
FOR SELECT
USING (
  deleted_at IS NULL
  AND shop_id = public.current_shop_id()
);

-- INSERT: Force shop ownership
CREATE POLICY customers_insert
ON public.customers
FOR INSERT
WITH CHECK (
  shop_id = public.current_shop_id()
);

-- UPDATE: Allow soft delete and edits
CREATE POLICY customers_update
ON public.customers
FOR UPDATE
USING (
  shop_id = public.current_shop_id()
)
WITH CHECK (
  shop_id = public.current_shop_id()
);

-- ============================================================================
-- PART 3: RLS POLICIES FOR VEHICLES
-- ============================================================================

-- Enable RLS (NOT FORCED)
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles NO FORCE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS vehicles_select ON public.vehicles;
DROP POLICY IF EXISTS vehicles_insert ON public.vehicles;
DROP POLICY IF EXISTS vehicles_update ON public.vehicles;
DROP POLICY IF EXISTS vehicles_delete ON public.vehicles;
DROP POLICY IF EXISTS vehicle_select ON public.vehicles;
DROP POLICY IF EXISTS vehicle_insert ON public.vehicles;
DROP POLICY IF EXISTS vehicle_update ON public.vehicles;
DROP POLICY IF EXISTS vehicle_delete ON public.vehicles;

-- SELECT: Only active rows from current shop
CREATE POLICY vehicles_select
ON public.vehicles
FOR SELECT
USING (
  deleted_at IS NULL
  AND shop_id = public.current_shop_id()
);

-- INSERT: Force shop ownership
CREATE POLICY vehicles_insert
ON public.vehicles
FOR INSERT
WITH CHECK (
  shop_id = public.current_shop_id()
);

-- UPDATE: Allow soft delete and edits
CREATE POLICY vehicles_update
ON public.vehicles
FOR UPDATE
USING (
  shop_id = public.current_shop_id()
)
WITH CHECK (
  shop_id = public.current_shop_id()
);

-- ============================================================================
-- PART 4: RLS POLICIES FOR BOOKINGS
-- ============================================================================

-- Enable RLS (NOT FORCED)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings NO FORCE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS bookings_select ON public.bookings;
DROP POLICY IF EXISTS bookings_insert ON public.bookings;
DROP POLICY IF EXISTS bookings_update ON public.bookings;
DROP POLICY IF EXISTS bookings_delete ON public.bookings;
DROP POLICY IF EXISTS booking_select ON public.bookings;
DROP POLICY IF EXISTS booking_insert ON public.bookings;
DROP POLICY IF EXISTS booking_update ON public.bookings;
DROP POLICY IF EXISTS booking_delete ON public.bookings;

-- SELECT: Only active rows from current shop
CREATE POLICY bookings_select
ON public.bookings
FOR SELECT
USING (
  deleted_at IS NULL
  AND shop_id = public.current_shop_id()
);

-- INSERT: Force shop ownership
CREATE POLICY bookings_insert
ON public.bookings
FOR INSERT
WITH CHECK (
  shop_id = public.current_shop_id()
);

-- UPDATE: Allow soft delete and edits
CREATE POLICY bookings_update
ON public.bookings
FOR UPDATE
USING (
  shop_id = public.current_shop_id()
)
WITH CHECK (
  shop_id = public.current_shop_id()
);

-- ============================================================================
-- PART 5: RLS POLICIES FOR PAYMENTS
-- ============================================================================

-- Enable RLS (NOT FORCED)
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments NO FORCE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS payments_select ON public.payments;
DROP POLICY IF EXISTS payments_insert ON public.payments;
DROP POLICY IF EXISTS payments_update ON public.payments;
DROP POLICY IF EXISTS payments_delete ON public.payments;
DROP POLICY IF EXISTS payment_select ON public.payments;
DROP POLICY IF EXISTS payment_insert ON public.payments;
DROP POLICY IF EXISTS payment_update ON public.payments;
DROP POLICY IF EXISTS payment_delete ON public.payments;

-- SELECT: Only active rows from current shop
CREATE POLICY payments_select
ON public.payments
FOR SELECT
USING (
  deleted_at IS NULL
  AND shop_id = public.current_shop_id()
);

-- INSERT: Force shop ownership
CREATE POLICY payments_insert
ON public.payments
FOR INSERT
WITH CHECK (
  shop_id = public.current_shop_id()
);

-- UPDATE: Allow soft delete and edits
CREATE POLICY payments_update
ON public.payments
FOR UPDATE
USING (
  shop_id = public.current_shop_id()
)
WITH CHECK (
  shop_id = public.current_shop_id()
);

-- ============================================================================
-- PART 6: RLS POLICIES FOR CUSTOMER_ID_PHOTOS
-- ============================================================================

-- Enable RLS (NOT FORCED)
ALTER TABLE public.customer_id_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_id_photos NO FORCE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS customer_id_photos_select ON public.customer_id_photos;
DROP POLICY IF EXISTS customer_id_photos_insert ON public.customer_id_photos;
DROP POLICY IF EXISTS customer_id_photos_update ON public.customer_id_photos;
DROP POLICY IF EXISTS customer_id_photos_delete ON public.customer_id_photos;

-- SELECT: Only active rows from current shop
CREATE POLICY customer_id_photos_select
ON public.customer_id_photos
FOR SELECT
USING (
  deleted_at IS NULL
  AND shop_id = public.current_shop_id()
);

-- INSERT: Force shop ownership
CREATE POLICY customer_id_photos_insert
ON public.customer_id_photos
FOR INSERT
WITH CHECK (
  shop_id = public.current_shop_id()
);

-- UPDATE: Allow soft delete and edits
CREATE POLICY customer_id_photos_update
ON public.customer_id_photos
FOR UPDATE
USING (
  shop_id = public.current_shop_id()
)
WITH CHECK (
  shop_id = public.current_shop_id()
);

-- ============================================================================
-- PART 7: RLS POLICIES FOR VEHICLE_DAMAGE_PHOTOS
-- ============================================================================

-- Enable RLS (NOT FORCED)
ALTER TABLE public.vehicle_damage_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_damage_photos NO FORCE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS vehicle_damage_photos_select ON public.vehicle_damage_photos;
DROP POLICY IF EXISTS vehicle_damage_photos_insert ON public.vehicle_damage_photos;
DROP POLICY IF EXISTS vehicle_damage_photos_update ON public.vehicle_damage_photos;
DROP POLICY IF EXISTS vehicle_damage_photos_delete ON public.vehicle_damage_photos;

-- SELECT: Only active rows from current shop
CREATE POLICY vehicle_damage_photos_select
ON public.vehicle_damage_photos
FOR SELECT
USING (
  deleted_at IS NULL
  AND shop_id = public.current_shop_id()
);

-- INSERT: Force shop ownership
CREATE POLICY vehicle_damage_photos_insert
ON public.vehicle_damage_photos
FOR INSERT
WITH CHECK (
  shop_id = public.current_shop_id()
);

-- UPDATE: Allow soft delete and edits
CREATE POLICY vehicle_damage_photos_update
ON public.vehicle_damage_photos
FOR UPDATE
USING (
  shop_id = public.current_shop_id()
)
WITH CHECK (
  shop_id = public.current_shop_id()
);

-- ============================================================================
-- PART 8: VERIFICATION QUERIES
-- ============================================================================

-- Run these queries after applying the migration to verify:

-- 1. Check that NO DELETE policies exist
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
AND cmd = 'DELETE'
AND tablename IN ('customers', 'vehicles', 'bookings', 'payments', 'customer_id_photos', 'vehicle_damage_photos');
-- Expected: 0 rows

-- 2. Verify all tables have exactly 3 policies (SELECT, INSERT, UPDATE)
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('customers', 'vehicles', 'bookings', 'payments', 'customer_id_photos', 'vehicle_damage_photos')
GROUP BY tablename
ORDER BY tablename;
-- Expected: 6 rows, each with policy_count = 3

-- 3. Verify helper function exists
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'current_shop_id'
AND pronamespace = 'public'::regnamespace;
-- Expected: 1 row

-- 4. Test soft delete (replace <table> and <id> with actual values)
-- UPDATE <table> SET deleted_at = now() WHERE id = '<id>';
-- SELECT * FROM <table> WHERE id = '<id>';
-- Expected: 0 rows (hidden by RLS)

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- All tables now support SOFT DELETE ONLY via UPDATE deleted_at = now()
-- RLS enforces shop isolation and hides deleted rows automatically
-- NO DELETE policies exist - clients CANNOT hard delete
-- ============================================================================
