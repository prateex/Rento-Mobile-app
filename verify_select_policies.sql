-- Verify select_for_update policies match requirements
SELECT 
  tablename, 
  policyname,
  cmd,
  CASE 
    WHEN policyname LIKE '%_select_for_update' THEN 'Should use: shop_id = current_shop_id() (NO deleted_at)'
    WHEN policyname LIKE '%_select' THEN 'Should filter: deleted_at IS NULL AND shop_id = current_shop_id()'
    ELSE 'Other'
  END as expected_behavior
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('vehicles', 'customers', 'bookings', 'payments')
  AND cmd = 'SELECT'
ORDER BY tablename, policyname;
