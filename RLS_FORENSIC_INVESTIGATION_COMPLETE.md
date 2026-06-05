# RLS Forensic Investigation Report

**Date**: 2026-02-13  
**Scope**: Deep forensic analysis of RLS state without modifications  
**Database**: Local Supabase (Last reset with all migrations applied)  

---

## EXECUTIVE SUMMARY

This report documents the current Row Level Security (RLS) state across all public tables in the Rento Bike Rental Management System's local Supabase database. The investigation confirms that **5 tables have RLS disabled**, all created after the initial schema migrations and without explicit RLS enablement.

### RLS-Disabled Tables (Critical)

| Table | Created In | Status | RLS Enabled? | RLS Forced? |
|-------|-----------|--------|-------------|-----------|
| `customer_id_documents` | 20260210173000 | ❌ **DISABLED** | false | false |
| `customer_profiles` | 20260210173000 | ❌ **DISABLED** | false | false |
| `marketplace_locations` | 20260210150000 | ❌ **DISABLED** | false | false |
| `marketplace_payment_events` | 20260210150000 | ❌ **DISABLED** | false | false |
| `marketplace_payment_reconciliation` | 20260210150000 | ❌ **DISABLED** | false | false |

### RLS-Enabled Tables (✅ Correct)

All other 23 tables in public schema have RLS enabled:
- `bookings`, `customers`, `vehicles`, `rental_shops`, `payments`, `damages`
- `notifications`, `documents`, `locations`
- `users`, `platform_users`
- `customer_id_photos`, `vehicle_images`, `vehicle_damage_photos`
- `shop_pickup_points`, `booking_number_counters`, `invoice_number_counters`
- `customer_sequences`, `invoice_sequences`
- `states`, `cities`, `pincodes`
- `marketplace_payments` (enabled in 20260210151000)

---

## ROOT CAUSE ANALYSIS

### When RLS Was Disabled/Not Enabled

#### 1. **Marketplace Schema Creation** (20260210150000_marketplace_schema.sql)
- **Lines Affected**: Creates 5 new tables
- **Status**: Tables created WITHOUT explicit `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- **Tables**: `marketplace_locations`, `marketplace_payment_events`, `marketplace_payment_reconciliation`, `vehicle_images`, `platform_users`
- **Reason**: Standard Supabase default behavior—new tables have RLS disabled by default
- **Resolution**: Applied in subsequent migration (20260210151000)

**Migration 20260210150000 Lines:**
```sql
-- Line 5:  CREATE TABLE IF NOT EXISTS marketplace_locations ( ... )
-- Line 37: CREATE TABLE IF NOT EXISTS platform_users ( ... )
-- Line 88: CREATE TABLE IF NOT EXISTS vehicle_images ( ... )
-- Line 284: CREATE TABLE IF NOT EXISTS marketplace_payments ( ... )
-- Line 333: CREATE TABLE IF NOT EXISTS marketplace_payment_events ( ... )
-- Line 355: CREATE TABLE IF NOT EXISTS marketplace_payment_reconciliation ( ... )
-- MISSING: No ENABLE ROW LEVEL SECURITY statements
```

#### 2. **Marketplace RLS Enablement** (20260210151000_marketplace_rls.sql)
- **Lines Affected**: Enables RLS on marketplace tables AND adds policies
- **Status**: PARTIALLY FIXES the issue
- **Tables Enabled**: `platform_users`, `vehicle_images`, `marketplace_payments`, vehicles (re-enable), `bookings` (re-enable), `customers` (re-enable)
- **Tables OMITTED from RLS enablement**:
  - ❌ `marketplace_locations`
  - ❌ `marketplace_payment_events`
  - ❌ `marketplace_payment_reconciliation`

**Migration 20260210151000 Lines:**
```sql
-- Line 44: ALTER TABLE platform_users ENABLE ROW LEVEL SECURITY;
-- Line 45: ALTER TABLE vehicle_images ENABLE ROW LEVEL SECURITY;
-- Line 46: ALTER TABLE marketplace_payments ENABLE ROW LEVEL SECURITY;
-- Line 49: ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
-- Line 50: ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
-- Line 51: ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- MISSING: marketplace_locations, marketplace_payment_events, marketplace_payment_reconciliation not listed
```

#### 3. **Customer App Schema Addition** (20260210173000_align_customer_app_schema.sql)
- **Lines Affected**: Creates 2 new tables
- **Status**: Tables created WITHOUT explicit `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- **Tables**: `customer_profiles`, `customer_id_documents`
- **Reason**: Author did not include RLS enablement statement (inconsistent with other migrations)
- **Impact**: HIGHEST PRIORITY—These tables are used for KYC data and have NO security layer

