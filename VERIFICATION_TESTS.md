# VERIFICATION TESTS - Customer Photo Upload & Delete

## Test Status: Ready for Manual Testing

## FIXES IMPLEMENTED

### 1. Customer ID Photo Upload ✅
**Problem:** Photos showed "success" but weren't persisted
**Root Cause:** Customer creation flow used old array approach (`__pendingIdPhotos`) instead of new separate front/back approach
**Fix:** 
- Updated customer creation to use `__pendingIdPhotoFront` and `__pendingIdPhotoBack`
- Added comprehensive debug logging throughout photo upload flow
- Photos now properly uploaded to Supabase Storage and paths saved to DB

### 2. Customer Delete ✅
**Problem:** Delete always failed silently
**Root Cause:** Backend used soft delete (UPDATE deleted_at) instead of hard DELETE, so trigger never fired
**Fix:**
- Changed backend to check booking count first
- If bookings exist, return error with clear message
- If no bookings, perform hard DELETE (trigger will also validate)
- Backend server now running on http://127.0.0.1:3000

---

## VERIFICATION CHECKLIST

### A. Photo Upload Tests (NEW CUSTOMER)

#### Test 1: Create Customer with FRONT Photo Only
1. Open app at http://localhost:5001/customers
2. Click "+ Add Customer"
3. Fill in: Name="Test User 1", Phone="1234567890"
4. Click "Take" or "Select" under FRONT ID
5. Upload a photo
6. Click "Submit"
7. **EXPECTED:** Success toast, customer appears in list
8. **VERIFY IN DB:**
   ```sql
   SELECT full_name, id_photo_front_path, id_photo_back_path 
   FROM customers 
   WHERE full_name = 'Test User 1';
   ```
   - `id_photo_front_path` should have path starting with `shop/...`
   - `id_photo_back_path` should be NULL
9. **VERIFY IN APP:**
   - Reload page
   - Click on customer
   - FRONT photo should display (not broken image)
10. **CHECK CONSOLE LOGS:**
    ```
    [Photo Upload] FRONT stored as pending (new customer)
    [Photo Upload] Uploading pending FRONT photo for customer: ...
    [Photo Upload] FRONT uploaded successfully: shop/...
    ```

#### Test 2: Create Customer with FRONT + BACK Photos
1. Click "+ Add Customer"
2. Fill in: Name="Test User 2", Phone="1234567891", ID Type="Aadhaar"
3. Upload FRONT photo
4. Upload BACK photo
5. Click "Submit"
6. **EXPECTED:** Success toast, both photos visible
7. **VERIFY IN DB:**
   ```sql
   SELECT full_name, id_photo_front_path, id_photo_back_path 
   FROM customers 
   WHERE full_name = 'Test User 2';
   ```
   - Both paths should start with `shop/...`
8. **VERIFY IN APP:**
   - Reload page
   - Click on customer
   - Both FRONT and BACK photos should display

---

### B. Photo Upload Tests (EXISTING CUSTOMER)

#### Test 3: Edit Customer - Add FRONT Photo
1. Find existing customer with NO photos
2. Click to view, then click "Edit"
3. Scroll to ID Photos section
4. Click "Take" or "Select" under FRONT ID
5. Upload a photo
6. **EXPECTED:** Immediate success toast "ID photo saved successfully"
7. **CHECK CONSOLE LOGS:**
   ```
   [Photo Upload] Starting FRONT upload: {fileName, size, type}
   [Photo Upload] Auth context: {uid, shopId, customerId}
   [Photo Upload] Uploading FRONT to storage...
   [Photo Upload] FRONT upload result: {success: true, path: "shop/..."}
   [Photo Upload] Updating DB column id_photo_front_path with path: shop/...
   [Photo Upload] FRONT complete - path saved to DB
   ```
8. **VERIFY IN DB:**
   ```sql
   SELECT id_photo_front_path FROM customers WHERE id = '<customer_id>';
   ```
   - Should have proper storage path
