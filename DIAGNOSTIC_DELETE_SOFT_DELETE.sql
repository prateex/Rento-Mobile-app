-- ============================================================================
-- COMPREHENSIVE SUPABASE DELETE/SOFT-DELETE DIAGNOSTIC
-- ============================================================================
-- Purpose: READ-ONLY forensic debugging of DELETE failures
-- Safe: NO data modifications, NO schema changes, NO RLS changes
-- Usage: Copy-paste entire file into Supabase SQL Editor and run
-- ============================================================================

-- ============================================================================
-- SECTION 1: DATABASE CONTEXT & AUTHENTICATION
-- ============================================================================
-- Determine who we are and what permissions we have

SELECT 
  'CURRENT_USER' as context,
  current_user as value;

SELECT 
  'SESSION_USER' as context,
  session_user as value;

SELECT 
  'CURRENT_ROLE' as context,
  current_role as value;

-- Check if we have JWT claims available
SELECT 
  'JWT_CLAIMS' as context,
  current_setting('request.jwt.claims', true) as value;

-- Try to extract JWT sub (auth user ID)
SELECT 
  'JWT_SUB_CLAIM' as context,
  (current_setting('request.jwt.claims', true)::jsonb ->> 'sub') as auth_user_id;

-- Check current auth.uid() if available
SELECT 
  'AUTH_UID' as context,
  auth.uid()::text as value;

-- ============================================================================
-- SECTION 2: RLS STATUS FOR TARGET TABLES
-- ============================================================================
-- Check if Row Level Security is enabled and forced on each table

SELECT 
  table_name,
  CASE WHEN row_security_enabled THEN 'ENABLED' ELSE 'DISABLED' END as rls_enabled,
  CASE WHEN force_row_security THEN 'FORCED' ELSE 'NOT FORCED' END as rls_forced
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'customers',
    'vehicles',
    'bookings',
    'payments',
    'customer_id_photos',
    'vehicle_damage_photos'
  )
ORDER BY table_name;

-- ============================================================================
-- SECTION 3: ALL RLS POLICIES - COMPLETE DETAIL
-- ============================================================================
-- Show every policy on target tables with full expressions

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive as policy_type,
  roles,
  qual as using_expression,
  with_check as check_expression,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'customers',
    'vehicles',
    'bookings',
    'payments',
    'customer_id_photos',
    'vehicle_damage_photos'
  )
ORDER BY tablename, cmd, policyname;

-- Show policies in a more readable format
SELECT 
  tablename,
  policyname,
  CASE cmd
    WHEN '*' THEN 'ALL'
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
  END as operation,
  CASE permissive
    WHEN true THEN 'PERMISSIVE'
    WHEN false THEN 'RESTRICTIVE'
  END as type,
  qual as "USING Clause",
  with_check as "WITH CHECK Clause"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'customers',
    'vehicles',
    'bookings',
    'payments',
    'customer_id_photos',
    'vehicle_damage_photos'
  )
ORDER BY tablename, operation;

-- Count policies per table and operation
SELECT 
  tablename,
  CASE cmd
    WHEN '*' THEN 'ALL'
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
  END as operation,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'customers',
    'vehicles',
    'bookings',
    'payments',
    'customer_id_photos',
    'vehicle_damage_photos'
  )
GROUP BY tablename, cmd
ORDER BY tablename, cmd;

-- ============================================================================
-- SECTION 4: TRIGGERS ON TARGET TABLES
-- ============================================================================
-- List all triggers that might block deletes

SELECT 
  trigger_schema,
  trigger_name,
  event_object_table,
  event_manipulation as event_type,
  action_timing,
  action_statement as trigger_function
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN (
    'customers',
    'vehicles',
    'bookings',
    'payments',
    'customer_id_photos',
    'vehicle_damage_photos'
  )
ORDER BY event_object_table, trigger_name;

-- Get detailed trigger information
SELECT 
  t.relname as table_name,
  tr.tgname as trigger_name,
  CASE WHEN tr.tgtype & 1 = 1 THEN 'ROW' ELSE 'STATEMENT' END as trigger_level,
  CASE WHEN tr.tgtype & 2 = 2 THEN 'BEFORE' ELSE 'AFTER' END as trigger_timing,
  CASE WHEN tr.tgtype & 4 = 4 THEN 'INSERT' ELSE '' END ||
  CASE WHEN tr.tgtype & 8 = 8 THEN 'UPDATE' ELSE '' END ||
  CASE WHEN tr.tgtype & 16 = 16 THEN 'DELETE' ELSE '' END as events,
  p.proname as function_name
FROM pg_trigger tr
JOIN pg_class t ON tr.tgrelid = t.oid
JOIN pg_proc p ON tr.tgfoid = p.oid
WHERE t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND t.relname IN (
    'customers',
    'vehicles',
    'bookings',
    'payments',
    'customer_id_photos',
    'vehicle_damage_photos'
  )
