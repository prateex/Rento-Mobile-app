# Database Reset - Verification Checklist

## ✅ Pre-Reset Backup
- [ ] Backup existing data if needed
- [ ] Note any important UUIDs or records
- [ ] Inform team members about reset

## 🔄 Execution Order

Run these SQL files in order:

1. **00_wipe_database.sql** - Complete wipe
2. **01_fresh_schema.sql** - New schema
3. **02_helper_functions.sql** - Security functions
4. **03_rls_policies.sql** - RLS policies
5. **04_seed_test_data.sql** - Test data

## 🔐 Authentication Setup

### For Supabase Cloud:
```javascript
// Use Admin API to create auth users first
const { data: ownerA, error } = await supabase.auth.admin.createUser({
  email: 'owner.a@rentoshop.com',
  password: 'TestPass123!',
  email_confirm: true
});

const { data: staffA, error } = await supabase.auth.admin.createUser({
  email: 'staff.a@rentoshop.com',
  password: 'TestPass123!',
  email_confirm: true
});

// Then modify 04_seed_test_data.sql to use returned UUIDs
```

### For Local Supabase:
- Run `04_seed_test_data.sql` as-is (creates auth users directly)

## 🧪 Testing Checklist

### Test Shop Isolation

#### Login as Shop A Owner
```sql
-- Login: owner.a@rentoshop.com / TestPass123!
```

**Test 1: View own customers**
```sql
SELECT * FROM customers;
-- Expected: Should see only Shop A customers (Customer A1)
```

**Test 2: View own vehicles**
```sql
SELECT * FROM vehicles;
-- Expected: Should see only Shop A vehicles (Honda Activa, Royal Enfield)
```

**Test 3: Cannot see Shop B data**
```sql
SELECT * FROM customers WHERE name LIKE '%B%';
-- Expected: No results (Shop B customers are isolated)
```

**Test 4: Add new customer**
```sql
INSERT INTO customers (shop_id, name, phone, id_type, id_photos, status)
SELECT 
  get_current_user_shop_id(),
  'New Customer A',
  '+91-9111111111',
  'Aadhaar',
  '[]',
  'Verified';
-- Expected: Success
```

**Test 5: Add new vehicle**
```sql
INSERT INTO vehicles (shop_id, name, registration_number, type, daily_rate, status)
SELECT 
  get_current_user_shop_id(),
  'TVS Apache',
  'KA-01-ZZ-9999',
  'Bike',
  500.00,
  'Available';
-- Expected: Success
```

**Test 6: Create booking**
```sql
INSERT INTO bookings (
  shop_id, 
  booking_number, 
  customer_id, 
  vehicle_ids, 
  start_date, 
  end_date, 
  total_amount, 
  balance_amount, 
  created_by
)
SELECT 
  get_current_user_shop_id(),
  'BK-001',
  c.id,
  jsonb_build_array(v.id),
  NOW(),
  NOW() + interval '2 days',
  800.00,
  800.00,
  u.id
FROM customers c, vehicles v, users u
WHERE c.name = 'Customer A1'
  AND v.registration_number = 'KA-01-AB-1234'
  AND u.auth_id = auth.uid()
LIMIT 1;
-- Expected: Success
```

#### Login as Shop A Staff
```sql
-- Login: staff.a@rentoshop.com / TestPass123!
```

**Test 7: Staff can view customers**
```sql
SELECT * FROM customers;
-- Expected: Should see all Shop A customers
```

**Test 8: Staff can view bookings**
```sql
SELECT * FROM bookings;
-- Expected: Should see all Shop A bookings
```

**Test 9: Staff CANNOT add users**
```sql
INSERT INTO users (shop_id, auth_id, name, phone, role)
VALUES (
  get_current_user_shop_id(),
  gen_random_uuid(),
  'Test User',
  '+91-9222222222',
  'staff'
);
-- Expected: FAIL (only owners can add users)
```

#### Login as Shop B Owner
```sql
-- Login: owner.b@rentoshop.com / TestPass123!
```

**Test 10: View own data only**
```sql
SELECT * FROM customers;
-- Expected: Should see only Shop B customers (Customer B1)
```

**Test 11: Cannot see Shop A data**
```sql
SELECT * FROM vehicles WHERE registration_number = 'KA-01-AB-1234';
-- Expected: No results (Shop A vehicle is isolated)
```

### Test Helper Functions

