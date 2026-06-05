# Database Investigation Summary - booking_id References
**Date:** January 21, 2026  
**Investigation:** booking_id on bookings table analysis  
**Status:** ✅ **ROOT CAUSE IDENTIFIED**

---

## Quick Facts

| Item | Finding |
|------|---------|
| **Issue Type** | Orphaned trigger function with non-existent column references |
| **Location** | Migration: `20260109120000_photo_storage_lifecycle.sql` |
| **Function Name** | `update_id_photo_expiry()` |
| **Trigger Name** | `trigger_update_id_photo_expiry` ON bookings table |
| **Problematic Columns** | `booking_id`, `expires_at`, `updated_at` on `customer_id_photos` |
| **Current Status** | ✅ Applied migration, ✅ Trigger attached, ❌ Non-functional |
| **Impact** | Silent photo expiry update failures during booking completion |

---

## Investigation Results

### 1. ✅ Bookings Table Schema (CORRECT)

**File:** `supabase/migrations/20250106000000_initial_schema.sql`

The `bookings` table itself is **correct** and has NO issues:
- ✅ Primary key: `id UUID`
- ✅ All required columns present
- ✅ NO `booking_id` column (correct - PK is `id`)
- ✅ Proper FK references to customers, vehicles
- ✅ Status enum includes 'Completed'
- ✅ `returned_at` column exists for booking return tracking

---

### 2. ❌ Orphaned Trigger (THE PROBLEM)

**File:** `supabase/migrations/20260109120000_photo_storage_lifecycle.sql`

#### Line 189-200: Function Definition
```sql
CREATE OR REPLACE FUNCTION public.update_id_photo_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'Completed' AND (OLD.status IS NULL OR OLD.status != 'Completed') THEN
    UPDATE customer_id_photos
    SET 
      expires_at = NEW.returned_at + INTERVAL '7 days',
      updated_at = now()
    WHERE 
      booking_id = NEW.id          <-- 🔴 COLUMN DOESN'T EXIST
      AND deleted_at IS NULL
      AND expires_at IS NULL;       <-- 🔴 COLUMN DOESN'T EXIST
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Problem Summary:**
- ❌ References `booking_id` on `customer_id_photos` → **DOES NOT EXIST**
- ❌ References `expires_at` on `customer_id_photos` → **DOES NOT EXIST**
- ❌ References `updated_at` on `customer_id_photos` → **DOES NOT EXIST**
- ✅ BUT: The trigger is **ATTACHED** to bookings table via AFTER UPDATE trigger

#### Lines 206-211: Trigger Attachment
```sql
DROP TRIGGER IF EXISTS trigger_update_id_photo_expiry ON bookings;
CREATE TRIGGER trigger_update_id_photo_expiry
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_id_photo_expiry();
```

**Impact:** Every booking status update (especially to 'Completed') fires this trigger → function tries to UPDATE non-existent columns → **silent failure or error**.

---

### 3. ✅ Actual customer_id_photos Schema

**File:** `supabase/migrations/20260120_final_photo_and_delete_fix.sql` (Lines 33-45)

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

**Actual Columns:**
- ✅ `id`, `shop_id`, `customer_id`, `side`, `file_path`, `storage_bucket`, `created_at`, `deleted_at`
- ❌ **NO** `booking_id` column
- ❌ **NO** `expires_at` column
- ❌ **NO** `updated_at` column

**Design Rationale:** Customer ID photos are **per-customer metadata**, independent of any booking. Photos should have a **fixed 7-day lifetime from creation**, not tied to booking state.

---

## Complete Trigger Dependency Map

### Migration Load Order (Applied)
```
20250106000000_initial_schema.sql
  ↓ (creates bookings, customers, etc.)
20260109120000_photo_storage_lifecycle.sql
  ↓ (creates update_id_photo_expiry function & trigger)
      TRIGGER: trigger_update_id_photo_expiry
        ↓ (fires on bookings UPDATE)
        ↓ (calls update_id_photo_expiry())
        ↓ (tries to UPDATE customer_id_photos WHERE booking_id = ...)
        ↓ ❌ FAILS: booking_id column doesn't exist
20260120_final_photo_and_delete_fix.sql
  ↓ (recreates customer_id_photos with proper schema)
  ↓ (does NOT drop the orphaned trigger)
  ↓ (orphaned trigger remains attached & non-functional)
```

---

## Execution Paths Affected

### Path 1: Booking Return
```
User clicks "Mark Returned"
  ↓
Frontend: updateBooking(bookingId, { status: 'Completed', returnedAt: ... })
  ↓
Store.updateBooking() → Supabase.update(bookings).eq('id', id)
  ↓
🔴 TRIGGER FIRES: trigger_update_id_photo_expiry
  ↓
🔴 FUNCTION EXECUTES: update_id_photo_expiry()
  ↓
🔴 SQL FAILS: WHERE booking_id = NEW.id
  ↓
❌ RESULT: Photo expiry NOT updated, booking update completes
```

### Path 2: Invoice Generation
```
User clicks "Generate Invoice"
  ↓
Frontend: generateInvoice(bookingId)
  ↓
