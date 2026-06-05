-- Test 1: Verify schema exists
SELECT 'TEST 1: Schema verification' as test;
SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';

-- Test 2: Test counter tables exist
SELECT 'TEST 2: Counter tables' as test;
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_number_counters') as booking_counters_exists;
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_sequences') as customer_sequences_exists;

-- Test 3: Verify RLS policies exist
SELECT 'TEST 3: RLS Policies' as test;
SELECT COUNT(*) as policy_count FROM pg_policies WHERE schemaname = 'public' AND policyname LIKE 'shop_access%';

-- Test 4: Test column sync function exists
SELECT 'TEST 4: Functions' as test;
SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'sync_vehicle_columns') as sync_vehicle_exists;
SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_booking_number') as generate_booking_exists;
SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_customer_number') as generate_customer_exists;

-- Test 5: Verify vehicles table has all required columns for sync
SELECT 'TEST 5: Vehicle columns for sync' as test;
SELECT 
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='type') as type_col,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='vehicle_type') as vehicle_type_col,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='daily_rate') as daily_rate_col,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='price_per_day') as price_per_day_col;

-- Test 6: Verify bookings table has payment_date
SELECT 'TEST 6: Bookings table' as test;
SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='payment_date') as payment_date_col;

-- Test 7: Verify customers soft delete support
SELECT 'TEST 7: Soft delete support' as test;
SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='deleted_at') as customers_deleted_at,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='deleted_at') as bookings_deleted_at,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='deleted_at') as vehicles_deleted_at;