**Migration 20260210173000 Lines:**
```sql
-- Line 21: ALTER TABLE public.bookings ... (column additions)
-- Line 30: ALTER TABLE public.marketplace_payments ... (column additions)
-- Line 39: CREATE TABLE IF NOT EXISTS public.customer_profiles ( ...
--          id UUID PRIMARY KEY,
--          customer_auth_id UUID NOT NULL,
--          ...
--        )
-- Line 59: CREATE TABLE IF NOT EXISTS public.customer_id_documents ( ...
--          id UUID PRIMARY KEY,
--          customer_id UUID NOT NULL,
--          ...
--        )
-- Line 54: ALTER TABLE public.customer_profiles ADD CONSTRAINT ... (FK setup)
-- MISSING: No ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;
-- MISSING: No ALTER TABLE customer_id_documents ENABLE ROW LEVEL SECURITY;
-- MISSING: No CREATE POLICY statements for these tables
```

#### 4. **Rollback Migration** (20260210174500_rollback_align_customer_app_schema.sql)
- **Status**: Contains no-op code, does not actually disable RLS
- **Impact**: None (functionally inert as per system instructions)

---

## CURRENT DATABASE STATE

### RLS Status Summary
```
Total Tables: 28
RLS Enabled: 23 (82.1%)
RLS Disabled: 5 (17.9%) ⚠️

RLS Forced: 0 (not required in this design)
RLS Partially Enforced: 0
```

### Policy Coverage

**Tables with RLS but NO policies defined**: None (all RLS-enabled tables have at least one policy)

**Tables with RLS and complete policy coverage**:
- booking_number_counters (4 policies)
- bookings (7 policies)
- customer_id_photos (4 policies)
- customers (6 policies)
- damages (4 policies)
- documents (4 policies)
- invoice_number_counters (4 policies)
- invoice_sequences (8 policies)
- marketplace_payments (2 policies)
- notifications (3 policies)
- payments (8 policies)
- pickup_points (6 policies)
- rental_shops (3 policies)
- shop_pickup_points (7 policies)
- users (3 policies)
- vehicle_damage_photos (4 policies)
- vehicle_images (3 policies)
- vehicles (7 policies)
- ... and more

**91 total policies across RLS-enabled tables**

---

## SECURITY IMPACT ASSESSMENT

### Level 1: CRITICAL 🔴

**Affected Tables**: `customer_profiles`, `customer_id_documents`

**Risk**: Any authenticated user can read, modify, or delete all customer profile and ID document data globally.

**Justification**:
- No RLS policies exist
- No RLS enabled
- Data contains sensitive PII (customer names, phone numbers, email, addresses, ID document paths)
- No shop-level isolation
- Customer app relies on this data for profile display and KYC verification

**Affected Features**:
- Customer profile management (Customers page in both owner and customer app)
- License/ID KYC feature
- Booking creation gate logic

**Reversibility**: ✅ **EASY** — Add `ENABLE ROW LEVEL SECURITY` and RLS policies in a follow-up migration

### Level 2: HIGH 🟠

**Affected Tables**: `marketplace_locations`, `marketplace_payment_events`, `marketplace_payment_reconciliation`

**Risk**: Unauthorized access to marketplace location data, payment events, and reconciliation records.

**Justification**:
- Not currently used in customer-web or owner app code
- Placeholder tables for future marketplace feature expansion
- If populated in future, will expose pricing, location, and payment data

**Reversibility**: ✅ **EASY** — Add `ENABLE ROW LEVEL SECURITY` statement and policies

---

## MIGRATION-BY-MIGRATION TIMELINE

### Initial Schema (20250106000000_initial_schema.sql)
- ✅ Creates core tables: bookings, customers, vehicles, rental_shops, payments, damages, notifications, documents, locations
- ✅ All have `ENABLE ROW LEVEL SECURITY`
- ✅ Policies defined immediately below table creation

### Multi-Tenant Functions (20250106000001-20250109152000)
- ✅ Adds functions and utility migrations
- ✅ Maintains RLS state from initial schema

### Marketplace Expansion (20260210150000_marketplace_schema.sql)
- ⚠️ Introduces tables WITHOUT RLS enablement:
  - marketplace_locations
  - marketplace_payment_events
  - marketplace_payment_reconciliation
  - platform_users (fixed in 20260210151000)
  - vehicle_images (fixed in 20260210151000)

