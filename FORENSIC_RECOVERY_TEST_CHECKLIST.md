# FORENSIC DATABASE RECOVERY - TEST CHECKLIST
## Date: January 16, 2026
## Migration: 20260116190000_forensic_full_schema_reconstruction.sql

---

## 🔴 CRITICAL PRE-DEPLOYMENT VERIFICATION

Before deploying this migration, verify current state:

```sql
-- Check if payments table exists
SELECT EXISTS (
  SELECT 1 FROM pg_tables 
  WHERE schemaname='public' AND tablename='payments'
);
-- Expected: false (table is missing)

-- Check which critical columns are missing
SELECT 
  table_name,
  column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('vehicles', 'customers', 'bookings')
  AND column_name IN ('category', 'cc', 'segment', 'gear_type', 'notes')
ORDER BY table_name, column_name;
-- Expected: Some columns missing
```

---

## 📋 DEPLOYMENT STEPS

### Step 1: Deploy Migration to Local
```bash
cd "c:\App Project\Rento App Project\Development\Rento-App-03"
supabase db reset --local
```

**Expected Output:**
```
✓ payments table exists
✓ vehicles.category exists
✓ vehicles.cc exists
✓ vehicles.segment exists
✓ vehicles.gear_type exists
✓ customers.notes exists
✓ bookings.notes exists
========================================
✓✓✓ FORENSIC RECONSTRUCTION COMPLETE ✓✓✓
========================================
```

**If you see any ✗ errors:** Migration failed, do NOT proceed to cloud

---

### Step 2: Test Locally BEFORE Cloud Deployment

#### Test 1: Add Vehicle with category, cc, segment, gear_type
```sql
-- Run this in local Supabase SQL editor or via psql
INSERT INTO vehicles (
  shop_id, 
  registration_number, 
  category, 
  cc, 
  segment, 
  gear_type, 
  daily_rate, 
  status
) VALUES (
  (SELECT id FROM rental_shops LIMIT 1),
  'TEST-VEHICLE-123',
  'Commuter',
  '150',
  'Executive',
  'Manual',
  500,
  'Available'
);
```

**Expected:** ✅ Row inserted successfully  
**If error:** ❌ Column missing or constraint failed

---

#### Test 2: Update Customer with notes
```sql
-- Update any existing customer
UPDATE customers 
SET notes = 'Test customer note - forensic recovery verification' 
WHERE id = (SELECT id FROM customers LIMIT 1);
```

**Expected:** ✅ 1 row updated  
**If error:** ❌ Column does not exist

---

#### Test 3: Create Booking with notes
```sql
-- Insert test booking
INSERT INTO bookings (
  shop_id,
  booking_number,
  customer_id,
  vehicle_ids,
  start_date,
  end_date,
  rent,
  deposit,
  total_amount,
  status,
  payment_status,
  notes
) VALUES (
  (SELECT id FROM rental_shops LIMIT 1),
  'BK-TEST-001',
  (SELECT id FROM customers LIMIT 1),
  ARRAY[(SELECT id FROM vehicles LIMIT 1)]::UUID[],
  now(),
  now() + interval '1 day',
  500,
  1000,
  1500,
  'Booked',
  'Unpaid',
  'Test booking note - forensic recovery'
);
```

**Expected:** ✅ Row inserted successfully  
**If error:** ❌ Column missing or array type mismatch

---

#### Test 4: Record Payment (CRITICAL - payments table was missing)
```sql
-- Insert payment record
INSERT INTO payments (
  shop_id,
  booking_id,
  amount,
  payment_mode,
  notes
) VALUES (
  (SELECT id FROM rental_shops LIMIT 1),
  (SELECT id FROM bookings LIMIT 1),
  500,
  'Cash',
  'Test advance payment - forensic recovery'
);
```

**Expected:** ✅ Row inserted successfully  
**If error:** ❌ Table does not exist (CRITICAL FAILURE)

---

#### Test 5: Soft Delete (UPDATE deleted_at)
```sql
-- Soft delete a vehicle
UPDATE vehicles 
SET deleted_at = now() 
WHERE registration_number = 'TEST-VEHICLE-123';
```

**Expected:** ✅ 1 row updated  
**If error:** ❌ RLS policy blocking UPDATE or column missing

---

