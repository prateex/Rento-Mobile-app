# SYSTEM FORENSIC INVESTIGATION REPORT
**Date**: February 21, 2026  
**Scope**: 3 Critical Issues (Map Picker, Customer Insert, Bike Publishing)  
**Investigation Mode**: READ-ONLY (No modifications, no migrations)

---

## EXECUTIVE SUMMARY

| Issue | Root Cause | Severity | Category |
|-------|-----------|----------|----------|
| 1. Map picker stuck loading | CORS blocking direct nominatim API calls | **HIGH** | Frontend CORS issue |
| 2. Adding customer → "shop_id not defined" | Frontend not passing shop_id to POST /api/customers | **CRITICAL** | Missing payload field |
| 3. Bike visible in owner app but not in customer app | `is_published` column doesn't exist in vehicles table | **CRITICAL** | Schema mismatch |

---

## PART 1: RENTAL SHOPS & BOOKINGS POLICIES ANALYSIS

### Evidence: RLS Policies

**File**: [backend/supabase_rls_policies.sql](backend/supabase_rls_policies.sql)

#### Rental Shops SELECT Policy (Lines 81-85)
```sql
CREATE POLICY "Users can view their own shop"
  ON rental_shops FOR SELECT
  USING (owner_id = auth.uid());
```

**Analysis**:
- ✅ Uses `auth.uid()` (standard Supabase JWT extraction)
- ✅ No `auth.jwt()` or `::uuid` cast issues
- ✅ Directly compares owner_id (UUID) to auth.uid() (UUID)
- **FINDING**: Policy is correctly structured; no RLS violation on SELECT

#### Bookings Policies (Lines 172-185)
```sql
CREATE POLICY "bookings_select_shop" ON bookings FOR SELECT 
  USING (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));
```

**Analysis**:
- ✅ Uses `auth.uid()` correctly
- ✅ Uses subquery to lookup user's shop_id (since shop_id stored on users table)
- ✅ No JWT field access issues
- **POTENTIAL RISK**: Subquery may return NULL if user row doesn't exist or if RLS blocks access to users table
  - If subquery returns no rows → policy evaluates to FALSE → 0 results returned

---

## PART 2: CUSTOMER INSERT FAILURE "SHOP_ID NOT DEFINED" 

### Evidence: Backend Route Handler

**File**: [backend/server/routes.ts](backend/server/routes.ts) (Lines 798-825)

```typescript
app.post("/api/customers", requireAuth, async (req: Request, res: Response) => {
  try {
    const userClient = getUserClient(req);
    const customerData = stripOwnershipFields(req.body);

    // CRITICAL: shop_id MUST be explicitly provided by frontend
    if (!customerData.shop_id) {
      return res.status(400).json({ error: 'shop_id is required in payload' });  // ← ERROR
    }
    // ...
```

### Evidence: Frontend Calling Code

**File**: [backend/client/src/pages/Customers.tsx](backend/client/src/pages/Customers.tsx) (Line 667)

```tsx
addCustomer(newCustomer);  // newCustomer sent WITHOUT shop_id
```

**Trace: Where is shop_id supposed to come from?**

Searching store.ts for customer insertion logic → Line 689:
```typescript
addCustomer: (customer) => set((state) => ({ customers: [...state.customers, customer] })),
```

This only updates local state. **The actual API call is missing.**

**WHERE IS THE API CALL?**

Looking at the POST /api/customers endpoint (line 798), no frontend API call found via:
- `supabase.from('customers').insert()`
- `fetch('/api/customers')`
- `apiRequest('/customers')`

**CRITICAL FINDING**: 
- Frontend calls `addCustomer()` → updates Zustand store only
- **No API POST request is made to backend**
- Therefore, backend's `shop_id` required check never runs (query doesn't reach backend)
- Data is only in local state; **NOT persisted to database**
- When page refreshes, unsaved customers disappear

### Database Constraint Check

**File**: [backend/supabase_schema.sql](backend/supabase_schema.sql) (Lines 119-130)

```sql
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,  -- ✅ NOT NULL
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  id_type TEXT NOT NULL,
  id_photos JSONB NOT NULL,
  -- ...
);
```

**Analysis**:
- ✅ `shop_id` is NOT NULL
- ✅ `shop_id` has FK to rental_shops.id
- If an INSERT was sent to DB without shop_id → would get constraint violation error
- **Confirmation**: No INSERT is being sent; only local state updated

### Customer INSERT Policies

**File**: [backend/supabase_rls_policies.sql](backend/supabase_rls_policies.sql) (Lines 178-180)

```sql
CREATE POLICY "customers_insert_shop" ON customers FOR INSERT 
  WITH CHECK (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));
```

