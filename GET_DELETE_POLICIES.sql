-- ============================================================================
-- GET ALL DELETE RLS POLICIES FROM SUPABASE
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as "USING Condition",
  with_check as "WITH CHECK Condition"
FROM pg_policies
WHERE cmd = 'DELETE'
ORDER BY schemaname, tablename, policyname;

-- Alternative: Get DELETE policies with more detail
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles::text,
  cmd,
  COALESCE(qual, 'NO CONDITION') as "Policy Condition",
  COALESCE(with_check, 'N/A') as "With Check"
FROM pg_policies
WHERE cmd = 'DELETE'
  AND schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename;

-- Count DELETE policies per table
SELECT 
  tablename,
  COUNT(*) as delete_policy_count
FROM pg_policies
WHERE cmd = 'DELETE'
  AND schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Show DELETE policies for specific table (example: customers)
SELECT 
  schemaname,
  tablename,
  policyname,
  qual as "Condition",
  with_check as "With Check"
FROM pg_policies
WHERE cmd = 'DELETE'
  AND tablename = 'customers';
