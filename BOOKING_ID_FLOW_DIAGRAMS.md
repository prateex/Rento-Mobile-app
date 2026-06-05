# Booking ID Flow Diagram - Issue Visualization

## Current Problem State

```
┌─────────────────────────────────────────────────────────────┐
│ USER ACTION: Mark Booking as Returned / Generate Invoice    │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend Store: updateBooking() / generateInvoice()         │
│ Sets: status = 'Completed', returned_at = now()            │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ Supabase: UPDATE bookings SET status='Completed' ...       │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
         ⚠️  TRIGGER FIRES  ⚠️
┌─────────────────────────────────────────────────────────────┐
│ Migration: 20260109120000_photo_storage_lifecycle.sql      │
│ Trigger: trigger_update_id_photo_expiry ON bookings       │
│ Function: update_id_photo_expiry()                        │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
      🔴 FUNCTION EXECUTES 🔴
┌─────────────────────────────────────────────────────────────┐
│ UPDATE customer_id_photos                                   │
│ SET expires_at = NEW.returned_at + INTERVAL '7 days',      │
│     updated_at = now()                                      │
│ WHERE booking_id = NEW.id          👈 COLUMN DOESN'T EXIST! │
│   AND deleted_at IS NULL           👈 COLUMN DOESN'T EXIST! │
│   AND expires_at IS NULL;          👈 COLUMN DOESN'T EXIST! │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
         ❌ SILENT FAILURE ❌
         (PostgreSQL updates 0 rows)
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ RESULT: Booking update completes successfully              │
│         BUT photo expiry metadata is NEVER SET             │
│         AND no error is raised to user                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Schema Mismatch Visualization

```
TRIGGER EXPECTS (from 20260109120000):
┌────────────────────────────────────────┐
│ customer_id_photos                     │
├────────────────────────────────────────┤
│ ✅ id                                  │
│ ✅ shop_id                             │
│ ✅ customer_id                         │
│ ❌ booking_id (EXPECTED, NOT PRESENT) │
│ ❌ expires_at (EXPECTED, NOT PRESENT)  │
│ ❌ updated_at (EXPECTED, NOT PRESENT)  │
│ ✅ side                                │
│ ✅ file_path                           │
│ ✅ storage_bucket                      │
│ ✅ created_at                          │
│ ✅ deleted_at                          │
└────────────────────────────────────────┘

ACTUAL SCHEMA (from 20260120_final_photo_and_delete_fix):
┌────────────────────────────────────────┐
│ customer_id_photos                     │
├────────────────────────────────────────┤
│ ✅ id                                  │
│ ✅ shop_id                             │
│ ✅ customer_id                         │
│ ✅ side                                │
│ ✅ file_path                           │
│ ✅ storage_bucket                      │
│ ✅ created_at                          │
│ ✅ deleted_at                          │
└────────────────────────────────────────┘

MISSING COLUMNS:
❌ booking_id
❌ expires_at
❌ updated_at
```

---

## Design Evolution (Why Mismatch Occurred)

```
Timeline:
─────────────────────────────────────────────────────────────

2026-01-09 (Migration 20260109120000):
┌─────────────────────────────────────────────────────────────┐
│ DESIGN v1: Booking-specific photo expiry                   │
│ Idea: Photos expire 7 days after booking completion        │
│ Schema: customer_id_photos.booking_id FK                   │
│ Trigger: update_id_photo_expiry() on bookings UPDATE       │
│ Status: APPLIED ✅                                         │
└─────────────────────────────────────────────────────────────┘

2026-01-20 (Migration 20260120_final_photo_and_delete_fix):
┌─────────────────────────────────────────────────────────────┐
│ DESIGN v2: Simplified customer-centric photos              │
│ Idea: Photos have fixed 7-day lifetime from creation       │
│ Schema: REMOVED booking_id, expires_at, updated_at        │
│ Reason: Photos are customer metadata, not booking-specific │
│ Status: APPLIED ✅                                         │
│                                                             │
│ ⚠️ ISSUE: Migration 20260109120000 trigger NEVER REMOVED  │
│    Result: Orphaned trigger + schema mismatch              │
└─────────────────────────────────────────────────────────────┘

2026-01-21 (This Fix):
┌─────────────────────────────────────────────────────────────┐
│ Migration 20260121000000: Remove obsolete trigger           │
│ Action: DROP trigger, DROP functions                       │
│ Status: PENDING ⏳                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Feature Impact Map

