-- ============================================================================
-- Soft delete enforcement for core tables (vehicles, customers, bookings, damages)
-- Ensures DELETE calls only set deleted_at and do not cascade hard deletes.
-- ============================================================================

BEGIN;

-- 1) Ensure deleted_at columns exist
ALTER TABLE public.vehicles  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.bookings  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.damages   ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2) Drop old soft-delete triggers/functions for these tables
DROP TRIGGER IF EXISTS trigger_soft_delete_vehicles ON public.vehicles;
DROP TRIGGER IF EXISTS trigger_soft_delete_customers ON public.customers;
DROP TRIGGER IF EXISTS trigger_soft_delete_bookings ON public.bookings;
DROP TRIGGER IF EXISTS trigger_soft_delete_damages ON public.damages;

DROP FUNCTION IF EXISTS public.trigger_soft_delete_vehicles() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_soft_delete_customers() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_soft_delete_bookings() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_soft_delete_damages() CASCADE;

-- 3) Recreate soft-delete trigger functions (SECURITY DEFINER + row_security off)
CREATE OR REPLACE FUNCTION public.trigger_soft_delete_vehicles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  UPDATE public.vehicles SET deleted_at = now() WHERE id = OLD.id;
  RETURN NULL; -- cancel hard delete
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_soft_delete_customers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  UPDATE public.customers SET deleted_at = now() WHERE id = OLD.id;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_soft_delete_bookings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  UPDATE public.bookings SET deleted_at = now() WHERE id = OLD.id;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_soft_delete_damages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  UPDATE public.damages SET deleted_at = now() WHERE id = OLD.id;
  RETURN NULL;
END;
$$;

-- 4) Recreate BEFORE DELETE triggers wiring to the new functions
CREATE TRIGGER trigger_soft_delete_vehicles
BEFORE DELETE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.trigger_soft_delete_vehicles();

CREATE TRIGGER trigger_soft_delete_customers
BEFORE DELETE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.trigger_soft_delete_customers();

CREATE TRIGGER trigger_soft_delete_bookings
BEFORE DELETE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.trigger_soft_delete_bookings();

CREATE TRIGGER trigger_soft_delete_damages
BEFORE DELETE ON public.damages
FOR EACH ROW EXECUTE FUNCTION public.trigger_soft_delete_damages();

-- 5) Harden foreign keys to prevent cascaded hard deletes (only if tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    EXECUTE 'ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_customer_id_fkey';
    EXECUTE 'ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_customer_id_fkey FOREIGN KEY (customer_id)
      REFERENCES public.customers(id) ON DELETE RESTRICT';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'damages') THEN
    EXECUTE 'ALTER TABLE public.damages DROP CONSTRAINT IF EXISTS damages_vehicle_id_fkey';
    EXECUTE 'ALTER TABLE public.damages
      ADD CONSTRAINT damages_vehicle_id_fkey FOREIGN KEY (vehicle_id)
      REFERENCES public.vehicles(id) ON DELETE RESTRICT';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_id_photos') THEN
    EXECUTE 'ALTER TABLE public.customer_id_photos DROP CONSTRAINT IF EXISTS customer_id_photos_customer_id_fkey';
    EXECUTE 'ALTER TABLE public.customer_id_photos
      ADD CONSTRAINT customer_id_photos_customer_id_fkey FOREIGN KEY (customer_id)
      REFERENCES public.customers(id) ON DELETE RESTRICT';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    EXECUTE 'ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_booking_id_fkey';
    EXECUTE 'ALTER TABLE public.payments
      ADD CONSTRAINT payments_booking_id_fkey FOREIGN KEY (booking_id)
      REFERENCES public.bookings(id) ON DELETE RESTRICT';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deposits') THEN
    EXECUTE 'ALTER TABLE public.deposits DROP CONSTRAINT IF EXISTS deposits_booking_id_fkey';
    EXECUTE 'ALTER TABLE public.deposits
      ADD CONSTRAINT deposits_booking_id_fkey FOREIGN KEY (booking_id)
      REFERENCES public.bookings(id) ON DELETE RESTRICT';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vehicle_damage_photos') THEN
    EXECUTE 'ALTER TABLE public.vehicle_damage_photos DROP CONSTRAINT IF EXISTS vehicle_damage_photos_vehicle_id_fkey';
    EXECUTE 'ALTER TABLE public.vehicle_damage_photos
      ADD CONSTRAINT vehicle_damage_photos_vehicle_id_fkey FOREIGN KEY (vehicle_id)
      REFERENCES public.vehicles(id) ON DELETE RESTRICT';
  END IF;
END $$;

-- 6) Validation: ensure deleted_at columns and triggers exist and no FK cascades remain
DO $$
DECLARE
  missing_cols int;
  cascade_count int;
BEGIN
  SELECT COUNT(*) INTO missing_cols FROM (
    VALUES ('vehicles'), ('customers'), ('bookings'), ('damages')
  ) t(tbl)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = t.tbl AND column_name = 'deleted_at'
  );

  IF missing_cols > 0 THEN
    RAISE EXCEPTION 'Missing deleted_at on % core tables', missing_cols;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_soft_delete_vehicles') THEN
    RAISE EXCEPTION 'Missing trigger_soft_delete_vehicles';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_soft_delete_customers') THEN
    RAISE EXCEPTION 'Missing trigger_soft_delete_customers';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_soft_delete_bookings') THEN
    RAISE EXCEPTION 'Missing trigger_soft_delete_bookings';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_soft_delete_damages') THEN
    RAISE EXCEPTION 'Missing trigger_soft_delete_damages';
  END IF;

  SELECT COUNT(*) INTO cascade_count FROM pg_constraint
  WHERE conname IN (
    'bookings_customer_id_fkey',
    'damages_vehicle_id_fkey',
    'customer_id_photos_customer_id_fkey',
    'payments_booking_id_fkey',
    'deposits_booking_id_fkey',
    'vehicle_damage_photos_vehicle_id_fkey'
  ) AND confdeltype = 'c'; -- 'c' = CASCADE

  IF cascade_count > 0 THEN
    RAISE EXCEPTION 'Cascade delete still present on % constraints', cascade_count;
  END IF;
END $$;

COMMIT;
