# DETAILED CHANGE LOG - shop_id FIX

## File-by-File Changes

### 1. ✨ NEW FILE: `backend/client/src/lib/shopIdHelper.ts`

**Purpose**: Centralized shop_id resolution for all frontend inserts

**Key Functions**:
- `getCurrentShopId()` — Get shop_id from authenticated user
- `getAuthContext()` — Get uid, shopId, and userId together

**Why Important**: Eliminates duplicate code for fetching shop_id from users table

---

### 2. `backend/client/src/pages/Customers.tsx`

**Line 20**: Added import
```typescript
import { getAuthContext } from "@/lib/shopIdHelper";
```

**Lines 119-131**: Replaced manual shop_id lookup with centralized helper
```typescript
// BEFORE:
// const { data: shops, error: shopError } = await supabase
//   .from('rental_shops').select('id').limit(1);
// const shopId = shops && shops.length > 0 ? shops[0].id : null;

// AFTER:
const { uid, shopId } = await getAuthContext();
```

**Line 138**: Added shop_id to insert payload
```typescript
const payload = {
  shop_id: shopId,  // ← ADDED (was missing before)
  full_name: formData.name,
  phone: formData.phone,
  ...
};
```

**Error Handling**: Catch block at line 175 handles `getAuthContext()` errors

---

### 3. `backend/client/src/pages/Bikes.tsx`

**Line 24**: Added import
```typescript
import { getAuthContext } from "@/lib/shopIdHelper";
```

**Lines 313-319**: Replaced manual shop_id lookup + validation
```typescript
// BEFORE:
// const { data: sessionData } = await supabase.auth.getSession();
// const uid = sessionData.session?.user?.id;
// const { data: shops, error: shopErr } = await supabase
//   .from('rental_shops').select('id').eq('owner_id', uid).limit(1);

// AFTER:
const { uid, shopId } = await getAuthContext();
```

**Line 326**: Added shop_id to insert payload
```typescript
const payload = {
  shop_id: shopId,  // ← ADDED (was missing before)
  registration_number: bikeData.regNo,
  type: bikeData.type || 'bike',
  ...
};
```

---

### 4. `backend/client/src/pages/Bookings.tsx`

**Line 11**: Added import
```typescript
import { getAuthContext as getCentralizedAuthContext } from "@/lib/shopIdHelper";
```

**Line 119**: Replaced local getAuthContext with centralized version
```typescript
// REMOVED: Local getAuthContext() function (lines 118-161)
// ADDED: One-liner that uses centralized version
const getAuthContext = getCentralizedAuthContext;
```

**Status**: Booking and payment inserts already had `shop_id` explicit ✅

---

### 5. `backend/server/routes.ts`

#### Change 1: Updated `stripOwnershipFields()` function (Lines 8-15)

**BEFORE**:
```typescript
function stripOwnershipFields<T extends Record<string, any>>(data: T): T {
  // Never accept user_id or shop_id from client input
  // DB triggers will set user_id = auth.uid() and RLS enforces access
  const { user_id, shop_id, ...rest } = data || ({} as T);
  return rest as T;
}
```

**AFTER**:
```typescript
function stripOwnershipFields<T extends Record<string, any>>(data: T): T {
  // Strip ONLY user_id from payloads; ALLOW shop_id (frontend must provide it explicitly)
  // shop_id is REQUIRED for customer_number trigger
  // DB RLS enforces that user can only insert into their own shop
  const { user_id, ...rest } = data || ({} as T);
  return rest as T;
}
```

**Rationale**: `shop_id` is needed by trigger, so must be allowed in requests

#### Change 2: Updated `/api/customers` endpoint (Lines 732-757)

**ADDED**:
```typescript
// CRITICAL: shop_id MUST be explicitly provided by frontend
// The customer_number trigger REQUIRES shop_id to generate sequential numbers
if (!customerData.shop_id) {
  return res.status(400).json({ error: 'shop_id is required in payload' });
}
```

#### Change 3: Updated `/api/vehicles` endpoint (Lines 591-616)

**ADDED**:
```typescript
if (!vehicleData.shop_id) {
  return res.status(400).json({ error: 'shop_id is required in payload' });
}
```

