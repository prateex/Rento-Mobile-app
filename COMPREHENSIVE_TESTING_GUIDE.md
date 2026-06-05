# COMPREHENSIVE TESTING GUIDE - PRODUCTION VERIFICATION

## QUICK SMOKE TEST (5 minutes)

### 1. Start Application
```bash
cd backend
npm run dev
```
Verify:
- ✅ Server starts without errors
- ✅ "Route registration complete" appears in logs
- ✅ "Environment variables validated" appears
- ✅ No console errors

### 2. Login
- Navigate to `http://127.0.0.1:3000`
- Login with: `usera@test.com` / `Password@123`
- Verify:
  - ✅ Dashboard loads without errors
  - ✅ Browser console (F12) shows zero errors
  - ✅ User name displayed in top left

### 3. Navigate All Pages
- Click Dashboard, Bookings, Bikes, Customers, Settings
- Verify:
  - ✅ Each page loads
  - ✅ No "Cannot read property" errors
  - ✅ No "undefined.includes" errors
  - ✅ Data displays correctly

### 4. Create Simple Booking
- Bookings → New Booking
- Select a bike, customer, dates
- Create booking
- Verify:
  - ✅ Booking created
  - ✅ Appears in list
  - ✅ Status is "Booked"

---

## DETAILED FUNCTIONAL TESTS

### A. DATA GUARD TESTS (Undefined/Null Handling)

#### Test A1: Empty Database
**Setup**: Clear all bookings/vehicles/customers
**Test**:
```typescript
// Dashboard should load without crashing
navigate to /
// Verify: No console errors, displays "No bookings"
```

#### Test A2: Missing Vehicle in Booking
**Setup**: Create booking, manually delete vehicle from DB
**Test**:
```typescript
// View booking details
// Expected: Shows "Vehicle not found" gracefully, not crash
```

#### Test A3: Invalid Date Parsing
**Setup**: Create booking with invalid start_date in DB
**Test**:
```typescript
// Open Bookings page
// Expected: Shows "Invalid Date" or current date, not NaN
// No console errors
```

#### Test A4: Undefined bikeIds
**Setup**: Create booking, manually set bike_ids to NULL in DB
**Test**:
```typescript
// View booking
// Click "Mark as Taken"
// Expected: Shows error or skips vehicle update, doesn't crash
// Not: "undefined.includes is not a function"
```

#### Test A5: Missing Customer
**Setup**: Create booking, delete customer from DB
**Test**:
```typescript
// View booking detail
// Expected: Shows "Customer not found", not blank
// Click Edit booking
// Expected: Can still edit without customer dropdown error
```

---

### B. RLS (Row Level Security) TESTS - CRITICAL

#### Test B1: Single User Access
**Setup**: Login as ownerA@test.com
**Test**:
```typescript
// Create booking
// Navigate to Bookings
// Expected: Only see your own bookings
// Check: Bookings for ownerB should not appear
```

#### Test B2: Multi-User Same Shop
**Setup**: 
- ownerA creates shop "Shop A"
- ownerA creates staff member staffA in "Shop A"
- staffA logs in

**Test**:
```typescript
// staffA opens Bookings
// Expected: Sees ownerA's bookings (NOW WITH FIX)
// Before fix: Would see zero bookings (wrong)
// After fix: Sees all "Shop A" bookings
```

#### Test B3: Staff Cannot See Other Shop
**Setup**:
- ownerA in "Shop A"
- ownerB in "Shop B"
- staffA in "Shop A"
- staffB in "Shop B"

**Test**:
```typescript
// staffA logs in
// Verify: Can see Shop A bookings
// Verify: Cannot see Shop B bookings (RLS blocks)
// Check browser console: No "RLS violation" errors
```

#### Test B4: RLS Enforced on Insert
**Setup**: ownerA logged in
**Test**:
```typescript
// Create new customer
// Check DB: customer.shop_id = ownerA's shop_id (set by trigger)
// Check: Cannot manually set shop_id in request
// Expected: Trigger sets it automatically from auth context
```

---

### C. SOFT-DELETE TESTS

#### Test C1: Deleted Bookings Not Visible
**Setup**: Create 2 bookings, delete one
**Test**:
```typescript
// Open Bookings page
// Expected: Only 1 booking visible
// Check DB: deleted booking has deleted_at = NOW()
// Not: deleted booking disappeared without deleted_at
```

#### Test C2: Deleted Vehicles Not Selectable
**Setup**: Create 2 vehicles, delete one
**Test**:
```typescript
// New booking form
// Expected: Only 1 vehicle in dropdown
// Check: Deleted vehicle not listed
```

