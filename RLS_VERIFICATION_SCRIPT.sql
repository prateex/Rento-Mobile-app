-- ============================================================================
-- VERIFICATION SCRIPT: RLS Restoration Status
-- ============================================================================
-- Run this script to verify that all 5 tables now have RLS enabled with 
-- appropriate policies.
-- ============================================================================

-- Step 1: Verify RLS is enabled on all 5 target tables
SELECT 
  'RLS Status Check' AS check_type,
  c.relname AS table_name,
  CASE WHEN c.relrowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END AS rls_status,
  CASE WHEN c.relforcerowsecurity THEN 'FORCED' ELSE 'NOT FORCED' END AS rls_force_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relkind = 'r'
AND c.relname IN (
  'customer_profiles',
  'customer_id_documents',
  'marketplace_locations',
  'marketplace_payment_events',
  'marketplace_payment_reconciliation'
)
ORDER BY c.relname;

-- Step 2: Verify policies exist for each table
SELECT 
  'Policy Count' AS check_type,
  tablename,
  COUNT(*) AS policy_count,
  STRING_AGG(policyname, ', ' ORDER BY policyname) AS policies
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
  'customer_profiles',
  'customer_id_documents',
  'marketplace_locations',
  'marketplace_payment_events',
  'marketplace_payment_reconciliation'
)
GROUP BY tablename
ORDER BY tablename;

-- Step 3: List all policies with their details
SELECT 
  'Policy Details' AS check_type,
  tablename,
  policyname,
  cmd,
  permissive,
  roles
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
  'customer_profiles',
  'customer_id_documents',
  'marketplace_locations',
  'marketplace_payment_events',
  'marketplace_payment_reconciliation'
)
ORDER BY tablename, policyname;

-- Step 4: Verify no tables remain with RLS disabled in public schema
SELECT 
  'Missing RLS' AS check_type,
  c.relname AS table_name,
  'NEEDS ATTENTION' AS status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relkind = 'r'
AND NOT c.relrowsecurity
AND c.relname NOT LIKE 'pg_%'
ORDER BY c.relname;

-- Expected Result:
-- ✅ customer_profiles: RLS ENABLED, 4 policies
-- ✅ customer_id_documents: RLS ENABLED, 4 policies
-- ✅ marketplace_locations: RLS ENABLED, 1 policy
-- ✅ marketplace_payment_events: RLS ENABLED, 2 policies
-- ✅ marketplace_payment_reconciliation: RLS ENABLED, 1 policy
-- ✅ No tables with RLS disabled (Step 4 returns 0 rows)
