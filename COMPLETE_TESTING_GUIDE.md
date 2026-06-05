# RENTO APP - COMPLETE TESTING GUIDE (LOCAL SUPABASE)

## ✅ Environment Status

- **Dev Server**: Running on http://127.0.0.1:3000
- **Local Supabase**: Running on http://127.0.0.1:54321
- **Studio**: http://127.0.0.1:54323
- **Database**: postgresql://postgres:postgres@127.0.0.1:54322/postgres
- **Anon Key**: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH

---

## STEP 1: Create Test Auth User in Studio

### Open Supabase Studio
```
http://127.0.0.1:54323
```

### Navigate to SQL Editor
1. Click **SQL Editor** (left sidebar)
2. Copy and paste this SQL:

```sql
-- Create test auth user
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'testlocal@rento.com',
  crypt('Password@123', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Create rental shop
INSERT INTO rental_shops (id, owner_id, name, phone, email, address, created_at, updated_at)
VALUES (
  '660e8400-e29b-41d4-a716-446655440000'::uuid,
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'Test Local Shop',
  '9876543210',
  'shop@test.com',
  'Test Address',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Create user staff record
INSERT INTO users (id, shop_id, auth_id, name, phone, role, is_active, created_at)
VALUES (
  '770e8400-e29b-41d4-a716-446655440000'::uuid,
  '660e8400-e29b-41d4-a716-446655440000'::uuid,
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'Test User',
  '9876543211',
  'admin',
  true,
  NOW()
) ON CONFLICT DO NOTHING;
```

3. Click **Run** (Ctrl+Enter)
4. Verify: "0 rows affected" or success message

---

## STEP 2: Test Sign In

### Open App
```
http://127.0.0.1:3000
```

### Sign In
- **Email**: testlocal@rento.com
- **Password**: Password@123
- Click **Sign In**

### Verify
- Should redirect to dashboard
- Check browser console (F12) for: `[Supabase] Client initialized successfully`
- Should show "Bookings" page option

---

## STEP 3: Create Customer

### Navigate to Customers
1. In dashboard, find **Customers** section (or similar)
2. Click **Add Customer** or **New Customer**

### Fill Form
- **Name**: John Doe
- **Phone**: 9123456789
- **Email**: john@test.com
- **Address**: 123 Main St
- **ID Type**: Aadhaar (or Driving License)
- **ID Photos**: (Upload test image or skip if optional)

### Verify
- Click **Save** or **Create**
- Should see success message
- Customer should appear in list

### Verify in Studio
1. Go to Studio: http://127.0.0.1:54323
2. Click **Table Editor** → **customers**
3. Verify "John Doe" record exists with user_id filled

---

## STEP 4: Create Vehicle/Bike

### Navigate to Vehicles
1. In dashboard, find **Vehicles** or **Bikes** section
2. Click **Add Vehicle** or **New Bike**

### Fill Form
- **Name**: Test Bike 001
- **Registration Number**: REG12345
- **Type**: Bicycle or Two-wheeler
- **Brand**: Hero/Atlas
- **Model**: HF100
- **Year**: 2023
- **Color**: Red
- **Daily Rate**: 50 (₹50/day)
- **Current Odometer**: 1000

### Verify
- Click **Save**
- Should see success message
- Vehicle should appear in inventory list

### Verify in Studio
1. Go to Studio: http://127.0.0.1:54323
2. Click **Table Editor** → **vehicles**
3. Verify "Test Bike 001" record exists

---

## STEP 5: Create Booking

### Navigate to Bookings
1. In dashboard, find **Bookings** or **New Booking** button
2. Click **Create Booking** or **New Booking**

### Fill Form
- **Customer**: Select "John Doe"
- **Vehicle**: Select "Test Bike 001"
- **Start Date**: Today
- **End Date**: Tomorrow
- **Daily Rate**: Auto-filled (50)
- **Advance Payment**: 500 (advance amount)

### Verify Calculation
- System should calculate: `total_amount = (end_date - start_date) * daily_rate`
- Example: 1 day × 50 = 50 (or adjust based on your formula)

### Create Booking
- Click **Confirm** or **Create Booking**
- Should see: "Booking created successfully"
- Booking should appear in Bookings list with status "Booked" or "Confirmed"

### Verify in Studio
1. Go to Studio
2. Click **Table Editor** → **bookings**
3. Verify booking record exists with:
   - `customer_id` = John Doe's ID
   - `vehicle_ids` contains Test Bike ID
   - `status` = "Confirmed"
   - `total_amount` = calculated value
   - `user_id` = test user's ID (auto-filled)

---

## STEP 6: Record Advance Payment

### In Bookings List
1. Find the booking you just created
2. Click **Record Payment** or **Add Payment**

### Fill Payment Form
- **Amount**: 500
- **Payment Method**: Cash (or Card/UPI)
- **Payment Type**: Advance

### Verify
- Click **Save Payment**
- Should see: "Payment recorded"
- Booking status may change to "Confirmed" or payment status updates

### Verify in Studio
1. Go to Studio
2. Click **Table Editor** → **payments**
3. Verify payment record with:
   - `booking_id` = your booking ID
   - `amount` = 500
   - `payment_type` = "Advance"
   - `user_id` = test user ID

