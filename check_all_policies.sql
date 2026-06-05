-- Check all policies including the new select_for_update ones
SELECT 
  tablename, 
  policyname, 
  cmd as command
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('vehicles', 'customers', 'bookings', 'payments')
ORDER BY tablename, cmd, policyname;
