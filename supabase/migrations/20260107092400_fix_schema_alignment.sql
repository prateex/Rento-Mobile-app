-- Fix schema alignment across bookings, vehicles, customers and enums
-- Rules:
-- - Only additive/corrective changes
-- - Do not touch auth.users data
-- - Keep RLS policies intact

BEGIN;

-- 1) booking_status enum: normalize to canonical set
--    Target values: 'Booked','Confirmed','Active','Completed','Cancelled'
--    Map legacy values:
--      'Taken'        -> 'Active'
--      'Returned'     -> 'Completed'
--      'Advance Paid' -> 'Booked'
DO $$
DECLARE
	has_type BOOLEAN := EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status');
BEGIN
	IF has_type THEN
		-- Create a fresh enum with the canonical set
		CREATE TYPE booking_status_new AS ENUM (
			'Booked', 'Confirmed', 'Active', 'Completed', 'Cancelled'
		);

		-- Drop default to allow type change
		ALTER TABLE bookings ALTER COLUMN status DROP DEFAULT;

		-- Cast with value mapping for legacy statuses
		ALTER TABLE bookings
			ALTER COLUMN status TYPE booking_status_new
			USING (
				CASE status::text
					WHEN 'Taken'        THEN 'Active'
					WHEN 'Returned'     THEN 'Completed'
					WHEN 'Advance Paid' THEN 'Booked'
					ELSE status::text
				END
			)::booking_status_new;

		-- Restore default
		ALTER TABLE bookings ALTER COLUMN status SET DEFAULT 'Booked'::booking_status_new;

		-- Replace old type
		DROP TYPE booking_status;
		ALTER TYPE booking_status_new RENAME TO booking_status;
	END IF;
END $$;

-- 2) vehicle_status enum: include 'Rented' used by application when vehicle is taken
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_enum 
		WHERE enumlabel = 'Rented' AND enumtypid = 'vehicle_status'::regtype
	) THEN
		ALTER TYPE vehicle_status ADD VALUE 'Rented';
	END IF;
END $$;

-- 3) Add created_by columns (FK -> auth.users.id) with safe defaults
--    Note: default auth.uid() applies to future rows; existing rows remain NULL (safe)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE vehicles  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE bookings  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid();

-- 4) Add bookings.notes (nullable)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notes text;

COMMIT;

-- Verification (non-fatal selects)
-- SELECT enum_range(NULL::booking_status) AS booking_status_values;
-- SELECT enum_range(NULL::vehicle_status)  AS vehicle_status_values;
