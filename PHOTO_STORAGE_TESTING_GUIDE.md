# Photo Storage Testing Guide

## Pre-Test Verification ✅

### Database
```bash
# Tables exist
customer_id_photos ✅
vehicle_damage_photos ✅

# Storage buckets exist
customer-id-photos (private) ✅
vehicle-damage-photos (private) ✅

# RLS policies applied (6 total)
Shop members read customer ID photos ✅
Shop members upload customer ID photos ✅
Shop members delete customer ID photos ✅
Shop members read vehicle damage photos ✅
Shop members upload vehicle damage photos ✅
Shop members delete vehicle damage photos ✅

# Functions exist
calculate_photo_expiry() ✅
cleanup_expired_id_photos() ✅
cleanup_damage_photos() ✅
update_id_photo_expiry() ✅
```

## Test Scenarios

### 1. Customer ID Photo Upload (New Customer)

**Steps:**
1. Go to Customers page
2. Click "Register Customer"
3. Fill in customer details
4. Upload front ID photo (click/drag to upload area)
5. Upload back ID photo (for Aadhaar/Voter ID/DL)
6. Click "Register Customer"

**Expected Results:**
- ✅ Photos show preview in form
- ✅ Customer created successfully
- ✅ Photos uploaded to Supabase Storage in background
- ✅ Toast notification: "Registered"
- ✅ Photos stored in path: `customer-id-photos/{shop_id}/{customer_id}/front_*.jpg`

**Database Verification:**
```sql
SELECT * FROM customer_id_photos ORDER BY uploaded_at DESC LIMIT 2;
-- Should show 2 records with correct shop_id, customer_id, photo_type
```

### 2. Customer ID Photo Upload (Existing Customer)

**Steps:**
1. Go to Customers page
2. Click on existing customer (edit mode)
3. Upload/replace front or back photo
4. Wait for upload to complete

**Expected Results:**
- ✅ Upload progress indicator shows
- ✅ Toast notification: "Front photo uploaded successfully"
- ✅ Photo preview updates with new image
- ✅ Download button appears on photo
- ✅ Delete button appears on photo

### 3. Photo Expiry Tracking

**Steps:**
1. Create a booking for a customer with ID photos
2. Mark booking as "Completed"
3. Edit the customer again
4. Check photo expiry display

**Expected Results:**
- ✅ Photos show countdown: "X days left"
- ✅ Color coding:
  - Gray for 3+ days
  - Orange for 1-2 days  - Red for expired/expires today

**Database Verification:**
```sql
-- Check expiry calculation
SELECT 
  photo_type, 
  expires_at,
  days_until_expiry
FROM v_customer_id_photos 
WHERE customer_id = '<customer-id>';
```

### 4. Photo Download

**Steps:**
1. Open customer with photos
2. Click download button on photo preview
3. Check Downloads folder

**Expected Results:**
- ✅ Photo downloads with descriptive name: `Aadhaar_Front_1704556800000.jpg`
- ✅ No errors in console
- ✅ File is valid image

### 5. Photo Deletion

**Steps:**
1. Open customer with photos
2. Click delete (X) button on photo
3. Confirm deletion

**Expected Results:**
- ✅ Confirmation dialog appears
- ✅ Toast notification: "Front photo deleted"
- ✅ Photo removed from UI
- ✅ File removed from storage
- ✅ Metadata removed from database

**Database Verification:**
```sql
-- Verify photo record deleted
SELECT * FROM customer_id_photos WHERE customer_id = '<customer-id>';

-- Verify file deleted from storage
SELECT * FROM storage.objects 
WHERE bucket_id = 'customer-id-photos' 
AND name LIKE '%<customer-id>%';
```

### 6. Shop-Level Access Control (Security Test)

**Setup:**
- User A from Shop 1
- User B from Shop 2
- Customer with photos in Shop 1

**Steps:**
1. Login as User A (Shop 1)
2. Upload photo for customer in Shop 1
3. Logout, login as User B (Shop 2)
4. Try to access Shop 1 customer's photos

**Expected Results:**
- ✅ User B cannot see photos from Shop 1
- ✅ RLS policies enforce shop_id isolation
- ✅ Signed URL generation fails for wrong shop

