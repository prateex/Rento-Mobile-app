-- ============================================================================
-- GET ALL RLS POLICIES IN ONE QUERY
-- ============================================================================
-- Shows SELECT, INSERT, UPDATE, DELETE policies for all tables
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  permissive,
  roles::text,
  qual as "USING Condition",
  with_check as "WITH CHECK Condition"
FROM pg_policies
ORDER BY schemaname, tablename, cmd, policyname;

-- ============================================================================
-- ALTERNATIVE: Pretty formatted all policies
-- ============================================================================

SELECT 
  schemaname as "Schema",
  tablename as "Table",
  policyname as "Policy Name",
  cmd as "Operation",
  CASE 
    WHEN permissive THEN 'ALLOW'
    ELSE 'DENY'
  END as "Type",
  COALESCE(qual, 'N/A') as "SELECT/DELETE Condition",
  COALESCE(with_check, 'N/A') as "INSERT/UPDATE Condition"
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, cmd;

-- ============================================================================
-- GROUP BY TABLE - Shows all operations per table
-- ============================================================================

SELECT 
  tablename,
  STRING_AGG(DISTINCT cmd, ', ' ORDER BY cmd) as "Operations",
  COUNT(*) as "Total Policies"
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- SUMMARY - Count by operation type
-- ============================================================================

SELECT 
  cmd as "Operation",
  COUNT(*) as "Policy Count"
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
GROUP BY cmd
ORDER BY cmd;
