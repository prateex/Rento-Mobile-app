-- Fix vehicles.owner_id foreign key to reference auth.users(id)
-- Rationale: app inserts owner_id = auth.uid(), but FK currently points to rental_shops(id)
-- Safe, idempotent migration with no data loss.

-- 1) Drop incorrect FK if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vehicles_owner_id_fkey'
      AND conrelid = 'public.vehicles'::regclass
  ) THEN
    ALTER TABLE public.vehicles DROP CONSTRAINT vehicles_owner_id_fkey;
  END IF;
END $$;

-- 2) Normalize existing owner_id values to shop owner auth id
-- This is safe even if there are no rows.
UPDATE public.vehicles v
SET owner_id = rs.owner_id
FROM public.rental_shops rs
WHERE v.shop_id = rs.id
  AND (v.owner_id IS NULL OR v.owner_id = rs.id OR v.owner_id <> rs.owner_id);

-- 3) Add correct FK to auth.users(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vehicles_owner_id_fkey_auth'
      AND conrelid = 'public.vehicles'::regclass
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_owner_id_fkey_auth
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) NOT VALID;

    ALTER TABLE public.vehicles
      VALIDATE CONSTRAINT vehicles_owner_id_fkey_auth;
  END IF;
END $$;