**Manual Verification:**
```sql
-- As Shop 2 user, this should return 0 rows
SELECT * FROM customer_id_photos WHERE shop_id = '<shop-1-id>';
-- RLS policy will filter out results
```

### 7. Vehicle Damage Photos (Future Enhancement)

Currently implemented but not yet integrated in UI. Database and storage ready for:
- Upload damage photos during booking return
- Associate photos with damage records
- Auto-cleanup when damage marked as repaired

**Test when UI is implemented:**
```typescript
// Example usage
const result = await uploadVehicleDamagePhoto(
  shopId,
  vehicleId,
  damageId,
  fileObject
);
```

## Manual SQL Tests

### Test Expiry Calculation
```sql
-- Simulate booking completion and check expiry
UPDATE bookings 
SET status = 'Completed', 
    returned_at = NOW() 
WHERE id = '<booking-id>';

-- Check if photos got expiry date
SELECT 
  c.full_name,
  p.photo_type,
  p.expires_at,
  p.days_until_expiry
FROM customer_id_photos p
JOIN customers c ON c.id = p.customer_id
WHERE p.booking_id = '<booking-id>';
```

### Test Cleanup Function
```sql
-- Manually expire a photo for testing
UPDATE customer_id_photos 
SET expires_at = NOW() - INTERVAL '1 day'
WHERE id = '<photo-id>';

-- Run cleanup (should delete expired photo from storage)
SELECT cleanup_expired_id_photos();

-- Verify deletion
SELECT * FROM customer_id_photos WHERE id = '<photo-id>';
-- Should return 0 rows
```

## Common Issues & Solutions

### Issue: Photos not uploading
**Solution:**
- Check browser console for errors
- Verify Supabase connection (check network tab)
- Ensure RLS policies are active
- Check file size < 5MB

### Issue: "Permission denied" error
**Solution:**
- Verify user is authenticated
- Check shop_id in user profile matches path
- Verify RLS policies on storage.objects table
- Check folder structure: `{shop_id}/{customer_id}/{file}`

### Issue: Signed URLs returning 404
**Solution:**
- Verify file exists in storage.objects table
- Check storage_path in database matches actual file
- Ensure RLS policies allow SELECT
- Try regenerating signed URL (may have expired after 1 hour)

### Issue: Expiry not calculating
**Solution:**
- Verify booking status is 'Completed'
- Check trigger is active: `\d bookings` in psql
- Manually test function: `SELECT calculate_photo_expiry('<booking-id>');`
- Ensure booking has a customer_id

## Performance Monitoring

### Check storage usage
```sql
SELECT 
  bucket_id,
  COUNT(*) as file_count,
  SUM(metadata->>'size')::bigint as total_bytes,
  pg_size_pretty(SUM(metadata->>'size')::bigint) as total_size
FROM storage.objects
WHERE bucket_id IN ('customer-id-photos', 'vehicle-damage-photos')
GROUP BY bucket_id;
```

### Check expired photos
```sql
SELECT 
  COUNT(*) as expired_count,
  SUM(metadata->>'size')::bigint as expired_bytes
FROM customer_id_photos p
JOIN storage.objects o ON o.name = p.storage_path
WHERE p.expires_at < NOW();
```

## Production Checklist

Before deploying to production:

- [ ] Test all upload scenarios
- [ ] Verify RLS policies work correctly
- [ ] Test multi-shop isolation
- [ ] Set up periodic cleanup job (pg_cron or edge function)
- [ ] Monitor storage usage
- [ ] Add logging for photo operations
- [ ] Test photo download on mobile devices
- [ ] Verify expiry calculations are correct
- [ ] Test photo deletion cascades properly
- [ ] Document backup/restore procedures for photos

## Next Steps

1. **Vehicle Damage Photos UI**: Implement booking return flow with damage photo upload
2. **Cleanup Job**: Deploy edge function to run daily cleanup
3. **Monitoring**: Add Sentry/logging for photo operation errors
4. **Bulk Operations**: Add ability to download all photos for a customer
5. **Photo Gallery**: Create modal gallery view for multiple photos
6. **Compression**: Add image compression before upload to save storage
7. **Mobile Camera**: Test camera capture on mobile devices
8. **Offline Support**: Handle photo uploads when offline (queue for later)

---

**Status**: ✅ Ready for Testing
**Last Updated**: 2025-01-09
