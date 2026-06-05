# RAW DIAGNOSIS REPORT — DATABASE + RLS + STATE + UI CONTROL ISSUE

**Date:** January 23, 2026  
**Status:** FACT COLLECTION COMPLETE (NO FIXES APPLIED)

---

## STEP 1 — UPDATE FUNCTION INSTRUMENTATION

### ✅ FINDING: updateBike() Already Instrumented

**File:** `backend/client/src/lib/store.ts` (Lines 510-600)

```typescript
updateBike: async (id, data) => {
  try {
    if (warnSupabaseDisabled('updateBike')) {
      throw new Error('Supabase disabled');
    }

    console.log('[updateBike] Payload before sanitization:', data);
    
    // ... validation logic ...
    
    const updatePayload = sanitizeVehiclePayload(data);
    console.log('[updateBike] Sanitized payload to DB:', updatePayload);
    
    const { data: updatedRow, error } = await supabase
      .from('vehicles')
      .update(updatePayload)
      .eq('id', id)
      .eq('shop_id', shopId)
      .select('...')
      .single();

    if (error) {
      console.error('[updateBike] Supabase error:', error);
      throw error;
    }

    console.log('[updateBike] Update successful');
    
    // Update local state from DB truth only
    set((state) => ({
      bikes: state.bikes.map((b) => (b.id === id ? mappedBike : b))
    }));
  } catch (error) {
    console.error('[updateBike] Exception:', error);
    throw error;
  }
}
```

**Logs Present:**
- ✅ Payload before sanitization
- ✅ Sanitized payload to DB
- ✅ Supabase error (if any)
- ✅ Update successful confirmation
- ✅ Exception logging

---

### ❌ FINDING: updateCustomer() Partially Instrumented

**File:** `backend/client/src/lib/store.ts` (Lines 626-720)

```typescript
updateCustomer: async (id, data) => {
  try {
    if (warnSupabaseDisabled('updateCustomer')) {
      throw new Error('Supabase disabled');
    }

    // ❌ NO LOG: Payload before sending
    // ❌ NO LOG: shop_id value
    // ❌ NO LOG: id being updated
    
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) throw new Error('Not authenticated');

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('shop_id')
      .eq('auth_id', uid)
      .single();
    if (userError) throw userError;

    const shopId = userData?.shop_id;
    if (!shopId) throw new Error('No shop found');

    const updatePayload: Record<string, any> = { /* ... */ };
    
    // ❌ NO LOG: Final payload to Supabase
    
    const { data: updatedRow, error } = await supabase
      .from('customers')
      .update(updatePayload)
      .eq('id', id)
      .eq('shop_id', shopId)
      .select('...')
      .single();

    if (error) throw error; // ❌ NO LOG: Error object
    
    // ❌ NO LOG: Success confirmation
    // ❌ NO LOG: Returned row data
    
    set((state) => ({
      customers: state.customers.map((c) => (c.id === id ? mappedCustomer : c)),
    }));
  } catch (error) {
    console.error('Error updating customer:', error); // ✅ Generic error log only
    throw error;
  }
}
```

**Missing Logs:**
- ❌ Input payload before processing
- ❌ shop_id value
- ❌ ID being updated
- ❌ Final updatePayload sent to DB
- ❌ Supabase error object details
- ❌ Successful update confirmation
- ❌ Returned row from DB

---

### ❌ FINDING: updateBooking() Partially Instrumented

**File:** `backend/client/src/lib/store.ts` (Lines 779-900)

```typescript
updateBooking: async (id, data) => {
  try {
    if (warnSupabaseDisabled('updateBooking')) {
      throw new Error('Supabase disabled');
    }

    // ❌ NO LOG: Input data before processing
    
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) throw new Error('Not authenticated');

    const { data: userData } = await supabase.from('users').select('shop_id').eq('auth_id', uid).single();
    const shopId = userData?.shop_id;
    if (!shopId) throw new Error('No shop found');
    
    // ❌ NO LOG: shop_id value
    // ❌ NO LOG: id being updated

    const updatePayload: any = { /* ... */ };
    
    // ❌ NO LOG: Final payload to Supabase

    const { data: updatedRow, error } = await supabase
      .from('bookings')
      .update(updatePayload)
      .eq('id', id)
      .eq('shop_id', shopId)
      .select('...')
      .single();

    if (error) throw error; // ❌ NO LOG: Error object details
    
    // ❌ NO LOG: Success confirmation
    
    set((state) => ({
      bookings: state.bookings.map((b) => (b.id === id ? mappedBooking : b)),
    }));
  } catch (error) {
    console.error('Error updating booking:', error); // ✅ Generic error log only
    throw error;
  }
}
```