#### Change 4: Updated `/api/bookings` endpoint (Lines 400-427)

**ADDED**:
```typescript
if (!bookingData.shop_id) {
  return res.status(400).json({ error: 'shop_id is required in payload' });
}
```

#### Change 5: Updated `/api/payments` endpoint (Lines 898-923)

**ADDED**:
```typescript
if (!paymentData.shop_id) {
  return res.status(400).json({ error: 'shop_id is required in payload' });
}
```

#### Change 6: Updated `/api/deposits` endpoint (Lines 945-970)

**ADDED**:
```typescript
if (!depositData.shop_id) {
  return res.status(400).json({ error: 'shop_id is required in payload' });
}
```

#### Change 7: Updated `/api/damages` endpoint (Lines 1025-1050)

**ADDED**:
```typescript
if (!damageData.shop_id) {
  return res.status(400).json({ error: 'shop_id is required in payload' });
}
```

---

## Summary of Changes

| Category | Count | Details |
|----------|-------|---------|
| **New Files** | 1 | shopIdHelper.ts (centralized helper) |
| **Imports Added** | 3 | Customers.tsx, Bikes.tsx, Bookings.tsx |
| **Shop ID Logic Replaced** | 2 | Customers.tsx, Bikes.tsx |
| **Payloads Updated** | 2 | Added `shop_id` to: Customers, Bikes |
| **Backend Functions** | 1 | stripOwnershipFields() updated |
| **API Endpoints Enhanced** | 6 | All POST endpoints now validate `shop_id` |

---

## Key Principles Applied

1. ✅ **Explicit is better than implicit**
   - shop_id is explicitly passed in every insert
   - No reliance on triggers to provide it

2. ✅ **Single Responsibility**
   - shopIdHelper.ts handles all shop_id lookup logic
   - Eliminates duplication across components

3. ✅ **Fail Fast**
   - Backend validates shop_id presence immediately
   - Returns HTTP 400 if missing, not a database error

4. ✅ **Source of Truth**
   - shop_id always comes from authenticated user's users table record
   - Never from auth metadata or inferred values

5. ✅ **No Database Changes**
   - No migrations needed
   - No trigger modifications
   - No schema changes

---

## Testing the Changes

### Unit Test: Verify shopIdHelper Works
```typescript
import { getAuthContext } from '@/lib/shopIdHelper';

const { uid, shopId, userId } = await getAuthContext();
console.assert(shopId, 'shopId should be present');
```

### Integration Test: Add Customer Flow
```typescript
// 1. Frontend calls getAuthContext()
const { shopId } = await getAuthContext();

// 2. Frontend includes shop_id in payload
const payload = { shop_id: shopId, full_name: '...' };

// 3. Backend validates
// POST /api/customers
// Returns HTTP 400 if shop_id missing
// Returns HTTP 201 if valid

// 4. Database trigger generates customer_number
// SELECT customer_number FROM customers WHERE id = ...
// Should show: CUST001, CUST002, etc.
```

### End-to-End: Booking Flow
```
1. User logs in → getAuthContext() called → shop_id set
2. Create customer → shop_id explicit → customer_number auto-generated
3. Add vehicle → shop_id explicit → vehicle created
4. Create booking → shop_id explicit → booking saved
5. Record payment → shop_id explicit → payment recorded
6. Reload page → All data persists correctly
```

---

## No Breaking Changes

✅ Existing database schemas unmodified  
✅ RLS policies unchanged  
✅ Trigger logic unchanged  
✅ Auth flow unchanged  
✅ API response formats unchanged  

---

## Deployment Checklist

- [ ] Merge shopIdHelper.ts
- [ ] Deploy frontend (Customers.tsx, Bikes.tsx, Bookings.tsx + helper)
- [ ] Deploy backend (routes.ts)
- [ ] Clear browser cache
- [ ] Run smoke tests (add customer, vehicle, booking, payment)
- [ ] Monitor logs for any "shop_id" errors
- [ ] Verify customer_number generation
- [ ] Confirm no data loss/corruption

---

**All changes implement EXPLICIT shop_id on inserts as specified in requirements.**
