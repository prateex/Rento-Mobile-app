-- =============================================================================
-- FIX DAMAGES RLS: Replace JWT shop_id with auth.uid() + users table join
-- =============================================================================
-- Date: 2026-01-26
-- Problem: Current policies use (auth.jwt() ->> 'shop_id') which is NULL
-- Solution: Use auth.uid() with EXISTS subquery joining users table
-- Impact: Fixes 403 Forbidden errors on damage INSERT during return flow
-- =============================================================================

BEGIN;

-- Enable RLS on damages table
ALTER TABLE damages ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS damages_select ON damages;
DROP POLICY IF EXISTS damages_insert ON damages;
DROP POLICY IF EXISTS damages_update ON damages;
DROP POLICY IF EXISTS damages_delete ON damages;

-- Create new policies using auth.uid() + users table join
CREATE POLICY damages_select
ON damages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
      AND users.shop_id = damages.shop_id
  )
);

CREATE POLICY damages_insert
ON damages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
      AND users.shop_id = damages.shop_id
  )
);

CREATE POLICY damages_update
ON damages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
      AND users.shop_id = damages.shop_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
      AND users.shop_id = damages.shop_id
  )
);

CREATE POLICY damages_delete
ON damages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
      AND users.shop_id = damages.shop_id
  )
);

-- Verification
DO $$
DECLARE
  policy_count INT;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'damages';
  
  IF policy_count != 4 THEN
    RAISE EXCEPTION 'Expected 4 damages policies, found %', policy_count;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '✓✓✓ DAMAGES RLS FIXED ✓✓✓';
  RAISE NOTICE 'Policies now use auth.uid() + users table join';
  RAISE NOTICE 'All 4 policies created: select, insert, update, delete';
  RAISE NOTICE '';
END $$;

COMMIT;
