-- Remove duplicate vehicles.owner_id FK to auth.users
-- Keep vehicles_owner_id_fkey with ON DELETE RESTRICT

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vehicles_owner_id_fkey_auth'
      AND conrelid = 'public.vehicles'::regclass
  ) THEN
    ALTER TABLE public.vehicles DROP CONSTRAINT vehicles_owner_id_fkey_auth;
  END IF;
END $$;

-- Ensure primary FK exists with RESTRICT
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
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
  END IF;
END $$;