### Marketplace RLS Fix (20260210151000_marketplace_rls.sql)
- ✅ Enables RLS on most marketplace tables
- ❌ **INCOMPLETE**: Misses 3 tables
  - marketplace_locations NOT in ALTER TABLE ENABLE RLS list
  - marketplace_payment_events NOT in ALTER TABLE ENABLE RLS list
  - marketplace_payment_reconciliation NOT in ALTER TABLE ENABLE RLS list

### Customer App Schema (20260210173000_align_customer_app_schema.sql)
- ❌ Creates 2 NEW tables with RLS disabled
  - customer_profiles (no RLS)
  - customer_id_documents (no RLS)
- ❌ Does not include RLS enablement statements
- ❌ Does not include policy definitions

### Subsequent Migrations (20260210173000 onward)
- ✅ All focus on schema modifications, FK fixes, or other operations
- ℹ️ Do not address RLS gap from previous migrations

---

## DETAILED TABLE ANALYSIS

### `customer_profiles`
- **Created**: 20260210173000 (ALTER TABLE ... CREATE TABLE IF NOT EXISTS)
- **Columns**: id, customer_auth_id, full_name, phone, email, address, country, state, city, pincode, license_number, license_expiry, gst_id, created_at, updated_at
- **RLS Status**: ❌ DISABLED
- **Policies**: ❌ NONE
- **FK References**: customers.id (if any), auth.users (implicit via customer_auth_id)
- **Sensitive Data**: ✅ YES (PII, license info)
- **Risk Level**: 🔴 CRITICAL
- **Fix**: Add ENABLE ROW LEVEL SECURITY; Define SELECT/INSERT/UPDATE/DELETE policies scoped to customer_auth_id or shop_id

### `customer_id_documents`
- **Created**: 20260210173000 (ALTER TABLE ... CREATE TABLE IF NOT EXISTS)
- **Columns**: id, customer_id, customer_auth_id, document_type, document_number, issue_date, expiry_date, document_path, verification_status, verification_notes, created_at, updated_at
- **RLS Status**: ❌ DISABLED
- **Policies**: ❌ NONE
- **FK References**: customers.id, auth.users (implicit via customer_auth_id)
- **Sensitive Data**: ✅ YES (document paths, verification data)
- **Risk Level**: 🔴 CRITICAL
- **Fix**: Add ENABLE ROW LEVEL SECURITY; Define policies scoped to customer_id or customer_auth_id

### `marketplace_locations`
- **Created**: 20260210150000 (ALTER TABLE ... CREATE TABLE IF NOT EXISTS)
- **Columns**: id, name, city, state, latitude, longitude, operating_hours, is_active, created_at, updated_at
- **RLS Status**: ❌ DISABLED (missed in 20260210151000)
- **Policies**: ❌ NONE
- **Current Usage**: ℹ️ Not used in current code
- **Risk Level**: 🟠 HIGH (placeholder for future)
- **Fix**: Add ENABLE ROW LEVEL SECURITY; Define SELECT-all policy for public discovery OR shop-specific policies

### `marketplace_payment_events`
- **Created**: 20260210150000 (ALTER TABLE ... CREATE TABLE IF NOT EXISTS)
- **Columns**: id, marketplace_payment_id, event_type, status, amount, response_data, created_at
- **RLS Status**: ❌ DISABLED (missed in 20260210151000)
- **Policies**: ❌ NONE
- **Current Usage**: ℹ️ Not used in current code
- **Risk Level**: 🟠 HIGH (audit/payment trail)
- **Fix**: Add ENABLE ROW LEVEL SECURITY; Define policies scoped to booking.owner_id or customer_auth_id

### `marketplace_payment_reconciliation`
- **Created**: 20260210150000 (ALTER TABLE ... CREATE TABLE IF NOT EXISTS)
- **Columns**: id, marketplace_payment_id, reconciliation_status, discrepancy_amount, discrepancy_reason, resolved_at, created_at, updated_at
- **RLS Status**: ❌ DISABLED (missed in 20260210151000)
- **Policies**: ❌ NONE
- **Current Usage**: ℹ️ Not used in current code
- **Risk Level**: 🟠 HIGH (financial/admin data)
- **Fix**: Add ENABLE ROW LEVEL SECURITY; Define owner-only or admin-only policies

---

## MIGRATION SCRIPT ANALYSIS

### Keyword Scan Results

**CREATE TABLE**: 90+ occurrences across migrations
**ALTER TABLE**: 100+ occurrences (mostly column additions and FK modifications)
**ENABLE ROW LEVEL SECURITY**: 25 occurrences (spread across multiple migrations)
**DISABLE ROW LEVEL SECURITY**: 0 occurrences (no intentional disablements)
**DROP POLICY**: 40+ occurrences (mostly cleanup in migration step-downs or policy replacements)
**CREATE POLICY**: 80+ occurrences (policy definitions across all RLS-enabled tables)
**SECURITY DEFINER**: 20+ occurrences (used in function definitions for helper functions like get_my_shop_id, is_admin, etc.)
**SET search_path**: 20+ occurrences (in SECURITY DEFINER functions to restrict function search path)

