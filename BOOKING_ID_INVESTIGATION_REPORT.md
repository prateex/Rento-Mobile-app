# Booking ID Investigation Report
**Date:** January 21, 2026  
**Status:** 🔴 **CRITICAL ISSUE FOUND**

---

## Executive Summary

A **database trigger function** and **SQL migration** reference `booking_id` on the `customer_id_photos` table, which **does not exist** in the current schema. This causes:
- ❌ Photo expiry updates to fail silently during booking return
- ❌ Invoice generation to fail when trying to update photo expiry
- ❌ Potential SQL errors on any booking status update to 'Completed'

---

## Root Cause Analysis

### 1. The Problematic Trigger Function

**File:** [`supabase/migrations/20260109120000_photo_storage_lifecycle.sql`](supabase/migrations/20260109120000_photo_storage_lifecycle.sql#L175-L201)

**Lines 189-200:**
```sql
CREATE OR REPLACE FUNCTION public.update_id_photo_expiry()
RETURNS TRIGGER AS $$
BEGIN
  -- Only when booking is marked as completed
  IF NEW.status = 'Completed' AND (OLD.status IS NULL OR OLD.status != 'Completed') THEN
    UPDATE customer_id_photos
    SET 
      expires_at = NEW.returned_at + INTERVAL '7 days',
      updated_at = now()
    WHERE 
      booking_id = NEW.id          <-- 🔴 PROBLEM: booking_id column does NOT exist
      AND deleted_at IS NULL
      AND expires_at IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Lines 206-211:** Trigger attached to bookings table:
```sql
DROP TRIGGER IF EXISTS trigger_update_id_photo_expiry ON bookings;
CREATE TRIGGER trigger_update_id_photo_expiry
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_id_photo_expiry();
```

---

### 2. Actual customer_id_photos Schema

**File:** [`supabase/migrations/20260120_final_photo_and_delete_fix.sql`](supabase/migrations/20260120_final_photo_and_delete_fix.sql#L33-L45)

**Lines 33-45:** Current schema definition:
```sql
CREATE TABLE public.customer_id_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.rental_shops(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  side text NOT NULL CHECK (side IN ('front', 'back')),
  file_path text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'customer-ids',
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
```

**Columns:** `id`, `shop_id`, `customer_id`, `side`, `file_path`, `storage_bucket`, `created_at`, `deleted_at`

❌ **Missing columns referenced in trigger:**
- `booking_id` (referenced in WHERE clause)
- `expires_at` (referenced in UPDATE SET and WHERE)
- `updated_at` (referenced in UPDATE SET)

---

## Execution Path (Booking Return / Invoice Generation)

### When Booking is Marked as Completed:
1. ✅ Frontend calls: `updateBooking(id, { status: 'Completed', returnedAt: ... })`
2. ✅ Store → Supabase UPDATE on bookings table
3. 🔴 **TRIGGER FIRES:** `trigger_update_id_photo_expiry`
4. 🔴 **FUNCTION EXECUTES:** `update_id_photo_expiry()`
5. 🔴 **SQL FAILS:** `WHERE booking_id = NEW.id` → column doesn't exist
   - PostgreSQL silently ignores invalid column references in UPDATE WHERE clauses
   - OR it may raise: `"booking_id" does not exist` error
6. ❌ Photo expiry metadata is NEVER set
7. ❌ Photo cleanup routine cannot track expiry

---

## Impact on Features

### Booking Return Flow
**File:** [backend/client/src/lib/store.ts](backend/client/src/lib/store.ts#L775-L820)

```typescript
returnBooking: async (bookingId: string) => {
  // ... calls updateBooking with status='Completed'
  // Trigger fires → update_id_photo_expiry() executes
  // ❌ booking_id column error silently fails
}
```

### Invoice Generation Flow
**File:** [backend/client/src/lib/store.ts](backend/client/src/lib/store.ts#L918-L1003)

```typescript
generateInvoice: async (bookingId: string) => {
  // ... updates booking to status='Completed'
  // Trigger fires → same error
  // ❌ Photo expiry update fails
}
```

---

## Proposed Fix

### Option 1: Drop the Obsolete Trigger (RECOMMENDED)
The `customer_id_photos` table **never had** a booking relationship in the final design.
- Customer photos are PER CUSTOMER, not per booking
- Expiry logic should NOT depend on booking status

**Action:**
```sql
DROP TRIGGER IF EXISTS trigger_update_id_photo_expiry ON bookings;
DROP FUNCTION IF EXISTS public.update_id_photo_expiry() CASCADE;
DROP FUNCTION IF EXISTS public.calculate_photo_expiry(UUID) CASCADE;
```

**Reason:** Customer ID photos have a **fixed 7-day lifetime** from upload, independent of any booking.

### Option 2: Remove References from Trigger (If Expiry is Required)
If expiry tracking is still needed, add missing columns to `customer_id_photos`:

```sql
ALTER TABLE customer_id_photos
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
```

Then update the trigger to match the new schema.

**Reason:** Full alignment between schema and trigger logic.

---

## Current Trigger Status in Database

**Status:** ✅ **EXISTS BUT NON-FUNCTIONAL**

The trigger is defined in the applied migration:
- Migration file: `20260109120000_photo_storage_lifecycle.sql` (APPLIED)
- Function: `update_id_photo_expiry()` (EXISTS)
- Trigger: `trigger_update_id_photo_expiry` (ATTACHED TO bookings table)

But the columns it references **DO NOT EXIST** in `customer_id_photos`, causing **silent failures**.

---

## Verification Queries

### Check if trigger exists:
```sql
SELECT 
  event_object_table,
  trigger_name,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE '%photo_expiry%';
```

### Check customer_id_photos columns:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'customer_id_photos'
ORDER BY ordinal_position;
```

### Check for booking_id on customer_id_photos:
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'customer_id_photos'
  AND column_name IN ('booking_id', 'expires_at', 'updated_at');
-- Should return: NO ROWS (columns don't exist)
```

---

## Recommendation

### **Immediate Action: Drop the Orphaned Trigger**

```sql
DROP TRIGGER IF EXISTS trigger_update_id_photo_expiry ON bookings;
DROP FUNCTION IF EXISTS public.update_id_photo_expiry() CASCADE;
DROP FUNCTION IF EXISTS public.calculate_photo_expiry(UUID) CASCADE;
```

**Reason:**
1. Customer ID photos should have a **fixed lifecycle** (7 days from creation), not booking-dependent
2. The trigger references **non-existent columns**
3. Removing it **unblocks booking status updates**
4. Photo cleanup is handled by a **separate cleanup function** that doesn't depend on bookings

---

## References

- ✅ Final schema (correct): `supabase/migrations/20260120_final_photo_and_delete_fix.sql` (Lines 33-45)
- ❌ Orphaned trigger (problematic): `supabase/migrations/20260109120000_photo_storage_lifecycle.sql` (Lines 189-211)
- 📋 Booking return flow: `backend/client/src/lib/store.ts` (returnBooking, generateInvoice)