#### Test C3: Soft-Delete Persists
**Setup**: Delete booking
**Test**:
```typescript
// Logout, login again
// Expected: Deleted booking still gone
// Check DB: deleted_at timestamp still set
```

---

### D. DATE HANDLING TESTS

#### Test D1: Past Date Booking
**Setup**: Try to create booking 10 days in past
**Test**:
```typescript
// New booking → set start date to 10 days ago
// Expected: Error "Cannot create bookings >7 days in past"
// Unless allowBackdateOverride enabled
```

#### Test D2: Invalid Date Range
**Setup**: Try booking where end < start
**Test**:
```typescript
// Set start = Jan 15, end = Jan 10
// Try to create
// Expected: Error "End date must be after start date"
```

#### Test D3: 24-Hour Auto-Complete
**Setup**: Create booking
**Test**:
```typescript
// Check "24 Hour Duration"
// Set start date/time
// Expected: End date auto-set to start + 24hrs
// Verify: Rent calculated correctly
```

#### Test D4: Date Sorting in Lists
**Setup**: Create 3 bookings on different dates
**Test**:
```typescript
// Bookings page
// Expected: Sorted by start date (newest first)
// Not: Sorting errors or NaN values
```

---

### E. PAYMENT FLOW TESTS

#### Test E1: Unpaid → Partial (Advance)
**Setup**: Create confirmed booking
**Test**:
```typescript
// Booking detail → "Record Payment" → "Advance"
// Enter advance amount (less than total)
// Expected:
//   - paymentStatus = "Partial"
//   - advanceAmount = entered amount
//   - remainingAmount = total - advance
//   - status = "Confirmed"
```

#### Test E2: Partial → Paid (Full)
**Setup**: Booking with advance paid
**Test**:
```typescript
// Click "Record Full Payment"
// Enter balance amount
// Expected:
//   - paymentStatus = "Paid"
//   - remainingAmount = 0
//   - paidAt = timestamp
```

#### Test E3: Payment History Tracked
**Setup**: Record advance + full payment
**Test**:
```typescript
// View booking history
// Expected: Two entries in history
//   - "Advance ₹X via Cash"
//   - "Full payment ₹Y via UPI"
```

---

### F. VEHICLE STATUS SYNC TESTS

#### Test F1: Vehicle Status on Mark Taken
**Setup**: Create active booking
**Test**:
```typescript
// Booking detail → "Mark as Taken"
// Enter opening odometer
// Expected:
//   - Vehicle status → "Rented"
//   - Booking status → "Active"
//   - current_odometer updated
```

#### Test F2: Vehicle Released on Mark Returned
**Setup**: Booking marked as taken
**Test**:
```typescript
// Booking detail → "Mark as Returned"
// Enter closing odometer
// Expected:
//   - Vehicle status → "Available"
//   - Booking status → "Completed"
//   - current_odometer updated
```

#### Test F3: Vehicle Released on Cancel
**Setup**: Booking in confirmed state
**Test**:
```typescript
// Booking detail → "Cancel"
// Expected:
//   - Vehicle status → "Available"
//   - Booking status → "Cancelled"
```

---

### G. FORM VALIDATION TESTS

#### Test G1: Booking Without Vehicle
**Setup**: New booking form
**Test**:
```typescript
// Don't select any vehicle
// Try to submit
// Expected: Error "Please select at least one vehicle"
```

#### Test G2: Booking Without Customer
**Setup**: New booking form, vehicle selected
**Test**:
```typescript
// Don't select customer
// Try to submit
// Expected: Error "Please select a customer"
```

#### Test G3: Vehicle Overlap Detection
**Setup**: Vehicle already booked Jan 10-15
**Test**:
```typescript
// New booking, same vehicle, Jan 13-20
// Try to submit
// Expected: Error "Vehicle already booked for these dates"
```

---

### H. INVOICE TESTS

#### Test H1: Invoice Number Assignment
**Setup**: Create and complete booking
**Test**:
```typescript
// Mark booking as returned
// Expected: invoiceNumber assigned (INV-XXXX format)
// Next booking: invoiceNumber incremented
```

#### Test H2: Invoice Not Reassigned
**Setup**: Booking with invoiceNumber
**Test**:
```typescript
// Edit booking
// Return booking again
// Expected: Same invoiceNumber persists
// Not: New invoiceNumber generated
```

---

### I. MULTI-USER COLLABORATION TESTS

#### Test I1: Owner Creates, Staff Completes
**Setup**: ownerA + staffA in same shop
**Test**:
```typescript
// ownerA creates booking
// ownerA logs out, staffA logs in
// Expected: staffA sees booking
// staffA marks as taken, records payment
// ownerA logs in, sees updated booking
```

