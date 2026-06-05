# DELETE FIX - VISUAL FLOW DIAGRAM

## 🔴 BEFORE FIX (BROKEN)

```
User clicks "Delete Customer"
         ↓
Frontend: store.deleteCustomer(id)
         ↓
Supabase: .from('customers').delete().eq('id', id)
         ↓
RLS Policy: "Cannot UPDATE row where deleted_at IS NULL"
         ↓
❌ DELETE BLOCKED
         ↓
Frontend: Removes from local state (UI update)
         ↓
User sees: "Customer Deleted" toast ✓
         ↓
Database: Customer still exists! ❌
         ↓
User refreshes page
         ↓
Customer reappears ❌
         ↓
😡 User confused, data integrity broken
```

---

## 🟢 AFTER FIX (WORKING)

```
User clicks "Delete Customer"
         ↓
Frontend: store.deleteCustomer(id)
         ↓
Supabase: .from('customers')
          .update({ deleted_at: now() })
          .eq('id', id)
         ↓
RLS Policy: ✅ "User owns this shop? → ALLOW UPDATE"
         ↓
Database: Sets deleted_at = '2026-01-14 10:30:00' ✓
         ↓
Trigger: Cascade soft-delete to child records ✓
         ↓
Frontend: Removes from local state (UI update)
         ↓
User sees: "Customer Deleted" toast ✓
         ↓
User refreshes page
         ↓
SELECT WHERE deleted_at IS NULL
         ↓
Customer does NOT appear ✓
         ↓
😊 User happy, data integrity maintained
```

---

## 🔒 RLS POLICY CHANGES

### BEFORE (BROKEN)
```sql
┌─────────────────────────────────────────────────┐
│ UPDATE Policy (customers_update_active)         │
├─────────────────────────────────────────────────┤
│ USING:                                          │
│   deleted_at IS NULL ❌ ← BLOCKS SOFT DELETE   │
│   AND shop_id = user_shop                       │
│                                                  │
│ WITH CHECK:                                     │
│   shop_id = user_shop                           │
└─────────────────────────────────────────────────┘

Problem: Cannot UPDATE row to SET deleted_at 
because USING requires deleted_at IS NULL
```

### AFTER (FIXED)
```sql
┌─────────────────────────────────────────────────┐
│ UPDATE Policy (customers_update_active)         │
├─────────────────────────────────────────────────┤
│ USING:                                          │
│   shop_id = user_shop ✅ ← ALLOWS SOFT DELETE  │
│                                                  │
│ WITH CHECK:                                     │
│   shop_id = user_shop ✅ ← PREVENTS HIJACKING  │
└─────────────────────────────────────────────────┘

Solution: Can UPDATE any row in user's shop,
including setting deleted_at
```

---

## 📊 DATA FLOW

### DELETE CUSTOMER (with photos and bookings)

```
DELETE CUSTOMER #123
        ↓
    ┌───────────────────┐
    │ customers         │
    │ deleted_at = NOW  │ ← Soft delete
    └───────────────────┘
            ↓
    [Trigger Fires]
            ↓
    ┌───────────────────┐
    │ customer_id_photos│
    │ deleted_at = NOW  │ ← Cascade soft delete
    └───────────────────┘

Note: Bookings are NOT deleted
(Business rule: Cannot delete customer with bookings)
```

### DELETE BOOKING (with payments)

```
DELETE BOOKING #456
        ↓
    ┌───────────────────┐
    │ bookings          │
    │ deleted_at = NOW  │ ← Soft delete
    └───────────────────┘
            ↓
    [Trigger Fires]
            ↓
    ┌───────────────────┐
    │ payments          │
    │ deleted_at = NOW  │ ← Cascade soft delete
    └───────────────────┘
            ↓
    ┌───────────────────┐
    │ booking_payments  │
    │ deleted_at = NOW  │ ← Cascade soft delete (if exists)
    └───────────────────┘
```

### DELETE VEHICLE (with damage photos)

```
DELETE VEHICLE #789
        ↓
    ┌───────────────────┐
    │ vehicles          │
    │ deleted_at = NOW  │ ← Soft delete
    └───────────────────┘
            ↓
    [Trigger Fires]
            ↓
    ┌───────────────────────────┐
    │ vehicle_damage_photos     │
    │ deleted_at = NOW          │ ← Cascade soft delete
    └───────────────────────────┘
```

---

## 🔍 SELECT QUERIES (How deleted records are filtered)

### Before Delete
```sql
SELECT * FROM customers 
WHERE shop_id = 'shop-123' 
  AND deleted_at IS NULL
  
Result: [Customer A, Customer B, Customer C]
```

### After Delete (Customer B)
```sql
SELECT * FROM customers 
WHERE shop_id = 'shop-123' 
  AND deleted_at IS NULL
  
Result: [Customer A, Customer C]

-- Customer B still exists but hidden:
SELECT * FROM customers WHERE id = 'customer-B'
Result: { id: 'B', deleted_at: '2026-01-14 10:30:00' }
```

---

## 🎨 UI INTERACTION FLOW

### User Deletes Customer

