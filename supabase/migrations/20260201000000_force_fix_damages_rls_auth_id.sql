-- ============================================================================
-- FORCE FIX: Damages RLS Policies with Correct Auth Mapping
-- ============================================================================
-- Problem: Previous migration did not apply correctly
-- Root cause: policies still use users.id = auth.uid() (WRONG)
-- Correct mapping: users.auth_id = auth.uid()
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Drop ALL existing policies on damages table
-- ============================================================================
DROP POLICY IF EXISTS damages_select ON public.damages;
DROP POLICY IF EXISTS damages_insert ON public.damages;
DROP POLICY IF EXISTS damages_update ON public.damages;
DROP POLICY IF EXISTS damages_delete ON public.damages;

-- Force commit to ensure drops are applied
COMMIT;

BEGIN;

-- ============================================================================
-- STEP 2: Create SELECT policy (read access)
-- ============================================================================
CREATE POLICY damages_select ON public.damages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.auth_id = auth.uid()
      AND users.shop_id = damages.shop_id
  )
);

-- ============================================================================
-- STEP 3: Create INSERT policy (write access with NULL guard)
-- ============================================================================
CREATE POLICY damages_insert ON public.damages
FOR INSERT
WITH CHECK (
  damages.shop_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.auth_id = auth.uid()
      AND users.shop_id = damages.shop_id
  )
);

-- ============================================================================
-- STEP 4: Create UPDATE policy (modify access)
-- ============================================================================
CREATE POLICY damages_update ON public.damages
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
  damages.shop_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.auth_id = auth.uid()
      AND users.shop_id = damages.shop_id
  )
);

-- ============================================================================
-- STEP 5: Create DELETE policy (delete access)
-- ============================================================================
CREATE POLICY damages_delete ON public.damages
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.auth_id = auth.uid()
      AND users.shop_id = damages.shop_id
  )
);

COMMIT;
