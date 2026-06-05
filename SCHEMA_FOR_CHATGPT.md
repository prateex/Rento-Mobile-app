# Rento App - Complete Database Schema

## Overview
Multi-tenant vehicle rental application with Supabase PostgreSQL backend, RLS-based shop isolation, and soft-delete patterns.

---

## Core Tables (14 Total)

### 1. **rental_shops** (Multi-tenancy Root)
- `id` (UUID, PK) - Shop identifier
- `owner_id` (UUID, FK) - References `users.auth_id`
- `name` (text) - Shop name
- `phone` (text) - Contact number
- `email` (text) - Contact email
- `address`, `city`, `state`, `pincode` - Location
- `gst_number` (text) - Tax ID
- `created_at`, `updated_at` (timestamps)

**Purpose:** Root entity for multi-tenant isolation. Every user, vehicle, booking belongs to a shop.

---

### 2. **users** (Authentication & Authorization)
- `id` (UUID, PK)
- `auth_id` (UUID, FK) - Links to Supabase Auth
- `shop_id` (UUID, FK) - Which shop user manages
- `name`, `email` (text)
- `role` (ENUM: 'owner', 'staff') - Permission level
- `is_active` (boolean) - Soft delete flag
- `created_at`, `updated_at`, `deleted_at` (timestamps)

**Purpose:** Users within a shop. Only one owner per shop. RLS policies filter by `shop_id`.

---

### 3. **customers** (Renters)
- `id` (UUID, PK)
- `shop_id` (UUID, FK) - Which shop owns this customer
- `customer_number` (text) - Auto-generated: CUST0001, CUST0002, etc.
- `full_name` (text, NOT NULL)
- `phone` (text, UNIQUE)
- `email`, `address`, `city`, `state`, `pincode` (text)
- `id_type` (ENUM: 'Aadhaar', 'Voter ID', 'Passport', 'Driving License')
- `id_photos` (UUID[], default: {}) - Array of photo IDs
- `documents` (JSONB) - Flexible document storage
- `status` (ENUM: 'Pending', 'Active', 'Suspended') - Verification status
- `notes` (text) - Internal notes
- `created_at`, `updated_at`, `deleted_at` (timestamps)
- `user_id`, `created_by` (UUID) - Audit trail
- `id_photos_uploaded_at` (timestamp) - When ID photos were uploaded

**RLS Policies:** SELECT, INSERT, UPDATE, DELETE all require `shop_id = get_my_shop_id()`

---

### 4. **vehicles** (Fleet Management)
- `id` (UUID, PK)
- `shop_id` (UUID, FK)
- `registration_number` (text, UNIQUE) - License plate
- `type` (ENUM: 'bike', 'car', 'van', 'truck', 'bus', 'auto')
- `fuel_type` (ENUM: 'Petrol', 'Diesel', 'Electric', 'Hybrid')
- `daily_rate` (numeric) - Rental cost per day
- `status` (ENUM: 'Available', 'Booked', 'UnderMaintenance', 'Retired')
- `created_at`, `updated_at`, `deleted_at` (timestamps)
- `user_id`, `created_by` (UUID)

**RLS Policies:** SELECT, INSERT, UPDATE, DELETE all require `shop_id = get_my_shop_id()`

---

### 5. **bookings** (Rental Transactions)
- `id` (UUID, PK)
- `shop_id` (UUID, FK)
- `booking_number` (text) - Auto-generated: BOOK-001, BOOK-002, etc.
- `customer_id` (UUID, FK) - Which customer
- `vehicle_ids` (UUID[], NOT NULL, default: {}) - Array of vehicles rented
- `start_date`, `end_date` (timestamp) - Rental period
- `start_datetime`, `end_datetime` (timestamp) - More precise times
- `rent`, `deposit`, `total_amount` (numeric) - Pricing
- `advance_amount`, `balance_amount` (numeric) - Payment tracking
- `status` (ENUM: 'Booked', 'CheckedOut', 'CheckedIn', 'Completed', 'Cancelled')
- `payment_status` (ENUM: 'Paid', 'Unpaid', 'PartiallyPaid')
- `payment_choice`, `payment_mode`, `payment_type` (ENUM) - How paid
- `utr_number` (text) - Transaction reference
- `start_image`, `end_image` (text) - Photo proof paths
- `opening_odometer`, `closing_odometer` (numeric) - Mileage tracking
- `damages_during_rental` (JSONB) - Damage log
- `deposit_deduction`, `damage_notes` (numeric, text)
- `invoice_number`, `invoice_generated_at`, `invoice_generated_by` (text, timestamp, UUID)
- `refund_amount` (numeric)
- `history` (JSONB) - Event log
- `taken_at`, `taken_by` - When vehicle was taken
- `returned_at`, `returned_by` - When vehicle was returned
- `paid_at`, `paid_by` - When payment was made
- `cancelled_at` (timestamp)
- `finalized`, `invoice_pending`, `invoice_locked` (boolean) - Status flags
- `whatsapp_sent` (JSONB) - Notification tracking
- `created_at`, `updated_at`, `deleted_at` (timestamps)
- `user_id`, `created_by`, `notes` (UUID, text)
- `payment_date` (timestamp)
- `invoice_id` (UUID)

