# 🚀 QUICK START - FIX & TEST

## The Problem
Booking insert fails: `"violates check constraint 'bookings_status_check'"`

## The Solution
One SQL script that removes the blocking constraint and enables all status values.

---

## Execute This Now

```sql
-- Copy everything below and paste into Supabase SQL Editor
-- Then click RUN

-- STEP 1: DROP THE BLOCKING CHECK CONSTRAINT
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

-- STEP 2: CREATE ENUM WITH ALL FRONTEND VALUES
CREATE TYPE booking_status_enum AS ENUM (
  'Booked',
  'Confirmed',
  'Taken',
  'Returned',
  'Cancelled'
);

-- STEP 3: CONVERT COLUMN TO ENUM
ALTER TABLE bookings ALTER COLUMN status TYPE booking_status_enum USING status::booking_status_enum;

-- STEP 4: SET DEFAULT TO MATCH FRONTEND INITIAL VALUE
ALTER TABLE bookings ALTER COLUMN status SET DEFAULT 'Booked'::booking_status_enum;

-- DONE! Verify:
SELECT column_default FROM information_schema.columns 
WHERE table_name = 'bookings' AND column_name = 'status';
-- Should show: 'Booked'::booking_status_enum
```

---

## Test Immediately

1. **Go to bookings page**
   ```
   http://127.0.0.1:3000/bookings
   ```

2. **Click "+ New Booking"**

3. **Fill the form**
   - Pick dates (any dates)
   - Pick customer
   - Pick vehicle

4. **Submit**

5. **Expected Result**
   ✅ Booking created successfully
   ✅ No error message appears
   ✅ Booking shows in list

---

## Verify Success

### In Browser Console (F12)
- No red error messages
- No 400 errors

### In Supabase
```sql
SELECT id, status, payment_status FROM bookings 
ORDER BY created_at DESC LIMIT 1;
```
Should return: `status='Booked'`, `payment_status='Unpaid'`

---

## If It Still Fails

### Error: "constraint still exists"
```sql
-- Force drop:
DO $$
BEGIN
  EXECUTE 'ALTER TABLE bookings DROP CONSTRAINT bookings_status_check';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
```

### Error: "ENUM already exists"
```sql
-- Drop and recreate:
DROP TYPE booking_status_enum CASCADE;
CREATE TYPE booking_status_enum AS ENUM ('Booked', 'Confirmed', 'Taken', 'Returned', 'Cancelled');
ALTER TABLE bookings ALTER COLUMN status TYPE booking_status_enum;
```

---

## Full Script (If You Need Everything)

For complete schema hardening with all triggers and auto-fills, run:

```bash
Supabase SQL Editor → Open
Paste: database_reset/12_remove_status_check.sql
Click "Run"
```

This includes:
- CHECK constraint removal ✅
- ENUM creation ✅
- Column migration ✅
- Triggers (user_id, shop_id) ✅
- Date columns (all 4) ✅
- Auto-generate functions ✅
- Complete verification ✅

---

## Success Criteria

After running SQL + testing:

- ✅ Booking insert works
- ✅ No "violates check constraint" error
- ✅ Booking appears in list
- ✅ Browser console clean
- ✅ Multiple bookings can be created

**If all pass → PRODUCTION READY 🎉**

---

## What Frontend Can Now Send

```javascript
{
  customer_id: "uuid-123",
  vehicle_ids: ["uuid-456"],
  start_date: "2025-01-15T10:00:00Z",
  end_date: "2025-01-20T10:00:00Z",
  start_datetime: "2025-01-15T10:00:00Z",
  end_datetime: "2025-01-20T10:00:00Z",
  status: "Booked",                    // ← Works now!
  payment_status: "Unpaid"
  total_amount: 2500
  // Auto-filled by database:
  // user_id, shop_id
}
```

---

## Questions?

See: `COMPLETE_FIX_SUMMARY.md` for full technical details
See: `STATUS_CHECK_FIX_FINAL.md` for detailed explanation

---

## TL;DR

1. Run SQL (drops CHECK, creates ENUM)
2. Test booking insert (should work now)
3. Done! 🎉
