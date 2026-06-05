-- ============================================================================
-- SAFETY AUDIT: Verify No Dangerous Cascades or Triggers
-- ============================================================================
-- Run this BEFORE applying the delete fix to verify database safety
-- ============================================================================

-- Check 1: Verify NO cascades from auth.users to main tables
SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'users' -- auth.users referenced through auth schema
  AND tc.table_name IN ('customers', 'vehicles', 'bookings', 'payments')
ORDER BY tc.table_name;

-- Expected: NO RESULTS (no direct FK from main tables to auth.users)

-- Check 2: Verify rental_shops cascade (acceptable)
SELECT 
  tc.table_name,
  kcu.column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'rental_shops'
  AND tc.table_name IN ('customers', 'vehicles', 'bookings', 'payments')
ORDER BY tc.table_name;

-- Expected: All show CASCADE (acceptable - shop owns data)

-- Check 3: Find all DELETE triggers (should be safe)
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_manipulation = 'DELETE'
  AND event_object_table IN ('customers', 'vehicles', 'bookings', 'payments')
ORDER BY event_object_table, trigger_name;

-- Expected: 
-- - trigger_prevent_customer_deletion (BEFORE DELETE) - SAFE: blocks hard delete if bookings exist
-- - bookings_prevent_delete_if_invoiced (BEFORE DELETE) - SAFE: blocks hard delete if invoiced

-- Check 4: Find all UPDATE triggers (soft delete cascades)
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE event_manipulation = 'UPDATE'
  AND event_object_table IN ('customers', 'vehicles', 'bookings')
ORDER BY event_object_table, trigger_name;

-- Expected:
-- - trg_soft_delete_customer_photos (AFTER UPDATE) - SAFE: cascades soft delete to photos
-- - trg_soft_delete_vehicle_photos (AFTER UPDATE) - SAFE: cascades soft delete to photos
-- - trg_soft_delete_booking_children (AFTER UPDATE) - SAFE: cascades soft delete to payments

-- Check 5: Verify deleted_at columns exist
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE column_name = 'deleted_at'
  AND table_name IN ('customers', 'vehicles', 'bookings', 'payments', 
                     'customer_id_photos', 'vehicle_damage_photos')
ORDER BY table_name;

-- Expected: 6 rows (all tables have deleted_at TIMESTAMPTZ NULL)

-- Check 6: Verify current UPDATE policies (these are broken)
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%deleted_at IS NULL%' THEN '❌ BLOCKING soft delete'
    ELSE '✅ OK'
  END as status,
  qual as using_clause
FROM pg_policies
WHERE tablename IN ('customers', 'vehicles', 'bookings', 'payments')
  AND cmd = 'UPDATE'
ORDER BY tablename, policyname;

-- Expected: All show ❌ BLOCKING (this is what we're fixing)

-- Check 7: Verify SELECT policies filter deleted records
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%deleted_at IS NULL%' THEN '✅ Filters deleted'
    ELSE '⚠️ May show deleted records'
  END as status
FROM pg_policies
WHERE tablename IN ('customers', 'vehicles', 'bookings', 'payments')
  AND cmd = 'SELECT'
ORDER BY tablename, policyname;

-- Expected: All show ✅ Filters deleted

-- ============================================================================
-- SAFETY VERDICT
-- ============================================================================

DO $$
DECLARE
  auth_fk_count INTEGER;
  delete_trigger_count INTEGER;
  update_trigger_count INTEGER;
  deleted_at_count INTEGER;
BEGIN
  -- Count dangerous FKs from main tables to auth.users
  SELECT COUNT(*) INTO auth_fk_count
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'users'
    AND tc.table_name IN ('customers', 'vehicles', 'bookings', 'payments');

  -- Count DELETE triggers
  SELECT COUNT(*) INTO delete_trigger_count
  FROM information_schema.triggers
  WHERE event_manipulation = 'DELETE'
    AND event_object_table IN ('customers', 'vehicles', 'bookings');

  -- Count UPDATE triggers (soft delete cascades)
  SELECT COUNT(*) INTO update_trigger_count
  FROM information_schema.triggers
  WHERE event_manipulation = 'UPDATE'
    AND event_object_table IN ('customers', 'vehicles', 'bookings');

  -- Count deleted_at columns
  SELECT COUNT(*) INTO deleted_at_count
  FROM information_schema.columns
  WHERE column_name = 'deleted_at'
    AND table_name IN ('customers', 'vehicles', 'bookings', 'payments');

  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🔍 SAFETY AUDIT RESULTS';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  
  IF auth_fk_count = 0 THEN
    RAISE NOTICE '✅ No dangerous FKs to auth.users';
  ELSE
    RAISE NOTICE '❌ DANGER: % FKs to auth.users found!', auth_fk_count;
  END IF;

  IF delete_trigger_count <= 2 THEN
    RAISE NOTICE '✅ DELETE triggers: % (expected: 1-2 protective triggers)', delete_trigger_count;
  ELSE
    RAISE NOTICE '⚠️  DELETE triggers: % (review needed)', delete_trigger_count;
  END IF;

  IF update_trigger_count >= 3 THEN
    RAISE NOTICE '✅ Soft delete cascade triggers: %', update_trigger_count;
  ELSE
    RAISE NOTICE '⚠️  Missing soft delete cascades: % found (need 3+)', update_trigger_count;
  END IF;

  IF deleted_at_count >= 4 THEN
    RAISE NOTICE '✅ Soft delete columns: % tables', deleted_at_count;
  ELSE
    RAISE NOTICE '❌ Missing deleted_at columns: % found (need 4+)', deleted_at_count;
  END IF;

  RAISE NOTICE '';
  
  IF auth_fk_count = 0 AND deleted_at_count >= 4 THEN
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '✅ SAFE TO APPLY DELETE FIX';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Next Steps:';
    RAISE NOTICE '   1. Run apply_delete_fix_to_cloud.sql';
    RAISE NOTICE '   2. Test delete operations';
    RAISE NOTICE '   3. Verify no data corruption';
  ELSE
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '❌ NOT SAFE - REVIEW REQUIRED';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  Issues detected - do not proceed';
  END IF;
END $$;
