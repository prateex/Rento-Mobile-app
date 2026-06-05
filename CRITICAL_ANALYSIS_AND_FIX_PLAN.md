# CRITICAL ANALYSIS AND FIX PLAN
## Rento App - Full End-to-End Alignment  
**Date:** Jan 19, 2026

---

## EXECUTIVE SUMMARY

The system has CRITICAL SCHEMA/CODE MISALIGNMENT preventing login, role assignment, and all CRUD operations. The latest migration (20260117010000) restores the CORRECT schema, but:

1. **bootstrapUser.ts** - Creates shop but user.role is EXPLICIT (no default) ✓ CORRECT
2. **Bikes.tsx** - Fetches `vehicle_type` but inserts `type` (MISMATCH)
3. **Customers.tsx** - Missing `created_by` handling in insert
4. **Bookings.tsx** - Not setting `created_by` in insert
5. **RLS Policies** - All use `get_my_shop_id()` correctly ✓ NO RECURSION
6. **FK Design** - `created_by REFERENCES auth.users(id)` but app should use this pattern consistently

---

## ROOT CAUSE ANALYSIS

### A) LOGIN FAILURE (RLS BLOCKING SELECT FROM users)

**Status:** ✓ FIXED IN SCHEMA

**Evidence:**
- Migration 20260117010000 creates proper RLS policies
- `users` table policies use `auth_id = auth.uid()` directly (NO recursion)
- `get_my_shop_id()` is SECURITY DEFINER, safe to call

**Remaining Issue:**
- bootstrapUser.ts line 130-145 tries to create shop + user, but doesn't handle race conditions
- If shop creation fails, user creation also fails (should be transactional OR idempotent)

**Fix Required:** None in schema - code is correct. Test with actual login.

---

### B) ROLE ALWAYS SHOWING "staff"

**Status:** ✓ FIXED IN SCHEMA

**Evidence:**
- users.role has NO DEFAULT (migration 20260117010000 line ~270)
- `ALTER TABLE users ALTER COLUMN role DROP DEFAULT;`
- bootstrapUser.ts explicitly sets role: `role: "owner"` on INSERT (line 137)

**Remaining Issue:**
- store.ts `getPermissions()` function MUST respect owner === admin (line ~36)
- Bikes.tsx/Customers.tsx/Bookings.tsx must read role from user object, not hardcode

**Fix Required:** Update store.ts permissions to check `role === 'owner'`

---

### C) INFINITE RLS RECURSION

**Status:** ✓ FIXED IN SCHEMA

**Evidence:**
- Helper function `get_my_shop_id()` uses SECURITY DEFINER (line ~689)
- ALL policies use `get_my_shop_id()` instead of nested SELECT from users
- No policy directly queries users table in WHERE clause

**Fix Required:** None - schema is correct.

---

### D) FK VIOLATIONS (customers_created_by_fkey)

**Status:** ⚠ MISMATCH IN CODE

**Schema Definition:**
```sql
-- Line ~215 in schema
created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
```

**App Usage in Customers.tsx:**
- App reads `user.id` from store (public.users.id)
- But FK expects `auth.uid()` (auth.users.id)

**The Problem:**
- When creating customer: `created_by: user.id` ← WRONG (this is public.users.id)
- Should be: `created_by: authUser.id` ← CORRECT (this is auth.users.id)

**Fix Required:** 
- Update Customers.tsx, Bikes.tsx, Bookings.tsx to capture auth.uid() separately
- OR create trigger to auto-set created_by from auth.uid()
- RECOMMENDED: Use trigger approach (already implemented in schema!)

---

### E) VEHICLE COLUMN MISMATCH (vehicle_type vs type)

**Status:** ⚠ CRITICAL CODE/SCHEMA MISMATCH

**Schema Definition:**
```sql
-- Line ~154
type vehicle_type NOT NULL DEFAULT 'bike'
```

**App in Bikes.tsx:**
- **Line 84:** Fetches `vehicle_type` from DB
- **Line 105:** Tries to read `row.vehicle_type || row.type || 'bike'`
- **Line 106:** Stores in `type: (row.vehicle_type || row.type || 'bike') as any`

**The Problem:**
1. Column name is `type`, NOT `vehicle_type`
2. App tries to fallback to `vehicle_type` if `type` is null (defensive but confusing)
3. Store interface defines `type?: 'bike' | 'car' | 'scooter' | 'ev'`
4. Schema uses ENUM vehicle_type with only `'bike' | 'car'`

**Fix Required:**
- Change Bikes.tsx fetch to: `.select('...type...')` (not vehicle_type)
- Remove fallback to vehicle_type
- Ensure INSERT uses correct column name

---

### F) SCHEMA CACHE ERRORS (PostgREST)

**Status:** ✓ FIXED IN SCHEMA

**Evidence:**
- Migration applies all columns idempotently
- All FKs are created
- All indexes are created

**Fix Required:** Refresh Supabase schema cache if needed: `supabase db push`

---

## CRITICAL CODE ISSUES TO FIX

### Issue 1: Bikes.tsx - Vehicle Type Column

**Current (BROKEN):**
```typescript
// Line 84-109
const { data: rows, error } = await supabase
  .from('vehicles')
  .select('id,name,registration_number,vehicle_type,type,...')
  ↑↑↑ WRONG COLUMN NAME
```

**Fixed:**
```typescript
const { data: rows, error } = await supabase
  .from('vehicles')
  .select('id,name,registration_number,type,brand,model,...')
  // Remove vehicle_type, keep only type
  
// In forEach:
type: (row.type || 'bike') as any,  // Direct, no fallback
```

---

