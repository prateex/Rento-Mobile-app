# Architecture & Data Flow Diagram

## System Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                          USER'S BROWSER                            │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │              RENTO APP (React + TypeScript)                  │ │
│  │  http://127.0.0.1:3000                                       │ │
│  │                                                               │ │
│  │  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │ │
│  │  │   Bookings.tsx │  │   Customers    │  │   Vehicles   │  │ │
│  │  │   (Main View)  │  │   Management   │  │  Management  │  │ │
│  │  └────────────────┘  └────────────────┘  └──────────────┘  │ │
│  │         ↓                                                    │ │
│  │  ┌──────────────────────────────────────────────────────┐   │ │
│  │  │  Booking Handlers (All DB-Persisted)               │   │ │
│  │  │  ✅ handleMarkTaken()                              │   │ │
│  │  │  ✅ handleCancelBooking()                          │   │ │
│  │  │  ✅ handleDeleteBooking()                          │   │ │
│  │  │  ✅ handleReturnFlow()                             │   │ │
│  │  │  ✅ createBooking()                                │   │ │
│  │  │  ✅ recordPayment()                                │   │ │
│  │  └──────────────────────────────────────────────────────┘   │ │
│  │         ↓                                                    │ │
│  │  ┌──────────────────────────────────────────────────────┐   │ │
│  │  │  Supabase Client (supabase.ts)                      │   │ │
│  │  │  ✅ Persistent auth session                         │   │ │
│  │  │  ✅ Auto token refresh                              │   │ │
│  │  │  ✅ Error handling                                  │   │ │
│  │  └──────────────────────────────────────────────────────┘   │ │
│  │         ↓                                                    │ │
│  │  ┌──────────────────────────────────────────────────────┐   │ │
│  │  │  Bootstrap Module (bootstrapUser.ts)                │   │ │
│  │  │  ✅ Auto-create users row on SIGNED_IN              │   │ │
│  │  │  ✅ Idempotent (safe to call multiple times)        │   │ │
│  │  │  ✅ Handles "no rows" errors gracefully             │   │ │
│  │  └──────────────────────────────────────────────────────┘   │ │
│  │         ↓                                                    │ │
│  │  ┌──────────────────────────────────────────────────────┐   │ │
│  │  │  Zustand Store (store.ts)                           │   │ │
│  │  │  ✅ Local state cache                               │   │ │
│  │  │  ✅ UI synchronization                              │   │ │
│  │  └──────────────────────────────────────────────────────┘   │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│                     HTTPS Network Request                        │
└────────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────────┐
│                     CLOUD SUPABASE API                            │
│     https://vamxwwgjjfqvwcceedyk.supabase.co                     │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Supabase Auth (Firebase Compatible)                    │  │
│  │  ✅ Email/Password login                                │  │
│  │  ✅ Session management                                  │  │
│  │  ✅ JWT tokens                                          │  │
│  │  ✅ Auto user row creation trigger                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         ↓                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL Database (Port 5432)                        │  │
│  │                                                          │  │
│  │  📊 Schema:                                            │  │
│  │  ├── public.users          (auth_id, shop_id, role)    │  │
│  │  ├── rental_shops          (shop_id, owner_id, name)   │  │
│  │  ├── vehicles              (vehicle_id, shop_id)       │  │
│  │  ├── customers             (customer_id, shop_id)      │  │
│  │  ├── bookings              (booking_id, user_id, ...)  │  │
│  │  ├── payments              (payment_id, booking_id)    │  │
│  │  ├── deposits              (deposit_id, booking_id)    │  │
│  │  └── damages               (damage_id, booking_id)     │  │
│  │                                                          │  │
│  │  🔒 RLS Policies:                                      │  │
│  │  ├── user_id = auth.uid()                              │  │
│  │  ├── shop_id in allowed shops                          │  │
│  │  └── Row Level Security enforced                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         ↓                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Studio (Web UI)                                        │  │
│  │  https://app.supabase.com/project/vamxwwgjjfqvwcceedyk │  │
│  │  ✅ Manual data inspection                              │  │
│  │  ✅ SQL query execution                                 │  │
│  │  ✅ User/role management                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow - Booking Creation

