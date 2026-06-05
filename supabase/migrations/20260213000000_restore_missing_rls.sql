-- Restore missing RLS on 5 tables: customer_profiles, customer_id_documents, marketplace_locations, marketplace_payment_events, marketplace_payment_reconciliation
-- This is a pure RLS enablement & policy creation migration—no schema changes, no table drops, forward-only
BEGIN;

-- ===========================================================================
-- 1. CUSTOMER_PROFILES - Customer personal profile data
-- ===========================================================================
-- Structure:
--   - auth_id (UUID, NOT NULL, UNIQUE) -> auth.users.id
--   - personal data (full_name, phone, email, address, etc.)
-- Access Model:
--   - Customer can view/edit own profile
--   - No staff/shop access needed (customer app only)

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

-- Customer can view own profile
CREATE POLICY "customer_profiles_select_own" ON public.customer_profiles
FOR SELECT
USING (auth_id = auth.uid());

-- Customer can insert their own profile
CREATE POLICY "customer_profiles_insert_own" ON public.customer_profiles
FOR INSERT
WITH CHECK (auth_id = auth.uid());

-- Customer can update own profile
CREATE POLICY "customer_profiles_update_own" ON public.customer_profiles
FOR UPDATE
USING (auth_id = auth.uid())
WITH CHECK (auth_id = auth.uid());

-- Customer can delete own profile (soft delete via app)
CREATE POLICY "customer_profiles_delete_own" ON public.customer_profiles
FOR DELETE
USING (auth_id = auth.uid());

-- ===========================================================================
-- 2. CUSTOMER_ID_DOCUMENTS - KYC license/ID documents
-- ===========================================================================
-- Structure:
--   - customer_auth_id (UUID, NOT NULL) -> auth.users.id
--   - customer_profile_id (UUID) -> customer_profiles.id
--   - document_type, image_url
-- Access Model:
--   - Customer can manage own documents
--   - admin can view/manage all (for future verification system)

ALTER TABLE public.customer_id_documents ENABLE ROW LEVEL SECURITY;

-- Customer can view own documents
CREATE POLICY "customer_id_documents_select_own" ON public.customer_id_documents
FOR SELECT
USING (customer_auth_id = auth.uid());

-- Customer can insert own documents
CREATE POLICY "customer_id_documents_insert_own" ON public.customer_id_documents
FOR INSERT
WITH CHECK (customer_auth_id = auth.uid());

-- Customer can update own documents (verification status, notes)
CREATE POLICY "customer_id_documents_update_own" ON public.customer_id_documents
FOR UPDATE
USING (customer_auth_id = auth.uid())
WITH CHECK (customer_auth_id = auth.uid());

-- Customer can delete own documents
CREATE POLICY "customer_id_documents_delete_own" ON public.customer_id_documents
FOR DELETE
USING (customer_auth_id = auth.uid());

-- ===========================================================================
-- 3. MARKETPLACE_LOCATIONS - Marketplace pickup/dropoff locations
-- ===========================================================================
-- Structure:
--   - id, name, city, state, latitude, longitude, is_active
--   - No direct auth or shop references
-- Access Model:
--   - Authenticated users can view active locations (public discovery)
--   - No direct insert/update/delete via RLS (managed via backend only)

ALTER TABLE public.marketplace_locations ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view active locations for marketplace discovery
CREATE POLICY "marketplace_locations_select_active" ON public.marketplace_locations
FOR SELECT
TO authenticated
USING (is_active = true);

-- ===========================================================================
-- 4. MARKETPLACE_PAYMENT_EVENTS - Webhook/event audit trail
-- ===========================================================================
-- Structure:
--   - payment_id (UUID, NOT NULL) FK -> marketplace_payments.id
--   - marketplace_payments.booking_id FK -> bookings.id
--   - bookings.owner_id FK -> rental_shops.id
--   - bookings.customer_auth_id FK -> auth.users.id
-- Access Model:
--   - Customer can view events for their own bookings
--   - Shop owner can view events for their shop's bookings
--   - No direct insert/update/delete (handled by system only)

ALTER TABLE public.marketplace_payment_events ENABLE ROW LEVEL SECURITY;

-- Customer can view payment events for their bookings
CREATE POLICY "marketplace_payment_events_select_customer" ON public.marketplace_payment_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.marketplace_payments mp
    JOIN public.bookings b ON b.id = mp.booking_id
    WHERE mp.id = marketplace_payment_events.payment_id
    AND b.customer_auth_id = auth.uid()
  )
);

-- Shop owner can view payment events for their bookings
CREATE POLICY "marketplace_payment_events_select_owner" ON public.marketplace_payment_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.marketplace_payments mp
    JOIN public.bookings b ON b.id = mp.booking_id
    JOIN public.rental_shops rs ON rs.id = b.owner_id
    WHERE mp.id = marketplace_payment_events.payment_id
    AND rs.owner_id = auth.uid()
  )
);

-- ===========================================================================
-- 5. MARKETPLACE_PAYMENT_RECONCILIATION - Admin reconciliation records
-- ===========================================================================
-- Structure:
--   - reconciliation_date, payment_gateway, reconciliation_status, discrepancies
--   - No direct auth references; admin-only data
-- Access Model:
--   - System/admin only (will need backend enforcement for now)
--   - No row-level access via RLS; managed entirely by backend authorization

ALTER TABLE public.marketplace_payment_reconciliation ENABLE ROW LEVEL SECURITY;

-- Placeholder: All access denied by default (backend will need to bypass or enhance)
-- This ensures the table is protected while only system APIs can populate/read
CREATE POLICY "marketplace_payment_reconciliation_system_only" ON public.marketplace_payment_reconciliation
FOR ALL
USING (false);

COMMIT;