```
AFFECTED FLOWS:
┌──────────────────────────────────────────────────────────────┐
│ 1. Mark Booking as Returned (returnBooking)                 │
│    ├─ Frontend: Updates booking.status → 'Completed'       │
│    ├─ Trigger Fires: trigger_update_id_photo_expiry        │
│    ├─ 🔴 Silent Failure: WHERE booking_id = ... (no column)│
│    └─ ❌ Photo expiry NOT set                              │
├──────────────────────────────────────────────────────────────┤
│ 2. Generate Invoice (generateInvoice)                       │
│    ├─ Frontend: Updates booking.status → 'Completed'       │
│    ├─ Trigger Fires: trigger_update_id_photo_expiry        │
│    ├─ 🔴 Silent Failure: Same as above                    │
│    └─ ❌ Photo expiry NOT set                              │
├──────────────────────────────────────────────────────────────┤
│ 3. Photo Cleanup (cleanup_expired_id_photos)                │
│    ├─ Function: cleanup_expired_id_photos()                │
│    ├─ ✅ Still works (references different columns)        │
│    └─ ✅ No impact from trigger removal                    │
└──────────────────────────────────────────────────────────────┘
```

---

## Migration Dependency Graph

```
Applied Migrations (Chronological):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

20250106000000_initial_schema.sql
    │
    ├─ Creates: customers, bookings, vehicles, etc.
    ├─ Status: ✅ APPLIED
    └─ Columns: bookings.id (PK, NOT booking_id)

20260109120000_photo_storage_lifecycle.sql
    │
    ├─ Creates: calculate_photo_expiry(UUID) FUNCTION
    ├─ Creates: update_id_photo_expiry() FUNCTION
    ├─ Creates: trigger_update_id_photo_expiry TRIGGER
    ├─ Status: ✅ APPLIED
    └─ 🔴 PROBLEM: Expects columns on customer_id_photos that don't exist

20260120_final_photo_and_delete_fix.sql
    │
    ├─ Recreates: customer_id_photos table
    ├─ Schema: Simplified (NO booking_id, expires_at, updated_at)
    ├─ Status: ✅ APPLIED
    └─ ⚠️ ISSUE: Trigger from 20260109120000 never removed!

20260121000000_remove_obsolete_photo_expiry_trigger.sql
    │
    ├─ Drops: trigger_update_id_photo_expiry
    ├─ Drops: update_id_photo_expiry() FUNCTION
    ├─ Drops: calculate_photo_expiry(UUID) FUNCTION
    ├─ Status: ⏳ PENDING (NEW)
    └─ Result: Removes orphaned code, unblocks booking updates
```

---

## Fix Verification Checklist

```
Before Fix:
┌─────────────────────────────────────────────────────────────┐
│ ❌ Trigger exists: trigger_update_id_photo_expiry          │
│ ❌ Function exists: update_id_photo_expiry()               │
│ ❌ Booking updates may fail silently                       │
│ ❌ Photo expiry metadata never set                         │
│ ❌ Non-functional code in production                       │
└─────────────────────────────────────────────────────────────┘

After Fix:
┌─────────────────────────────────────────────────────────────┐
│ ✅ Trigger dropped: trigger_update_id_photo_expiry         │
│ ✅ Function dropped: update_id_photo_expiry()              │
│ ✅ Function dropped: calculate_photo_expiry()              │
│ ✅ Booking updates complete successfully                   │
│ ✅ Photo cleanup still works (separate function)           │
│ ✅ No orphaned code in production                          │
│ ✅ Schema clean and maintainable                           │
└─────────────────────────────────────────────────────────────┘
```

---

## SQL Execution Timeline

### Current State (Before Fix)
```
UPDATE bookings SET status='Completed'
    ↓
TRIGGER EXECUTES: trigger_update_id_photo_expiry
    ↓
FUNCTION EXECUTES: update_id_photo_expiry()
    ↓
UPDATE customer_id_photos WHERE booking_id = ... (FAILS SILENTLY)
    ↓
RETURN NULL (function completes)
    ↓
Booking update succeeds ✅
    BUT photo expiry never set ❌
```

### After Fix (New State)
```
UPDATE bookings SET status='Completed'
    ↓
✅ NO TRIGGER
    ↓
Booking update succeeds ✅
    AND no side effects ✅
    AND cleanup function still handles photo lifecycle ✅
```

---

## Conclusion

The `booking_id` issue on bookings table is actually a **trigger/function problem**, not a schema problem:

| Aspect | Status |
|--------|--------|
| **bookings.id** (PK) | ✅ Correct |
| **bookings table schema** | ✅ Correct |
| **payments.booking_id** (FK) | ✅ Correct |
| **damages.booking_id** (FK) | ✅ Correct |
| **trigger_update_id_photo_expiry** | ❌ Orphaned, non-functional |
| **customer_id_photos.booking_id** | ❌ Doesn't exist, should not |

**Fix:** Remove orphaned trigger and functions. No schema changes needed.