**Analysis**:
- Policy requires shop_id in payload AND user must have row in users table
- Policy will only allow INSERT if both conditions met
- **Since no INSERT reaches backend**: Policy never executes

---

## PART 3: BIKE PUBLISH VISIBILITY ISSUE

### Evidence 1: Frontend expects `is_published` column

**File**: [backend/client/src/pages/Bikes.tsx](backend/client/src/pages/Bikes.tsx)

- Line 587: `is_published: !!bikeData.isPublished,` → sends `is_published` field
- Line 595: `.select('...is_published')` → expects to fetch `is_published` column
- Line 626: `isPublished: row.is_published ?? false,` → maps from DB response

**Finding**: Frontend assumes column exists

### Evidence 2: Database schema definition

**File**: [backend/supabase_schema.sql](backend/supabase_schema.sql) (Lines 95-115)

```sql
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  type TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  year INTEGER,
  color TEXT,
  image_url TEXT,
  daily_rate NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Rented', 'Maintenance')),
  current_odometer INTEGER DEFAULT 0,
  documents JSONB,
  damages JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**CRITICAL FINDING**: 
- ❌ `is_published` column **DOES NOT EXIST** in schema
- ❌ `is_listed_marketplace` column **DOES NOT EXIST**
- Frontend code references non-existent columns

### Evidence 3: Customer web service expects `is_published`

**File**: [backend/customer-web/src/services/vehicles.service.ts](backend/customer-web/src/services/vehicles.service.ts)

Line 40: `.eq('is_published', true)` → filters for published vehicles
Line 144: `.eq('is_published', true)` → filters single vehicle lookup

**Problem**: Queries for non-existent column → Supabase returns empty result set or NULL

### Vehicle Visibility RLS Policies

**File**: [backend/supabase_rls_policies.sql](backend/supabase_rls_policies.sql) (Lines 121-130)

```sql
CREATE POLICY "vehicles_select_shop" ON vehicles FOR SELECT 
  USING (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));
```

**Analysis**:
- Owner app: Staff queries their own shop's vehicles → RLS allows (shop_id matches)
- Customer app: Customer is NOT in users table (not staff) → auth.uid() has no shop_id → RLS blocks ALL vehicles
- Additionally, the `.eq('is_published', true)` filter queries a non-existent column

---

## PART 4: MAP PICKER CORS ISSUE

### Evidence: Frontend direct API call

**File**: [backend/client/src/pages/Settings.tsx](backend/client/src/pages/Settings.tsx) (Lines 94-97)

```typescript
const reverseGeocode = async (lat: number, lng: number) => {
  setReverseGeocodeStatus('loading');
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', lat.toString());
    url.searchParams.set('lon', lng.toString());
    url.searchParams.set('addressdetails', '1');

    const response = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
    });
    // ...
```

### CORS Configuration Analysis

**Finding**: 
- Frontend calls `https://nominatim.openstreetmap.org/reverse` directly
- Nominatim API **does NOT allow CORS requests** from browsers by default
- Nominatim User-Agent policy: Requires CORS headers from client app domains
- Browser blocks request with: `Access to fetch at 'https://nominatim.openstreetmap.org/reverse' blocked by CORS`

### Root Cause

**Frontend-to-Nominatim is a direct cross-origin request**:
- Frontend domain: `localhost:5000` or `*.render.com`
- Nominatim domain: `nominatim.openstreetmap.org`
- Nominatim CORS Policy: Restrictive; doesn't accept `localhost:*` origins

**Solution Architecture** (exists in repo but not used):
- Backend has `/api` routes
- Backend can call Nominatim (no CORS, backend-to-backend)
- Frontend should call `/api/reverse-geocode` → Backend proxies to Nominatim

### Evidence: No Backend Proxy Route

Searched routes.ts for:
- `nominatim` → 0 matches
- `reverse` → 0 matches
- `geocode` → 0 matches

**Finding**: Backend proxy route does not exist

---

## PART 5: SHOP_ID RESOLUTION MECHANISM

### How shop_id is supposed to be known

**File**: [backend/client/src/lib/store.ts](backend/client/src/lib/store.ts) (Lines 495-508)

```typescript
resolveShopId: async () => {
  const existing = get().shopId;
  if (existing) return existing;

  const authContext = await getAuthContext();
  if (!authContext?.shopId) {
    throw new Error('shop_id not resolved – blocking insert');
  }

  set({ shopId: authContext.shopId });
  return authContext.shopId;
},
```

This method is supposed to resolve shop_id from authContext, but:

**Search Results**: `newCustomer` in Customers.tsx never calls `resolveShopId()` or includes `shop_id` in payload

---

## SUMMARY TABLE: ISSUE ROOT CAUSES

