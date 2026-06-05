== RLS FIX - CRITICAL INVESTIGATION & SOLUTION ==
Date: 2026-01-26
Status: COMPLETE

================================================================================
PROBLEM IDENTIFIED
================================================================================

Error: "new row violates row-level security policy for table damages" (403 Forbidden)

ROOT CAUSE:
-----------
The current RLS policy (20260119120000_fix_rls_jwt_claims.sql) uses:
  
  CREATE POLICY "damages_insert" ON damages
  FOR INSERT
  WITH CHECK (shop_id = (auth.jwt() ->> 'shop_id')::uuid);

This fails because:
  1. The 'shop_id' claim is NOT present in Supabase JWT tokens
  2. (auth.jwt() ->> 'shop_id') evaluates to NULL
  3. NULL = any_uuid always returns FALSE
  4. INSERT is rejected with RLS policy violation (403)

The JWT token from Supabase Anon key contains only:
  - sub (user ID)
  - aud (audience)
  - iat, exp (timestamps)
  - role (always "authenticated" or "anon")

CUSTOM CLAIMS like shop_id require:
  - Auth hooks (not configured)
  - Or explicit app_metadata/user_metadata setting (not used)


================================================================================
SOLUTION IMPLEMENTED
================================================================================

File: supabase/migrations/20260126_fix_rls_use_auth_uid.sql

Strategy:
  1. Replace JWT shop_id assumption with auth.uid() lookup
  2. Use users table as source of truth for user→shop mapping
  3. No recursive queries (safe from infinite loops)
  4. Explicit user and shop validation on every operation

NEW RLS POLICIES for damages table:

A) SELECT: 
   EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() 
                                 AND users.shop_id = damages.shop_id)

B) INSERT:
   EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() 
                                 AND users.shop_id = damages.shop_id)
   AND damages.user_id = auth.uid()

C) UPDATE:
   EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() 
                                 AND users.shop_id = damages.shop_id)

D) DELETE:
   EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() 
                                 AND users.shop_id = damages.shop_id)


================================================================================
CODE VERIFICATION - DAMAGE INSERT CONTRACT
================================================================================

Location: backend/client/src/pages/Bookings.tsx (lines 702-718)

INSERT fields:
  ✅ shop_id: shopId          (from getAuthContext())
  ✅ user_id: userId          (from getAuthContext())
  ✅ vehicle_id: bikeId
  ✅ booking_id: booking.id
  ✅ type: damage.type
  ✅ severity: uiToDbSeverity(damage.severity)  [NORMALIZED to DB format]
  ✅ description: damage.notes || null
  ✅ photo_urls: [...] or null
  ✅ reported_by: userId      (matches user_id)
  ✅ reported_at: ISO timestamp

ALL REQUIRED FIELDS PRESENT ✅


================================================================================
ERROR HANDLING - HARD FAIL IMPLEMENTATION
================================================================================

Location: Bookings.tsx (lines 715-717)

  if (damageError) {
    console.error('[RETURN FLOW] Damage insert failed:', damageError);
    throw new Error(`Failed to persist damage: ${damageError.message}`);
  }

BEHAVIOR:
  ✅ If damage insert fails → throw error
  ✅ Error bubbles to catch block (line 741)
  ✅ Toast shows to user: "Return Failed: [error message]"
  ✅ Return flow ABORTS (does not proceed to vehicle update)
  ✅ Exception is re-thrown to caller

RESULT: Booking completion REQUIRES successful damage persistence ✅


================================================================================
VEHICLES.DAMAGES DEPRECATION STATUS
================================================================================

File: backend/client/src/lib/store.ts (lines 333)

  // REMOVED: damages must NOT be written to vehicles table
  // damages table is the single source of truth

Confirmed: ✅ No writes to vehicles.damages JSONB column

Why:
  - vehicles.damages was storing stale/incomplete data
  - damages table is the single authoritative source
  - Prevents dual-write inconsistencies


================================================================================
DEPLOYMENT CHECKLIST
================================================================================

Before deploying:

