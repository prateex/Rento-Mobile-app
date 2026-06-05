# Customer ID Photo Persistence - Testing Guide

## Overview
Fixed customer ID photo storage to use Supabase Storage with persistent text[] array in database. Photos now survive logout/login and work across browsers.

## What Changed

### Database Schema
- **customers.id_photos**: Changed from JSONB → **text[]** (array of storage paths)
- **customers.id_photos_uploaded_at**: New timestamp field for tracking uploads
- **Storage Bucket**: Created `customer-ids` bucket (private, 5MB limit, images only)
- **Path Structure**: `shop/{shop_id}/customers/{customer_id}/ids/{filename}`

### Storage Policies (RLS)
1. **customer_ids_select_same_shop**: Users can view photos from their shop only
2. **customer_ids_insert_same_shop**: Users can upload photos to their shop only
3. **customer_ids_delete_same_shop**: Users can delete photos from their shop only

### Frontend Changes
1. **Upload Options**: Camera + Gallery buttons (mobile-friendly)
2. **Multiple Photos**: Support for unlimited ID photos per customer
3. **Immediate Upload**: Existing customers - photos upload immediately
4. **Deferred Upload**: New customers - photos upload after DB record creation
5. **Scrollable Dialogs**: Add/Edit customer dialogs now have `overflow-y-auto` with 90vh max height

### Code Changes
- **photoService.ts**: Simplified API, removed metadata table dependency
  - `uploadCustomerIdPhoto(shopId, customerId, file)` → returns `{success, path, signedUrl}`
  - `getCustomerIdPhotoUrls(paths[])` → batch signed URL generation
  - `deleteCustomerIdPhoto(path)` → deletes from storage only
- **Customers.tsx**: Replaced PhotoUpload component with custom camera+gallery UI
- **Migration**: `20260109152000_customer_id_photos_array.sql` applied successfully

## Testing Checklist

### Pre-Test Setup
1. ✅ Dev server running on http://localhost:5001/
2. ✅ Supabase running locally (docker containers up)
3. ✅ Migration applied (`supabase db push --local` completed)
4. ✅ Storage bucket `customer-ids` created
5. ✅ RLS policies active

### Test 1: Upload ID Photo for New Customer
**Steps:**
1. Navigate to Customers page
2. Click "Add Customer" button
3. Fill in customer details (name, phone, address, etc.)
4. Click **Camera** or **Gallery** button to upload ID photo
5. Select/capture an image (max 5MB, image format only)
6. Verify photo preview appears in the form
7. Submit the form to create customer
8. **Expected:** Photo uploads to storage after customer creation, path stored in `customers.id_photos` array

**Verification:**
```sql
-- Check DB record
SELECT id, full_name, id_photos, id_photos_uploaded_at 
FROM customers 
WHERE phone = 'YOUR_TEST_PHONE';

-- Check storage
SELECT name, created_at 
FROM storage.objects 
WHERE bucket_id = 'customer-ids' 
AND name LIKE 'shop/%/customers/%';
```

### Test 2: Upload ID Photo for Existing Customer
**Steps:**
1. Open an existing customer (Edit mode)
2. Click **Camera** or **Gallery** button
3. Upload a new ID photo
4. **Expected:** Photo uploads immediately, preview appears, toast confirms success

**Verification:**
- Photo appears in preview grid
- Database `id_photos` array contains new path
- `id_photos_uploaded_at` timestamp updated

### Test 3: Multiple ID Photos
**Steps:**
1. Edit a customer
2. Upload 2-3 ID photos using Camera/Gallery
3. **Expected:** All photos appear in grid (2 columns)
4. Verify each photo has delete button (X icon in top-right)

### Test 4: Delete ID Photo
**Steps:**
1. Edit customer with existing photos
2. Click X button on a photo
3. Confirm deletion
4. **Expected:** 
   - Photo removed from preview
   - Storage object deleted
   - Database `id_photos` array updated (path removed)
   - Toast confirms deletion

**Verification:**
```sql
-- Check DB array
SELECT id_photos FROM customers WHERE id = 'CUSTOMER_ID';

-- Check storage (path should be gone)
SELECT name FROM storage.objects WHERE name = 'shop/.../PATH_TO_DELETED_PHOTO';
```