**RLS Policies:** SELECT, INSERT, UPDATE, DELETE all require `shop_id = get_my_shop_id()`

---

### 6. **customer_id_photos** (ID Verification)
- `id` (UUID, PK)
- `shop_id` (UUID, FK)
- `customer_id` (UUID, FK)
- `side` (text, CHECK: 'front' or 'back') - Which side of ID
- `file_path` (text) - Path in storage
- `storage_bucket` (text, default: 'customer-ids')
- `created_at` (timestamp, default: now())
- `deleted_at` (timestamp, nullable) - Soft delete

**Unique Constraint:** `(customer_id, side)` WHERE `deleted_at IS NULL`  
**Purpose:** One front + one back per customer. Re-upload soft-deletes old photos.

**RLS Policies:** SELECT, INSERT, UPDATE, DELETE all require `shop_id = get_my_shop_id()`

---

### 7. **payments** (Payment Records)
- `id` (UUID, PK)
- `shop_id` (UUID, FK)
- `booking_id` (UUID, FK)
- `amount` (numeric)
- `mode` (ENUM: 'Cash', 'Card', 'UPI', 'NetBanking', 'Cheque')
- `utr_number`, `notes` (text)
- `status` (ENUM: 'Pending', 'Completed', 'Failed', 'Refunded')
- `created_at` (timestamp)
- `user_id`, `recorded_by` (UUID) - Who recorded the payment

---

### 8. **damages** (Damage Claims)
- `id` (UUID, PK)
- `shop_id` (UUID, FK)
- `booking_id` (UUID, FK)
- `description` (text) - What was damaged
- `estimated_cost` (numeric) - Repair cost
- `status` (ENUM: 'Reported', 'Assessed', 'Repaired', 'ClaimedFromCustomer')
- `created_at`, `updated_at`, `deleted_at` (timestamps)

---

### 9. **documents** (Customer Documents)
- `id` (UUID, PK)
- `shop_id` (UUID, FK)
- `customer_id` (UUID, FK)
- `document_type` (text) - License, Insurance, etc.
- `file_path` (text) - Path in storage
- `expires_at` (timestamp)
- `created_at`, `updated_at`, `deleted_at` (timestamps)

---

### 10. **vehicle_damage_photos** (Damage Photo Evidence)
- `id` (UUID, PK)
- `damage_id` (UUID, FK)
- `file_path` (text) - Path in storage
- `created_at`, `updated_at` (timestamps)

---

### 11. **invoice_sequences** (Invoice Number Counter)
- `id` (UUID, PK)
- `shop_id` (UUID, FK, UNIQUE) - One counter per shop
- `next_invoice_number` (integer) - Current sequence
- `created_at`, `updated_at` (timestamps)

**Format:** INV-YY-MM-{sequence} e.g., INV-25-26-0001

---

### 12. **booking_number_counters** (Booking Number Counter)
- `shop_id` (UUID, PK) - One counter per shop
- `next_booking_number` (integer)
- `updated_at` (timestamp)

---

### 13. **customer_sequences** (Customer Number Counter)
- `id` (UUID, PK)
- `shop_id` (UUID, FK, UNIQUE)
- `sequence_number` (integer)
- `created_at`, `updated_at` (timestamps)

**Format:** CUST{sequence} e.g., CUST0001

---

### 14. **invoice_number_counters** (Backup Invoice Counter)
- `shop_id` (UUID, PK)
- `next_invoice_number` (integer)
- `updated_at` (timestamp)

---

## Enums (User-Defined Types)

