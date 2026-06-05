-- ============================================================================
-- COMPLETE SCHEMA EXPORT FOR DOCUMENTATION
-- ============================================================================
-- Run this query to get your entire schema, RLS policies, and relationships
-- Copy the output and share with ChatGPT for schema explanation
-- ============================================================================

-- SECTION 1: ALL TABLES AND COLUMNS
\echo '════════════════════════════════════════════════════════════════'
\echo 'SECTION 1: TABLES AND COLUMNS'
\echo '════════════════════════════════════════════════════════════════'

SELECT 
  t.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default,
  tc.constraint_type
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu ON c.table_name = ccu.table_name AND c.column_name = ccu.column_name
LEFT JOIN information_schema.table_constraints tc ON ccu.constraint_name = tc.constraint_name
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- SECTION 2: ALL RLS POLICIES
\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo 'SECTION 2: RLS POLICIES'
\echo '════════════════════════════════════════════════════════════════'

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
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- SECTION 3: FOREIGN KEY RELATIONSHIPS
\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo 'SECTION 3: FOREIGN KEY RELATIONSHIPS'
\echo '════════════════════════════════════════════════════════════════'

SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- SECTION 4: INDEXES
\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo 'SECTION 4: INDEXES'
\echo '════════════════════════════════════════════════════════════════'

SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- SECTION 5: ENUM TYPES
\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo 'SECTION 5: ENUM TYPES'
\echo '════════════════════════════════════════════════════════════════'

SELECT 
  n.nspname AS schema,
  t.typname AS enum_name,
  array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
GROUP BY n.nspname, t.typname
ORDER BY t.typname;

-- SECTION 6: FUNCTIONS AND TRIGGERS
\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo 'SECTION 6: FUNCTIONS AND TRIGGERS'
\echo '════════════════════════════════════════════════════════════════'

SELECT 
  t.trigger_name,
  t.event_object_table,
  t.event_manipulation,
  t.action_orientation,
  r.routine_name AS function_name
FROM information_schema.triggers t
LEFT JOIN information_schema.routines r 
  ON t.trigger_name = r.routine_name
WHERE t.trigger_schema = 'public'
ORDER BY t.event_object_table, t.trigger_name;

-- SECTION 7: SEQUENCES
\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo 'SECTION 7: SEQUENCES'
\echo '════════════════════════════════════════════════════════════════'

SELECT 
  sequence_schema,
  sequence_name,
  data_type,
  start_value,
  minimum_value,
  maximum_value,
  increment,
  cycle_option
FROM information_schema.sequences
WHERE sequence_schema = 'public'
ORDER BY sequence_name;

-- SECTION 8: TABLE SIZE AND ROW COUNT
\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo 'SECTION 8: TABLE SIZE AND ROW COUNT'
\echo '════════════════════════════════════════════════════════════════'

SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  (SELECT COUNT(*) FROM pg_stat_user_tables WHERE relname = tablename) as estimated_rows
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- SECTION 9: STORAGE BUCKET POLICIES (if configured)
\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo 'SECTION 9: STORAGE BUCKET POLICIES'
\echo '════════════════════════════════════════════════════════════════'

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
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;

-- SECTION 10: HELPER FUNCTIONS (if any)
\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo 'SECTION 10: HELPER FUNCTIONS'
\echo '════════════════════════════════════════════════════════════════'

SELECT 
  routine_schema,
  routine_name,
  routine_type,
  data_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- SUMMARY STATISTICS
\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo 'SUMMARY STATISTICS'
\echo '════════════════════════════════════════════════════════════════'

SELECT 
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') as total_tables,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as total_rls_policies,
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public') as total_foreign_keys,
  (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') as total_indexes,
  (SELECT COUNT(*) FROM pg_type WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) as total_custom_types;
