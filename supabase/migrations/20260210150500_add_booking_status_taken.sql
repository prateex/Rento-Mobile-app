-- Add missing booking_status enum value required by marketplace index predicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'booking_status' AND e.enumlabel = 'Taken'
  ) THEN
    ALTER TYPE booking_status ADD VALUE 'Taken';
  END IF;
END $$;