```
User clicks "Create Booking"
          ↓
createBooking() triggered
          ↓
getAuthContext() called
  ├─ Gets auth.uid()
  ├─ Gets shop_id from store
  └─ Auto-creates public.users row if missing
          ↓
INSERT into bookings table
  ├─ status = 'Confirmed' (DB)
  ├─ user_id = auth.uid() (RLS)
  ├─ shop_id = selected shop
  ├─ customer_id
  ├─ vehicle_id
  ├─ start_date
  ├─ end_date
  ├─ total_amount
  └─ created_at = NOW()
          ↓
UPDATE vehicles table
  └─ status = 'Booked' (sync)
          ↓
UPDATE Zustand store
  └─ Add to bookings array
          ↓
UI updates
  └─ Show success message
  └─ Refresh booking list
```

---

## Data Flow - Mark as Taken

```
User clicks "Mark Taken" button
  ├─ Inputs: opening_odometer value
  └─ Booking ID selected
          ↓
handleMarkTaken() called
          ↓
getAuthContext() → Gets user_id + shop_id
          ↓
UPDATE bookings SET
  ├─ status = 'Taken' (DB)
  ├─ opening_odometer = input value
  ├─ taken_at = NOW()
  └─ WHERE id = booking_id
          ↓
UPDATE vehicles SET
  └─ status = 'Active' (sync)
          ↓
UPDATE Zustand store
  └─ Update booking in array
          ↓
UI updates
  └─ Button state changes
  └─ Calendar reflects status
```

---

## Data Flow - Mark as Returned

```
User clicks "Mark Returned" button
  ├─ Inputs: closing_odometer, condition, damages_amount
  └─ Booking ID selected
          ↓
handleReturnFlow() called
          ↓
getAuthContext() → Gets user_id + shop_id
          ↓
START TRANSACTION (atomic)
  ├─ UPDATE bookings
  │   ├─ status = 'Returned'
  │   ├─ closing_odometer = input
  │   ├─ returned_at = NOW()
  │   └─ WHERE id = booking_id
  │
  ├─ UPDATE deposits
  │   └─ status = 'Returned'
  │
  ├─ INSERT damages (if applicable)
  │   ├─ damage_amount = amount
  │   └─ description = user input
  │
  ├─ CALCULATE deposit_refund
  │   ├─ original_deposit - damages_amount
  │   └─ IF > 0 then refund_amount
  │
  ├─ INSERT refund payment
  │   └─ amount = refund_amount
  │
  └─ UPDATE vehicles
      └─ status = 'Available'
          ↓
COMMIT TRANSACTION
          ↓
UPDATE Zustand store
          ↓
UI updates
```

---

## Status Mapping

```
Database Statuses          UI Statuses          Workflow
─────────────────          ───────────          ────────

Confirmed          →       Booked              (after confirmation, before taken)
Taken              →       Confirmed/Active    (actively rented)
Returned           →       Completed           (returned, processing deposit)
Cancelled          →       Cancelled           (booking cancelled)
[Deleted]          →       [Not shown]         (deleted from DB)

Status Transitions:
Confirmed  → Taken     (Mark Taken button)
Taken      → Returned  (Mark Returned button)
Confirmed  → Cancelled (Cancel button)
Any        → Deleted   (Delete button, soft or hard delete)
```

---

## Database Schema (Simplified)