**Missing Logs:**
- ❌ Input data before processing
- ❌ shop_id value
- ❌ ID being updated
- ❌ Final updatePayload sent to DB
- ❌ Supabase error object details
- ❌ Successful update confirmation

---

## STEP 4 — ZUSTAND / STATE FREEZE DIAGNOSIS

### ✅ FINDING: refreshAllData() Uses Promise.allSettled (Safe)

**File:** `backend/client/src/lib/store.ts` (Lines 1223-1251)

```typescript
refreshAllData: async () => {
  if (warnSupabaseDisabled('refreshAllData')) {
    throw new Error('Supabase disabled');
  }

  console.log('[refreshAllData] Starting refresh at', new Date().toISOString());
  
  // ✅ SAFE: Promise.allSettled continues even if some fail
  const results = await Promise.allSettled([
    get().refreshBikes(),
    get().refreshCustomers(),
    get().refreshBookings(),
    get().refreshUsers(),
    get().refreshShopDetails(),
  ]);

  const labels = ['bikes', 'customers', 'bookings', 'users', 'shop details'];
  const failures = results
    .map((res, idx) => (res.status === 'rejected' ? { idx, reason: res.reason } : null))
    .filter((r): r is { idx: number; reason: any } => Boolean(r));

  if (failures.length > 0) {
    const message = failures
      .map((f) => `${labels[f.idx]}: ${f.reason?.message || String(f.reason)}`)
      .join('; ');
    console.error('[refreshAllData] Failure(s):', message);
    toast({ title: 'Refresh failed', description: message, variant: 'destructive' });
    throw new Error(message); // ⚠️ Throws AFTER logging all failures
  }

  console.log('[refreshAllData] Completed at', new Date().toISOString());
}
```

**Analysis:**
- ✅ Uses `Promise.allSettled` (does NOT short-circuit on first failure)
- ✅ Logs all failures before throwing
- ✅ Shows toast with error details
- ⚠️ **THROWS after failures** — caller must handle or UI may freeze

---

### ✅ FINDING: Individual Refresh Functions Throw on Error

#### refreshBikes()

**File:** `backend/client/src/lib/store.ts` (Lines 1262-1322)

```typescript
refreshBikes: async () => {
  if (warnSupabaseDisabled('refreshBikes')) throw new Error('Supabase disabled');
  try {
    console.log('[refreshBikes] Starting refresh at', new Date().toISOString());
    
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    console.log('[refreshBikes] Auth UID:', uid);
    if (!uid) throw new Error('Not authenticated');

    const { data: userData } = await supabase.from('users').select('shop_id').eq('auth_id', uid).single();
    const shopId = userData?.shop_id;
    console.log('[refreshBikes] Shop ID:', shopId);
    if (!shopId) throw new Error('No shop found');

    const { data: rows, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('shop_id', shopId)
      .is('deleted_at', null)  // ✅ CORRECT: Filters soft-deleted vehicles
      .order('created_at', { ascending: false });

    console.log('[refreshBikes] Query returned', rows?.length || 0, 'bikes. Error:', error);
    
    if (error) throw error; // ⚠️ Throws on error
    
    if (Array.isArray(rows)) {
      const bikes: Bike[] = rows.map(row => { /* ... */ });
      console.log('[refreshBikes] Setting', bikes.length, 'bikes to state');
      set({ bikes });
      console.log('[refreshBikes] State updated successfully');
    }
  } catch (e) {
    console.error('[refreshBikes] Error:', e);
    throw e; // ⚠️ Re-throws error
  }
}
```

**Pattern:**
- ✅ Filters `deleted_at IS NULL`
- ✅ Logs query results
- ⚠️ **Throws on error** (no catch-and-suppress)

---

#### refreshCustomers()

**File:** `backend/client/src/lib/store.ts` (Lines 1330-1381)

