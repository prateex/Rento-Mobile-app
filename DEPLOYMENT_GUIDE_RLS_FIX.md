== DEPLOYMENT GUIDE: Fix Damage Insert RLS Failures ==

PROBLEM:
  Damage inserts fail with: "new row violates row-level security policy" (403)
  Root cause: RLS policy relies on missing JWT 'shop_id' claim

SOLUTION:
  Replace JWT-based RLS with auth.uid() lookup from users table

================================================================================
STEP 1: APPLY MIGRATION
================================================================================

File to apply: supabase/migrations/20260126_fix_rls_use_auth_uid.sql

Via Supabase Dashboard:
  1. Go to SQL Editor
  2. Create new query
  3. Paste entire migration file
  4. Click "Run"
  5. Verify: "✓✓✓ DAMAGES RLS FIXED ✓✓✓" message appears

Via CLI (if using Supabase CLI):
  supabase db push

Via API:
  - Execute SQL via Supabase Management API


================================================================================
STEP 2: VERIFY DEPLOYMENT
================================================================================

Run this query to confirm policies are installed:

  SELECT policyname, qual, with_check 
  FROM pg_policies 
  WHERE schemaname = 'public' AND tablename = 'damages'
  ORDER BY policyname;

Expected output (4 rows):
  damages_delete   | (EXISTS (...))      | NULL
  damages_insert   | NULL                | (EXISTS (...) AND damage.user_id = auth.uid())
  damages_select   | (EXISTS (...))      | NULL
  damages_update   | (EXISTS (...))      | (EXISTS (...))


================================================================================
STEP 3: TEST DAMAGE PERSISTENCE
================================================================================

In app (Bookings page):
  1. Create a booking
  2. Start return flow
  3. Add damage with severity "Minor" (or any severity)
  4. Complete return
  5. Expected: Damage saved successfully

In database, verify damage persisted:
  SELECT id, shop_id, user_id, severity, created_at 
  FROM damages 
  WHERE booking_id = '<booking_id>'
  ORDER BY created_at DESC 
  LIMIT 1;

Expected:
  - Severity should be 'Minor' (capitalized, not lowercase)
  - shop_id and user_id should match authenticated user


================================================================================
STEP 4: ROLLBACK (if needed)
================================================================================

If issues occur, contact Supabase support or:
  - Database reset via CLI: supabase db reset --sandbox
  - Restore from backup
  - Manually DROP policies and restore previous version


================================================================================
WHAT CHANGED
================================================================================

Before (BROKEN):
  CREATE POLICY "damages_insert" ON damages
  FOR INSERT
  WITH CHECK (shop_id = (auth.jwt() ->> 'shop_id')::uuid);
  
  ❌ Fails because JWT has no 'shop_id' claim
  ❌ NULL = any_uuid = FALSE always
  ❌ All inserts rejected with 403

After (FIXED):
  CREATE POLICY "damages_insert" ON damages
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.shop_id = damages.shop_id)
    AND damages.user_id = auth.uid()
  );
  
  ✅ auth.uid() is always present for authenticated users
  ✅ Verified against users table (authoritative source)
  ✅ Inserts succeed for valid users in correct shop


================================================================================
APP CODE VERIFICATION
================================================================================

The app already sends all required fields on damage insert:

  Bookings.tsx (line 702-718):
    {
      shop_id: shopId,          ✅ From getAuthContext()
      user_id: userId,          ✅ From getAuthContext()
      vehicle_id: bikeId,       ✅ From booking
      booking_id: booking.id,   ✅ From booking
      type: damage.type,        ✅ From form
      severity: uiToDbSeverity(...),  ✅ Normalized to 'Minor'/'Moderate'/'Major'
      description: damage.notes || null,
      photo_urls: [...],
      reported_by: userId,      ✅ Matches user_id
      reported_at: ISO timestamp ✅ Server timestamp
    }

All fields are correct. RLS will now accept these inserts.


================================================================================
ERROR HANDLING
================================================================================

If insert still fails (shouldn't happen):
  1. Error is caught in return flow (line 717)
  2. User sees toast: "Return Failed: [error message]"
  3. Booking completion aborts (doesn't update vehicle status)
  4. Error logged to console for debugging

This is correct behavior - return flow REQUIRES successful damage persistence.


================================================================================
SUPPORT
================================================================================

If damage insert still fails after applying migration:

1. Check RLS policies were applied:
   SELECT * FROM pg_policies WHERE tablename = 'damages';

2. Verify user is authenticated:
   SELECT auth.uid();  (should return user UUID, not NULL)

3. Verify user exists in users table:
   SELECT id, shop_id FROM users WHERE id = auth.uid();
   (should return 1 row with user's shop assignment)

4. Check app logs for error details
5. Contact: [support email]


================================================================================
TIMELINE
================================================================================

Migration created: 2026-01-26
Ready for deployment: Immediately
Estimated app testing time: 5-10 minutes
Expected impact: All damage persistence now works


-- END DEPLOYMENT GUIDE --
