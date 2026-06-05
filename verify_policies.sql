-- Verify the RLS policies are correctly configured
SELECT 
  tablename, 
  policyname, 
  cmd as command,
  CASE 
    WHEN policyname LIKE '%_select_for_update' THEN 'FOR UPDATE RETURNING'
    WHEN policyname LIKE '%_select' THEN 'FOR ACTIVE ROWS'
    ELSE 'OTHER'
  END as purpose
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('vehicles', 'customers', 'bookings', 'payments')
ORDER BY tablename, policyname;
