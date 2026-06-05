# Rento Bike Rental Management System - AI Agent Instructions

## Quick Overview

This is a **multi-tenant bike rental management system** with:
- **Express.js backend** + **React frontend** bundled together
- **PostgreSQL database** with Supabase for auth & RLS (Row Level Security)
- **Capacitor wrapper** for Android APK deployment
- **Monorepo structure**: Backend includes frontend build artifacts
- **Pay-and-use model**: Users created by admin, login via device_id enforcement

## Critical Architecture

### Multi-Tenancy & Data Isolation

**Rule 1: Every data operation requires `shop_id` (per-user isolation)**
- All tables (`vehicles`, `customers`, `bookings`, `payments`, `damages`, `deposits`) have `shop_id` FK
- RLS policies enforce: User can only access data where `shop_id = user's shop`
- Users belong to ONE shop via `users.shop_id` column
- Owners link auth users to shops via `rental_shops.owner_id = auth.users.id`

**File references**: [backend/supabase_schema.sql](backend/supabase_schema.sql), [backend/supabase_rls_policies.sql](backend/supabase_rls_policies.sql)

### Authentication Flow

1. User logs in with **email + password + device_id**
2. Backend validates in Supabase Auth
3. Backend checks `profiles.allowed = 'true'` (admin approval required - no self-signup)
4. Backend enforces one-device-per-user: Updates `last_device_id` & invalidates prior sessions
5. Returns JWT token (Supabase session)
6. Frontend stores token in localStorage and uses it for RLS-enforced queries