**Test 12: get_current_user_shop_id()**
```sql
SELECT get_current_user_shop_id();
-- Expected: Returns your shop UUID
```

**Test 13: is_current_user_owner()**
```sql
SELECT is_current_user_owner();
-- Expected: true for owner logins, false for staff
```

### Test RLS Policies

**Test 14: Verify RLS enabled**
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('shops', 'users', 'customers', 'vehicles', 'bookings');
-- Expected: All tables show rowsecurity = true
```

**Test 15: List all policies**
```sql
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
-- Expected: Shows all policies created
```

**Test 16: No recursive policies**
```sql
-- Check that users table policies don't query users table
SELECT policyname, qual::text, with_check::text
FROM pg_policies
WHERE tablename = 'users' AND schemaname = 'public';
-- Expected: Should use auth.uid() and get_current_user_shop_id() only
```

## 🎯 App Integration Tests

### Frontend/App Tests

**Test 17: Login flow**
- [ ] Can login with owner credentials
- [ ] Can login with staff credentials
- [ ] JWT token is returned
- [ ] Token contains correct user data

**Test 18: Dashboard loads**
- [ ] Customers list loads
- [ ] Vehicles list loads
- [ ] Bookings list loads
- [ ] No errors in console

**Test 19: Add customer via app**
- [ ] Form opens
- [ ] Can fill details
- [ ] Can upload ID photo
- [ ] Customer saves successfully
- [ ] Customer appears in list immediately

**Test 20: Add vehicle via app**
- [ ] Form opens
- [ ] Can fill vehicle details
- [ ] Vehicle saves successfully
- [ ] Vehicle appears in available vehicles

**Test 21: Create booking via app**
- [ ] Can select customer
- [ ] Can select vehicle
- [ ] Can set dates
- [ ] Booking number auto-generates
- [ ] Booking saves successfully
- [ ] Vehicle status updates to 'Rented'

**Test 22: Multi-user in same shop**
- [ ] Login as owner
- [ ] Add customer A
- [ ] Logout
- [ ] Login as staff
- [ ] Can see customer A
- [ ] Add customer B
- [ ] Logout
- [ ] Login as owner
- [ ] Can see both customers A and B

**Test 23: Shop isolation**
- [ ] Login as Shop A owner
- [ ] Note customer count
- [ ] Logout
- [ ] Login as Shop B owner
- [ ] Customer count is different
- [ ] Cannot see Shop A customers

## ✅ Final Checks

- [ ] No RLS recursion errors
- [ ] No "infinite recursion" errors
- [ ] All CRUD operations work
- [ ] Shop isolation is strict
- [ ] Owner can manage users
- [ ] Staff cannot manage users
- [ ] Helper functions work correctly
- [ ] All indexes created
- [ ] All triggers working
- [ ] Updated_at timestamps update correctly

## 📊 Performance Checks

**Test 24: Query performance**
```sql
EXPLAIN ANALYZE SELECT * FROM customers WHERE shop_id = get_current_user_shop_id();
-- Expected: Should use idx_customers_shop_id index
```

**Test 25: Index usage**
```sql
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public';
-- Expected: All indexes created
```

## 🚨 Common Issues

### Issue: "infinite recursion detected in policy"
**Solution**: Check that users table policies don't query users table. Use SECURITY DEFINER helper function instead.

### Issue: "null value in column shop_id"
**Solution**: Ensure get_current_user_shop_id() returns valid UUID. Check users table has entry for auth user.

### Issue: "RLS policy violated"
**Solution**: Check user is logged in (auth.uid() not null) and has users table entry with shop_id.

### Issue: Cannot see any data
**Solution**: Verify RLS policies exist and user's shop_id matches data shop_id.

## 📝 Notes

- Always test with service role first (bypasses RLS) to verify data exists
- Then test with authenticated users to verify RLS works
- Use multiple browser profiles to test different users simultaneously
- Monitor Supabase logs for policy violations

## ✨ Success Criteria

The reset is successful when:
1. ✅ All tables created
2. ✅ RLS enabled on all tables
3. ✅ Helper functions work
4. ✅ No recursion errors
5. ✅ Shop isolation is strict
6. ✅ CRUD operations work via app
7. ✅ Multiple users can work in same shop
8. ✅ Cross-shop data is invisible
9. ✅ Owner/staff permissions work
10. ✅ App flows complete end-to-end
