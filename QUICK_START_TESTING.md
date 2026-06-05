# 🚀 QUICK START - TESTING GUIDE

**Status:** ✅ All fixes applied. Ready to test.

---

## 1. START THE APP

### Terminal 1: Start Supabase (if not running)
```bash
cd "c:\App Project\Rento App Project\Development\Rento-App-03"
supabase start --local
```

### Terminal 2: Start Frontend Dev Server
```bash
cd "c:\App Project\Rento App Project\Development\Rento-App-03\backend\client"
npm run dev
```

### Open Browser
```
http://localhost:5000
```

---

## 2. LOGIN TEST

### Test 1: Owner Login ✅
```
Email: owner@goabikes.com
Password: test@123

Expected Result:
- App loads dashboard
- Sidebar shows all menu items (Vehicles, Customers, Bookings, Payments)
- "Add Vehicle", "Add Customer", "New Booking" buttons visible
```

### Test 2: Staff Login ✅
```
Email: staff@goabikes.com
Password: test@123

Expected Result:
- App loads dashboard
- Sidebar shows menu items
- "Add Vehicle", "Add Customer" buttons NOT visible (read-only)
- Can still create bookings but not edit/delete
```

---

## 3. OWNER WORKFLOW TEST (The Critical Test)

### Step 1️⃣: Add Vehicle
```
1. Click "Add Vehicle"
2. Fill in:
   - Registration: KA-01-TEST-001
   - Type: Bike
   - Brand: Hero
   - Model: Splendor
   - Year: 2023
   - Fuel Type: Petrol
   - Daily Rate: 500
   - Status: Available
3. Click "Save Vehicle"

Expected:
  ✅ Vehicle appears in list
  ✅ No error in console
  ✅ No database error
```

### Step 2️⃣: Edit Vehicle
```
1. Click on the vehicle you just added
2. Click "Edit"
3. Change Daily Rate to 600
4. Click "Update Vehicle"

Expected:
  ✅ Rate updates immediately
  ✅ No error in console
```

### Step 3️⃣: Add Customer
```
1. Click "Add Customer"
2. Fill in:
   - Name: John Doe
   - Phone: 9876543210
   - Email: john@example.com
   - Address: 123 Main St
   - ID Type: Aadhaar
3. Click "Save Customer"

Expected:
  ✅ Customer appears in list
  ✅ Customer Number auto-generated (CUST-001, etc.)
  ✅ No error in console
```

### Step 4️⃣: Edit Customer
```
1. Click on customer
2. Click "Edit"
3. Change address to "456 Oak St"
4. Click "Update Customer"

Expected:
  ✅ Address updates immediately
  ✅ No error in console
```

### Step 5️⃣: Create Booking
```
1. Click "New Booking"
2. Select:
   - Customer: John Doe
   - Vehicle: KA-01-TEST-001
   - Start Date: [Tomorrow]
   - End Date: [Day after tomorrow]
   - Daily Rate: 500
   - Number of Days: 2
   - Total Amount: 1000
   - Deposit Amount: 250
3. Click "Create Booking"

Expected:
  ✅ Booking appears in list
  ✅ Status shows "Booked"
  ✅ No error in console
  ✅ No database error about user_id
```

### Step 6️⃣: Record Payment (Advance)
```
1. Click on booking
2. Click "Mark As Paid" or "Record Payment"
3. Select Payment Method: Cash
4. Enter Amount: 250
5. Click "Record Payment"

Expected:
  ✅ Booking status changes to "Advance Paid"
  ✅ Payment appears in Payments list
  ✅ Payment shows as "Advance"
  ✅ No error about payment_method column
```

### Step 7️⃣: Delete Vehicle
```
1. Go to Vehicles
2. Click on the test vehicle (KA-01-TEST-001)
3. Click "Delete"
4. Confirm deletion

Expected:
  ✅ Vehicle disappears from list
  ✅ No error in console
```

### Step 8️⃣: Delete Customer
```
1. Go to Customers
2. Click on John Doe
3. Click "Delete"
4. Confirm deletion

Expected:
  ✅ Customer disappears from list
  ✅ No error in console
```

---

## 4. STAFF WORKFLOW TEST (Permission Check)

### Login as Staff
```
Email: staff@goabikes.com
Password: test@123
```

### Verify Permissions
```
Expected Behaviors:

1. Vehicles List
   ✅ Can VIEW vehicles
   ❌ NO "Add Vehicle" button
   ❌ NO "Edit" button on vehicles
   ❌ NO "Delete" button on vehicles

2. Customers List
   ✅ Can VIEW customers
   ❌ NO "Add Customer" button
   ❌ NO "Edit" button on customers
   ❌ NO "Delete" button on customers

3. Bookings List
   ✅ Can VIEW bookings
   ✅ CAN create new bookings
   ✅ Can view booking details
   ❌ NO "Edit Booking" button (depends on business logic)
   ❌ NO "Delete Booking" button

4. Payments List
   ✅ Can VIEW payments
   ❌ NO ability to create payments (read-only)
```

---

## 5. VERIFICATION QUERIES

