# ROOT CAUSES IDENTIFIED - COMPREHENSIVE AUDIT

## 1. FRONTEND DATA FLOW ISSUES

### 1.1 Undefined Array Access Without Guards
**Location**: `Bookings.tsx` line 547, 588, Dashboard.tsx line 178, etc.
**Problem**: `booking.bikeIds.includes()` called without checking if `bikeIds` is defined
```typescript
// UNSAFE - bikeIds could be undefined
if (booking.bikeIds.includes(b.id) && booking.status === 'Active')

// SAFE - use safeIncludes
if (safeIncludes(booking.bikeIds, b.id) && booking.status === 'Active')
```
**Impact**: Runtime crash "undefined.includes is not a function"

### 1.2 Missing Null Checks on Date Parsing
**Location**: `Bookings.tsx` lines 225-226, 238-239, 697-711
**Problem**: Direct use of `new Date(booking.startDate)` without checking if `startDate` exists
```typescript
// UNSAFE
const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;

// Should be
const dateA = a.startDate && isValidDateString(a.startDate) ? new Date(a.startDate).getTime() : 0;
```
**Impact**: Invalid Date parsing, NaN in sorting

### 1.3 Array.map() on Potentially Undefined Arrays
**Location**: Multiple places in safe.ts, store.ts
**Problem**: Direct `.map()` calls without using `safeArray()` wrapper
**Impact**: Runtime crash "Cannot read property 'map' of undefined"

### 1.4 State Updates Without Null Checks
**Location**: Store.ts filter/map operations
**Problem**: Filters and maps assume all array items have expected properties
**Impact**: Crashes during state transformations

---

## 2. BACKEND SINGLE() MISUSE

### 2.1 Using .single() for Multi-Row Queries
**Location**: `routes.ts` lines 376-402 (GET /api/bookings, GET /api/vehicles, etc.)
**Problem**: `.single()` used on queries that return multiple rows (no WHERE clause)
```typescript
// WRONG - bookings could be multiple rows
const { data: bookings } = await userClient
  .from('bookings')
  .select('*')
  .is('deleted_at', null)
  .single();  // ❌ FAILS if >1 row

// RIGHT - omit .single()
const { data: bookings } = await userClient
  .from('bookings')
  .select('*')
  .is('deleted_at', null);  // ✓ Returns array
```
**Impact**: "multiple (or no) rows returned" error

### 2.2 Using Admin Client Instead of User Client for RLS
**Location**: `routes.ts` line 401 (POST /api/bookings)
**Problem**: Using `getAdminClient()` bypasses RLS entirely, data could leak between shops
**Impact**: Multi-tenant isolation broken

---

## 3. SOFT-DELETE INCONSISTENCIES

### 3.1 Missing deleted_at Filter in Some Queries
**Location**: Multiple GET routes
**Problem**: Some queries filter `.is('deleted_at', null)` but not all
**Impact**: Deleted records still appear in UI

### 3.2 Soft-Delete Not Used Consistently
**Location**: DELETE routes vs UPDATE routes
**Problem**: Some deletes use soft-delete (UPDATE deleted_at) but client expects permanent delete
**Impact**: Deleted records reappear

---

## 4. RLS POLICY ISSUES

### 4.1 shop_id Not Enforced in All Policies
**Location**: Database RLS policies
**Problem**: Some policies don't check `(SELECT shop_id FROM auth.users WHERE id = auth.uid())`
**Impact**: Data leaks between shops in multi-tenant system

### 4.2 user_id Scoping in Booking Isolation
**Location**: Bookings RLS policy
**Problem**: Should filter by both shop_id AND user_id for staff isolation
**Impact**: Staff members see bookings from other staff members

---

## 5. DATE HANDLING ISSUES

### 5.1 Date Parsing Without Validation
**Location**: `Bookings.tsx` lines 225, 238, 282-284, Dashboard.tsx lines 30-36
**Problem**: `new Date(string)` without checking if string is valid ISO date
**Impact**: Invalid dates produce "Invalid Date" or NaN

### 5.2 parseISO Not Guarded Against Undefined
**Location**: `Bikes.tsx` lines 135-136, 158-159
**Problem**: `parseISO(booking.startDate)` when startDate could be undefined
**Impact**: "Cannot parse undefined" error

### 5.3 Date Fallback to Current Date Loses Information
**Location**: `safe.ts` normalization functions
**Problem**: Invalid dates silently replaced with `new Date().toISOString()`
**Impact**: Data loss, incorrect date displays