### Key Files with RLS/DDL Changes

1. **20260210150000_marketplace_schema.sql**
   - 5 CREATE TABLE (marketplace expansion)
   - 1 SET search_path (in function definition)
   - 2 SECURITY DEFINER (function wrappers)
   - ❌ No ENABLE ROW LEVEL SECURITY statements

2. **20260210151000_marketplace_rls.sql**
   - 6 ALTER TABLE ENABLE ROW LEVEL SECURITY (partial fix)
   - 40+ CREATE POLICY statements
   - ❌ Misses 3 tables from 20260210150000

3. **20260210173000_align_customer_app_schema.sql**
   - 2 CREATE TABLE (customer_profiles, customer_id_documents)
   - 2 ALTER TABLE (constraint additions only)
   - ❌ No ENABLE ROW LEVEL SECURITY
   - ❌ No CREATE POLICY

4. **20260213***_fix_vehicles_owner_fk.sql** (Multiple iterations)
   - Focused on correcting vehicles.owner_id FK to auth.users
   - ✅ All RLS-enabled tables already in place

---

## ACTION ITEMS & REVERSIBILITY ASSESSMENT

### Immediate Action Required

**Priority 1: Fix customer_profiles & customer_id_documents**

Create migration `20260214000000_enable_rls_customer_tables.sql`:

```sql
-- Enable RLS on customer_profiles
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for customer_profiles
CREATE POLICY "customer_profiles_select_self_or_shop" ON public.customer_profiles
FOR SELECT
USING (
  customer_auth_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = customer_profiles.customer_id
    AND customers.shop_id = (SELECT shop_id FROM public.users WHERE auth_id = auth.uid())
  )
);

CREATE POLICY "customer_profiles_insert_self" ON public.customer_profiles
FOR INSERT
WITH CHECK (customer_auth_id = auth.uid());

CREATE POLICY "customer_profiles_update_self_or_shop" ON public.customer_profiles
FOR UPDATE
USING (
  customer_auth_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = customer_profiles.customer_id
    AND customers.shop_id = (SELECT shop_id FROM public.users WHERE auth_id = auth.uid())
  )
)
WITH CHECK (
  customer_auth_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = customer_profiles.customer_id
    AND customers.shop_id = (SELECT shop_id FROM public.users WHERE auth_id = auth.uid())
  )
);

-- Enable RLS on customer_id_documents
ALTER TABLE public.customer_id_documents ENABLE ROW LEVEL SECURITY;

-- Policies for customer_id_documents
CREATE POLICY "customer_id_documents_select_self_or_shop" ON public.customer_id_documents
FOR SELECT
USING (
  customer_auth_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = customer_id_documents.customer_id
    AND customers.shop_id = (SELECT shop_id FROM public.users WHERE auth_id = auth.uid())
  )
);

CREATE POLICY "customer_id_documents_insert_self" ON public.customer_id_documents
FOR INSERT
WITH CHECK (customer_auth_id = auth.uid());

CREATE POLICY "customer_id_documents_update_self_or_shop" ON public.customer_id_documents
FOR UPDATE
USING (
  customer_auth_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = customer_id_documents.customer_id
    AND customers.shop_id = (SELECT shop_id FROM public.users WHERE auth_id = auth.uid())
  )
)
WITH CHECK (
  customer_auth_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = customer_id_documents.customer_id
    AND customers.shop_id = (SELECT shop_id FROM public.users WHERE auth_id = auth.uid())
  )
);

CREATE POLICY "customer_id_documents_delete_self" ON public.customer_id_documents
FOR DELETE
USING (customer_auth_id = auth.uid());
```

**Reversibility**: ✅ EASY — Can be rolled back by dropping the policies and disabling RLS (not ideal, but possible)

**Priority 2: Fix marketplace_locations, marketplace_payment_events, marketplace_payment_reconciliation**

Create migration `20260214000001_enable_rls_marketplace_tables.sql`:

