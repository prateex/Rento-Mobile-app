## QUICK TEST GUIDE: Enum Fix Validation

**Before Testing:** Apply the SQL migration first!

```sql
-- Apply migration to Supabase:
psql -d your_db -f supabase/migrations/20250107000001_fix_booking_status_enum.sql

-- Verify:
SELECT enum_range(NULL::booking_status);
-- Should return all 8 values including 'Taken' and 'Returned'
```

---

## TEST 1: Mark as Taken (Critical Flow)

**Objective:** Verify the "Mark as Taken" button works without enum errors

**Precondition:**
- Create a booking (Status: 'Booked')
- Payment marked as 'Paid' or 'Partial'
- Booking moved to 'Confirmed' status

**Steps:**
1. Navigate to Bookings page
2. Find the confirmed booking
3. Click "Mark as Taken" button (green icon)
4. Enter Opening Odometer: `1000`
5. Confirm

**Expected Results:**
```
✅ NO DATABASE ERROR
✅ Booking status changes to 'Active' (UI display) / 'Taken' (DB)
✅ Vehicle status changes to 'Rented'
✅ Toast message: "Vehicle Taken. Status: Active."
✅ 'taken_at' timestamp recorded
✅ 'opening_odometer' set to 1000
```

**Database Check:**
```sql
SELECT id, status, opening_odometer, taken_at 
FROM bookings 
WHERE booking_number = 'BK0001';

-- status should be: 'Taken' (NOT 'Active' in DB)
-- But UI will display 'Active' due to mapDbStatusToUi
```

---

## TEST 2: Return Vehicle (Critical Flow)

**Objective:** Verify returning a vehicle works without enum errors

**Precondition:**
- Booking must be in 'Active' or 'Taken' status
- Opening odometer must be recorded

**Steps:**
1. Navigate to Bookings page
2. Find an 'Active' booking
3. Click "Mark as Returned" button (in actions)
4. Enter Closing Odometer: `1050`
5. Confirm damage inspection (if any)
6. Click "Save & Return"

**Expected Results:**
```
✅ NO DATABASE ERROR
✅ Booking status changes to 'Completed' (UI) / 'Returned' (DB)
✅ Vehicle status changes to 'Available'
✅ 'closing_odometer' set to 1050
✅ 'returned_at' timestamp recorded
✅ Invoice generation available
✅ History entry: "Marked as Returned"
```

**Database Check:**
```sql
SELECT id, status, closing_odometer, returned_at 
FROM bookings 
WHERE booking_number = 'BK0001';

-- status should be: 'Returned' (NOT 'Completed' in DB)
-- But UI will display 'Completed' due to mapDbStatusToUi
```

---

## TEST 3: Cancel Booking

**Objective:** Verify cancellation still works

**Precondition:**
- Booking in any active status (Booked, Confirmed, Active, Taken)

**Steps:**
1. Navigate to Bookings page
2. Click "Cancel" on booking
3. Confirm cancellation

**Expected Results:**
```
✅ Booking status → 'Cancelled'
✅ No database errors
✅ Bike availability restored
✅ Toast: "Booking cancelled"
```

**Database Check:**
```sql
SELECT status FROM bookings WHERE id = 'xyz';
-- Should be: 'Cancelled'
```

---

## TEST 4: Filter by Active Status

**Objective:** Verify filter shows both 'Active' and 'Taken' bookings

**Steps:**
1. Navigate to Bookings page
2. Click "Active" filter badge
3. Observe list

**Expected Results:**
```
✅ Shows bookings with status 'Active' OR 'Taken'
✅ Hidden: Booked, Confirmed, Completed, Cancelled, Returned
✅ Can click "Return" button on any listed booking
```

**Database Check:**
```sql
SELECT COUNT(*) FROM bookings WHERE status IN ('Active', 'Taken');
-- Should match number of bookings shown in UI filter
```

---

## TEST 5: Backward Compatibility

**Objective:** Verify old 'Active' bookings (if any) still work

**Precondition:**
- Have existing bookings with status 'Active' from before fix

**Steps:**
1. Load Bookings page
2. Search for old 'Active' bookings
3. Try to return an 'Active' booking
4. Observe mapping works correctly

**Expected Results:**
```
✅ 'Active' bookings still readable
✅ mapDbStatusToUi handles 'Active' correctly
✅ Can return from 'Active' status
✅ No TypeScript errors
```

---

## TEST 6: TypeScript Compilation

**Objective:** Verify no type errors after code changes

**Steps:**
```bash
npm run build
# or
npm run type-check
```

**Expected Results:**
```
✅ No TypeScript errors
✅ BookingStatus type accepts 'Taken' and 'Returned'
✅ All status assignments type-safe
```

