# Storage Error Handling & Schema Alignment Fix

## Overview
Fixed critical issues in customer ID photo upload to:
1. Handle Supabase Storage failures gracefully (503 errors, DNS resolution)
2. Ensure all photo writes go to `customer_id_photos` table (NOT customers table)
3. Provide clear error feedback to users
4. Prevent silent upload failures

## Changes Made

### 1. Customer Fetch Logic (Lines 50-130)
**Fixed:** Direct queries to `customer_id_photos` table instead of `v_customer_id_photos` view
- **Reason:** Avoid 400 errors from view/RLS complexity; directly query source table
- **New Behavior:**
  - Query `customer_id_photos` with `.eq('shop_id', shopId)`
  - Build photo map by customer_id + side
  - Load signed URLs via photoService for each photo found
  - Add error handling for signed URL generation (won't stop customer display if photo URLs fail)

### 2. Photo Upload for Existing Customers (Lines 200-320)
**Added:** Error handling for storage upload failures
```tsx
try {
  const result = await uploadCustomerIdPhoto(shopId, initialData.id, file);
  
  if (result.success && result.path) {
    // Insert into customer_id_photos (NOT UPDATE customers)
    const { error: insertError } = await supabase
      .from('customer_id_photos')
      .insert({ shop_id, customer_id, side, file_path, storage_bucket });
    
    // Only mark uploaded if insert succeeds
    setUploaded(!insertError);
  } else {
    // Handle storage failure
    const errorMsg = result.error || 'Upload failed';
    if (errorMsg.includes('503') || errorMsg.includes('unavailable') || errorMsg.includes('ENOTFOUND')) {
      toast({ title: 'Storage Unavailable', description: 'Please try again in a moment' });
    } else {
      toast({ title: 'Upload Failed', description: errorMsg });
    }
  }
} catch (uploadErr: any) {
  // Handle network/DNS errors
  const errMsg = uploadErr?.message || 'Upload error';
  if (errMsg.includes('ENOTFOUND') || errMsg.includes('DNS') || errMsg.includes('network')) {
    toast({ title: 'Network Error', description: 'Please check your internet connection' });
  }
}
```

**Error Types Detected:**
- `503 Service Unavailable` → "Storage Unavailable. Please try again in a moment."
- `ENOTFOUND` / DNS errors → "Network Error. Please check your internet connection."
- Generic storage errors → Display actual error message
- DB insert errors → "Partial Success. Photo uploaded but DB insert failed."

### 3. Photo Upload During Customer Creation (Lines 450-520)
**Added:** Error handling for both front and back photos
- Wrapped each photo upload in try-catch
- Detects storage 503 errors and logs them
- Does NOT mark photo as uploaded if storage fails (prevents data inconsistency)
- Continues with back photo upload even if front fails
- Logs all failures for debugging

**Key Behavior:**
```tsx
if (pendingFrontFile) {
  try {
    const result = await uploadCustomerIdPhoto(shopId, row.id, pendingFrontFile);
    if (result.success && result.path) {
      // Insert to customer_id_photos
      const { error: insertError } = await supabase.from('customer_id_photos').insert({ ... });
      
      if (!insertError) {
        // Only then mark as uploaded
        uploadedFrontPath = result.path;
        setFrontUploaded(true);
      } else {
        frontUploadFailed = true;
        console.error('[Customer Create] Front photo DB insert failed:', insertError);
      }
    } else {
      // Storage upload failed
      frontUploadFailed = true;
      const errorMsg = result.error || 'Upload failed';
      if (errorMsg.includes('503') || errorMsg.includes('unavailable')) {
        console.error('[Customer Create] Front photo storage error:', errorMsg);
      }
    }
  } catch (uploadErr: any) {
    frontUploadFailed = true;
    console.error('[Customer Create] Front photo upload error:', uploadErr);
  }
  setPendingFrontFile(null);
}
```

## Database Alignment

### What Changed
✅ **No longer writes to:**
- `customers.id_photo_front_path`
- `customers.id_photo_back_path`
- `customers.id_photos_uploaded_at`

✅ **Now writes to:**
- `customer_id_photos` table (separate INSERT for each photo side)

✅ **Now reads from:**
- `customer_id_photos` table (direct query with shop_id filter)
- Uses `.eq('side', 'front')` or `.eq('side', 'back')` to get specific photos

### Why
1. **Separates concerns:** Customer metadata (customers table) vs photo records (customer_id_photos table)
2. **Prevents JSON array errors:** No more attempting to write complex objects to customers columns
3. **Simplifies RLS:** Each photo is a separate row with shop_id, easier to restrict
4. **Enables retries:** Failed photo uploads don't block customer creation (photos added separately)

## Error Handling Strategy

### Storage 503 / Unavailable
- **Symptom:** Supabase Storage service down
- **User Message:** "Storage Unavailable. Please try again in a moment."
- **Backend Behavior:** Don't insert DB record, log error, allow user to retry via Edit

### DNS / Network Errors (ENOTFOUND)
- **Symptom:** Internet connectivity issue or DNS resolution failure
- **User Message:** "Network Error. Please check your internet connection."
- **Backend Behavior:** Don't insert DB record, log error, allow user to retry

### DB Insert Failures
- **Symptom:** Photo uploaded to storage but DB insert failed
- **User Message:** "Partial Success. Photo uploaded but DB insert failed."
- **Backend Behavior:** Photo is in storage but not linked to customer; user can retry or delete manually

### Generic Upload Failures
- **Symptom:** Unexpected error from uploadCustomerIdPhoto
- **User Message:** Display actual error message
- **Backend Behavior:** Don't insert DB record, allow retry

## Validation
- ✅ TypeScript compilation: No errors
- ✅ All photo writes now INSERT to customer_id_photos (verified in code)
- ✅ All photo reads now SELECT from customer_id_photos (verified in code)
- ✅ Error handling covers 503, DNS, network, and DB errors
- ✅ Blob URLs are revoked to prevent memory leaks
- ✅ Signed URLs replace blob URLs immediately after DB insert

## Testing Recommendations

### Test 1: New Customer with Photo (Normal)
1. Add customer with front and back ID photos
2. Verify photos appear as signed URLs (not blob)
3. Refresh page → photos still visible
4. Check database: customer_id_photos has 2 rows (front + back)
5. Check storage: 2 files in customer-ids bucket

### Test 2: Storage Upload Failure (503)
1. Simulate storage 503 by stopping Supabase
2. Try to add ID photo for existing customer
3. Should see: "Storage Unavailable. Please try again in a moment."
4. Check database: No row in customer_id_photos (correctly failed)
5. Photo state not marked as uploaded

### Test 3: Partial Failure (Upload Success, DB Insert Fail)
1. Modify uploadCustomerIdPhoto to succeed but DB insert to fail
2. Should see: "Partial Success. Photo uploaded but DB insert failed."
3. Photo NOT displayed as uploaded badge
4. User can retry or try uploading again

### Test 4: Existing Customer Photo Edit
1. Edit customer with existing ID photos
2. Replace front photo
3. Verify old signed URL replaced with new one
4. Check DB: Old row deleted, new row inserted
5. Check storage: Old file still exists, new file created

## Files Modified
- `backend/client/src/pages/Customers.tsx`
  - Lines 50-130: Customer fetch with photo error handling
  - Lines 200-320: Photo upload for existing customers with storage error detection
  - Lines 450-520: Photo upload during customer creation with error logging

## No Changes to
- `backend/client/src/lib/photoService.ts` (stable interface)
- `auth.users` (protected)
- `customers` table structure (photo columns kept but unused)
- Storage bucket policies (already configured)
