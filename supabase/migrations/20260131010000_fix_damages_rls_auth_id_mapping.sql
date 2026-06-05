-- =============================================================================
-- FIX DAMAGES RLS: Use users.auth_id = auth.uid() for correct auth mapping
-- =============================================================================
BEGIN;

-- Drop broken policies
DROP POLICY IF EXISTS damages_select ON public.damages;
DROP POLICY IF EXISTS damages_insert ON public.damages;
DROP POLICY IF EXISTS damages_update ON public.damages;
DROP POLICY IF EXISTS damages_delete ON public.damages;

-- SELECT policy
CREATE POLICY damages_select
ON public.damages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.auth_id = auth.uid()
      AND users.shop_id = damages.shop_id
  )
);

-- INSERT policy
CREATE POLICY damages_insert
ON public.damages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.auth_id = auth.uid()
      AND users.shop_id = damages.shop_id
  )
);

-- UPDATE policy
CREATE POLICY damages_update
ON public.damages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.auth_id = auth.uid()
      AND users.shop_id = damages.shop_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.auth_id = auth.uid()
      AND users.shop_id = damages.shop_id
  )
);

-- DELETE policy
CREATE POLICY damages_delete
ON public.damages
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.auth_id = auth.uid()
      AND users.shop_id = damages.shop_id
  )
);

-- NOTE: users.auth_id must be used because auth.uid() returns the auth.users UUID,
--       not the internal public.users.id value.
-- NOTE: This fixes booking return flow damage inserts failing with 403.

COMMIT;