#### Test 6: Verify Supabase REST API
```bash
# Test payments endpoint (should return 200, not 404)
curl -X GET "http://127.0.0.1:54321/rest/v1/payments?select=id&limit=1" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected:** `[{"id":"..."}]` or `[]`  
**If error:** `{"code":"42P01","message":"relation \"public.payments\" does not exist"}`

---

### Step 3: Deploy to Cloud (ONLY if all local tests pass)

```bash
supabase db push
```

**Expected Output:** Same verification output as local

**If deployment fails:** Rollback immediately, do NOT continue

---

## ✅ POST-DEPLOYMENT VERIFICATION

### Frontend Tests (Run in Browser)

#### Test 1: Add Vehicle via Bikes.tsx
1. Open app in browser
2. Navigate to Bikes page
3. Click "Add Vehicle"
4. Fill form with:
   - Registration Number: TEST-001
   - Category: Commuter
   - CC: 150
   - Segment: Executive
   - Gear Type: Manual
   - Price: 500
5. Click Save

**Expected:** ✅ Vehicle added successfully, no "column not found" error  
**If error:** ❌ "Could not find the 'category' column of 'vehicles'"

---

#### Test 2: Add Customer with notes via Customers.tsx
1. Navigate to Customers page
2. Add new customer
3. Fill all fields including notes
4. Click Save

**Expected:** ✅ Customer added successfully  
**If error:** ❌ "Could not find the 'notes' column of 'customers'"

---

#### Test 3: Create Booking with notes via Bookings.tsx
1. Navigate to Bookings page
2. Click "Add Booking"
3. Select customer, vehicle, dates
4. Add notes in notes field
5. Click Save

**Expected:** ✅ Booking created successfully  
**If error:** ❌ "Could not find the 'notes' column of 'bookings'"

---

#### Test 4: Record Payment via Bookings.tsx
1. Find a booking with unpaid status
2. Click "Update Payment Status"
3. Select "Advance Paid"
4. Enter amount: 500
5. Select method: Cash
6. Click Save

**Expected:** ✅ Payment recorded, booking status updated to "Confirmed"  
**If error:** ❌ "relation \"public.payments\" does not exist" or 404 from Supabase

---

#### Test 5: Soft Delete Vehicle
1. Navigate to Bikes page
2. Select a test vehicle
3. Click Delete
4. Confirm deletion

**Expected:** ✅ Vehicle marked as deleted (deleted_at set), disappears from list  
**If error:** ❌ "0 rows affected" or "permission denied"

---

#### Test 6: Soft Delete Customer
1. Navigate to Customers page
2. Select a test customer
3. Click Delete
4. Confirm deletion

**Expected:** ✅ Customer marked as deleted  
**If error:** ❌ "0 rows affected"

---

#### Test 7: Soft Delete Booking
1. Navigate to Bookings page
2. Select a test booking (status: Booked or Confirmed)
3. Click Delete
4. Confirm deletion

**Expected:** ✅ Booking marked as deleted  
**If error:** ❌ "0 rows affected"

---

## 🔍 DIAGNOSTIC QUERIES

If any test fails, run these queries to diagnose:

### Check payments table structure
```sql
\d payments
-- Should show: id, shop_id, booking_id, amount, payment_mode, utr_number, paid_by, paid_at, notes, created_at, updated_at
```

### Check vehicles columns
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
  AND column_name IN ('category', 'cc', 'segment', 'gear_type')
ORDER BY column_name;
-- Should return all 4 columns
```

### Check RLS policies
```sql
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('vehicles', 'customers', 'bookings', 'payments')
ORDER BY tablename, cmd;
-- Should show INSERT, SELECT, UPDATE policies (NO DELETE policies)
```

### Check soft delete functionality
```sql
-- Count rows with deleted_at set
SELECT 
  'vehicles' as table_name, 
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as soft_deleted
FROM vehicles
UNION ALL
SELECT 'customers', COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) FROM customers
UNION ALL
SELECT 'bookings', COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) FROM bookings;
```

---

## ✅ SUCCESS CRITERIA

**ALL of the following must be true:**

- [x] Migration deploys without errors to local
- [x] Migration verification output shows all ✓ checks passing
- [x] All 5 SQL tests pass locally
- [x] Supabase REST API returns 200 for `/rest/v1/payments`
- [x] Migration deploys without errors to cloud
- [x] All 7 frontend tests pass in production
- [x] No "column not found" errors anywhere
- [x] No "relation does not exist" errors
- [x] Soft delete works (UPDATE deleted_at succeeds)
- [x] Payment recording works (payments INSERT succeeds)

**If ANY test fails:** Database reconstruction incomplete, investigate logs

---

## 🔴 ROLLBACK PROCEDURE

If deployment fails or critical errors occur:

### Local Rollback
```bash
# Restore to previous migration state
supabase db reset --local
```

### Cloud Rollback
```bash
# DANGER: This drops all data
supabase db reset --db-url "postgresql://..."
```

**WARNING:** Cloud rollback should ONLY be done if absolutely necessary. Coordinate with team first.

---

## 📊 FINAL REPORT

After completing all tests, generate final report:

```bash
# Check migration history
supabase migration list

# Verify schema
docker exec supabase_db_Rento-App-03 psql -U postgres -d postgres -c "\dt public.*"

# Count critical objects
docker exec supabase_db_Rento-App-03 psql -U postgres -d postgres -c "
SELECT 
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname='public') as tables,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public') as columns,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public') as policies
"
```

**Expected:**
- tables: 13+ (including payments)
- columns: 150+ (all critical columns present)
- policies: 30+ (INSERT, SELECT, UPDATE policies)

---

## ✅ COMPLETION SIGN-OFF

**Date Completed:** __________________  
**Tested By:** __________________  
**Result:** ☐ ALL TESTS PASSED ☐ FAILURES (specify below)

**Failures (if any):**
```
[List any test failures here]
```

**Notes:**
```
[Add any observations or issues encountered]
```

---

## 📖 APPENDIX: What Was Fixed

### Root Cause Analysis
- **Problem:** Migrations on Jan 14-15 dropped/broke critical schema elements
- **Impact:** App insert/update operations failed with "column not found" errors
- **Root Cause:** Experimental migrations (now disabled) altered schema incorrectly

### Schema Elements Restored
1. **payments table** - Completely recreated (was missing entirely)
2. **vehicles.category** - Added (app vehicle form required this)
3. **vehicles.cc** - Added (app vehicle specs required this)
4. **vehicles.segment** - Added (app vehicle categorization)
5. **vehicles.gear_type** - Added (app vehicle transmission)
6. **customers.notes** - Added (app customer management)
7. **bookings.notes** - Added (app booking creation)
8. **Soft delete columns** - Ensured deleted_at exists on all tables
9. **RLS policies** - Removed DELETE policies, ensured UPDATE policies work

### Technical Details
- **Approach:** ONE comprehensive migration to restore full Jan 13, 2026 state
- **Safety:** All operations idempotent (ADD IF NOT EXISTS, DROP IF EXISTS)
- **Verification:** Built-in PL/pgSQL verification block checks all critical elements
- **Compatibility:** Column sync triggers handle naming aliases (daily_rate ↔ price_per_day)

---

**END OF CHECKLIST**
