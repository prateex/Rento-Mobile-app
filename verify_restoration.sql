-- Verification: Check RLS policies and soft delete triggers

-- Check RLS policies on critical tables
SELECT 
  tablename,
  policyname,
  cmd,
  CASE WHEN cmd = 'DELETE' THEN '✓ DELETE allowed' ELSE cmd END as operation
FROM pg_policies
WHERE tablename IN ('customers', 'vehicles', 'bookings', 'customer_id_photos')
ORDER BY tablename, cmd;

-- Check soft delete triggers
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  CASE WHEN tgname LIKE 'trigger_soft_delete%' THEN '✓ Soft delete' ELSE 'Other' END as trigger_type
FROM pg_trigger
WHERE tgname LIKE 'trigger_soft_delete%'
ORDER BY tgrelid::regclass;

-- Check customer_id_photos table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'customer_id_photos'
ORDER BY ordinal_position;
