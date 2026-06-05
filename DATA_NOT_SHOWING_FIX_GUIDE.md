# DATA NOT SHOWING - COMPLETE FIX GUIDE

## Problem
- App shows blank lists (customers, vehicles, bookings)
- No errors in console
- Data EXISTS in database
- **Root Cause:** RLS SELECT policies are blocking reads

---

## Solution: 3-Step Process

### **STEP 1: Verify Data Exists (5 minutes)**

Run [01_verify_data_exists.sql](01_verify_data_exists.sql) in Supabase SQL Editor:

```sql
-- Check record counts
SELECT COUNT(*) as customer_count FROM customers;
SELECT COUNT(*) as vehicle_count FROM vehicles;
SELECT COUNT(*) as booking_count FROM bookings;

-- See your current user context
SELECT auth.uid() as my_auth, 
       (SELECT shop_id FROM users WHERE auth_id = auth.uid()) as my_shop_id;
```

**Expected Output:**
- ✅ customer_count > 0
- ✅ vehicle_count > 0  
- ✅ booking_count > 0
- ✅ my_auth = UUID (your auth ID)
- ✅ my_shop_id = UUID (your shop)

If you see data in SQL but app shows blank → **Confirmed RLS issue** ✓

---

### **STEP 2: Test with Temporary Policies (3 minutes)**

Run [02_temporary_test_policies.sql](02_temporary_test_policies.sql) in Supabase SQL Editor:

This adds permissive SELECT policies that allow ANY authenticated user to read:
```sql
CREATE POLICY "test_users_select" ON users FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "test_customers_select" ON customers FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "test_vehicles_select" ON vehicles FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "test_bookings_select" ON bookings FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);
```

**Then immediately test in your app:**

1. Go to **Customers page** → Refresh page
2. Go to **Vehicles page** → Refresh page
3. Go to **Bookings page** → Refresh page

**Expected Results:**

| Scenario | Meaning |
|----------|---------|
| ✅ Data appears | RLS policies were blocking (this is expected!) |
| ❌ Still blank | Different issue - check schema/auth setup |

If data appears with temporary policies → **Proceed to Step 3** ✓

---

### **STEP 3: Apply Proper RLS Policies (2 minutes)**

Run [03_proper_rls_fix.sql](03_proper_rls_fix.sql) in Supabase SQL Editor:

This:
1. **Removes temporary test policies**
2. **Creates correct helper function** that gets current user's shop_id
3. **Replaces broken SELECT policies** with proper multi-tenant ones

**Key Fix:**

```sql
-- Helper function (runs with SECURITY DEFINER - bypasses RLS)
CREATE FUNCTION get_current_user_shop_id() RETURNS UUID AS $$
  SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Correct SELECT policy (no recursion, uses helper function)
CREATE POLICY "customers_select" ON customers FOR SELECT TO authenticated
USING (
  shop_id = get_current_user_shop_id()  -- User sees only their shop's data
  OR (SELECT role FROM users WHERE auth_id = auth.uid()) = 'SUPER_ADMIN'
);
```

---

## **Test After Fix**

### Refresh All Pages
1. **Customers** - Should show all shop customers ✅
2. **Vehicles** - Should show all shop vehicles ✅
3. **Bookings** - Should show all shop bookings ✅

### Test Create Operations
1. **Add Customer**
   - Click "+ Add Customer"
   - Fill form
   - Click "Register Customer"
   - ✅ Should succeed

2. **Create Booking**
   - Click "+ New Booking"
   - Select customer from dropdown (should have data)
   - Select vehicle
   - Enter dates
   - ✅ Should succeed

---

## Expected Before & After

### BEFORE (Broken)
```
❌ Customers list: 0 items (but DB has 10)
❌ Vehicles list: 0 items (but DB has 5)
❌ Bookings list: 0 items (but DB has 8)
❌ Add customer: No customer dropdown
❌ Console: No errors visible
```

### AFTER (Fixed)
```
✅ Customers list: 10 items
✅ Vehicles list: 5 items
✅ Bookings list: 8 items
✅ Add customer: Customer dropdown loads
✅ Create booking: Succeeds
```

---

## Why This Works

| Component | Why It Was Broken | How It's Fixed |
|-----------|-------------------|----------------|
| **Helper Function** | Old one queried users directly (recursion) | New one uses SECURITY DEFINER (bypasses RLS) |
| **SELECT Policies** | Called old recursive function | Call safe helper function instead |
| **Multi-tenancy** | Didn't check shop_id properly | Now compares `shop_id = get_current_user_shop_id()` |
| **SUPER_ADMIN** | Couldn't see all data | Now has explicit role check |

---

## Troubleshooting

### Issue: Still blank after Step 3

**Check:**
1. Are you logged in as a user with `shop_id` set?
   ```sql
   SELECT auth.uid(), shop_id FROM users WHERE auth_id = auth.uid();
   ```
   - If `shop_id` is NULL → User has no shop assigned

2. Does data exist for your shop?
   ```sql
   SELECT COUNT(*) FROM customers WHERE shop_id = 'YOUR_SHOP_ID';
   ```
   - If 0 → Create test data first

3. Are SELECT policies applied?
   ```sql
   SELECT policyname, cmd FROM pg_policies 
   WHERE tablename = 'customers';
   ```
   - Should see: `customers_select | SELECT`

### Issue: "Infinite recursion" error returns

This means old policies are still active:
```sql
-- Check for old policies
SELECT policyname FROM pg_policies 
WHERE schemaname = 'public' 
AND policyname LIKE '%test%' OR policyname LIKE '%users_same%';

-- If found, drop them
DROP POLICY IF EXISTS "users_same_shop" ON users;
DROP POLICY IF EXISTS "users_superadmin_all" ON users;
```

---

## File Summary

| File | Purpose | When to Run |
|------|---------|-------------|
| `01_verify_data_exists.sql` | Check DB has data | First |
| `02_temporary_test_policies.sql` | Test if RLS is the issue | After Step 1 |
| `03_proper_rls_fix.sql` | Fix with correct policies | After confirming Step 2 works |

---

## Success Criteria

✅ You are done when:
- [ ] Data shows in Customers, Vehicles, Bookings pages
- [ ] Can add new customer successfully
- [ ] Can create new booking successfully
- [ ] No "infinite recursion" errors
- [ ] No "permission denied" errors
- [ ] Shop-level data isolation works (user only sees their shop's data)

---

**Total Time: ~10 minutes**

Apply Steps 1-3 in order, test after each step!