#### Test I2: Staff Cannot Delete Bookings
**Setup**: staffA with limited permissions
**Test**:
```typescript
// staffA tries to delete booking
// Expected: Delete button disabled or shows error
// Check permissions: canDeleteBooking = false for staff
```

---

### J. EDGE CASES

#### Test J1: Multi-Vehicle Booking
**Setup**: Create booking with 2+ vehicles
**Test**:
```typescript
// Select bike1, bike2 in same booking
// Expected: Both bikes marked as booked
// Mark as taken: Both bikes status → "Rented"
// Mark returned: Both bikes status → "Available"
```

#### Test J2: Concurrent Edits
**Setup**: Two staff members
**Test**:
```typescript
// staffA and staffB both open same booking
// staffA marks as taken
// staffB tries to record payment
// Expected: Last-write-wins or proper conflict handling
```

#### Test J3: Very Long Booking
**Setup**: 90-day rental
**Test**:
```typescript
// Create booking for 90 days
// Rent = 100/day → total = 9000
// Expected: Calculated correctly, no overflow
```

---

## DATABASE VERIFICATION QUERIES

Run these in Supabase SQL editor to verify fixes:

### 1. Verify RLS Policies Changed
```sql
-- Should show new shop-level policies, NOT user-level
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('bookings', 'vehicles', 'customers');

-- Expected output includes:
-- bookings_select_shop (not bookings_select_owner)
-- vehicles_select_shop (not vehicles_select_owner)
```

### 2. Verify shop_id Trigger
```sql
-- Create test record without shop_id
INSERT INTO bookings (
  customer_id, vehicle_ids, start_date, end_date, rent, deposit, total_amount, status, payment_status
)
VALUES (
  'test-cust', ARRAY['test-bike'], now(), now() + interval '1 day', 500, 1000, 1500, 'Booked', 'Unpaid'
);

-- Check: shop_id was automatically populated
SELECT id, shop_id FROM bookings WHERE id = 'test-record';
-- Expected: shop_id is NOT NULL (set by trigger)
```

### 3. Verify Soft-Delete Filter
```sql
-- Create and "delete" a booking
DELETE FROM bookings WHERE id = 'test-booking';

-- Should have soft-deleted with deleted_at timestamp
SELECT id, deleted_at FROM bookings WHERE id = 'test-booking';
-- Expected: deleted_at = now() (not actually deleted)
```

### 4. Verify Multi-User Same-Shop Access
```sql
-- Setup: owner1 and staff1 in same shop
-- Query as staff1's auth context should return both owner1 and staff1's bookings

SELECT count(*) FROM bookings 
WHERE shop_id = (SELECT shop_id FROM users WHERE auth_id = 'staff1-auth-id');
-- Expected: count > 0 includes owner's bookings
```

---

## PERFORMANCE CHECKS

### P1: Page Load Times
- [ ] Dashboard: <2 seconds
- [ ] Bookings list: <1 second (100 records)
- [ ] Bikes list: <1 second
- [ ] New booking form: <1 second

### P2: Query Efficiency
Check Supabase query logs:
- [ ] No N+1 queries (loading booking list shouldn't load customers N times)
- [ ] RLS subqueries: <50ms overhead
- [ ] Soft-delete filter: instant (indexed on deleted_at)

---

## BROWSER CONSOLE CHECKS (F12)

On every page:
- [ ] Zero errors
- [ ] Zero warnings (non-critical OK)
- [ ] No "undefined.includes" errors
- [ ] No "Cannot read property X of undefined"
- [ ] No "RLS policy violation"

---

## DEPLOYMENT READINESS CHECKLIST

- [ ] All tests above pass
- [ ] RLS policies deployed to production
- [ ] Backend code deployed
- [ ] Frontend code deployed
- [ ] No database migrations pending
- [ ] Monitoring/alerts configured
- [ ] Backup taken before deployment

---

## ROLLBACK PROCEDURE

If critical issues found:

### 1. Revert RLS Policies (Quick)
```sql
-- Drop new policies
DROP POLICY IF EXISTS "vehicles_select_shop" ON vehicles;
DROP POLICY IF EXISTS "vehicles_insert_shop" ON vehicles;
-- ... (repeat for all tables)

-- Restore old policies from backup
-- (policies should be in version control)
```

### 2. Revert Code Changes
```bash
git revert HEAD~1  # Revert last commit
npm run deploy
```

### 3. Validate
```bash
# Run smoke test again
# Verify: Old behavior restored
```