9. **VERIFY PERSISTENCE:**
   - Close edit modal
   - Reopen customer view
   - Photo should still be visible
   - Logout and login
   - Photo should still be visible

#### Test 4: Edit Customer - Delete FRONT Photo
1. Open customer with existing FRONT photo
2. Click "Edit"
3. Click trash icon on FRONT photo
4. Confirm deletion
5. **EXPECTED:** Photo disappears, success toast
6. **VERIFY IN DB:**
   ```sql
   SELECT id_photo_front_path FROM customers WHERE id = '<customer_id>';
   ```
   - Should be NULL

---

### C. Customer Delete Tests

#### Test 5: Delete Customer with 0 Bookings
1. Create a new customer (no bookings)
2. Click on customer to view
3. Click "Delete" button
4. Confirm deletion
5. **EXPECTED:** 
   - Success toast: "Customer deleted successfully"
   - Customer removed from list
6. **CHECK BACKEND LOGS:**
   ```
   [DELETE /api/customers/:id] REQUEST: {customerId, userShopId}
   [DELETE /api/customers/:id] CUSTOMER: <name>
   [DELETE /api/customers/:id] BOOKING COUNT: 0
   [DELETE /api/customers/:id] Performing HARD DELETE
   [DELETE /api/customers/:id] SUCCESS - Customer hard deleted
   ```
7. **VERIFY IN DB:**
   ```sql
   SELECT id, full_name, deleted_at FROM customers WHERE id = '<customer_id>';
   ```
   - Should return 0 rows (hard deleted)

#### Test 6: Delete Customer with 1+ Bookings
1. Find customer with bookings (check VERIFICATION_TESTS.md for IDs):
   - `231bbb87-b44b-464e-a68f-ce20a1fcf4cb` has 7 bookings
   - `588f9f24-ac90-4382-93a4-25d5d08b11b1` has 4 bookings
2. Click on customer to view
3. Click "Delete" button
4. Confirm deletion
5. **EXPECTED:**
   - Error toast: "Cannot delete customer. Customer has X booking(s). Please remove or reassign bookings first."
   - Customer stays in list (not deleted)
6. **CHECK BACKEND LOGS:**
   ```
   [DELETE /api/customers/:id] BOOKING COUNT: <count>
   [DELETE /api/customers/:id] BLOCKED - Customer has <count> booking(s)
   ```
7. **VERIFY IN DB:**
   ```sql
   SELECT COUNT(*) FROM bookings WHERE customer_id = '<customer_id>' AND deleted_at IS NULL;
   ```
   - Should match the count in error message

---

### D. Regression Tests

#### Test 7: Verify Trigger Still Works
1. Use psql to attempt direct DELETE with bookings:
   ```sql
   DELETE FROM customers WHERE id = '231bbb87-b44b-464e-a68f-ce20a1fcf4cb';
   ```
2. **EXPECTED:**
   ```
   ERROR:  Cannot delete customer with existing bookings
   ```

#### Test 8: Verify Storage Bucket Access
1. Check bucket exists:
   ```sql
   SELECT name, public FROM storage.buckets WHERE name = 'customer-ids';
   ```
   - Should return: customer-ids | f (private)
2. Check files:
   ```sql
   SELECT COUNT(*) FROM storage.objects WHERE bucket_id = 'customer-ids';
   ```
   - Should show uploaded photos

#### Test 9: Verify Signed URL Generation
1. Upload a photo to existing customer
2. Check browser console for signed URL
3. Copy signed URL and open in new tab
4. **EXPECTED:** Photo displays (URL valid for 1 hour)

---

## DATABASE VERIFICATION QUERIES

### Current State Check
```sql
-- Customers with photos
SELECT 
  id, 
  full_name, 
  customer_number,
  id_photo_front_path,
  id_photo_back_path,
  created_at
FROM customers 
WHERE deleted_at IS NULL 
  AND (id_photo_front_path IS NOT NULL OR id_photo_back_path IS NOT NULL)
ORDER BY created_at DESC 
LIMIT 5;
```