---

## TEST 7: Enum Constraint Validation

**Objective:** Verify database truly enforces the new enum

**Steps:**
```sql
-- Try to insert invalid status (should fail)
INSERT INTO bookings (id, shop_id, booking_number, customer_id, vehicle_ids, start_date, end_date, status)
VALUES (gen_random_uuid(), 'shop-1', 'TEST001', 'cust-1', '{}', now(), now() + interval '1 day', 'InvalidStatus');

-- Should get error: invalid input value for enum booking_status
```

**Expected Results:**
```
❌ INSERT should FAIL with enum error
```

**Try valid values:**
```sql
-- Should succeed
INSERT INTO bookings (..., status) VALUES (..., 'Taken');
INSERT INTO bookings (..., status) VALUES (..., 'Returned');
```

**Expected Results:**
```
✅ INSERT succeeds for all new values
```

---

## TEST 8: Data Integrity Check

**Objective:** Verify no bookings have null or invalid statuses

**Steps:**
```sql
-- Check for null statuses
SELECT COUNT(*) FROM bookings WHERE status IS NULL;
-- Should be 0

-- Check all statuses are valid
SELECT DISTINCT status FROM bookings ORDER BY status;
-- Should only show: Booked, Advance Paid, Confirmed, Active, Taken, Completed, Returned, Cancelled

-- Count by status
SELECT status, COUNT(*) FROM bookings GROUP BY status ORDER BY status;
```

**Expected Results:**
```
✅ No null statuses
✅ Only valid enum values present
✅ Distribution looks reasonable
```

---

## TEST 9: Invoice Generation (Cascading Test)

**Objective:** Verify invoice generation works with 'Returned' status

**Precondition:**
- Booking returned (status: 'Returned')
- Payment complete

**Steps:**
1. Navigate to Bookings page
2. Find returned booking
3. Click "Generate Invoice" (if not already done)
4. Confirm

**Expected Results:**
```
✅ Invoice generated without error
✅ Invoice number assigned
✅ PDF can be downloaded
```

---

## TEST 10: WhatsApp Notification (Cascading Test)

**Objective:** Verify WhatsApp integration works with new statuses

**Precondition:**
- WhatsApp configured
- Booking marked as Taken or Returned

**Steps:**
1. Check WhatsApp templates are applied
2. Observe booking history

**Expected Results:**
```
✅ Notifications sent without error
✅ No enum-related WhatsApp errors
✅ History records timestamp
```

---

## ERROR SCENARIOS (What NOT to see)

### ❌ SHOULD NOT SEE:

1. **Enum Error:**
   ```
   "invalid input value for enum booking_status_enum: 'Taken'"
   "invalid input value for enum booking_status_enum: 'Returned'"
   ```

2. **TypeScript Errors:**
   ```
   Type '"Taken"' is not assignable to type 'BookingStatus'
   Type '"Returned"' is not assignable to type 'BookingStatus'
   ```

3. **Database Constraint Error:**
   ```
   "new row for relation "bookings" violates check constraint"
   ```

4. **Null Status:**
   ```
   SELECT * FROM bookings WHERE status IS NULL;
   -- Should return 0 rows
   ```

---

## ROLLBACK TEST (Optional but Recommended)

**Objective:** Verify rollback SQL works if needed

**Steps:**
```sql
-- Run rollback migration (if created)
-- Should convert 'Taken' → 'Active', 'Returned' → 'Completed'
```

**Expected Results:**
```
✅ Migration completes without error
✅ All statuses still valid
✅ Data preserved (mapped to old values)
```

---

## PERFORMANCE CHECK

**Objective:** Verify enum changes don't impact query performance

**Steps:**
```sql
-- Check indexes still valid
SELECT * FROM pg_indexes WHERE tablename = 'bookings';

-- Time a typical query
EXPLAIN ANALYZE SELECT * FROM bookings WHERE status = 'Taken';
```

**Expected Results:**
```
✅ All indexes present
✅ Query plan hasn't changed
✅ No performance degradation
```

---

## FINAL CHECKLIST

Before marking as complete:

- [ ] SQL migration applied to database
- [ ] Enum verified with all 8 values
- [ ] Mark as Taken flow works without error
- [ ] Return Vehicle flow works without error
- [ ] Cancel Booking flow works
- [ ] Active filter shows both Active + Taken bookings
- [ ] Backward compat with old 'Active' bookings
- [ ] TypeScript build passes without errors
- [ ] No null statuses in database
- [ ] Invoice generation works
- [ ] Production logs monitored for errors
- [ ] Team notified of fix deployed

