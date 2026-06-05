-- Migration: add SELECT policies to allow UPDATE ... RETURNING for soft-deletes
-- Adds a permissive FOR SELECT policy (no deleted_at check) scoped to current_shop_id()
-- This preserves the existing active-row SELECT policies that include deleted_at IS NULL

BEGIN;

-- vehicles
DROP POLICY IF EXISTS vehicles_select_for_update ON public.vehicles;
CREATE POLICY vehicles_select_for_update
ON public.vehicles
FOR SELECT
USING (shop_id = public.current_shop_id());

-- customers
DROP POLICY IF EXISTS customers_select_for_update ON public.customers;
CREATE POLICY customers_select_for_update
ON public.customers
FOR SELECT
USING (shop_id = public.current_shop_id());

-- bookings
DROP POLICY IF EXISTS bookings_select_for_update ON public.bookings;
CREATE POLICY bookings_select_for_update
ON public.bookings
FOR SELECT
USING (shop_id = public.current_shop_id());

-- payments
DROP POLICY IF EXISTS payments_select_for_update ON public.payments;
CREATE POLICY payments_select_for_update
ON public.payments
FOR SELECT
USING (shop_id = public.current_shop_id());

-- customer_id_photos
DROP POLICY IF EXISTS customer_id_photos_select_for_update ON public.customer_id_photos;
CREATE POLICY customer_id_photos_select_for_update
ON public.customer_id_photos
FOR SELECT
USING (shop_id = public.current_shop_id());

-- vehicle_damage_photos
DROP POLICY IF EXISTS vehicle_damage_photos_select_for_update ON public.vehicle_damage_photos;
CREATE POLICY vehicle_damage_photos_select_for_update
ON public.vehicle_damage_photos
FOR SELECT
USING (shop_id = public.current_shop_id());

COMMIT;

-- Notes:
-- - This migration only adds additional FOR SELECT policies without touching existing SELECT policies
--   that include the `deleted_at IS NULL` filter. The new policies intentionally do NOT filter
--   on `deleted_at` so that PostgREST's UPDATE ... RETURNING can SELECT the updated row to return
--   it to the client while still restricting access to the current shop via current_shop_id().