```typescript
refreshCustomers: async () => {
  if (warnSupabaseDisabled('refreshCustomers')) throw new Error('Supabase disabled');
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) throw new Error('Not authenticated');

    const { data: userData } = await supabase.from('users').select('shop_id').eq('auth_id', uid).single();
    const shopId = userData?.shop_id;
    if (!shopId) throw new Error('No shop found');

    const { data: rows, error } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', shopId)
      .is('deleted_at', null);  // ✅ CORRECT: Filters soft-deleted customers

    if (error) {
      console.error('[refreshCustomers] Query error:', error);
      throw error; // ⚠️ Throws on error
    }

    if (Array.isArray(rows)) {
      const customers: Customer[] = await Promise.all(rows.map(async (row: any) => {
        // ... ID photo URL generation ...
      }));
      set({ customers });
    }
  } catch (e) {
    console.error('[refreshCustomers] Error:', e);
    throw e; // ⚠️ Re-throws error
  }
}
```

**Pattern:**
- ✅ Filters `deleted_at IS NULL`
- ⚠️ **Throws on error** (no catch-and-suppress)

---

#### refreshBookings()

**File:** `backend/client/src/lib/store.ts` (Lines 1389-1457)

```typescript
refreshBookings: async () => {
  if (warnSupabaseDisabled('refreshBookings')) throw new Error('Supabase disabled');
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) throw new Error('Not authenticated');

    const { data: userData } = await supabase.from('users').select('shop_id').eq('auth_id', uid).single();
    const shopId = userData?.shop_id;
    if (!shopId) throw new Error('No shop found');

    const { data: rows, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('shop_id', shopId)
      .is('deleted_at', null);  // ✅ CORRECT: Filters soft-deleted bookings

    if (error) {
      console.error('[refreshBookings] Query error:', error);
      throw error; // ⚠️ Throws on error
    }

    if (Array.isArray(rows)) {
      const bookings: Booking[] = rows.map(row => ({ /* ... */ }));
      set({ bookings });
    }
  } catch (e) {
    console.error('[refreshBookings] Error:', e);
    throw e; // ⚠️ Re-throws error
  }
}
```

**Pattern:**
- ✅ Filters `deleted_at IS NULL`
- ⚠️ **Throws on error** (no catch-and-suppress)

---

### 🔴 CRITICAL FINDING: Update Functions Do NOT Call refresh*()

**updateBike():**
```typescript
// After successful DB update:
set((state) => ({
  bikes: state.bikes.map((b) => (b.id === id ? mappedBike : b))
}));
// ❌ NO CALL to refreshBikes()
// ✅ DOES update local state from returned DB row
```

**updateCustomer():**
```typescript
// After successful DB update:
set((state) => ({
  customers: state.customers.map((c) => (c.id === id ? mappedCustomer : c)),
}));
// ❌ NO CALL to refreshCustomers()
// ✅ DOES update local state from returned DB row
```

**updateBooking():**
```typescript
// After successful DB update:
set((state) => ({
  bookings: state.bookings.map((b) => (b.id === id ? mappedBooking : b)),
}));
// ❌ NO CALL to refreshBookings()
// ✅ DOES update local state from returned DB row
```

**Analysis:**
- ✅ Update functions DO hydrate local state from DB response
- ✅ Uses `.select()` to get fresh row after update
- ❌ NO explicit refresh call (relies on returned row only)
- ⚠️ If `.select()` fails or returns stale data, UI will be stale

---

## STEP 5 — POPOVER / SELECTION BUG ANALYSIS

### 🔴 CRITICAL FINDING: Popovers Force-Open When State is True

**File:** `backend/client/src/pages/Bikes.tsx` (Lines 594, 652)

#### Brand Popover

