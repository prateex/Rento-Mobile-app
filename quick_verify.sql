-- Quick RLS Verification
SELECT 'POLICY COUNTS' as check_type, tablename, COUNT(*) as count
FROM pg_policies 
WHERE schemaname = 'public' AND tablename IN ('customers', 'vehicles', 'bookings', 'customer_id_photos')
GROUP BY tablename
UNION ALL
SELECT 'HELPER FUNCTION' as check_type, 'get_my_shop_id' as tablename, COUNT(*)::int as count
FROM pg_proc WHERE proname = 'get_my_shop_id'
ORDER BY check_type, tablename;