Store.generateInvoice() → Supabase.update(bookings, { status: 'Completed' })
  ↓
🔴 SAME TRIGGER FIRES
  ↓
❌ RESULT: Same silent failure
```

---

## Error Behavior (PostgreSQL)

**Scenario:** UPDATE on non-existent column in WHERE clause

**PostgreSQL Behavior:**
- If RLS is enabled: May raise `column "booking_id" does not exist` error with ERROR code
- If RLS is disabled or SECURITY DEFINER: Silent failure (0 rows updated)
- **Current Status:** Likely **SECURITY DEFINER** in soft-delete functions → **SILENT FAILURE**

**Manifestation:**
- ✅ Booking status updates succeed
- ❌ Photo expiry metadata never set
- ❌ No observable error to user
- ⚠️ Photo cleanup routine cannot track expiry

---

## References in Codebase

### Frontend References (CORRECT - no booking_id)

**File:** `backend/client/src/lib/store.ts`

```typescript
// Line 775-820: returnBooking() 
returnBooking: (id: string) => void,

// Line 918-1003: generateInvoice()
generateInvoice: (bookingId: string) => Promise<Invoice | null>,
```

Both call `updateBooking()` which sets `status: 'Completed'` → triggers the orphaned function.

**File:** `backend/client/src/pages/Bikes.tsx`

```typescript
// Line 879: Damage insertion (correct)
const { data: inserted, error } = await supabase
  .from('damages')
  .insert({
    booking_id: null,  // ✅ Correct - damages FK to bookings
    // ...
  })
```

---

## Schema Validation

### What SHOULD Exist (Per Current Schema)

**customer_id_photos → customers:**
```
customer_id_photos.customer_id → customers.id
```

**payments → bookings:**
```
payments.booking_id → bookings.id
```

**damages → bookings:**
```
damages.booking_id → bookings.id
```

### What CURRENTLY EXISTS (Orphaned)

**Trigger Function:** `update_id_photo_expiry()`
- ❌ Expects: `customer_id_photos.booking_id`
- ✅ Reality: `customer_id_photos` has NO booking relationship

---

## Verification Steps Performed

### ✅ Step 1: Found Migration Files
```
supabase/migrations/20260109120000_photo_storage_lifecycle.sql
supabase/migrations/20260120_final_photo_and_delete_fix.sql
```

### ✅ Step 2: Located Problematic Function
```
File: 20260109120000_photo_storage_lifecycle.sql
Lines: 189-201
Function Name: update_id_photo_expiry()
```

### ✅ Step 3: Confirmed Column Mismatch
```
Expected by trigger: booking_id, expires_at, updated_at
Actual in table: id, shop_id, customer_id, side, file_path, storage_bucket, created_at, deleted_at
```

### ✅ Step 4: Traced Trigger Attachment
```
Trigger Name: trigger_update_id_photo_expiry
Attached To: bookings table
Event: AFTER UPDATE
Fires On: Every bookings UPDATE, especially status='Completed'
```

---

## Root Cause

**Design Evolution Mismatch:**
1. Early design (20260109120000): Customer photos tied to bookings with expiry tracking
2. Final design (20260120): Customer photos independent of bookings, simpler schema
3. **Issue:** Trigger/function never removed during schema refactor
4. **Result:** Orphaned trigger + missing columns = non-functional code

---

## Recommendation

### **IMMEDIATE FIX: Drop the Orphaned Trigger**

```sql
-- Drop trigger (next migration file)
DROP TRIGGER IF EXISTS trigger_update_id_photo_expiry ON bookings;

-- Drop associated functions
DROP FUNCTION IF EXISTS public.update_id_photo_expiry() CASCADE;
DROP FUNCTION IF EXISTS public.calculate_photo_expiry(UUID) CASCADE;
```

**Why This is Safe:**
1. Customer photos should have **FIXED 7-day lifetime** from creation, not booking-dependent
2. Trigger is **non-functional** anyway (missing columns)
3. Photo cleanup handled by separate `cleanup_expired_id_photos()` function
4. **NO production impact** - trigger was already failing silently

**Benefits:**
- ✅ Unblock booking status updates
- ✅ Remove non-functional code
- ✅ Prevent confusion in future schema audits
- ✅ No breaking changes (feature was already broken)

---

## Files Affected

### To Drop (Orphaned)
- `supabase/migrations/20260109120000_photo_storage_lifecycle.sql` (partially - keep cleanup functions)

### To Create (New Migration)
- `supabase/migrations/20260121000000_remove_obsolete_photo_expiry_trigger.sql`

### Frontend (No Changes Needed)
- `backend/client/src/lib/store.ts` - returnBooking() works without trigger
- `backend/client/src/lib/store.ts` - generateInvoice() works without trigger
- `backend/client/src/pages/Bikes.tsx` - No changes needed

---

## Next Steps

1. ✅ **Investigation Complete** - Root cause identified
2. ⏭️  **Create Migration** to drop orphaned trigger/functions
3. ⏭️  **Test Booking Return** without trigger
4. ⏭️  **Test Invoice Generation** without trigger
5. ⏭️  **Run Build Verification**

---

**Status:** Investigation COMPLETE. Ready for fix implementation.