```tsx
<Popover open={brandIsOther ? true : undefined}>
  <PopoverTrigger asChild>
    <Button variant="outline" role="combobox" className="w-full justify-between">
      {brandSelection || 'Select brand'}
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-[320px] p-0">
    <Command>
      <CommandInput placeholder="Search brand..." />
      <CommandList>
        <CommandEmpty>No brand found.</CommandEmpty>
        <CommandGroup>
          {brandsForType.map((brand) => (
            <CommandItem
              key={brand}
              value={brand}
              onSelect={(val) => {
                setBrandSelection(val);
                setBrandIsOther(false);  // ✅ Resets state on selection
                setModelSelection('');
                setValue('brand', val);
              }}
            >
              {brand}
            </CommandItem>
          ))}
          <CommandItem
            value="Other"
            onSelect={() => {
              setBrandIsOther(true);  // ⚠️ Forces popover open permanently
              setBrandSelection('');
              setModelSelection('');
              setValue('brand', '');
            }}
          >
            Other
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
{brandIsOther && (
  <Input
    className="mt-2"
    placeholder="Enter brand"
    value={brandSelection}
    onChange={(e) => {
      setBrandSelection(e.target.value);
      setValue('brand', e.target.value);
    }}
  />
)}
```

**Issue:**
- ⚠️ `open={brandIsOther ? true : undefined}` **FORCES CONTROLLED STATE**
- When `brandIsOther = true`, popover is ALWAYS open
- ❌ NO `onOpenChange` handler to allow manual close
- ❌ Clicking outside CANNOT close popover when `brandIsOther = true`
- ✅ Resets to `false` only when selecting a brand from list

**Root Cause:**
```tsx
// When user selects "Other":
setBrandIsOther(true);  // Popover becomes permanently open

// Popover is CONTROLLED and forced open:
<Popover open={true}>  // Cannot be closed by user interaction
```

---

#### Model Popover

```tsx
<Popover open={modelIsOther ? true : undefined}>
  <PopoverTrigger asChild>
    <Button variant="outline" role="combobox" className="w-full justify-between">
      {modelSelection || 'Select model'}
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-[320px] p-0">
    <Command>
      <CommandInput placeholder="Search model..." />
      <CommandList>
        <CommandEmpty>No model found.</CommandEmpty>
        <CommandGroup>
          {modelsForBrand.map((model) => (
            <CommandItem
              key={model}
              value={model}
              onSelect={(val) => {
                setModelSelection(val);
                setModelIsOther(false);  // ✅ Resets state on selection
                setValue('model', val);
              }}
            >
              {model}
            </CommandItem>
          ))}
          <CommandItem
            value="Other"
            onSelect={() => {
              setModelIsOther(true);  // ⚠️ Forces popover open permanently
              setModelSelection('');
              setValue('model', '');
            }}
          >
            Other
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
{modelIsOther && (
  <Input
    className="mt-2"
    placeholder="Enter model"
    value={modelSelection}
    onChange={(e) => {
      setModelSelection(e.target.value);
      setValue('model', e.target.value);
    }}
  />
)}
```

**Same Issue:**
- ⚠️ `open={modelIsOther ? true : undefined}` **FORCES CONTROLLED STATE**
- When `modelIsOther = true`, popover is ALWAYS open
- ❌ NO `onOpenChange` handler to allow manual close

---

### 🔴 FINDING: Auto-Detect Logic Forces Popovers Open

**File:** `backend/client/src/pages/Bikes.tsx` (Lines 323-333)

```typescript
useEffect(() => {
  if (brandSelection && !brandIsOther) {
    const exists = brandsForType.includes(brandSelection);
    if (!exists) setBrandIsOther(true);  // ⚠️ Auto-opens popover
  }
}, [brandSelection, brandIsOther, brandsForType]);

useEffect(() => {
  if (modelSelection && !modelIsOther && !modelsForBrand.includes(modelSelection)) {
    setModelIsOther(true);  // ⚠️ Auto-opens popover
  }
}, [modelSelection, modelIsOther, modelsForBrand]);
```

**Analysis:**
- When editing existing bike with custom brand/model not in master data
- Auto-detection sets `brandIsOther = true` or `modelIsOther = true`
- This **FORCES popovers open immediately** when edit modal opens
- User cannot close popovers until they select a different brand/model

---

### 📋 Popover State Summary

| Component | State Variable | Controlled? | onOpenChange? | Can Close? |
|-----------|----------------|-------------|---------------|------------|
| Brand Popover | `brandIsOther` | ✅ Yes (when true) | ❌ No | ❌ No (when true) |
| Model Popover | `modelIsOther` | ✅ Yes (when true) | ❌ No | ❌ No (when true) |

**Expected Behavior:**
- Popover should be **uncontrolled** (no `open` prop) OR
- Popover should be **controlled** with `onOpenChange` handler