ORDER BY t.relname, tr.tgname;

-- ============================================================================
-- SECTION 5: TRIGGER FUNCTION DEFINITIONS
-- ============================================================================
-- Show the actual code of trigger functions

SELECT 
  p.proname as function_name,
  t.relname as table_name,
  pg_get_functiondef(p.oid) as function_body
FROM pg_proc p
JOIN pg_trigger tr ON p.oid = tr.tgfoid
JOIN pg_class t ON tr.tgrelid = t.oid
WHERE t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND t.relname IN (
    'customers',
    'vehicles',
    'bookings',
    'payments',
    'customer_id_photos',
    'vehicle_damage_photos'
  )
ORDER BY t.relname, p.proname;

-- ============================================================================
-- SECTION 6: FOREIGN KEY CONSTRAINTS
-- ============================================================================
-- Show which tables reference which (delete cascading issues)

SELECT 
  tc.constraint_name,
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name,
  rc.delete_rule as on_delete_action,
  rc.update_rule as on_update_action
FROM information_schema.table_constraints as tc
JOIN information_schema.key_column_usage as kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage as ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints as rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'customers',
    'vehicles',
    'bookings',
    'payments',
    'customer_id_photos',
    'vehicle_damage_photos'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================================================
-- SECTION 7: SOFT DELETE COLUMN VERIFICATION
-- ============================================================================
-- Check if deleted_at columns exist and are properly configured

SELECT 
  table_name,
  column_name,
  data_type,
  CASE WHEN is_nullable = 'YES' THEN 'NULLABLE' ELSE 'NOT NULL' END as nullability,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'customers',
    'vehicles',
    'bookings',
    'payments',
    'customer_id_photos',
    'vehicle_damage_photos'
  )
  AND column_name = 'deleted_at'
ORDER BY table_name;

-- ============================================================================
-- SECTION 8: SAMPLE DATA - SOFT DELETE STATUS
-- ============================================================================
-- Show sample rows with deleted_at values to verify soft delete behavior

-- CUSTOMERS: Sample with deleted_at status
SELECT 
  'CUSTOMERS' as table_name,
  id::text as row_id,
  shop_id::text,
  deleted_at,
  CASE WHEN deleted_at IS NULL THEN 'ACTIVE' ELSE 'SOFT DELETED' END as status
FROM public.customers
LIMIT 5;

-- VEHICLES: Sample with deleted_at status
SELECT 
  'VEHICLES' as table_name,
  id::text as row_id,
  shop_id::text,
  deleted_at,
  CASE WHEN deleted_at IS NULL THEN 'ACTIVE' ELSE 'SOFT DELETED' END as status
FROM public.vehicles
LIMIT 5;

-- BOOKINGS: Sample with deleted_at status
SELECT 
  'BOOKINGS' as table_name,
  id::text as row_id,
  shop_id::text,
  deleted_at,
  CASE WHEN deleted_at IS NULL THEN 'ACTIVE' ELSE 'SOFT DELETED' END as status
FROM public.bookings
LIMIT 5;

-- PAYMENTS: Sample with deleted_at status
SELECT 
  'PAYMENTS' as table_name,
  id::text as row_id,
  shop_id::text,
  deleted_at,
  CASE WHEN deleted_at IS NULL THEN 'ACTIVE' ELSE 'SOFT DELETED' END as status
FROM public.payments
LIMIT 5;

-- Count of deleted vs active rows per table
SELECT 
  'customers' as table_name,
  COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as active_rows,
  COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as soft_deleted_rows,
  COUNT(*) as total_rows
FROM public.customers
UNION ALL
SELECT 
  'vehicles' as table_name,
  COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as active_rows,
  COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as soft_deleted_rows,
  COUNT(*) as total_rows
FROM public.vehicles
UNION ALL
SELECT 
  'bookings' as table_name,
  COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as active_rows,
  COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as soft_deleted_rows,
  COUNT(*) as total_rows
FROM public.bookings
UNION ALL
SELECT 
  'payments' as table_name,
  COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as active_rows,
  COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as soft_deleted_rows,
  COUNT(*) as total_rows
FROM public.payments
UNION ALL
SELECT 
  'customer_id_photos' as table_name,
  COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as active_rows,
  COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as soft_deleted_rows,
  COUNT(*) as total_rows
FROM public.customer_id_photos
UNION ALL
SELECT 
  'vehicle_damage_photos' as table_name,
  COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as active_rows,
  COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as soft_deleted_rows,
  COUNT(*) as total_rows
FROM public.vehicle_damage_photos;

-- ============================================================================
-- SECTION 9: RLS POLICY ENFORCEMENT CHECK
-- ============================================================================
-- Analyze whether policies would block updates to deleted_at or deletes

