-- =============================================================================
-- VERIFICATION: RLS RESTORED TO JAN 13 STATE
-- =============================================================================

\echo ''
\echo '========================================='
\echo 'RLS POLICY VERIFICATION'
\echo '========================================='
\echo ''

-- Check helper function exists
\echo '1. Helper Function:'
SELECT 
  proname as function_name,
  prosecdef as is_security_definer,
  provolatile as volatility
FROM pg_proc 
WHERE proname = 'get_my_shop_id';

\echo ''
\echo '2. RLS Policy Counts per Table:'
SELECT 
  tablename,
  COUNT(*) as policy_count,
  array_agg(policyname ORDER BY policyname) as policies
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('customers', 'vehicles', 'bookings', 'customer_id_photos', 
                    'damages', 'vehicle_damage_photos', 'documents', 'payments')
GROUP BY tablename 
ORDER BY tablename;

\echo ''
\echo '3. Sample Policy Details (customers):'
SELECT 
  policyname,
  cmd as operation,
  CASE 
    WHEN qual LIKE '%get_my_shop_id()%' THEN 'Uses get_my_shop_id()'
    WHEN qual LIKE '%auth.jwt()%' THEN 'Uses auth.jwt() - BAD!'
    ELSE 'Other'
  END as policy_type,
  qual as using_clause
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'customers'
ORDER BY policyname;

\echo ''
\echo '4. Storage Policies (customer-ids bucket):'
SELECT 
  policyname,
  cmd as operation,
  qual as using_clause
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%customer%ids%'
ORDER BY policyname;

\echo ''
\echo '5. Soft Delete Triggers:'
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgtype & 2 = 2 as is_before,
  tgtype & 8 = 8 as is_delete
FROM pg_trigger 
WHERE tgname LIKE 'trigger_soft_delete%'
ORDER BY tgname;

\echo ''
\echo '6. customer_id_photos Table Structure:'
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'customer_id_photos'
ORDER BY ordinal_position;

\echo ''
\echo '========================================='
\echo 'VERIFICATION COMPLETE'
\echo '========================================='