```sql
-- Enable RLS on marketplace_locations
ALTER TABLE public.marketplace_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketplace_locations_select_all" ON public.marketplace_locations
FOR SELECT
USING (true);  -- Public discovery data

-- Enable RLS on marketplace_payment_events
ALTER TABLE public.marketplace_payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketplace_payment_events_select" ON public.marketplace_payment_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.marketplace_payments
    WHERE marketplace_payments.id = marketplace_payment_events.marketplace_payment_id
    AND (
      marketplace_payments.customer_auth_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.bookings
        WHERE bookings.id = marketplace_payments.booking_id
        AND bookings.owner_id = (SELECT id FROM public.rental_shops WHERE owner_id = auth.uid())
      )
      OR (SELECT get_user_role()) = 'admin'
    )
  )
);

-- Enable RLS on marketplace_payment_reconciliation
ALTER TABLE public.marketplace_payment_reconciliation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketplace_payment_reconciliation_select" ON public.marketplace_payment_reconciliation
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.marketplace_payments
    WHERE marketplace_payments.id = marketplace_payment_reconciliation.marketplace_payment_id
    AND EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bookings.id = marketplace_payments.booking_id
      AND bookings.owner_id = (SELECT id FROM public.rental_shops WHERE owner_id = auth.uid())
    )
  )
  OR (SELECT get_user_role()) = 'admin'
);

CREATE POLICY "marketplace_payment_reconciliation_insert" ON public.marketplace_payment_reconciliation
FOR INSERT
WITH CHECK ((SELECT get_user_role()) = 'admin');

CREATE POLICY "marketplace_payment_reconciliation_update" ON public.marketplace_payment_reconciliation
FOR UPDATE
USING ((SELECT get_user_role()) = 'admin')
WITH CHECK ((SELECT get_user_role()) = 'admin');
```

**Reversibility**: ✅ EASY —Policies can be dropped; RLS can be disabled if needed

---

## VERIFICATION CHECKLIST

After applying fixes, verify with:

```sql
-- Check all tables have RLS enabled
SELECT n.nspname, c.relname, c.relrowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- Confirm RLS-disabled list is now empty
-- Expected: 0 rows
SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;

-- Count policies on newly-fixed tables
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('customer_profiles', 'customer_id_documents', 'marketplace_locations', 'marketplace_payment_events', 'marketplace_payment_reconciliation')
GROUP BY tablename;
```

---

## COMPLIANCE & BEST PRACTICES

### Current Issues vs. Rento Copilot Instructions

Reference: [copilot-instructions.md § Multi-Tenancy & Data Isolation](copilot-instructions.md)

**Rule Violation**: ✅ "Every data operation requires `shop_id` (per-user isolation)"
- **Status**: PARTIALLY VIOLATED for customer_profiles and customer_id_documents
- **Issue**: No RLS = no automatic shop_id filtering
- **Impact**: Rules 1-7 from copilot-instructions can be bypassed for KYC data

### Future Prevention

1. **Template**: Standardize migration structure:
   - CREATE TABLE → (immediately) ALTER TABLE ENABLE RLS
   - Define POLICY → Cover all CRUD operations

2. **Testing**: Add pre-deployment validation:
   ```sql
   -- Validate all public tables have RLS enabled
   SELECT COUNT(*) as rls_disabled
   FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
   -- Should return: 0
   ```

3. **Code Review**: Require policy review for any CREATE TABLE migration

---

## GLOSSARY

- **RLS (Row Level Security)**: Database feature that restricts rows visible by query based on authenticated user
- **RLS Enabled**: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;` has been applied
- **RLS Forced**: `ALTER TABLE table_name FORCE ROW LEVEL SECURITY;` (prevents superuser bypass; not needed in Rento design)
- **Policy**: `CREATE POLICY` statement that defines specific row access rules (SELECT, INSERT, UPDATE, DELETE)
- **Migration**: SQL file in `supabase/migrations/` that defines schema changes (timestamped, immutable)
- **SECURITY DEFINER**: Function attribute that enforces function logic with the privileges of the function owner

---

## CONCLUSION

The forensic investigation identified exactly **5 tables with RLS disabled**, originating from two migration batches:

1. **Marketplace schema expansion** (20260210150000) created marketplace tables without RLS
2. **Marketplace RLS fix** (20260210151000) partially remedied the issue but missed 3 tables
3. **Customer app schema** (20260210173000) introduced KYC tables without RLS enablement

**All issues are reversible** with new RLS-enablement migrations. The critical tables (`customer_profiles`, `customer_id_documents`) require immediate attention due to PII sensitivity. The marketplace tables are lower risk as they are not yet actively used but should still be secured for completeness.

**Current Risk Level**: 🔴 CRITICAL for customer data; 🟠 HIGH for marketplace infrastructure

**Recommended Action**: Apply both recommended migrations immediately and verify with provided SQL checks.

---

**Report Generated**: 2026-02-13  
**Investigation Completed Without Database Modifications**: ✅ YES  
**Status**: Ready for remediation planning