-- Check CUSTOMERS policy for UPDATE capability
SELECT 
  'customers' as table_name,
  'UPDATE' as operation,
  count(*) as policies_matching,
  string_agg(policyname, ', ') as policy_names,
  bool_or(cmd IN ('w', '*')) as allows_update
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'customers'
  AND cmd IN ('w', '*')
GROUP BY tablename;

-- Check CUSTOMERS policy for DELETE capability
SELECT 
  'customers' as table_name,
  'DELETE' as operation,
  count(*) as policies_matching,
  string_agg(policyname, ', ') as policy_names,
  bool_or(cmd IN ('d', '*')) as allows_delete
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'customers'
  AND cmd IN ('d', '*')
GROUP BY tablename;

-- Check all target tables for DELETE policies
SELECT 
  tablename,
  CASE cmd
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END as operation,
  count(*) as count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'customers',
    'vehicles',
    'bookings',
    'payments',
    'customer_id_photos',
    'vehicle_damage_photos'
  )
  AND cmd IN ('d', '*')
GROUP BY tablename, cmd
ORDER BY tablename;

-- ============================================================================
-- SECTION 10: VISIBILITY CHECK - WHY DELETED ROWS APPEAR
-- ============================================================================
-- Show whether SELECT policies filter on deleted_at

SELECT 
  tablename,
  policyname,
  CASE cmd WHEN 'r' THEN 'SELECT' ELSE 'OTHER' END as operation,
  qual as using_clause,
  CASE WHEN qual LIKE '%deleted_at%' THEN 'YES - filters deleted_at' 
       ELSE 'NO - does NOT filter deleted_at' END as filters_soft_delete
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'customers',
    'vehicles',
    'bookings',
    'payments',
    'customer_id_photos',
    'vehicle_damage_photos'
  )
  AND cmd = 'r'
ORDER BY tablename, policyname;

-- ============================================================================
-- SECTION 11: HELPER FUNCTION VERIFICATION
-- ============================================================================
-- Check if current_shop_id() function exists

SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'current_shop_id'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ============================================================================
-- SECTION 12: CHECK PUBLIC.USERS TABLE (REQUIRED BY HELPER FUNCTION)
-- ============================================================================
-- Verify the users table exists and has required columns

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
ORDER BY ordinal_position;

-- Sample users data (limited, no auth.users data)
SELECT 
  id::text as user_id,
  auth_id::text as auth_user_id,
  shop_id::text,
  name,
  role,
  is_active,
  created_at
FROM public.users
LIMIT 10;

-- ============================================================================
-- SECTION 13: SUMMARY & ROOT CAUSE ANALYSIS BLOCK
-- ============================================================================

-- This diagnostic output should reveal whether:
--
-- SYMPTOM 1: Delete operations fail with 403 Forbidden
-- Possible causes:
--   a) DELETE policies don't exist (no DELETE policies found in section 3)
--   b) DELETE policies have overly restrictive USING clauses
--   c) Triggers prevent DELETE (check section 4 for triggers)
--   d) Current user role lacks DELETE privilege
--
-- SYMPTOM 2: Soft delete (UPDATE deleted_at) doesn't work
-- Possible causes:
--   a) UPDATE policies have restrictive USING/WITH CHECK
--   b) current_shop_id() function returns NULL (section 11)
--   c) public.users table missing or incomplete (section 12)
--   d) Triggers prevent UPDATE (check section 4)
--   e) JWT claims don't contain 'sub' (section 1)
--
-- SYMPTOM 3: Deleted rows still appear in SELECT
-- Possible causes:
--   a) SELECT policies don't filter on deleted_at IS NULL (section 10)
--   b) deleted_at column doesn't exist (section 7)
--   c) Rows were hard deleted, not soft deleted (section 8)
--   d) RLS is disabled (section 2)
--
-- SYMPTOM 4: Cross-shop data visibility / data leaks
-- Possible causes:
--   a) SELECT policies missing or incomplete (section 3)
--   b) Policies don't filter on shop_id (section 3)
--   c) current_shop_id() returns NULL for some users (section 11)
--   d) RLS not enforced (section 2)
--
-- TO DETERMINE ROOT CAUSE:
-- 1. Check section 2: Is RLS enabled? Is it FORCED?
-- 2. Check section 3: How many DELETE policies exist?
-- 3. Check section 4: Are there triggers that prevent DELETE/UPDATE?
-- 4. Check section 10: Do SELECT policies filter deleted_at?
-- 5. Check section 1: What is current_user and auth.uid()?
-- 6. Check section 11: Does current_shop_id() function exist and work?
--
-- NEXT STEP (after reviewing this output):
-- Do NOT create migrations or apply fixes yet.
-- Share this diagnostic output and describe the DELETE failure:
--   - What error message do you see? (403, 500, timeout, etc.)
--   - Which table? (customers, vehicles, bookings, etc.)
--   - Is it DELETE or UPDATE? Or both?
--   - Are rows hard deleted or soft deleted?

-- ============================================================================
-- END OF DIAGNOSTIC FILE
-- ============================================================================