1. [ ] Apply migration: supabase/migrations/20260126_fix_rls_use_auth_uid.sql
   
   Command: 
     supabase db push
   
   Or in Supabase dashboard:
     - SQL Editor
     - Paste migration content
     - Run

2. [ ] Verify RLS policies created:
   
   Query:
     SELECT policyname, qual, with_check
     FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'damages'
     ORDER BY policyname;
   
   Expected 4 policies:
     - damages_delete
     - damages_insert  (WITH CHECK uses EXISTS clause)
     - damages_select
     - damages_update

3. [ ] Test damage insert in return flow:
   
   Steps:
     a) Create booking
     b) Start return flow
     c) Add damage (any severity)
     d) Complete return → should persist successfully
     e) Check database: SELECT * FROM damages WHERE booking_id = '<id>';
     f) Verify: damage row exists with severity as 'Minor'/'Moderate'/'Major'

4. [ ] Verify user context:
   
   Ensure:
     - getAuthContext() returns { uid, shopId, userId }
     - uid matches authenticated user
     - shopId matches user's shop assignment
     - userId = uid (same value)

5. [ ] Test with multiple shops:
   
   If multi-tenant setup:
     a) Create user in Shop A
     b) Create booking in Shop A  
     c) Insert damage → should succeed
     d) Login as user from Shop B
     e) Query damages from Shop A → should see nothing (RLS blocks)
     f) Insert damage into Shop A data → should fail (403)


================================================================================
ROLLBACK PROCEDURE
================================================================================

If issues occur:

1. Revert to previous RLS:
   
   supabase db reset --sandbox
   
   Or manually re-apply 20260119120000_fix_rls_jwt_claims.sql

2. Contact Supabase support if auth.jwt() missing claims


================================================================================
TESTING EVIDENCE NEEDED
================================================================================

After deployment, verify:

Query 1 - RLS Policy Installed:
  SELECT COUNT(*) as policy_count FROM pg_policies 
  WHERE schemaname = 'public' AND tablename = 'damages';
  
  Expected: 4

Query 2 - Sample Insert (should succeed now):
  SELECT 1 FROM damages 
  WHERE user_id = auth.uid() 
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid());
  
  Expected: No error

Query 3 - Cross-shop isolation (should fail):
  [As user from Shop A, try to access Shop B damages]
  Expected: No rows returned


================================================================================
TECHNICAL NOTES
================================================================================

1. Why auth.uid() instead of JWT claims?
   - auth.uid() is built-in Supabase security context
   - Guaranteed to be present for authenticated users
   - Cannot be spoofed (server-side validated)
   - Always consistent across all operations

2. Why EXISTS subquery pattern?
   - Allows flexible validation logic
   - Safe from recursive infinite loops (unlike helper functions)
   - Clear intent in SQL
   - PostgreSQL optimizes EXISTS efficiently

3. Why user_id = auth.uid() on INSERT?
   - Ensures user can only report damages for themselves
   - Prevents one user reporting damage for another
   - matches reported_by field

4. Severity normalization:
   - uiToDbSeverity() converts 'minor' → 'Minor'
   - Severity is stored in DB as capitalized value
   - dbToUiSeverity() converts 'Minor' → 'minor' on read
   - ENUM case sensitivity is absolute in PostgreSQL


================================================================================
MIGRATION FILENAME REFERENCE
================================================================================

File: supabase/migrations/20260126_fix_rls_use_auth_uid.sql

Timestamp: 20260126_fix_rls_use_auth_uid

Ordering:
  - Runs AFTER: 20260124_add_customer_address_fields.sql
  - MUST run before: any future app deployments

This ensures:
  - Customers table is ready
  - Damages RLS is fixed BEFORE app tries to insert damages


================================================================================
FINAL STATUS
================================================================================

✅ Root cause identified: JWT shop_id claim missing
✅ Solution designed: Use auth.uid() with users table lookup
✅ Migration created: 20260126_fix_rls_use_auth_uid.sql
✅ Code verified: Insert contract complete, all fields present
✅ Error handling: Hard fail in place, prevents partial completion
✅ Data isolation: vehicles.damages deprecated, damages table authoritative
✅ Ready for deployment

Next steps: Apply migration and test damage persistence in return flow