```
id_type: 'Aadhaar', 'Voter ID', 'Passport', 'Driving License'
vehicle_type: 'bike', 'car', 'van', 'truck', 'bus', 'auto'
fuel_type: 'Petrol', 'Diesel', 'Electric', 'Hybrid'
vehicle_status: 'Available', 'Booked', 'UnderMaintenance', 'Retired'
booking_status: 'Booked', 'CheckedOut', 'CheckedIn', 'Completed', 'Cancelled'
payment_status: 'Paid', 'Unpaid', 'PartiallyPaid'
payment_mode: 'Cash', 'Card', 'UPI', 'NetBanking', 'Cheque'
customer_status: 'Pending', 'Active', 'Suspended'
```

---

## RLS (Row Level Security) Policies

### Pattern: Shop-Level Isolation
Every table uses the same RLS enforcement:

```sql
-- SELECT: User sees only their shop's data
CREATE POLICY {table}_select ON {table} FOR SELECT
  USING (shop_id = get_my_shop_id());

-- INSERT: User can only add to their shop
CREATE POLICY {table}_insert ON {table} FOR INSERT
  WITH CHECK (shop_id = get_my_shop_id());

-- UPDATE: User modifies only their shop's data
CREATE POLICY {table}_update ON {table} FOR UPDATE
  USING (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());

-- DELETE: RLS allows, but trigger converts to soft delete
CREATE POLICY {table}_delete ON {table} FOR DELETE
  USING (shop_id = get_my_shop_id());
```

### Tables with RLS
- `customers` (4 policies)
- `vehicles` (4 policies)
- `bookings` (4 policies)
- `customer_id_photos` (4 policies)
- `payments`, `damages`, `documents`, `vehicle_damage_photos` (implied)

