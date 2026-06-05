# QUICK REFERENCE - shop_id FIX

## TL;DR

**Problem**: Frontend inserts didn't pass `shop_id`, causing trigger failures.  
**Solution**: Explicit `shop_id` in every insert payload, validated by backend.  
**Result**: ✅ All inserts succeed, `customer_number` generates correctly.

---

## What Changed

### Frontend: Always Get shop_id Before Insert

```typescript
// ALWAYS do this first:
const { uid, shopId, userId } = await getAuthContext();

// Then include in payload:
const payload = {
  shop_id: shopId,  // ← CRITICAL: Must be explicit
  full_name,
  phone,
  ...
};

// Then insert:
await supabase.from('customers').insert(payload);
```

### Backend: Validate shop_id Presence

```typescript
// Backend now validates:
if (!customerData.shop_id) {
  return res.status(400).json({ error: 'shop_id is required' });
}

// Returns HTTP 400 if missing (fail fast)
```

---

## Files to Deploy

| File | Status | Reason |
|------|--------|--------|
| `backend/client/src/lib/shopIdHelper.ts` | ✨ NEW | Centralized helper |
| `backend/client/src/pages/Customers.tsx` | ✏️ MODIFIED | Uses `getAuthContext()` |
| `backend/client/src/pages/Bikes.tsx` | ✏️ MODIFIED | Uses `getAuthContext()` |
| `backend/client/src/pages/Bookings.tsx` | ✏️ MODIFIED | Uses centralized helper |
| `backend/server/routes.ts` | ✏️ MODIFIED | Validates `shop_id` in requests |

---

## How to Verify

### ✅ Quick Test
```bash
1. Add customer → Should NOT see "shop_id cannot be null"
2. Check list → Customer appears with customer_number (e.g., CUST001)
3. Add vehicle → Vehicle created successfully
4. Create booking → Booking saves with payment
5. Reload page → All data persists
```

### ❌ If It Fails
```
Error: "shop_id cannot be null"
→ Frontend not calling getAuthContext()
→ Check payload includes shop_id

Error: "shop_id is required in payload" (HTTP 400)
→ Backend validation working
→ Frontend must fix payload

Error: customer_number not generated
→ Trigger executed but shop_id wasn't in NEW row
→ Verify insert payload has shop_id
```

---

## Key Points

| Point | Why |
|-------|-----|
| **Use `getAuthContext()`** | Gets shop_id from users table (source of truth) |
| **shop_id is EXPLICIT** | Database trigger requires it to generate customer_number |
| **No Default in Database** | Schema is finalized, can't change |
| **Backend Validates** | Returns HTTP 400 if shop_id missing (fail fast) |
| **RLS Still Enforces** | User can only insert into their own shop |

---

## Code Pattern

### Before (Wrong)
```typescript
// Frontend
const payload = { full_name, phone };  // ❌ No shop_id
await supabase.from('customers').insert(payload);  // Fails!
```

### After (Correct)
```typescript
// Frontend
const { shopId } = await getAuthContext();  // Get shop_id
const payload = { shop_id: shopId, full_name, phone };  // ✅ Explicit
await supabase.from('customers').insert(payload);  // Works!
```

---

## API Endpoints Updated

All POST endpoints now require `shop_id`:
- ✅ `POST /api/customers` — Creates customer with sequential number
- ✅ `POST /api/vehicles` — Creates vehicle in shop
- ✅ `POST /api/bookings` — Creates booking with shop isolation
- ✅ `POST /api/payments` — Records payment with shop context
- ✅ `POST /api/deposits` — Saves deposit with shop context
- ✅ `POST /api/damages` — Records damage report with shop context

---

## Deployment Order

1. **Backend First** (`routes.ts`)
   - Validates incoming requests
   - Returns HTTP 400 if shop_id missing
   - Prevents bad data from reaching database

2. **Then Frontend** (Customers.tsx, Bikes.tsx, Bookings.tsx, shopIdHelper.ts)
   - Always calls `getAuthContext()` before insert
   - Builds payload with explicit shop_id
   - Won't get HTTP 400 responses

---

## Monitoring

After deployment, watch for:

### ✅ Good Signs
- Customer inserts succeed
- customer_number appears automatically (CUST001, CUST002, ...)
- No "shop_id cannot be null" errors in logs
- All CRUD operations work

### ⚠️ Red Flags
- "shop_id cannot be null" errors
- "shop_id is required in payload" (HTTP 400)
- customer_number not generating
- Data loss or corruption

---

## Related Docs

- [SHOP_ID_FIX_COMPLETE.md](SHOP_ID_FIX_COMPLETE.md) — Full implementation details
- [SHOP_ID_FIX_DETAILED_CHANGES.md](SHOP_ID_FIX_DETAILED_CHANGES.md) — Line-by-line changes

---

**Ready for production deployment** ✅