### Test 5: Logout/Login Persistence
**Steps:**
1. Upload ID photos for a customer
2. Logout from the app
3. Login again
4. Navigate to Customers → View customer details
5. **Expected:** All uploaded photos visible (not disappeared)

### Test 6: Cross-Browser Access
**Steps:**
1. Upload photos in Chrome
2. Open app in Firefox/Edge with same credentials
3. Navigate to customer details
4. **Expected:** All photos visible across browsers (stored in cloud, not locally)

### Test 7: RLS Security Test
**Steps:**
1. Login as Shop A user
2. Upload photo for customer in Shop A
3. Logout, login as Shop B user
4. Try to access Shop A's customer photos directly via URL
5. **Expected:** Access denied (403) - photos isolated by shop_id

### Test 8: File Validation
**Steps:**
1. Try uploading a non-image file (PDF, TXT)
2. **Expected:** Toast error "Please upload an image"
3. Try uploading a 6MB image
4. **Expected:** Toast error "Max 5MB allowed"

### Test 9: Scrollable Dialog
**Steps:**
1. Open Add Customer dialog
2. Fill all fields + upload multiple photos
3. **Expected:** Dialog content scrolls smoothly (overflow-y-auto)
4. No content cut off, all fields accessible

### Test 10: Photo URL Expiry
**Steps:**
1. Upload a photo
2. Wait 1 hour (signed URLs expire)
3. Reload customer details page
4. **Expected:** New signed URLs generated automatically, photos still visible

## Database Verification Queries

### Check Migration Status
```sql
SELECT version, name 
FROM supabase_migrations.schema_migrations 
WHERE version = '20260109152000';
```

### Check Column Type
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'customers' AND column_name IN ('id_photos', 'id_photos_uploaded_at');
```

### Check Storage Bucket
```sql
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'customer-ids';
```

### Check RLS Policies
```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' 
AND tablename = 'objects' 
AND policyname LIKE '%customer_ids%';
```

### View Sample Customer with Photos
```sql
SELECT 
  id, 
  full_name, 
  phone, 
  id_photos, 
  array_length(id_photos, 1) as photo_count,
  id_photos_uploaded_at
FROM customers
WHERE array_length(id_photos, 1) > 0
LIMIT 5;
```

### View Storage Objects
```sql
SELECT 
  name, 
  bucket_id, 
  created_at,
  metadata->>'size' as size_bytes
FROM storage.objects
WHERE bucket_id = 'customer-ids'
ORDER BY created_at DESC
LIMIT 10;
```

## Known Issues & Solutions

### Issue: Photos disappear after logout
**Solution:** ✅ Fixed - photos now stored in Supabase Storage with persistent paths in DB

### Issue: Photos not syncing across browsers
**Solution:** ✅ Fixed - cloud storage with database references, no local-only storage

### Issue: Old PhotoUpload component with expiry tracking
**Solution:** ✅ Removed - simplified to camera+gallery UI with permanent storage

### Issue: JSONB column incompatible with text[] API
**Solution:** ✅ Migrated - column converted to text[] array type

### Issue: Can't scroll long customer forms
**Solution:** ✅ Fixed - dialogs now have `max-h-[90vh] overflow-y-auto`

## Rollback Plan

If issues occur, rollback migration:
```sql
-- Revert column type
ALTER TABLE public.customers
ALTER COLUMN id_photos TYPE jsonb
USING id_photos::jsonb;

-- Remove timestamp column
ALTER TABLE public.customers
DROP COLUMN IF EXISTS id_photos_uploaded_at;

-- Delete storage bucket (careful - deletes all photos!)
DELETE FROM storage.objects WHERE bucket_id = 'customer-ids';
DELETE FROM storage.buckets WHERE id = 'customer-ids';
```

## Success Criteria
- ✅ Photos persist after logout/login
- ✅ Photos accessible across multiple browsers/devices
- ✅ Camera + gallery upload options work
- ✅ Multiple photos supported per customer
- ✅ RLS policies enforce shop-level isolation
- ✅ Dialogs scrollable for long forms
- ✅ File validation (type + size) working
- ✅ Signed URLs auto-refresh when expired

## Contact
For issues or questions, check:
- Migration file: `supabase/migrations/20260109152000_customer_id_photos_array.sql`
- PhotoService: `backend/client/src/lib/photoService.ts`
- Customers UI: `backend/client/src/pages/Customers.tsx`
