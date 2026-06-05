-- Verify select_for_update policies match requirements
SELECT 
  tablename, 
  policyname,
  pg_get_expr(qual, (schemaname || '.' || tablename)::regclass) AS using_expression
FROM pg_policies 
WHERE schemaname = 'public'
  AND policyname LIKE '%_select_for_update'
  AND tablename IN ('vehicles', 'customers', 'bookings', 'payments')
ORDER BY tablename;