### Storage Bucket Policies
Bucket: `customer-ids` (private, 5MB, image/* only)

```sql
-- Allow authenticated users to select
CREATE POLICY customer_ids_select ON storage.objects FOR SELECT
  USING (bucket_id = 'customer-ids');

-- Allow authenticated users to insert
CREATE POLICY customer_ids_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'customer-ids');

-- Allow deletion
CREATE POLICY customer_ids_delete ON storage.objects FOR DELETE
  USING (bucket_id = 'customer-ids');
```

---

## Helper Functions

### `get_my_shop_id()` - SECURITY DEFINER
**Purpose:** Get the authenticated user's shop_id for RLS enforcement

**Logic:**
```sql
SELECT shop_id FROM users 
WHERE auth_id = auth.uid() 
LIMIT 1;
```

**Usage:** Every RLS policy condition: `shop_id = get_my_shop_id()`

**Security:** SECURITY DEFINER bypasses RLS on `users` table to prevent recursion

---

## Soft Delete Pattern

### Implementation
Instead of `DELETE`, update `deleted_at`:

```sql
UPDATE customers SET deleted_at = now() WHERE id = 'customer-id';
UPDATE vehicles SET deleted_at = now() WHERE id = 'vehicle-id';
UPDATE bookings SET deleted_at = now() WHERE id = 'booking-id';
```

### Triggers
BEFORE DELETE triggers on all deletable tables convert DELETE to UPDATE:

```sql
CREATE TRIGGER trigger_soft_delete_{table} BEFORE DELETE ON {table}
FOR EACH ROW EXECUTE FUNCTION trigger_soft_delete_generic();
```

### SELECT Queries Must Filter
```sql
-- Show only active records
SELECT * FROM customers WHERE deleted_at IS NULL AND shop_id = get_my_shop_id();
```

---

## Auto-Numbering

### Sequences & Triggers
Generate human-friendly IDs:

- **Customer Numbers:** CUST0001, CUST0002, ... (per shop)
- **Booking Numbers:** BOOK-001, BOOK-002, ... (per shop)
- **Invoice Numbers:** INV-YY-MM-0001, INV-YY-MM-0002, ... (per shop per month)

### Tables
- `customer_sequences` - Tracks next customer number
- `booking_number_counters` - Tracks next booking number
- `invoice_sequences` - Tracks next invoice number

---

## Foreign Key Relationships

```
customers.shop_id → rental_shops.id
vehicles.shop_id → rental_shops.id
bookings.shop_id → rental_shops.id
bookings.customer_id → customers.id
bookings.invoice_id → invoices.id (if exists)
customer_id_photos.shop_id → rental_shops.id
customer_id_photos.customer_id → customers.id
payments.booking_id → bookings.id
damages.booking_id → bookings.id
documents.customer_id → customers.id
vehicle_damage_photos.damage_id → damages.id
users.shop_id → rental_shops.id
users.auth_id → auth.users.id (Supabase Auth)
```

---

## Key Constraints & Indexes

### Unique Constraints
- `customer_id_photos(customer_id, side)` WHERE deleted_at IS NULL
- `customers(phone)` - One phone per app
- `users(auth_id)` per shop
- `vehicles(registration_number)` - Unique license plate
- `customer_sequences(shop_id)` - One sequence per shop
- `invoice_sequences(shop_id)` - One sequence per shop

### Indexes (Performance)
- `idx_customers_shop_id` - Filter by shop
- `idx_vehicles_shop_id` - Filter by shop
- `idx_bookings_shop_id` - Filter by shop
- `idx_customer_id_photos_shop_id` - Filter by shop
- `idx_bookings_customer_id` - Link bookings to customer
- `idx_customers_phone` - Phone lookup
- `idx_vehicles_status` - Find available vehicles
- `idx_bookings_status` - Filter by booking state
- `idx_bookings_booking_number` - Lookup by number
- `idx_bookings_invoice_number` - Lookup by invoice
- And many more for deleted_at, dates, etc.

---

## Data Flow Example: Create Booking

1. **User logs in** → Supabase Auth → `auth.uid()` set
2. **Get shop_id** → `get_my_shop_id()` returns shop from `users` table
3. **Create booking** → INSERT requires `shop_id` match
4. **RLS checks** → All 4 policies (SELECT, INSERT, UPDATE, DELETE) verify shop_id
5. **Auto-number** → Trigger generates BOOK-001 in that shop
6. **Soft delete** → If deleted later, `deleted_at` is set (not hard deleted)
7. **Invoice** → Can generate INV-25-26-0001 for that booking

---

## Multi-Tenancy Isolation

**Method:** Shop-level RLS + shop_id on every table

**Guarantees:**
- ✅ Shop A users cannot see Shop B data (RLS enforces)
- ✅ Different shops don't affect each other (separate sequences, separate bookings)
- ✅ One auth user can manage one shop only (1:1 relationship)
- ✅ Deleted data not seen in queries (soft delete filter)

**Trust:** RLS policies are enforced at database layer before data leaves PostgreSQL.

---

## Total Schema Summary

- **Tables:** 14
- **RLS Policies:** 16 (4 per 4 core tables)
- **Enums:** 8 types
- **Foreign Keys:** 12+ relationships
- **Indexes:** 40+ for performance
- **Helper Functions:** 1 (get_my_shop_id)
- **Soft Delete Triggers:** 7
- **Unique Constraints:** 7
- **Storage Buckets:** 1 (customer-ids)

---

## Key Design Principles

1. **Multi-tenant first** - Every table has shop_id, every policy enforces it
2. **Soft delete everywhere** - Use deleted_at column, never hard delete
3. **Audit trail** - Track who created what, when
4. **Auto-numbering** - Human-friendly IDs per shop
5. **Photo versioning** - Unique index on (customer_id, side) allows re-upload
6. **Flexible storage** - JSONB for documents, jsonb for history
7. **Status workflows** - ENUMs for state machines (booking, payment, vehicle status)
8. **Helper functions** - get_my_shop_id() prevents RLS recursion
9. **Booking flexibility** - vehicle_ids array supports multi-vehicle rentals
10. **Payment tracking** - Advance, balance, deposit, refund columns

---

## Common Queries Pattern

```sql
-- Always include this filter for multi-tenancy
WHERE shop_id = get_my_shop_id() AND deleted_at IS NULL

-- Examples
SELECT * FROM customers 
  WHERE shop_id = get_my_shop_id() AND deleted_at IS NULL;

SELECT * FROM bookings 
  WHERE shop_id = get_my_shop_id() AND status = 'Completed';

SELECT * FROM vehicles 
  WHERE shop_id = get_my_shop_id() AND deleted_at IS NULL AND status = 'Available';
```

---

## Troubleshooting Common Issues

| Issue | Solution |
|-------|----------|
| 403 RLS Error on INSERT | Missing shop_id in payload |
| Can't find customer | Customer might be soft-deleted (deleted_at IS NOT NULL) |
| Duplicate customer error | Phone number already exists in another shop (global unique) |
| Invoice number not incrementing | Check `invoice_sequences` table for that shop |
| Photos not showing | Check storage bucket policies and file_path format |

---

Generated: 2026-01-20  
Database: Supabase PostgreSQL with RLS  
Multi-tenant: Yes, shop-level isolation  
Soft Delete: Yes, all tables support it
