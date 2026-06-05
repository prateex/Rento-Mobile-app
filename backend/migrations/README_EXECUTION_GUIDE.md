-- ============================================
-- MIGRATION EXECUTION GUIDE
-- Step-by-step instructions for applying Phase 1
-- ============================================

/*
BEFORE YOU START:

1. BACKUP your Supabase database
   - Go to Supabase Dashboard
   - Project Settings → Backups
   - Create manual backup

2. TEST environment first
   - Apply migrations to dev database
   - Test owner app functionality
   - Verify RLS policies
   - Only then apply to production

3. PREPARE:
   - Have existing database connection ready
   - Keep SQL editor open
   - Have rollback scripts available
   - Schedule during low-traffic window

MIGRATION SEQUENCE (MUST BE IN ORDER):

1. 001_marketplace_foundation.sql
   - Add platform_users table
   - Add marketplace_locations table
   - Add vehicle_images table
   - SAFE: New tables only

2. 002_extend_bookings_for_marketplace.sql
   - Extend bookings table
   - Add online booking fields
   - SAFE: Adds optional columns, backfills existing data

3. 003_extend_vehicles_for_marketplace.sql
   - Extend vehicles table
   - Add marketplace pricing & features
   - SAFE: Adds optional columns with defaults

4. 004_booking_availability_blocks.sql
   - Create availability_blocks table
   - Add constraint checking
   - Add helper functions
   - SAFE: New table, doesn't affect existing queries

5. 005_marketplace_payments.sql
   - Create marketplace_payments table
   - Create payment events & reconciliation tables
   - Add payment functions
   - SAFE: New tables, separate from existing payments

6. 006_rls_policies.sql
   - Enable RLS on tables
   - Create access control policies
   - Create helper functions
   - ⚠️ BREAKING: May restrict existing owner app
   - ⚠️ TEST FIRST with real owner app users
   - Can be rolled back if needed

EXECUTION STEPS:

Step 1: Backup
--------
Go to Supabase Dashboard:
- Settings → Backups → Create Manual Backup
Wait for backup to complete.

Step 2: Test Environment
--------
If you have a separate dev/staging database:
- Copy all migration files to dev database first
- Test owner app with dev database
- Verify no functionality breaks
- Then apply to production

Step 3: Apply Migrations (Production)
--------
In Supabase SQL Editor:

-- Run 001_marketplace_foundation.sql
-- ✓ Check for errors
-- ✓ Verify tables created:
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('platform_users', 'marketplace_locations', 'vehicle_images');

-- Run 002_extend_bookings_for_marketplace.sql
-- ✓ Check for errors
-- ✓ Verify columns added:
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'bookings' 
AND column_name IN ('is_online_booking', 'vehicle_id', 'owner_id');

-- Run 003_extend_vehicles_for_marketplace.sql
-- ✓ Check for errors
-- ✓ Verify columns added:
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'vehicles' 
AND column_name IN ('location_id', 'free_km_per_day', 'extra_km_rate');

-- Run 004_booking_availability_blocks.sql
-- ✓ Check for errors
-- ✓ Verify tables/functions created:
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'booking_availability_blocks';

-- Run 005_marketplace_payments.sql
-- ✓ Check for errors
-- ✓ Verify tables created:
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('marketplace_payments', 'marketplace_payment_events');

Step 4: Test Before RLS
--------
Test existing owner app BEFORE applying RLS policies:

-- Test owner can still query vehicles
SELECT v.* FROM vehicles v
WHERE v.owner_id = (
  SELECT id FROM rental_shops WHERE owner_id = '8f7f1234-...'
);

-- Test staff can query bookings
SELECT b.* FROM bookings b
WHERE b.shop_id = '1234-5678-...';

-- Test customer queries still work
SELECT c.* FROM customers c
WHERE c.id = '9999-8888-...';

If any queries return 0 rows, DO NOT apply RLS yet.
Something is wrong with the backfill logic.

Step 5: Apply RLS (WITH CAUTION)
--------
Run 006_rls_policies.sql

⚠️ AFTER applying RLS:

Immediately test with real owner app:
1. Owner login
2. View vehicle list (should see own vehicles)
3. View bookings (should see own bookings)
4. Create booking (should work)
5. Customer searches vehicles (should see public)
6. Customer creates online booking (should work)

If ANY error occurs:
1. Check Supabase logs for RLS violations
2. Run queries with EXPLAIN ANALYZE
3. Consider rolling back RLS (disable and reapply)

Step 6: Monitor
--------
After successful deployment:
- Monitor Supabase logs for errors
- Check API response times
- Verify no customer complaints
- Monitor query performance
- Run ANALYZE on tables

ROLLBACK PLAN (If Something Goes Wrong):

Rollback 006 (RLS) - SAFE:
--------
If RLS causes issues, quickly disable it:

-- Disable RLS on all tables
ALTER TABLE platform_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_images DISABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;

-- Drop all RLS policies
DROP POLICY IF EXISTS "Users can view own profile" ON platform_users;
DROP POLICY IF EXISTS "Users can update own profile" ON platform_users;
DROP POLICY IF EXISTS "Only system can create users" ON platform_users;
-- ... drop all other policies

This doesn't delete any data, just turns off access control.
Owner app should work normally again.

Rollback Full Migration (Emergency):

If database is corrupted, restore from backup:
1. Supabase Dashboard
2. Settings → Backups
3. Click "Restore" on latest backup
4. Confirm (this takes ~30 minutes)
5. Database rolls back to backup time

Rollback Individual Migrations (Advanced):

-- Rollback 005 (Payments)
DROP TABLE marketplace_payment_reconciliation;
DROP TABLE marketplace_payment_events;
DROP TABLE marketplace_payments;
DROP FUNCTION refund_payment;
DROP FUNCTION mark_payment_failed;
DROP FUNCTION mark_payment_completed;

-- Rollback 004 (Availability Blocks)
DROP TABLE booking_availability_blocks;
DROP FUNCTION get_available_vehicles;
DROP FUNCTION check_vehicle_available;
DROP FUNCTION create_availability_block_on_booking;
DROP FUNCTION check_vehicle_availability_overlap;

-- Rollback 003 (Extended Vehicles)
ALTER TABLE vehicles DROP CONSTRAINT chk_vehicles_seating_capacity;
ALTER TABLE vehicles DROP CONSTRAINT chk_vehicles_rating_range;
ALTER TABLE vehicles DROP CONSTRAINT chk_vehicles_security_deposit_positive;
ALTER TABLE vehicles DROP CONSTRAINT chk_vehicles_extra_km_rate_positive;
ALTER TABLE vehicles DROP CONSTRAINT chk_vehicles_free_km_positive;
ALTER TABLE vehicles DROP COLUMN location_id;
ALTER TABLE vehicles DROP COLUMN free_km_per_day;
ALTER TABLE vehicles DROP COLUMN extra_km_rate;
-- ... drop all other added columns

-- Rollback 002 (Extended Bookings)
ALTER TABLE bookings DROP COLUMN is_online_booking;
ALTER TABLE bookings DROP COLUMN vehicle_id;
ALTER TABLE bookings DROP COLUMN owner_id;
-- ... drop all other added columns

-- Rollback 001 (Foundation)
DROP TABLE vehicle_images;
DROP TABLE marketplace_locations;
DROP TABLE platform_users;

VERIFICATION QUERIES:

After each migration, verify:

-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('vehicles', 'bookings', 'vehicle_images');

-- Check functions
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
ORDER BY routine_name;

-- Check RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('platform_users', 'vehicles', 'bookings');

-- Check constraints
SELECT constraint_name, table_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_schema = 'public' 
ORDER BY table_name;

PERFORMANCE TESTING:

After migrations, test query performance:

-- Availability search (should be <100ms)
EXPLAIN ANALYZE
SELECT * FROM get_available_vehicles(
  'location_uuid',
  NOW(),
  NOW() + INTERVAL '3 days',
  'bike'
);

-- Vehicle listing (should be <500ms)
EXPLAIN ANALYZE
SELECT * FROM vehicles 
WHERE location_id = 'location_uuid'
  AND is_listed_marketplace = true
ORDER BY daily_rate ASC
LIMIT 20;

-- Owner's bookings (should be <50ms)
EXPLAIN ANALYZE
SELECT * FROM bookings
WHERE owner_id = 'owner_uuid'
ORDER BY created_at DESC;

If any query takes >1000ms:
1. Check indexes are created
2. Run ANALYZE on tables
3. Consider additional indexes
4. Check for full table scans (seq scan in EXPLAIN)

CHECKLIST:

Pre-Migration:
☐ Database backup created
☐ Test environment ready
☐ Rollback plan documented
☐ Owner app tested in staging
☐ All migration files available
☐ Supabase SQL editor open

During Migration:
☐ Applied 001_marketplace_foundation.sql
☐ Verified tables created
☐ Applied 002_extend_bookings_for_marketplace.sql
☐ Verified columns added
☐ Applied 003_extend_vehicles_for_marketplace.sql
☐ Verified columns added
☐ Applied 004_booking_availability_blocks.sql
☐ Verified tables and functions
☐ Applied 005_marketplace_payments.sql
☐ Verified tables created
☐ Tested owner app works before RLS
☐ Applied 006_rls_policies.sql
☐ Tested owner app with RLS

Post-Migration:
☐ All migrations applied successfully
☐ No error in Supabase logs
☐ Owner app functioning normally
☐ Customer website can search vehicles
☐ Online bookings can be created
☐ Availability blocks prevent double-booking
☐ RLS policies enforced correctly
☐ Performance within acceptable range
☐ Backup tested (restore in dev)
☐ Monitoring alerts configured

CONTACT & SUPPORT:

If errors occur during migration:
1. Check Supabase status: https://status.supabase.com
2. Review error messages carefully
3. Check for migration dependencies (apply in order)
4. Try rollback and apply again
5. Contact Supabase support if database corrupt
6. Restore from backup as last resort

Common Errors:

ERROR: relation "platform_users" does not exist
→ Didn't run 001_marketplace_foundation.sql first

ERROR: column "vehicle_id" does not exist on relation "bookings"
→ Didn't run 002_extend_bookings_for_marketplace.sql

ERROR: duplicate key value violates unique constraint
→ Data conflict. Check backfill logic in migration

ERROR: permission denied for schema public
→ Need admin/service role permissions

ERROR: tsrange not available
→ Use trigger alternative (included in 004_booking_availability_blocks.sql)

NEXT STEPS:

After Phase 1 (Database):

1. Phase 2: Customer Website
   - Create React app structure
   - Build search & listing pages
   - Implement booking flow
   - Add payment integration

2. Phase 3: Owner App Updates
   - Real-time booking notifications
   - Accept/reject bookings
   - Online booking management
   - Earnings dashboard

3. Phase 4: Admin Panel
   - User management
   - Vehicle approvals
   - Analytics dashboard
   - Dispute handling

*/

-- ============================================
-- EXECUTE MIGRATIONS IN THIS ORDER:
-- ============================================

-- 1. Run this first (foundation tables)
-- \i 001_marketplace_foundation.sql

-- 2. Run after 001 (extend bookings)
-- \i 002_extend_bookings_for_marketplace.sql

-- 3. Run after 002 (extend vehicles)
-- \i 003_extend_vehicles_for_marketplace.sql

-- 4. Run after 003 (availability blocks)
-- \i 004_booking_availability_blocks.sql

-- 5. Run after 004 (payments)
-- \i 005_marketplace_payments.sql

-- 6. Run LAST after testing (RLS policies)
-- \i 006_rls_policies.sql

-- ============================================
-- END OF MIGRATION GUIDE
-- ============================================
