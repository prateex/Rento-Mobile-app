-- ============================================================================
-- FIX: Remove SECURITY DEFINER from views
-- ============================================================================
-- Issue: Supabase detected views with SECURITY DEFINER property
-- Security Risk: These views enforce database owner privileges rather than 
--                querying user privileges, bypassing RLS policies
-- Solution: Use SECURITY INVOKER to ensure RLS policies apply correctly
-- ============================================================================

-- Drop and recreate v_customer_id_photos with SECURITY INVOKER
DROP VIEW IF EXISTS public.v_customer_id_photos CASCADE;

CREATE VIEW public.v_customer_id_photos WITH (security_invoker) AS
SELECT 
  cip.*,
  c.full_name as customer_name,
  c.phone as customer_phone
FROM customer_id_photos cip
LEFT JOIN customers c ON cip.customer_id = c.id
WHERE cip.deleted_at IS NULL;

-- Drop and recreate v_vehicle_damage_photos with SECURITY INVOKER
DROP VIEW IF EXISTS public.v_vehicle_damage_photos CASCADE;

CREATE VIEW public.v_vehicle_damage_photos WITH (security_invoker) AS
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

-- Restore permissions
GRANT SELECT ON public.v_customer_id_photos TO authenticated;
GRANT SELECT ON public.v_vehicle_damage_photos TO authenticated;

-- Verify the views were created with correct security option
-- Check: SELECT viewname, definition FROM pg_views WHERE viewname IN ('v_customer_id_photos', 'v_vehicle_damage_photos');