### Check if Migration Was Applied
Open Supabase Studio (http://localhost:54323) → SQL Editor

```sql
-- Verify user_id column exists on vehicles
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'vehicles' AND column_name = 'user_id';

-- Expected: One row with "user_id"
```

```sql
-- Verify triggers exist
SELECT trigger_name FROM information_schema.triggers 
WHERE table_name = 'vehicles';

-- Expected: Rows including "trigger_vehicles_set_created_by"
```

```sql
-- Check a vehicle record has user_id populated
SELECT id, registration_number, user_id, created_by FROM vehicles 
WHERE registration_number = 'KA-01-TEST-001';

-- Expected: user_id and created_by should have UUID values (NOT NULL)
```

```sql
-- Check payment uses payment_mode column
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'payments' AND column_name IN ('payment_mode', 'payment_method');

-- Expected: Only "payment_mode" should exist, not "payment_method"
```

---

## 6. EXPECTED RESULTS SUMMARY

### ✅ If All Tests Pass
- Owner can fully use the app (CRUD on all entities)
- Staff sees read-only views with no edit/delete buttons
- No database errors about missing columns
- User tracking works (user_id, created_by populated automatically)
- Payments record correctly with payment_mode column

### ❌ If Tests Fail

**Error: "column user_id does not exist"**
- Migration not applied
- Check: `supabase migration list --local`
- Re-apply: `supabase db push --local`

**Error: "column payment_method does not exist"**
- Booking.tsx not updated
- Check lines 418 and 623
- Should use `payment_mode` not `payment_method`

**Error: Owner can't add vehicle (button missing)**
- Permission system issue
- Check: store.ts line 28 - `getPermissions` function
- Owner role should return all `canAdd*` properties as true

**Error: Delete button doesn't appear**
- Permission check in component
- Components should use: `if (permissions.canDeleteVehicle) { ...render delete button... }`

---

## 7. CONSOLE ERROR CHECKLIST

### ✅ Safe to Ignore (Expected)
```
- Warnings about Zustand
- Warnings about React 19 experimental features
- Auth context not available initially
```

### ❌ MUST NOT SEE These Errors
```
- "Cannot read property 'user_id' of undefined"
- "column 'user_id' does not exist"
- "column 'payment_method' does not exist"
- "violates check constraint"
- "401 Unauthorized" (after logging in)
- "RLS policy rejected" (for owner viewing their own shop's data)
```

---

## 8. CLEANUP (After Testing)

### Stop Supabase
```bash
supabase stop --local
```

### Remove Test Data (Optional)
```sql
-- In Supabase Studio → SQL Editor
DELETE FROM vehicles WHERE registration_number LIKE 'KA-01-TEST-%';
DELETE FROM customers WHERE full_name = 'John Doe';
DELETE FROM bookings WHERE customer_id IN (SELECT id FROM customers WHERE full_name = 'John Doe');
```

---

## 9. TROUBLESHOOTING

### App Won't Load?
```bash
1. Check Supabase is running: supabase status --local
2. Check dev server running: npm run dev (in backend/client folder)
3. Check no errors in browser console (F12)
4. Clear browser cache and reload
```

### Can't Login?
```
1. Check auth user exists: Supabase Studio → Auth → Users
2. Users should be: owner@goabikes.com, staff@goabikes.com
3. Try resetting password in Supabase Studio
4. Check RLS policies not blocking auth table
```

### Vehicle Add Fails with "column user_id does not exist"?
```
1. Check migration applied: supabase migration list --local
2. Check vehicles table has user_id: Supabase Studio → SQL Editor
3. Re-apply if needed: supabase db push --local
```

### Payment Fails with "column payment_method does not exist"?
```
1. Check Bookings.tsx lines 418 and 623 use "payment_mode"
2. Check migration created payment_mode column
3. Verify no code still uses "payment_method" or "payment_type"
```

---

## 10. SUCCESS CRITERIA

**You know everything is fixed when:**

1. ✅ Owner can add a vehicle with NO database errors
2. ✅ Owner can edit the vehicle (change daily rate)
3. ✅ Owner can delete the vehicle
4. ✅ Owner can add a customer
5. ✅ Owner can edit the customer
6. ✅ Owner can create a booking
7. ✅ Owner can record a payment (advance)
8. ✅ Staff logs in and sees NO "Add Vehicle" button
9. ✅ Staff logs in and sees NO "Add Customer" button
10. ✅ Browser console shows NO errors about missing columns

**If all 10 pass → APP IS PRODUCTION READY** ✅

---

## QUICK REFERENCE

| Task | Test | Expected |
|------|------|----------|
| Add Vehicle | Click Add, fill form, Save | Vehicle appears, no errors |
| Edit Vehicle | Open vehicle, Edit, change rate, Update | Rate updates |
| Delete Vehicle | Open vehicle, Delete, Confirm | Vehicle disappears |
| Add Customer | Click Add, fill form, Save | Customer appears, number auto-generated |
| Edit Customer | Open customer, Edit, change address, Update | Address updates |
| Create Booking | Click New, select dates/vehicle/customer, Create | Booking appears, status="Booked" |
| Record Payment | Click booking, Record Payment, select method, amount, Save | Status updates to "Advance Paid" |
| Staff Permissions | Login as staff | No Add/Edit/Delete buttons visible |

---

**Good luck! If all tests pass, the app is ready for production.** 🎉
