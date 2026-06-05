-- Ensure vehicles.owner_id FK exists and points to auth.users(id)
-- Safe: only adds FK if missing.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'vehicles'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'owner_id'
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
  END IF;
END $$;