### Customers with Bookings (Cannot Delete)
```sql
SELECT 
  c.id,
  c.full_name,
  c.customer_number,
  COUNT(b.id) as booking_count
FROM customers c
LEFT JOIN bookings b ON b.customer_id = c.id AND b.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.full_name, c.customer_number
HAVING COUNT(b.id) > 0
ORDER BY COUNT(b.id) DESC;
```

### Verify Trigger and FK
```sql
-- Trigger exists
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgrelid = 'customers'::regclass 
  AND tgname = 'trigger_prevent_customer_deletion';

-- FK is RESTRICT
SELECT conname, confdeltype 
FROM pg_constraint 
WHERE conname = 'bookings_customer_id_fkey';
-- confdeltype should be 'r' (RESTRICT)
```

---

## EXPECTED OUTCOMES

### ✅ Photo Upload Success Criteria
- [ ] Photos uploaded to Supabase Storage (`customer-ids` bucket)
- [ ] Storage paths saved in DB (`id_photo_front_path`, `id_photo_back_path`)
- [ ] NO blob URLs in database (all paths start with `shop/...`)
- [ ] Photos persist across page reload
- [ ] Photos persist across logout/login
- [ ] Signed URLs generated on read (1-hour expiry)
- [ ] Console logs show complete upload flow

### ✅ Customer Delete Success Criteria
- [ ] Delete succeeds when customer has 0 bookings
- [ ] Delete blocked with clear error when customer has 1+ bookings
- [ ] Error message shows booking count
- [ ] Hard DELETE performed (not soft delete)
- [ ] Trigger validation works as backup
- [ ] Backend server running and responding

---

## KNOWN ISSUES (Pre-Fix)

### Issue Found: Blob URLs in Database
```sql
-- Customer with incorrect blob URL
SELECT id, full_name, id_photo_front_path 
FROM customers 
WHERE id = '20baf678-a00e-45de-935c-843420672bcc';
-- Returns: blob:http://localhost:5000/5fe6776b-b206-452a-8286-32cbdfd09394
```
**This customer needs re-upload to fix the path.**

### Issue Found: Backend Server Was Down
- Frontend was showing ECONNREFUSED errors
- Delete requests failing because backend wasn't running
- **FIXED:** Backend now running on http://127.0.0.1:3000

---

## TESTING ENVIRONMENT

- **Frontend:** http://localhost:5001/
- **Backend:** http://127.0.0.1:3000
- **Supabase Local:** Running in Docker containers
- **Database:** PostgreSQL 17.6.1
- **Storage Bucket:** `customer-ids` (private)

---

## NEXT STEPS AFTER VERIFICATION

1. ✅ Test all 9 scenarios above
2. ✅ Verify database state matches expectations
3. ✅ Check console logs for complete flow
4. ✅ Test across different browsers
5. ✅ Confirm no regression in other features
6. 📋 Document any remaining issues
7. 🚀 Prepare for production deployment

---

## SUPPORT

**If tests fail, check:**
1. Backend server running: http://127.0.0.1:3000/health
2. Supabase containers running: `docker ps | grep supabase`
3. Browser console for errors
4. Backend terminal logs
5. Database state with verification queries above

**Debug commands:**
```bash
# Check backend server status
curl http://127.0.0.1:3000/health

# Check Supabase containers
docker ps | grep supabase

# Check customer-ids bucket
docker exec supabase_db_Rento-App-03 psql -U postgres -d postgres \
  -c "SELECT name, public FROM storage.buckets WHERE name = 'customer-ids';"

# Check storage files
docker exec supabase_db_Rento-App-03 psql -U postgres -d postgres \
  -c "SELECT COUNT(*) FROM storage.objects WHERE bucket_id = 'customer-ids';"
```

---

**Document Created:** 2026-01-10  
**Fixes Applied:** Customer photo upload + Customer delete  
**Status:** Ready for manual testing