```
┌──────────────────────────────────────────────────┐
│  Customers Page                                   │
│  ┌────────────────────────────────────────────┐  │
│  │ Customer A              [Edit] [Delete]    │  │
│  │ Customer B              [Edit] [Delete] ←─┼──┼─ User clicks
│  │ Customer C              [Edit] [Delete]    │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
                    ↓
        ┌──────────────────────┐
        │ Confirm Delete?      │
        │ [Cancel]  [Delete]   │
        └──────────────────────┘
                    ↓
          DELETE API Call
                    ↓
        Database: deleted_at set
                    ↓
        ┌──────────────────────┐
        │ ✅ Customer Deleted  │
        └──────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│  Customers Page (Updated)                        │
│  ┌────────────────────────────────────────────┐  │
│  │ Customer A              [Edit] [Delete]    │  │
│  │ Customer C              [Edit] [Delete]    │  │ ← Customer B gone
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

---

## 🧪 TEST SCENARIOS

### Scenario 1: Delete Customer (Happy Path)
```
Given: Customer with NO bookings
When: User clicks delete
Then: 
  ✅ Database: deleted_at set
  ✅ UI: Customer removed immediately
  ✅ After refresh: Customer still gone
  ✅ Other customers: Unaffected
```

### Scenario 2: Delete Customer (With Bookings)
```
Given: Customer with 2 active bookings
When: User clicks delete
Then:
  ❌ Error: "Customer has 2 booking(s)"
  ✅ Customer: Still visible
  ✅ Bookings: Still active
  
Note: This is BY DESIGN (business rule)
```

### Scenario 3: Delete Vehicle (No Corruption)
```
Given: 
  - Customer A exists
  - Vehicle X exists
When: User deletes Vehicle X
Then:
  ✅ Vehicle X: deleted_at set
  ✅ Customer A: UNAFFECTED (no corruption)
  ✅ Other vehicles: UNAFFECTED
  
Before fix: ❌ Customer A would disappear!
```

### Scenario 4: Vehicle Loading
```
Given: App just opened
When: Navigate to Vehicles page
Then:
  ✅ Vehicles load immediately
  ✅ All vehicles visible
  ✅ No need to logout/login
  
Before fix: ❌ Vehicles missing until logout/login
```

---

## 📐 BOOKING SEARCH BAR LAYOUT

### Before (BROKEN)
```
Desktop View (1024px+):
┌──────────────────────────────────────────────────────────┐
│  Bookings                                                 │
│  ┌────────────────────────────────────────────┐ [🔍][⚙️]│
│  │ Search by booking ID, name, phone...       │          │→ [➕] (pushed off-screen)
│  └────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────┘
     ↑ Too wide (16rem = 256px)
```

### After (FIXED)
```
Desktop View (1024px+):
┌──────────────────────────────────────────────────────────┐
│  Bookings                                                 │
│  ┌──────────────────────────┐ [🔍][⚙️][➕]              │
│  │ Search booking...        │                            │
│  └──────────────────────────┘                            │
└──────────────────────────────────────────────────────────┘
     ↑ Optimized (12rem = 192px)
     
All controls fit in one row ✅
```

---

## 🔐 SECURITY BOUNDARIES

```
┌─────────────────────────────────────────────────────────┐
│                    SHOP A (user1)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Customer 1   │  │ Customer 2   │  │ Customer 3   │  │
│  │ deleted_at:  │  │ deleted_at:  │  │ deleted_at:  │  │
│  │ NULL         │  │ 2026-01-14   │  │ NULL         │  │
│  │ (visible)    │  │ (hidden)     │  │ (visible)    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                         ↕ RLS Isolation
┌─────────────────────────────────────────────────────────┐
│                    SHOP B (user2)                        │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │ Customer 4   │  │ Customer 5   │                     │
│  │ deleted_at:  │  │ deleted_at:  │                     │
│  │ NULL         │  │ NULL         │                     │
│  │ (visible)    │  │ (visible)    │                     │
│  └──────────────┘  └──────────────┘                     │
└─────────────────────────────────────────────────────────┘

✅ user1 cannot see or modify Shop B data
✅ user2 cannot see or modify Shop A data
✅ Soft-deleted records hidden from both
✅ RLS enforced at database level
```

---

## 🎯 KEY TAKEAWAYS

1. **Soft Delete = Better Data Integrity**
   - Records marked as deleted, not removed
   - Audit trail preserved
   - Can be recovered if needed

2. **RLS Must Allow Soft Delete**
   - UPDATE policies need `shop_id` check only
   - No `deleted_at IS NULL` in USING clause
   - SELECT policies filter deleted records

3. **Cascade Deletes via Triggers**
   - Automatically handle child records
   - Maintains referential integrity
   - No orphaned data

4. **UI Must Match Database**
   - SELECT filters deleted_at IS NULL
   - UPDATE sets deleted_at = now()
   - Local state updated after DB confirms

5. **Security Through RLS**
   - Shop isolation at database level
   - Cannot bypass via API manipulation
   - Defense in depth

---

**Last Updated:** January 14, 2026  
**For:** Delete Fix Implementation
