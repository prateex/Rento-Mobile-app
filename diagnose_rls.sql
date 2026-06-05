-- ============================================
-- DIAGNOSTIC: Check current RLS state
-- ============================================

-- What policies exist right now?
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- What functions exist?
SELECT 
  routine_name,
  routine_type,
  routine_schema,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%user%'
ORDER BY routine_name;

-- Check if old function still exists
SELECT routine_name 
FROM information_schema.routines
WHERE routine_name = 'get_current_user_context';