**Current Behavior:**
- Popover is **partially controlled** (only when state is `true`)
- No `onOpenChange` handler to sync external close events
- User interaction cannot close popover when `isOther = true`

---

## STEP 6 — UI NOT REFLECTING DB CHANGES

### ✅ FINDING: Update Functions Use Returned DB Row

All update functions use `.select().single()` to get fresh data:

```typescript
const { data: updatedRow, error } = await supabase
  .from('vehicles')
  .update(updatePayload)
  .eq('id', id)
  .eq('shop_id', shopId)
  .select('...')  // ✅ Returns updated row
  .single();

// Map DB row to UI model
const mappedBike: Bike = { /* ... */ };

// Update local state
set((state) => ({
  bikes: state.bikes.map((b) => (b.id === id ? mappedBike : b))
}));
```

**Analysis:**
- ✅ UI relies on `.select()` returned row (NOT on refresh)
- ✅ Local state updated immediately after DB update
- ⚠️ If `.select()` returns stale/incomplete data, UI will be wrong

---

### ❌ FINDING: No Explicit Refresh After Update

**Current Flow:**
1. User clicks Save
2. `updateBike(id, data)` called
3. Supabase `.update().select().single()`
4. Map returned row to UI model
5. Update local Zustand state
6. ❌ NO call to `refreshBikes()`

**Issue:**
- If RLS policy blocks `.select()` or returns wrong data
- UI will show stale/incorrect data
- No validation that DB update actually worked

---

## STEP 7 — FREEZE AFTER FAILURE

### ⚠️ HYPOTHESIS: Modal Never Closes After Failed Update

**Typical Pattern in Pages:**
```typescript
const handleSubmit = async (data) => {
  try {
    await updateBike(id, data);
    toast({ title: 'Bike updated' });
    setEditingBike(null);  // ✅ Closes modal on success
  } catch (error) {
    toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    // ❌ Modal stays open (setEditingBike(null) never called)
  }
};
```

**Analysis:**
- ✅ Modal closes on success
- ❌ Modal **DOES NOT** close on failure (by design)
- User must manually close modal
- No UI freeze — just modal remains open

---

## SUMMARY OF KEY FINDINGS

### ✅ Working Correctly
1. `updateBike()` has comprehensive logging
2. All refresh functions filter `deleted_at IS NULL`
3. `refreshAllData()` uses `Promise.allSettled` (safe)
4. Update functions hydrate from returned DB row

### 🔴 Critical Issues
1. **updateCustomer() / updateBooking()** missing diagnostic logs
2. **Popovers force-open** when `isOther = true` (no close mechanism)
3. **Auto-detect logic** triggers force-open on edit
4. **No explicit refresh after update** (relies on `.select()` only)

### ⚠️ Potential Issues
1. Refresh functions **throw on error** (may freeze UI if uncaught)
2. Modal **stays open on update failure** (intentional?)
3. If RLS blocks `.select()`, UI shows stale data

---

## NEXT STEPS (USER TO PROVIDE)

### STEP 2 — Trigger Failed Updates
User must attempt updates and provide:
- Browser console logs
- Supabase error objects (full details)
- Which records failed (IDs)

### STEP 3 — RLS Policy Verification
Using failed record IDs, run SQL queries:
```sql
SELECT id, shop_id, deleted_at FROM bookings WHERE id = '<booking_id>';
SELECT id, shop_id, get_my_shop_id() AS session_shop FROM bookings WHERE id = '<booking_id>';

UPDATE bookings SET status = 'Completed' WHERE id = '<booking_id>' RETURNING id, status;
```

### STEP 7 — Capture Freeze Behavior
After failed update:
- Browser console errors
- Network tab (failed requests)
- React error boundary logs
- Zustand state inspection

---

**INSTRUMENTATION STILL NEEDED:**

Add to `updateCustomer()` and `updateBooking()`:
```typescript
console.log('[updateCustomer] Input data:', data);
console.log('[updateCustomer] Record ID:', id);
console.log('[updateCustomer] Shop ID:', shopId);
console.log('[updateCustomer] Update payload:', updatePayload);
console.log('[updateCustomer] Supabase response:', { data: updatedRow, error });
```