### Issue 2: Customers.tsx - created_by FK

**Current (BROKEN):**
```typescript
// Line ~150
const { data: userData } = await supabase.from('users').select('shop_id').eq('auth_id', uid).single();
const shopId = userData?.shop_id;

const { error } = await supabase
  .from('customers')
  .insert({
    shop_id: shopId,
    full_name: ...,
    // NO created_by set - relies on trigger
  })
  // Trigger will set created_by = auth.uid() ✓ CORRECT
```

**Analysis:** Actually CORRECT - trigger handles it. But verify trigger exists.

---

### Issue 3: Bookings.tsx - created_by FK

**Current (UNCERTAIN):**
```typescript
// Need to check if created_by is being set
// If not, trigger should handle it
```

**Fix Required:** Verify trigger is setting created_by correctly

---

### Issue 4: bootstrapUser.ts - Shop Creation Race Condition

**Current (RISKY):**
```typescript
// Line 127-145
const { data: ownedShops, error: shopErr } = await supabase
  .from("rental_shops")
  .select("id")
  .eq("owner_id", uid)
  .limit(1);

if (!shopErr && ownedShops && ownedShops.length > 0) {
  shopId = ownedShops[0].id;
} else {
  // Create shop
  const { data: newShop, error: createShopErr } = await supabase
    .from("rental_shops")
    .insert({...})
  // ...
}

// Then insert user row
const { data: inserted, error: insertErr } = await supabase
  .from("users")
  .insert({
    shop_id: shopId,
    role: "owner",  // ✓ EXPLICIT
  })
```

**Issues:**
1. If shop creation succeeds but user insert fails → orphaned shop
2. If user fetch succeeds but is_active = false → wrong behavior
3. Should fetch `is_active = true` explicitly

**Fix Required:**
- Fetch user with `is_active = true`
- Make shop creation idempotent (ON CONFLICT would help but create_shop is RPC)

---

## DECISION MATRIX

| Issue | Root Cause | Fix Type | Priority |
|-------|-----------|----------|----------|
| A) Login fails | RLS recursion | Schema ✓ | P0 |
| B) Role "staff" | Missing default, code reads wrong | Schema ✓, Code ⚠ | P0 |
| C) RLS infinite loop | get_my_shop_id() not used | Schema ✓ | P0 |
| D) created_by FK fail | App sets users.id instead of auth.users.id | Code ⚠, Trigger ✓ | P1 |
| E) vehicle_type mismatch | App fetches wrong column | Code ✗ | P0 |
| F) Schema cache stale | PostgREST cache | DevOps | P2 |

---

## FIX PLAN - ORDERED BY PRIORITY

### Phase 1: Schema Validation (LOCAL TESTING ONLY)
1. **Run latest migration:** `supabase db push`
2. **Verify schema:** Check all 14 tables, triggers, policies exist
3. **Check users.role:** Ensure NO DEFAULT

### Phase 2: Frontend Code Fixes

#### Fix 2.1: Bikes.tsx - Vehicle Type Column
- Remove `vehicle_type` from SELECT
- Keep only `type`
- Update INSERT to use `type`, not `vehicle_type`

#### Fix 2.2: Store.ts - Owner Permissions
- Ensure `getPermissions('owner')` returns full permissions
- Compare with `getPermissions('admin')`

#### Fix 2.3: Customers.tsx - Trigger Verification
- Verify `set_customers_created_by()` trigger is attached
- Test: Insert customer, check `created_by` is populated

#### Fix 2.4: Bookings.tsx - Trigger Verification
- Verify `set_bookings_created_by()` trigger is attached
- Test: Insert booking, check `created_by` is populated

#### Fix 2.5: bootstrapUser.ts - Shop + User Creation
- Fetch user with `is_active = true` filter
- Handle shop creation idempotency better

### Phase 3: Admin Page (Dev Helper)
- Create `/admin` page for:
  - Auth user creation
  - Shop creation
  - User row insertion with explicit role
  - Role assignment
  - Verification queries

### Phase 4: End-to-End Test
1. Create auth user (usera@test.com / test@123) via admin page
2. Login → should redirect to Bikes
3. Bikes page → should load (RLS passes)
4. Add vehicle → should succeed (trigger sets created_by)
5. Add customer → should succeed (trigger sets created_by)
6. Add booking → should succeed (trigger sets created_by, auto-numbering works)
7. Verify role shows as "owner" (not staff)
8. Generate invoice → invoice_number should auto-generate

---

## IMPLEMENTATION CHECKLIST

- [ ] Run migration 20260117010000
- [ ] Fix Bikes.tsx vehicle_type → type
- [ ] Fix Store.ts owner permissions
- [ ] Verify triggers in Customers.tsx, Bookings.tsx
- [ ] Fix bootstrapUser.ts shop lookup
- [ ] Create /admin page
- [ ] Test login flow
- [ ] Test vehicle creation
- [ ] Test customer creation
- [ ] Test booking creation + invoice
- [ ] Verify role persistence
- [ ] Verify RLS isolation (access other shop fails)

---

## EXPECTED OUTCOMES

After all fixes:
✓ Login succeeds
✓ User role shows correctly (owner/staff)
✓ Vehicles, customers, bookings can be created
✓ created_by field populated automatically
✓ Booking numbers auto-generate (BK0001)
✓ Invoice numbers auto-generate (INV-25-26-0001)
✓ Customer numbers auto-generate (CUST0001)
✓ RLS prevents cross-shop access
✓ Soft delete works (deleted_at column)
✓ Photo uploads work (customer_id_photos table)
✓ No 500 errors
✓ No recursion errors
✓ No FK violations
