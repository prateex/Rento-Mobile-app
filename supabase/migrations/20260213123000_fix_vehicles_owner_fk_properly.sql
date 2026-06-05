-- Fix vehicles.owner_id FK to reference auth.users(id)
-- Rationale: app uses owner_id = auth.uid(); FK currently points to rental_shops(id)
-- Safe, idempotent, and non-destructive.

BEGIN;

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

-- 2) Normalize existing rows to shop owner auth id
UPDATE public.vehicles v
SET owner_id = rs.owner_id
FROM public.rental_shops rs
WHERE v.shop_id = rs.id
  AND (v.owner_id IS NULL OR v.owner_id IS DISTINCT FROM rs.owner_id);

-- 3) Add correct FK (RESTRICT on delete to match typical ownership semantics)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vehicles_owner_id_fkey'
      AND conrelid = 'public.vehicles'::regclass
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT NOT VALID;

    ALTER TABLE public.vehicles
      VALIDATE CONSTRAINT vehicles_owner_id_fkey;
  END IF;
END $$;

COMMIT;