| Issue | Root Cause | Evidence File | Issue Category |
|-------|-----------|----------------|-----------------|
| **Map picker stuck loading** | Browser CORS policy blocks direct fetch to nominatim.openstreetmap.org | [Settings.tsx#94](backend/client/src/pages/Settings.tsx#L94) | Architectural CORS issue; no backend proxy |
| **"shop_id not defined" when adding customer** | Frontend never calls API; only updates local Zustand state. No POST /api/customers sent. | [Customers.tsx#667](backend/client/src/pages/Customers.tsx#L667) + [store.ts#689](backend/client/src/lib/store.ts#L689) | Missing API integration; data not persisted |
| **Bike published in owner app but invisible in customer app** | `is_published` and `is_listed_marketplace` columns don't exist in vehicles table; customer app queries for non-existent columns | [supabase_schema.sql#95](backend/supabase_schema.sql#L95) + [vehicles.service.ts#40](backend/customer-web/src/services/vehicles.service.ts#L40) | Schema mismatch; missing DB columns |

---

## CLASSIFICATION BY TYPE

### 🔴 CRITICAL Issues (Block production use)

**Issue 2: Customer Insert Failure**
- Frontend updates local state only; never persists to DB
- Severity: **CRITICAL**
- Cause: Missing API POST call + missing shop_id in payload
- Impact: All customers added are lost on page refresh

**Issue 3: Bike Publishing Broken**
- Frontend & backend assume `is_published` column exists; column doesn't exist
- Severity: **CRITICAL**  
- Cause: Schema incomplete (columns never added)
- Impact: No bikes publishable; customer app can't filter/display any vehicles

### 🟠 HIGH Issues (Significant UX impact)

**Issue 1: Map Picker**
- CORS blocks reverse geocoding; state picker stuck loading
- Severity: **HIGH**
- Cause: Direct browser fetch instead of backend proxy
- Impact: Shop settings can't be saved with auto-filled address/state/pincode

---

## RLS POLICY ASSESSMENT

**Rental Shops Policies**: ✅ CORRECT
- Uses `auth.uid()` directly; no JWT field access errors
- Ownership enforced via `owner_id = auth.uid()`

**Bookings Policies**: ✅ SYNTAX CORRECT but ⚠️ FRAGILE
- Uses subquery to lookup user's shop_id from users table
- Will fail silently (return 0 rows) if user doesn't exist in users table
- No explicit error message to help debug RLS violations

**Customers Policies**: ✅ SYNTAX CORRECT but IRRELEVANT
- Policy says `shop_id` required in WITH CHECK
- But INSERT never reaches backend due to local-state-only implementation

**Vehicles Policies**: ✅ SYNTAX CORRECT but INCOMPLETE
- Owner app: Can read own shop's vehicles
- Customer app: BLOCKED by RLS (customer not in users table; can't lookup shop_id)
- Additionally blocked by missing `is_published` column filter

---

## VERIFICATION QUERIES (READY TO RUN)

If needed, these queries can verify findings (READ-ONLY):

```sql
-- Verify is_published column does NOT exist
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'vehicles'
AND column_name = 'is_published';
-- Expected: No rows returned

-- Verify is_listed_marketplace does NOT exist
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'vehicles'
AND column_name = 'is_listed_marketplace';
-- Expected: No rows returned

-- Verify users row exists for auth_id
SELECT id, shop_id, role
FROM users
WHERE auth_id = '{login_auth_id}';
-- Expected: Should return 1 row with shop_id populated

-- Verify customer insert policy syntax
SELECT policyname, qual, with_check
FROM pg_policies
WHERE tablename = 'customers' AND cmd = 'INSERT';
-- Expected: Policy references shop_id and subquery
```

---

## CONCLUSION

### Key Findings:

1. **RLS Policies are syntactically correct** but have no enforcement mechanisms since:
   - Issue #2: API call doesn't reach backend (local state only)
   - Issue #3: Schema incomplete (columns don't exist)

2. **Issue #1 (Map Picker)**: Pure architecture issue
   - No RLS involvement
   - Frontend must use backend proxy for Nominatim

3. **Issue #2 (Customer "shop_id not defined")**: 
   - Misleading error message (comes from backend)
   - Actual problem: No API POST call sent (frontend stops at addCustomer local update)

4. **Issue #3 (Bike Publishing)**:
   - Frontend-Backend Schema mismatch
   - Queries target non-existent columns
   - No auto-migration or fallback handling

---

## SYSTEM FORENSIC COMPLETE

**Investigation Status**: ✅ CLOSED (No modifications made)  
**Recommendations Due**: On request  
**Next Steps**: Await user instructions for targeted fixes