---

## 6. PAYMENT STATUS FLOW ISSUES

### 6.1 Inconsistent Payment Status Naming
**Location**: Across codebase
**Problem**: Different components use different status names
- DB: 'Paid' | 'Partial' | 'Unpaid'
- Client: Different in some views
**Impact**: Payment status comparison failures

### 6.2 Missing Balance Amount Calculations
**Location**: `Bookings.tsx` payment dialogs
**Problem**: `balance_amount` not calculated correctly when recording partial payments
**Impact**: Incorrect remaining balance display

---

## 7. INVOICE GENERATION ISSUES

### 7.1 invoiceNumber Assignment Race Condition
**Location**: `Bookings.tsx` return flow
**Problem**: Invoice number assigned in multiple places, not atomic
**Impact**: Missing or duplicate invoice numbers

### 7.2 Invoice Generation Logic Incomplete
**Location**: `Bookings.tsx` InvoicePreviewModal
**Problem**: GST calculation, invoice numbering FY logic not synchronized with DB
**Impact**: Mismatched invoices between frontend and DB

---

## 8. VEHICLE STATUS TRACKING ISSUES

### 8.1 Vehicle Status Not Updated on Booking State Changes
**Location**: All booking operation handlers
**Problem**: When marking booking as Active/Returned, vehicle status not always updated
**Impact**: Vehicle shows as Available but actually booked

### 8.2 Opening/Closing Odometer Logic
**Location**: Mark Taken / Mark Returned flows
**Problem**: Odometer readings not validated (could be undefined)
**Impact**: Missing odometer data at rental end

---

## 9. FORM VALIDATION ISSUES

### 9.1 bikeIds Not Validated Before Submission
**Location**: `Bookings.tsx` BookingForm
**Problem**: Form allows empty bikeIds array
**Impact**: Bookings created without vehicles

### 9.2 Customer Selection Optional
**Location**: `Bookings.tsx` BookingForm
**Problem**: Booking created with customerId = null
**Impact**: Bookings orphaned from customers

---

## 10. STATE MANAGEMENT ISSUES

### 10.1 Race Conditions in Optimistic Updates
**Location**: `Bookings.tsx` payment recording
**Problem**: Optimistic state update before server confirmation
**Impact**: Stale state if server rejects update

### 10.2 Store Not Cleared on Logout
**Location**: `store.ts` logout function
**Problem**: Bookings/customers/bikes remain in memory after logout
**Impact**: Previous user's data visible on next login

---

## 11. DATABASE QUERY ISSUES

### 11.1 Missing shop_id in Insert/Update Payloads
**Location**: All write operations
**Problem**: Client sends data without shop_id, relies on trigger
**Impact**: If trigger fails silently, data has null shop_id

### 11.2 User_id Context Lost
**Location**: Payment recording, history updates
**Problem**: `user?.id` could be 'unknown' string
**Impact**: Audit trail unclear

---

## CRITICAL FIXES REQUIRED (PRIORITY ORDER)

1. **Fix .single() usage on multi-row queries** - Causes server crashes
2. **Replace admin client with user client in POST /api/bookings** - Security/isolation
3. **Add safeIncludes/safeArray guards in frontend** - Prevents undefined.includes crashes
4. **Add deleted_at filter to ALL queries** - Ensures soft-delete works
5. **Validate and guard all date parsing** - Prevents Invalid Date issues
6. **Fix vehicle status sync with booking state** - Prevents double bookings
7. **Validate bikeIds/customerId in forms** - Prevents orphaned records
8. **Ensure shop_id in all payloads** - Prevents data leaks
9. **Fix RLS policies for staff isolation** - Security
10. **Add missing deleted_at filters** - Data consistency

---

## TESTING REQUIREMENTS AFTER FIXES

- [ ] Empty DB: No crashes on initial load
- [ ] Partial bookings: Handle missing vehicles/customers gracefully
- [ ] Date edge cases: Invalid dates, undefined dates, future dates
- [ ] Deleted records: Never appear in lists
- [ ] Multi-user: Staff A cannot see Staff B's data
- [ ] Payment flow: All states (Unpaid → Partial → Paid)
- [ ] Vehicle status: Sync across booking lifecycle
- [ ] Invoice: Assigned only once, never null
- [ ] Browser console: Zero errors on all pages
- [ ] Soft-delete: Deleted bookings gone from UI

