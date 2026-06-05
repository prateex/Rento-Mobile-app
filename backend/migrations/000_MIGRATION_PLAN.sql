-- ============================================
-- MIGRATION PLAN DOCUMENTATION
-- Rento Marketplace Pivot - Phase 1
-- ============================================

/*
ANALYSIS OF CURRENT SCHEMA:

Existing Tables (Owner App Only):
- rental_shops (shop/owner info)
- users (shop staff/admin)
- vehicles (shop inventory)
- customers (local customers)
- bookings (shop bookings - offline/counter model)
- payments (manual recording)
- deposits (security deposits)
- damages (incident tracking)

PROBLEM:
- Designed for SINGLE-SHOP offline rental model
- Customers tied to shop_id (local customers only)
- No multi-vendor support
- No online marketplace capability
- No role-based access control (only admin/staff/owner)
- bookings.vehicle_ids is JSONB (array) - no relational integrity

TARGET ARCHITECTURE:
- Multi-vendor marketplace
- Online customer registration (role='customer')
- Online bookings from website
- Real-time owner notifications
- Prevent double-booking at DB level

MIGRATION STRATEGY:

Phase 1A: Add Foundation Tables (non-breaking)
- Create platform_users table (customers + marketplace users)
- Create marketplace_locations table
- Create vehicle_images table (extract images from vehicles table)
- Create booking_availability_blocks table (lock vehicle slots)
- Create marketplace_payments table (payment gateway integration)

Phase 1B: Extend Existing Tables (backward compatible)
- Add is_online_booking BOOLEAN to bookings
- Add vehicle_id (single FK) to bookings (new model)
- Add owner_id denormalization to bookings (for RLS)
- Add pricing fields to vehicles (extra_km_rate, free_km, etc)

Phase 1C: Add RLS & Security (enforce access control)
- Create users_with_roles view (combines platform_users + existing users)
- Implement RLS policies on all marketplace tables
- Secure existing tables with RLS

BACKWARD COMPATIBILITY:

Existing owner app continues working because:
✓ rental_shops table UNCHANGED
✓ users table UNCHANGED (still has shop staff/admin)
✓ vehicles table extended (new columns are optional)
✓ customers table UNCHANGED (old behavior)
✓ bookings table extended (old columns still work)
✓ payments table UNCHANGED
✓ deposits table UNCHANGED
✓ damages table UNCHANGED

New online bookings use:
✓ bookings.is_online_booking = true (new field)
✓ bookings.vehicle_id (single vehicle, new field)
✓ bookings.customer_id → platform_users (not old customers table)
✓ booking_availability_blocks (new table, prevents double-booking)

KEY DESIGN DECISIONS:

1. platform_users table instead of modifying users
   WHY: Existing users table is shop-specific (shop_id FK)
   New users are marketplace-wide (no shop_id)
   Keep both tables separate to avoid breaking changes

2. vehicle_id (FK) in bookings instead of vehicle_ids (JSONB)
   WHY: Current model uses JSONB array (no integrity)
   New model: one booking = one vehicle (simpler, safer)
   Existing bookings can have vehicle_ids until migrated

3. booking_availability_blocks table instead of status update
   WHY: Prevents race conditions
   Creates hard block on vehicle for date range
   Allows concurrent booking creation with transaction

4. marketplace_payments table separate from payments
   WHY: Old payments table is manual/counter recording
   New payments table tracks payment gateway integration
   Both coexist during transition

5. Added owner_id to bookings (denormalization)
   WHY: RLS enforcement - easier to filter by owner_id
   Maintains referential integrity
   One booking = one owner (multi-vehicle bookings rare in bike rental)

MIGRATION FILES:

001_marketplace_foundation.sql
  - platform_users (role='customer')
  - marketplace_locations
  - vehicle_images

002_extend_bookings_for_marketplace.sql
  - Add is_online_booking, vehicle_id, owner_id to bookings
  - Add indexes for availability search

003_extend_vehicles_for_marketplace.sql
  - Add pricing fields (extra_km_rate, free_km_per_day, etc)
  - Add transmission_type, fuel_type, features (JSONB)
  - Add location_id

004_booking_availability_blocks.sql
  - Create availability_blocks table
  - Add constraint to prevent overlapping blocks
  - Add trigger to create block on confirmed booking

005_marketplace_payments.sql
  - Create marketplace_payments table
  - Support payment gateway integration (Razorpay, Stripe)
  - Add webhook event tracking

006_rls_policies.sql
  - Enable RLS on all marketplace tables
  - Implement role-based access
  - Public read for vehicles, private for bookings
  - Admin full access

ROLLBACK STRATEGY:

Each migration can be rolled back independently:
- 001: DROP TABLE platform_users, marketplace_locations, vehicle_images
- 002: ALTER TABLE bookings DROP COLUMN is_online_booking, vehicle_id, owner_id
- 003: ALTER TABLE vehicles DROP COLUMN extra_km_rate, free_km_per_day, etc
- 004: DROP TABLE booking_availability_blocks
- 005: DROP TABLE marketplace_payments
- 006: ALTER TABLE [...] DISABLE ROW LEVEL SECURITY

DATA INTEGRITY:

✓ Foreign key constraints on all relationships
✓ CHECK constraints on all enums
✓ NOT NULL constraints where required
✓ UNIQUE constraints on business keys (booking_number, etc)
✓ Composite indexes for common query patterns
✓ Triggers to maintain consistency (timestamps, blocks)

PERFORMANCE CONSIDERATIONS:

✓ Indexes on all foreign keys
✓ Indexes on status/state columns
✓ Composite indexes for date range queries
✓ Partial indexes for active records only
✓ ANALYZE after each migration

TESTING STRATEGY:

✓ Test existing owner app flows (backward compatibility)
✓ Test new online booking creation
✓ Test double-booking prevention
✓ Test RLS policies with different roles
✓ Test payment gateway simulation
✓ Load test availability search
*/

-- Summary of migrations order:
-- 1. 001_marketplace_foundation.sql - Add core marketplace tables
-- 2. 002_extend_bookings_for_marketplace.sql - Extend booking model
-- 3. 003_extend_vehicles_for_marketplace.sql - Extend vehicle model
-- 4. 004_booking_availability_blocks.sql - Prevent double booking
-- 5. 005_marketplace_payments.sql - Payment gateway ready
-- 6. 006_rls_policies.sql - Security layer