**See**: [backend/server/routes.ts#L74-L150](backend/server/routes.ts#L74) (login endpoint)

### Frontend → Backend → Database Flow

```
React Component (client/src/pages/**)
  ↓ (calls API)
Express Route (server/routes.ts)
  ↓ (validates shop_id, strips user_id from payload)
Supabase Client (RLS-enforced, uses JWT)
  ↓ (RLS policy checks: shop_id = user's shop)
PostgreSQL (data returned only if policy allows)
```

**Critical**: Backend STRIPS `user_id` from payloads (never trust client) but REQUIRES explicit `shop_id`.

## Build & Deploy

### Development Workflow

```bash
cd backend
npm install
npm run dev:client        # Frontend on port 5000 (Vite dev server)
npm run dev              # Backend on port 3000 (Express, separate terminal)
```

### Production Build

```bash
npm run build            # Runs script/build.ts: Builds frontend → dist, bundles Express server → dist/index.cjs
npm start               # Starts bundled server (serves static + API endpoints)
```

**Deploy**: Set `Root Directory: backend` on Render (or similar). Render will run `npm run build:full` → `npm run start`.

### Android APK Build

```bash
npm run build           # Build frontend & backend
npm run cap:sync       # Sync to Capacitor (copies dist/ to Android assets)
npm run cap:open       # Opens Android Studio
# In Android Studio: Build → Build APK(s)
```

## Project-Specific Patterns

### 1. Field Name Mapping (Frontend ↔ DB)

Frontend uses camelCase, DB uses snake_case. Backend maps automatically in `mapFieldsToDb()`:
- `bikeIds` → `vehicle_ids`
- `startDate` → `start_date`
- `customerId` → `customer_id`
- `bookingNumber` → `booking_number`

**Do NOT add fields to DB without updating `mapFieldsToDb()` and `stripOwnershipFields()`.**

### 2. Zustand Store (State Management)

[client/src/lib/store.ts](backend/client/src/lib/store.ts) is the single source of truth:
- Auth state: `user`, `isLoggedIn`, `session`
- Shop data: `shopId`, `shopName`, `shopPhone`
- Collections: `customers`, `vehicles`, `bookings`, `payments`
- Queries are cached in TanStack Query, NOT the Zustand store

**When adding new collections**: Define interface in store.ts, add to store, create API methods.

### 3. RLS Policy Enforcement

Every SELECT/INSERT/UPDATE/DELETE hits a policy. Common patterns:

```sql
-- Shop-based access (all staff in shop_id see each other's data)
CREATE POLICY "damages_select_shop" ON damages FOR SELECT 
  USING (shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1));

-- Owner-only access
CREATE POLICY "rental_shops_select_owner" ON rental_shops FOR SELECT 
  USING (owner_id = auth.uid());
```

**If RLS fails**: Check that `user_id` field in JWT token matches DB `auth_id` column.

### 4. Soft Deletes vs Hard Deletes

**Bookings & Vehicles**: Use soft delete (set `deleted_at = NOW()`, don't return in queries).
**Damages & Customer Photos**: Use hard delete (actually remove rows).

Check queries for `WHERE deleted_at IS NULL` filters.

### 5. Photo Management

**Customer ID Photos**: 
- Store in Supabase Storage `/customer-id-photos/{shop_id}/{customer_id}/{side}.jpg`
- DB table: `customer_id_photos` (stores paths, not inline URLs)
- Frontend fetches URLs via signed URL helper in [backend/client/src/lib/photoService.ts](backend/client/src/lib/photoService.ts)

**Vehicle Damage Photos**:
- Store inline as JSONB array in `damages.photo_urls`
- Frontend calls `deleteCustomerIdPhoto()` helper to remove from storage

### 6. Booking Number Generation

Auto-generated by DB trigger (`booking_number_trigger`):
- Format: `{shop_id}-{6-digit-sequential}`
- Trigger: Ensures unique per shop, incremental

Do NOT allow frontend to set `booking_number`.

### 7. Permission System

[store.ts#L30-L47](backend/client/src/lib/store.ts#L30) defines role-based access:
- `admin` & `owner`: Full access (can delete bookings, manage users)
- `staff`: Can add/edit customers & vehicles, but NOT manage users or delete bookings

Use `getPermissions(role)` to check before rendering actions.

## Common Issues & Fixes

### "RLS policy violation" Error

**Cause**: User trying to access data from a different shop or missing `shop_id` in payload.

**Fix**:
1. Verify JWT token is valid: `console.log(user.id)` should match `auth_id` in `users` table
2. Verify request includes `shop_id` in payload
3. Run `SELECT * FROM users WHERE auth_id = '{user_id}'` to check user exists

### Frontend sees empty lists

**Cause**: Query runs before `user` is fully loaded or RLS denies access.

**Fix**:
1. Check `useAppStore().isLoggedIn` before rendering data
2. Verify API returns data (check browser Network tab)
3. If API returns `[]`, check RLS policies in [backend/supabase_rls_policies.sql](backend/supabase_rls_policies.sql)

### Build fails with "stripOwnershipFields not found"

**Cause**: Adding new table without updating [backend/server/routes.ts](backend/server/routes.ts) route handler.

**Fix**: Copy existing pattern:
```typescript
const { data, error } = await userClient
  .from('new_table')
  .insert(stripOwnershipFields(req.body))
  .select();
```

## Key Files to Know

| File | Purpose |
|------|---------|
| [backend/supabase_schema.sql](backend/supabase_schema.sql) | Database schema (8 tables, FK relationships) |
| [backend/supabase_rls_policies.sql](backend/supabase_rls_policies.sql) | RLS policies (per-user/shop isolation) |
| [backend/server/routes.ts](backend/server/routes.ts) | Express API endpoints (auth, CRUD, delete logic) |
| [backend/client/src/lib/store.ts](backend/client/src/lib/store.ts) | Zustand store (state + API methods) |
| [backend/client/src/pages/](backend/client/src/pages/) | React page components (main UI) |
| [backend/vite.config.ts](backend/vite.config.ts) | Build config (frontend + backend bundling) |
| [backend/drizzle.config.ts](backend/drizzle.config.ts) | ORM config (currently unused; consider for future migration) |

## Testing & Debugging

### Quick Test: Login Flow
1. Open browser DevTools → Network tab
2. Log in with email + password + device_id
3. Check POST `/api/auth/login` response contains `sessionToken`
4. Verify `Bearer {token}` is sent in subsequent API calls

### Check User Access
```bash
# In Supabase SQL Editor:
SELECT id, shop_id, auth_id, role FROM users WHERE auth_id = '<auth_user_id>';
```

### Verify RLS is Enforced
```bash
# Login as different users, verify they DON'T see each other's data
SELECT COUNT(*) FROM customers;  -- Should only show current user's customers
```

## Performance Notes

- **Query caching**: TanStack Query caches by 30 min default (see [backend/client/src/lib/queryClient.ts](backend/client/src/lib/queryClient.ts))
- **Indexes**: Added on `shop_id`, `user_id`, `owner_id` for fast filtering
- **Soft deletes**: Queries filter `deleted_at IS NULL` automatically (check every SELECT)

## Marketplace Mode vs Internal Rental Mode

This system has **two fundamentally different user types** with distinct responsibilities:

### Owner App (Internal - Staff & Admin Only)
- **Who**: Shop staff, admins, owners
- **Sees**: All internal shop data (vehicles, customers, bookings, payments)
- **Can Do**: Manage inventory, create bookings, record payments, document damages
- **Data Access**: Full access to shop data (RLS enforced by `shop_id`)
- **Vehicle Visibility**: ALL vehicles, including drafts and unpublished

### Customer App (Marketplace - Public)
- **Who**: End customers (external)
- **Sees**: ONLY published vehicles (`published = true`)
- **Can Do**: Browse vehicles, create booking, upload ID docs, view own bookings
- **Data Access**: Read-only except for: profile, ID documents, booking creation
- **Vehicle Visibility**: ONLY `published = true` vehicles; NO draft, internal, or unpublished data

**Critical Rule**: Customer app must NEVER query or access:
- Unpublished vehicles (`published != true`)
- Owner/staff internal notes
- Shop pricing strategies or cost data
- Other customers' data or bookings
- Draft or archived inventory

**Implementation**: Always filter `WHERE published = true` in customer-facing queries. RLS policies should enforce this at the database level.

## Booking Snapshot Rule (Critical)

**Bookings are immutable records of a moment in time.** They must store complete snapshots so that viewing old bookings reflects the terms that existed when the booking was created.

### What Must Be Snapshotted

When a booking is created, store these values IN the booking record (not as foreign keys):

1. **Vehicle Details** (snapshot from `vehicles` table):
   - vehicle name, type, registration number, daily_rate at time of booking
   - Do NOT store just `vehicle_id` and join to live vehicle table

2. **Pickup/Dropoff Location** (from `rental_shops`):
   - shop address, phone, contact info as it existed at booking time

3. **Owner Terms & Conditions**:
   - cancellation policy, insurance terms, deposit amount (all as JSONB snapshot)

4. **Pricing Breakdown** (immutable):
   - rent_amount, deposit_amount, tax, total_amount
   - These must NOT change if shop settings change later

### Customer Booking View

When customer views a past booking:
```typescript
// ✅ CORRECT: Use values from booking record itself
const bookingDetails = {
  vehicleName: booking.vehicle_snapshot.name,
  rate: booking.vehicle_snapshot.daily_rate,
  pickup: booking.location_snapshot.address,
  terms: booking.terms_snapshot,
};

// ❌ WRONG: Do NOT join to live tables
const wrongRate = vehicle.daily_rate;  // Could have changed!
const wrongAddress = shop.address;     // Could have changed!
```

**Why**: If owner changes vehicle price or shop address after booking, customer should see the ORIGINAL terms they agreed to, not current terms.

## Customer Profile & ID Gating

**Before a customer can create a booking, they MUST complete their profile and upload ID documents.**

### Profile Requirements (Enforced in Backend)

1. **Complete Profile**:
   - name, phone, email, address
   - All required fields must be NOT NULL in `customers` table

2. **ID Documents**:
   - Upload minimum 1 ID photo (front side)
   - Store in Supabase Storage: `/customer-id-photos/{shop_id}/{customer_id}/front.jpg`
   - Record in `customer_id_photos` table with verification status

### Booking Creation Gate

In [backend/server/routes.ts](backend/server/routes.ts) POST `/api/bookings` endpoint:

```typescript
// BEFORE allowing booking insert, verify customer is complete
const { data: customer } = await userClient
  .from('customers')
  .select('*')
  .eq('id', customerId)
  .single();

// ✅ Check all required fields are filled
if (!customer.name || !customer.phone || !customer.email || !customer.address) {
  return res.status(400).json({ 
    error: 'Customer profile incomplete. Name, phone, email, and address required.' 
  });
}

// ✅ Check ID documents exist
const { data: idPhotos } = await userClient
  .from('customer_id_photos')
  .select('id')
  .eq('customer_id', customerId)
  .limit(1);

if (!idPhotos || idPhotos.length === 0) {
  return res.status(400).json({ 
    error: 'Customer must upload ID documents before booking.' 
  });
}

// ✅ NOW allow booking creation
const { data: booking } = await userClient
  .from('bookings')
  .insert(bookingData)
  .select();
```

**Do NOT rely on frontend validation alone.** The backend must enforce these rules.

## Notification Contract

Define exactly when notifications are sent and to whom.

### Notification Triggers

| Event | Trigger | Recipients | Realtime? | Persisted? |
|-------|---------|-----------|-----------|------------|
| Booking Created | Customer submits booking | Owner, all staff in shop | Yes | Yes (audit trail) |
| Booking Confirmed | Owner approves booking | Customer | Yes | Yes |
| Booking Cancelled | Either party cancels | Both parties | Yes | Yes |
| Damage Reported | Staff reports damage | Owner | Yes | Yes (linked to damage record) |
| Payment Recorded | Payment added to booking | Customer, owner | Yes | Yes |

### Implementation Notes

- **Realtime**: Use WebSocket (already in `package.json`: `ws`) or Supabase realtime subscriptions
- **Persisted**: Create `notifications` table with `recipient_id`, `event_type`, `booking_id`, `read_at`
- **Subscribers**: Owner and all staff in the booking's `shop_id` should receive notifications
- **Do NOT**: Send notifications based on stale data; always query current values

### Notification Content

Never send sensitive pricing details in notifications. Send:
- Booking number (not price details)
- Customer name (not ID photo data)
- Event type and timestamp

## Customer App Permission Boundary

The customer app (if separate from owner app) is **read-only by default** with three specific exceptions.

### Allowed Mutations

Customers can ONLY modify:
1. **Own Profile** (`UPDATE customers WHERE id = auth.user_id`)
   - name, phone, email, address only
   - NOT allowed to change: `role`, `status`, `shop_id`

2. **Own ID Documents** (INSERT/DELETE from `customer_id_photos`)
   - Can upload new ID photos
   - Can delete own photos
   - Subject to RLS: Can only access own customer record

3. **Create Bookings** (INSERT into `bookings` with customer_id = self)
   - Only if profile complete + ID docs uploaded
   - Must provide `shop_id` (which shop they're booking from)
   - Backend sets `customer_id` from JWT (never trust client)

### Forbidden Mutations

Customers MUST NEVER have API endpoints or permissions to:

- ❌ **Modify vehicles** (change prices, status, photos)
- ❌ **Modify shop data** (change address, phone, terms)
- ❌ **View/modify other customers** (customer isolation via RLS)
- ❌ **Modify payments** (only owner can record payments)
- ❌ **Modify bookings after creation** (once created, booking is immutable to customer; only owner can cancel/modify)
- ❌ **Access staff/user management** (no visibility into shop staff)

### RLS Enforcement

If `backend/customer-web/` is a separate app, its Supabase client should have **different RLS policies** that deny write access except for the three cases above:

```sql
-- Customer app: Read-only on vehicles (with published filter)
CREATE POLICY "customer_vehicles_read" ON vehicles FOR SELECT
  USING (published = true);

-- Customer app: NO UPDATE/DELETE on vehicles
-- (policy should not exist for UPDATE/DELETE)

-- Customer app: Can update own profile
CREATE POLICY "customer_profile_update" ON customers FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
```

## Feature Evolution Guardrail

Before adding a new table, column, booking flow, or feature:

### 1. Search for Partial Implementations

```bash
# Search for existing code that might do similar work
grep -r "snapshot" backend/  # If adding snapshot feature
grep -r "notification" backend/  # If adding notifications
grep -r "ID.*document\|id.*photo" backend/  # If adding ID features
```

### 2. Extend Instead of Duplicating

**Bad**: Adding `vehicle_snapshot_v2` because the old snapshot structure didn't fit.
**Good**: Migrating existing `vehicle_snapshot` JSONB structure to include new fields.

**Bad**: Creating `customer_notifications` table when `notifications` table already exists.
**Good**: Reusing `notifications` table with a new `event_type` enum value.

### 3. Justify Duplication

If you must duplicate data (e.g., snapshot vehicle_name in booking), document **why**:
- Immutability requirement? (✅ Booking snapshot is justified)
- Performance? (Consider caching instead)
- Historical audit trail? (✅ Justified, but add migration/comment)

## Vehicle Availability & Concurrency

**Availability must be enforced in backend, not frontend.**

### Booking Overlap Validation

When creating or modifying a booking, the backend MUST reject if:
- The vehicle already has a non-cancelled booking that overlaps with the requested `start_date` and `end_date`
- Overlap is calculated as: `(new_start < existing_end) AND (new_end > existing_start)`

```typescript
// In server/routes.ts POST /api/bookings:
const { data: conflicts } = await userClient
  .from('bookings')
  .select('id, start_date, end_date')
  .eq('vehicle_ids', bookingData.vehicle_ids)
  .neq('status', 'Cancelled')  // Exclude cancelled bookings
  .or(`and(start_date.lt.${endDate}, end_date.gt.${startDate})`);

if (conflicts && conflicts.length > 0) {
  return res.status(409).json({ 
    error: 'Vehicle not available for selected dates',
    conflictingBooking: conflicts[0].id
  });
}
```

### Transactional Protection

- Use database transactions or explicit locking to prevent race conditions
- A booking must be inserted ATOMICALLY with availability verification
- Two simultaneous requests for the same vehicle must not both succeed if they overlap

### Frontend Advisory Only

Frontend may query availability for UX purposes (calendar highlighting, grayed-out dates), but:
- Frontend validation is STRICTLY advisory
- Frontend should display "checking availability..." during submission
- Backend ALWAYS validates; never trust frontend availability checks

## Booking State Machine

**Bookings have strict state transitions. Only these transitions are allowed:**

```
pending → confirmed
pending → cancelled
confirmed → cancelled (owner only)
confirmed → completed
completed (terminal state - no further transitions)
cancelled (terminal state - no further transitions)
```

### Validation Rules

**Backend must validate every transition:**

```typescript
// Allowed transitions table
const BOOKING_TRANSITIONS = {
  'pending': ['confirmed', 'cancelled'],
  'confirmed': ['cancelled', 'completed'],
  'completed': [],
  'cancelled': [],
};

// In server/routes.ts PATCH /api/bookings/:id
const currentStatus = booking.status;
const newStatus = req.body.status;

if (!BOOKING_TRANSITIONS[currentStatus]?.includes(newStatus)) {
  return res.status(400).json({ 
    error: `Invalid transition: ${currentStatus} → ${newStatus}` 
  });
}

// Additional rules:
if (newStatus === 'cancelled' && currentStatus === 'confirmed') {
  // Only owner can cancel confirmed bookings
  if (user.role !== 'owner' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Only owner can cancel confirmed bookings' });
  }
}
```

### Frontend Constraint

Frontend must NOT include a status dropdown allowing arbitrary transitions. Render only the ALLOWED next states for the current status.

## Payments & Accounting Boundary

**Payments are append-only records and must NEVER be deleted.**

### Payment Immutability

```typescript
// ❌ FORBIDDEN: DELETE payments
app.delete('/api/payments/:id', (req, res) => {
  return res.status(403).json({ error: 'Payments cannot be deleted' });
});

// ✅ ALLOWED: Create reversal/void payment
app.post('/api/payments/reverse', (req, res) => {
  // Insert new payment with negative amount and type='reversal'
  const reversalData = {
    booking_id: req.body.booking_id,
    amount: -req.body.original_amount,
    payment_method: req.body.original_method,
    payment_type: 'reversal',
    reference_payment_id: req.body.original_payment_id,
    // ...
  };
});
```

### Booking Totals Are Immutable

**Booking totals MUST be derived from the booking snapshot, never recalculated:**

```typescript
// ❌ WRONG: Recalculate from payments
const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

// ✅ CORRECT: Read from snapshot
const expectedTotal = booking.total_amount;  // From booking snapshot, set at creation time
const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
const remaining = expectedTotal - totalPaid;
```

### Partial Payments

Partial payments are allowed, but:
- Booking must explicitly flag `allows_partial_payment = true` at creation
- Frontend should show progress: `$paid / $total`
- Backend should warn if trying to mark booking 'completed' with outstanding balance

## Owner vs Staff Authority

**Business rule changes are owner-only. Staff operates bookings but cannot redefine business rules.**

### Owner-Only Decisions

ONLY `owner` or `admin` role can:
- ✅ **Publish/unpublish vehicles** (toggle `published = true`)
- ✅ **Modify pickup location** (`rental_shops.address`)
- ✅ **Modify owner terms & conditions** (cancellation policy, insurance terms, deposit amount)
- ✅ **Change daily_rate or pricing** on vehicles
- ✅ **Delete vehicles** (soft delete)
- ✅ **Manage shop staff** (add/remove users)
- ✅ **Cancel confirmed bookings** (with reason)

### Staff Authority

Staff (`staff` role) can:
- ✅ **Operate bookings**: Accept pending bookings, mark as completed
- ✅ **Manage customers**: Create/edit customer records
- ✅ **Document damages**: Report damage with photos
- ✅ **Record payments**: Log payment transactions (read-only, append-only)
- ❌ Cannot publish vehicles
- ❌ Cannot modify pricing
- ❌ Cannot change pickup location
- ❌ Cannot manage other staff
- ❌ Cannot modify booking totals or deposit amounts

```typescript
// In server/routes.ts, gate operations by role:
if (!['owner', 'admin'].includes(user.role)) {
  return res.status(403).json({ error: 'Only owner can modify pricing' });
}
```

## Time & Timezone Rules

**All timestamps are stored in UTC. Timezone conversion happens only in frontend display.**

### Storage & Calculation

- `start_date`, `end_date`, `created_at`, `updated_at` all stored as `TIMESTAMPTZ` with UTC
- Overlap calculations use UTC values directly
- Sorting and filtering use UTC comparison

```typescript
// ✅ CORRECT: Store as ISO string in UTC
const startDate = new Date('2026-02-15T10:00:00Z').toISOString();
// Result: "2026-02-15T10:00:00.000Z"

// ✅ CORRECT: Backend overlap check in UTC
const overlaps = bookings.some(b => 
  new Date(b.start_date) < new Date(endDate) &&
  new Date(b.end_date) > new Date(startDate)
);
```

### Frontend Display Only

Frontend converts UTC → local timezone for user display:

```typescript
// ✅ CORRECT: Display only
const displayDate = new Date(booking.start_date).toLocaleString();
// If user is in IST (UTC+5:30), shows local time

// ❌ WRONG: Converting to local for booking creation
const localDate = new Date(); // User's local time
const booking = { start_date: localDate }; // Now stored as local time!
```

### Duration Calculations

When calculating rental duration (e.g., for pricing), use UTC timestamps:

```typescript
const startUtc = new Date(booking.start_date);
const endUtc = new Date(booking.end_date);
const durationMs = endUtc - startUtc;
const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
const rentAmount = durationDays * vehicle.daily_rate;
```

## Data Retention & Legal Rules

**Customer data and booking records have legal and audit constraints.**

### Customer ID Documents (Deletable)

Customer ID photos can be deleted AFTER:
1. Booking is `completed`
2. Retention period has passed (e.g., 2 years from completion)

```typescript
// In Supabase, add index for cleanup:
// SELECT * FROM bookings 
// WHERE status = 'Completed' 
// AND completed_at < NOW() - INTERVAL '2 years'

// Then delete associated customer_id_photos:
const { error } = await adminClient
  .from('customer_id_photos')
  .delete()
  .eq('customer_id', customerId)
  .lt('created_at', twoYearsAgo);
```

### Bookings (Never Hard-Deleted)

Bookings must NEVER be hard-deleted:
- ✅ Soft delete: Set `deleted_at = NOW()` (optional, for archival)
- ❌ Hard delete: `DELETE FROM bookings WHERE id = ...` (FORBIDDEN)

**Why**: Audit trail, financial reconciliation, dispute resolution, legal compliance.

```typescript
// ❌ FORBIDDEN
await adminClient.from('bookings').delete().eq('id', bookingId);

// ✅ ALLOWED (if archival needed)
await userClient.from('bookings').update({ deleted_at: NOW() }).eq('id', bookingId);
```

### Audit Constraints on Soft Deletes

Soft-deleted records:
- Must remain queryable (include `deleted_at` in admin queries)
- Must not appear in frontend user-facing lists (filter `WHERE deleted_at IS NULL`)
- Must be included in accounting/audit reports with reason

## Explicit "DO NOT" Rules

These rules exist because they have caused bugs in this codebase:

### 🚫 DO NOT Rely on Frontend Filtering for Security

**Wrong**:
```typescript
// Frontend: filter vehicles by published
const published = vehicles.filter(v => v.published === true);
```

**Why**: Customer can bypass this by directly querying the API without the filter.

**Right**:
```sql
-- Database RLS policy enforces it
CREATE POLICY "customers_see_published" ON vehicles FOR SELECT
  USING (published = true);
```

### 🚫 DO NOT Bypass RLS to Fix Bugs

**Wrong**:
```typescript
// Using service role key to insert data for a customer
const adminClient = getSupabaseAdminClient();
const { data } = await adminClient.from('bookings').insert(bookingData);
```

**Why**: Service role bypasses RLS; if there's a bug, fix the RLS policy instead.

**Right**:
```typescript
// Use authenticated client so RLS is enforced
const userClient = getUserClient(req);
const { data } = await userClient.from('bookings').insert(bookingData);
// RLS policy will reject if shop_id doesn't match user's shop
```

### 🚫 DO NOT Duplicate Data Without Strong Justification

**Wrong**:
```sql
-- Storing customer name in both customers AND bookings tables for "convenience"
INSERT INTO bookings (customer_id, customer_name, ...) VALUES (...);
-- Now if customer name changes, bookings are stale
```

**Right**: Store `customer_id` only, join at query time. EXCEPTION: Booking snapshot (justified by immutability requirement).

### 🚫 DO NOT Couple Owner UI State Directly to Customer UI

**Wrong**:
```typescript
// In customer app, reading from owner app's Zustand store
const { shopName, staffList } = useOwnerStore();  // ❌ NO!
```

**Why**: Customer app UI should be independent. If owner app UX changes, customer app breaks.

**Right**:
```typescript
// Query data via API with customer RLS policies
const { data: shop } = await userClient
  .from('rental_shops')
  .select('name, phone')  // Only public fields
  .eq('id', shopId);
```

### 🚫 DO NOT Add Columns Without Updating Field Mapping

**Wrong**:
```typescript
// Added booking.gst_amount to schema but forgot mapFieldsToDb()
app.post('/api/bookings', (req, res) => {
  const mapped = mapFieldsToDb(req.body);  // gstAmount → ??? (not mapped!)
  // Now it silently fails or inserts NULL
});
```

**Right**:
```typescript
// Update mapFieldsToDb() first
function mapFieldsToDb(data: Record<string, any>) {
  const fieldMap = {
    'gstAmount': 'gst_amount',  // ✅ Added
    // ... other mappings
  };
  // ...
}
```

### 🚫 DO NOT Create Soft Delete Queries Without Filtering deleted_at

**Wrong**:
```typescript
// Forgot to filter out soft-deleted vehicles
const { data: vehicles } = await userClient
  .from('vehicles')
  .select('*');
  // Returns deleted vehicles too!
```

**Right**:
```typescript
const { data: vehicles } = await userClient
  .from('vehicles')
  .select('*')
  .is('deleted_at', null);  // ✅ Explicitly filter
```

### 🚫 DO NOT Use Frontend JWT or Device ID for Backend Logic

**Wrong**:
```typescript
// Backend trusts device_id from request body
const { device_id } = req.body;
if (device_id === lastDeviceId) { /* allow */ }  // ❌ Client can spoof!
```

**Right**:
```typescript
// Extract from JWT token (signed by Supabase, can't be forged)
const user = req.auth.user;  // From middleware that validates JWT
const { device_id } = user.user_metadata;  // Signed by Supabase
```

### 🚫 DO NOT Mix Multi-Tenant Data Without shop_id

**Wrong**:
```typescript
// Inserting payment without shop_id; RLS won't filter it
const { data } = await userClient
  .from('payments')
  .insert({ booking_id, amount, ... });
  // RLS can't isolate this payment to a shop!
```

**Right**:
```typescript
// Always include shop_id in payload
const { data } = await userClient
  .from('payments')
  .insert({ shop_id, booking_id, amount, ... });
  // RLS filters by shop_id → strict isolation
```

## Adding a New Feature

1. **Schema**: Add table/columns to [backend/supabase_schema.sql](backend/supabase_schema.sql)
2. **RLS**: Add policy to [backend/supabase_rls_policies.sql](backend/supabase_rls_policies.sql) (enforce `shop_id`)
3. **API Route**: Add handler to [backend/server/routes.ts](backend/server/routes.ts) (strip `user_id`, require `shop_id`)
4. **Field Mapping**: Update `mapFieldsToDb()` if using camelCase frontend names
5. **Store Methods**: Add API calls to [backend/client/src/lib/store.ts](backend/client/src/lib/store.ts)
6. **UI**: Create component in [backend/client/src/pages/](backend/client/src/pages/)
7. **Test**: Verify RLS allows access in Supabase SQL Editor
8. **Verify Guardrails**: Search for partial implementations before duplicating logic