```
┌─────────────────────┐
│   public.users      │
├─────────────────────┤
│ id (PK)            │
│ auth_id (FK)       │──→ auth.users
│ shop_id (FK)       │──→ rental_shops
│ name               │
│ role               │
│ is_active          │
│ created_at         │
│ updated_at         │
└─────────────────────┘
         ↓
┌─────────────────────────────────────┐
│       rental_shops                   │
├─────────────────────────────────────┤
│ id (PK)                              │
│ name, location, owner_id             │
│ created_at, updated_at               │
└─────────────────────────────────────┘
         ↓ ↓
    ┌────────────────┐    ┌──────────────────┐
    │    vehicles    │    │    customers     │
    ├────────────────┤    ├──────────────────┤
    │ id (PK)        │    │ id (PK)          │
    │ shop_id (FK)   │    │ shop_id (FK)     │
    │ user_id (FK)   │    │ user_id (FK)     │
    │ status         │    │ name, email      │
    │ ...specs...    │    │ phone, address   │
    └────────────────┘    └──────────────────┘
            ↓                      ↓
    ┌────────────────────────────────────────┐
    │           bookings                     │
    ├────────────────────────────────────────┤
    │ id (PK)                                │
    │ user_id (FK) → public.users            │
    │ shop_id (FK) → rental_shops            │
    │ vehicle_id (FK) → vehicles             │
    │ customer_id (FK) → customers           │
    │ status (Confirmed/Taken/Returned/...)  │
    │ start_date, end_date                   │
    │ opening_odometer, closing_odometer     │
    │ total_amount, advance_paid             │
    │ taken_at, returned_at, cancelled_at    │
    │ created_at, updated_at                 │
    └────────────────────────────────────────┘
             ↓ ↓ ↓
    ┌──────────────────┐  ┌──────────────┐
    │    payments      │  │   deposits   │
    ├──────────────────┤  ├──────────────┤
    │ id (PK)          │  │ id (PK)      │
    │ booking_id (FK)  │  │ booking_id   │
    │ amount           │  │ status       │
    │ type             │  │ refund_amt   │
    │ created_at       │  │ created_at   │
    └──────────────────┘  └──────────────┘
                                ↓
                        ┌──────────────────┐
                        │    damages       │
                        ├──────────────────┤
                        │ id (PK)          │
                        │ booking_id (FK)  │
                        │ damage_amt       │
                        │ description      │
                        │ created_at       │
                        └──────────────────┘

All tables include:
- user_id (for RLS filtering)
- shop_id (for multi-tenant isolation)
- created_at, updated_at (audit trail)
```

---

## Environment Configuration

```
Development (Local)
───────────────────
.env.local (checked into git for template)
  ├─ VITE_SUPABASE_URL=http://127.0.0.1:54321      (local)
  └─ VITE_SUPABASE_ANON_KEY=local-test-key

Cloud (Your Project)
────────────────────
.env.local (actual values, .gitignored)
  ├─ VITE_SUPABASE_URL=https://vamxwwgjjfqvwcceedyk.supabase.co
  └─ VITE_SUPABASE_ANON_KEY=your-actual-anon-key

.env.cloud (reference only)
  └─ Template with instructions
```

---

## Security Model (RLS - Row Level Security)

```
Database enforces:
  WHERE user_id = auth.uid()
    AND shop_id IN (user's allowed shops)

Examples:

✅ ALLOWED:
SELECT * FROM bookings 
WHERE user_id = 'uuid-123' 
  AND shop_id = 'shop-456'

❌ BLOCKED:
SELECT * FROM bookings 
WHERE user_id = 'uuid-999'  (different user)

❌ BLOCKED:
SELECT * FROM bookings 
WHERE shop_id = 'shop-999'  (different shop)

❌ BLOCKED:
UPDATE bookings 
WHERE user_id != 'uuid-123' (can't modify other users' data)
```

---

## Deployment Checklist

```
Before Going to Production:
  ☐ Cloud Supabase project created ✅
  ☐ Test account exists ✅
  ☐ RLS policies verified ✅
  ☐ Booking handlers implement persistence ✅
  ☐ Bootstrap module auto-creates users ✅
  ☐ Status mapping correct (DB ↔ UI) ✅
  ☐ Multi-tenant isolation enforced ✅
  ☐ Error handling for edge cases ✅
  ☐ Documentation complete ✅
  ☐ 10-phase testing framework ready ✅

Ready to Test:
  ✅ Phase 0: Data reset
  ✅ Phase 1-10: Full booking workflow
  ✅ Spot checks: Verify DB state
  ✅ User isolation: Verify data boundaries
```

---

**This architecture ensures:**
- ✅ Data persistence at every step
- ✅ Multi-tenant safety with RLS
- ✅ Atomic transactions for complex flows
- ✅ User isolation across shops
- ✅ Audit trail (created_at, updated_at)
- ✅ Auto-recovery (bootstrap on login)