---

## STEP 7: Mark Booking as "Taken"

### In Bookings List
1. Find the booking
2. Click **Mark as Taken** or **Start Rental**

### Fill Form
- **Opening Odometer**: 1000 (or current reading)

### Verify
- Click **Confirm**
- Booking status should change to "Active" or "Taken"
- Bike status should change to "Rented" or "In Use"

### Verify in Studio
1. Go to Studio → **Table Editor** → **bookings**
2. Verify:
   - `status` = "Taken"
   - `opening_odometer` = 1000
   - `taken_at` = timestamp
3. Check **vehicles** table: `status` should be "Rented"

---

## STEP 8: Mark Booking as "Returned"

### In Bookings List
1. Find the active booking
2. Click **Mark as Returned** or **Return Bike**

### Fill Form
- **Closing Odometer**: 1050 (traveled 50 km)
- **Condition**: Good (or Damaged if applicable)
- **Damages**: None (or enter damage amount if any)

### Verify Calculations
- App should calculate: `distance = closing_odometer - opening_odometer = 50 km`
- Deposit refund calculated based on damages
- Final amount due calculated

### Verify
- Click **Confirm**
- Booking status should change to "Completed" or "Returned"
- Bike status should change to "Available"

### Verify in Studio
1. Go to Studio → **Table Editor** → **bookings**
2. Verify:
   - `status` = "Returned"
   - `closing_odometer` = 1050
   - `returned_at` = timestamp
3. Check **vehicles** table: `status` should be "Available"
4. Check **deposits** table: `status` should be "Refunded" (if applicable)

---

## STEP 9: Test Cancel Booking

### Create Another Booking (Repeat Step 5)

### Cancel the Booking
1. In Bookings list
2. Click **Cancel Booking**
3. Reason: "Customer changed mind" (optional)

### Verify
- Click **Confirm Cancel**
- Booking status should change to "Cancelled"
- Bike status should change back to "Available"

### Verify in Studio
1. Go to Studio → **Table Editor** → **bookings**
2. Verify: `status` = "Cancelled", `cancelled_at` = timestamp
3. Check **vehicles**: status back to "Available"

---

## STEP 10: Verify Multi-Tenant Isolation (RLS)

### Check Data Isolation
1. Go to Studio → **SQL Editor**
2. Run this query:

```sql
SELECT * FROM bookings WHERE user_id != auth.uid();
```

3. Should return 0 rows (no cross-user data leakage)

### Run RLS Test
```sql
SELECT 
  (SELECT COUNT(*) FROM bookings) as total_bookings,
  (SELECT COUNT(*) FROM bookings WHERE user_id = auth.uid()) as my_bookings,
  auth.uid() as current_user;
```

Should show: `total_bookings` ≥ `my_bookings`

---

## STEP 11: Test Bootstrap Auto-Create Users

### Create New Auth User in Studio

```sql
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'newuser@test.com',
  crypt('Password@123', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  NOW(),
  NOW()
);
```

### Sign In with New User
1. Sign out from current session
2. Sign in with: newuser@test.com / Password@123

### Verify Bootstrap
1. Go to Studio → **Table Editor** → **users** (public.users)
2. Should see new row auto-created with:
   - `auth_id` = the auth user's ID
   - `name` = extracted from email
   - `role` = "owner"
   - `is_active` = true

---

## COMPLETE TEST CHECKLIST

- [ ] Dev server running on http://127.0.0.1:3000
- [ ] Local Supabase running on http://127.0.0.1:54321
- [ ] Test user created (testlocal@rento.com)
- [ ] Sign in works
- [ ] Customer creation works and persists
- [ ] Vehicle creation works and persists
- [ ] Booking creation works with correct calculations
- [ ] Payment recording works
- [ ] Mark as taken updates statuses and odometer
- [ ] Mark as returned calculates distance and refund
- [ ] Cancel booking changes statuses correctly
- [ ] All data visible in Studio (not in other users)
- [ ] Bootstrap auto-creates users.public row
- [ ] No "user record not found" errors
- [ ] No RLS violations

---

## TROUBLESHOOTING

### "Cannot connect to local Supabase"
- Verify: `supabase status` shows all services running
- Check: http://127.0.0.1:54323 (Studio should load)

### "User record not found"
- Verify bootstrap user module ran (check console in F12)
- Run: `SELECT * FROM users;` in Studio to see if row was created

### "Permission denied" in Studio
- This is expected RLS behavior
- Means your row-level policies are working!

### Data not saving
- Check browser console (F12) for errors
- Verify `.env.local` has LOCAL URL: `http://127.0.0.1:54321`
- Verify anon key in `.env.local` matches Studio output

### Booking amounts wrong
- Check the calculation logic in Bookings.tsx
- Verify daily_rate is set correctly on vehicle
- Check start_date and end_date format

---

## NEXT STEPS

After testing:
1. Document any bugs or issues
2. Fix any data validation issues
3. Optimize UI/UX based on testing
4. Run Phase 0-10 complete cycle
5. Deploy to production when ready

---

**Status**: ✅ Local Supabase fully configured and ready for testing.

