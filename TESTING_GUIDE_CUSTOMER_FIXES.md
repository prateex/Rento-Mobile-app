# Quick Testing Guide - Customer Screen Fixes

**Test Environment:** http://localhost:5001/  
**Date:** 2026-01-10

---

## 🧪 Test 1: Customer Delete Protection

### Scenario A: Delete Customer with NO Bookings
1. Go to **Customers** page
2. Create a new test customer:
   - Name: "Test Delete Success"
   - Phone: "9999999999"
   - Click Add
3. Click customer → Click **Delete** button
4. Confirm deletion
5. **Expected Result:** ✅ Customer is deleted, toast shows "Deleted"

### Scenario B: Delete Customer WITH Bookings
1. Go to **Bookings** page
2. Create a booking for any customer
3. Go back to **Customers**
4. Find the customer with booking → Click **Delete**
5. Confirm deletion
6. **Expected Result:** ✅ Toast shows error "Cannot delete customer with active bookings"

---

## 📸 Test 2: ID Photo Upload - Front/Back Slots

### Test A: Add Customer with Front Photo Only
1. Go to **Customers** → Click **Add Customer**
2. Fill form:
   - Name: "Photo Test 1"
   - Phone: "9888888888"
   - ID Type: "Aadhaar"
3. **Front Side** section:
   - Click **Take** or **Select** button
   - Choose an image from gallery/camera
   - Verify preview appears with green "✓ Uploaded" label
4. Skip **Back Side** (leave empty)
5. Click **Submit**
6. **Expected Result:**
   - ✅ Customer created
   - ✅ Front photo visible in customer details
   - ✅ Back photo section empty (as expected)

### Test B: Add Customer with Front + Back Photos
1. Create new customer with ID Type: "Driving License"
2. Upload both **Front** and **Back** photos
3. Submit form
4. **Expected Result:**
   - ✅ Both photos saved
   - ✅ Customer details show both photos
   - ✅ Back photo NOT shown for Passport (test this separately)

### Test C: Edit Customer - Add Back Photo
1. Open existing customer with front photo
2. Click **Edit**
3. Click **Back Side** → **Select** → Choose image
4. Click **Submit**
5. **Expected Result:**
   - ✅ Back photo added without affecting front
   - ✅ Both visible in customer details

### Test D: Delete Individual Photo
1. Open customer with both photos (Edit mode)
2. Click **X** button on back photo
3. Confirm deletion
4. **Expected Result:**
   - ✅ Back photo removed from preview
   - ✅ Front photo remains
   - ✅ Saved to DB

### Test E: Photo Persistence
1. Add customer with photos
2. **Reload page** (F5)
3. Go to Customers → View that customer
4. **Expected Result:**
   - ✅ Photos still visible (loaded from DB, not browser memory)
   - ✅ No "loading" state shows (should be instant)

### Test F: Cross-Browser Persistence
1. Add customer with photos in Chrome
2. Open **Firefox** and login with same credentials
3. Go to Customers → View that customer
4. **Expected Result:**
   - ✅ Photos visible in Firefox
   - ✅ Proves storage is cloud-based, not local-only

---

## 🔢 Test 3: Customer Number Sequencing

### Setup: Create 5 Customers
1. Go to **Customers** → Create 5 new customers:
   - "Seq Test 1"
   - "Seq Test 2"
   - "Seq Test 3"
   - "Seq Test 4"
   - "Seq Test 5"

### Verify Sequential Numbering
2. Check customer numbers shown in list:
   - **Expected:** CUST0001, CUST0002, CUST0003, CUST0004, CUST0005
   - **NOT:** CUST0001, CUST0003, CUST0008, CUST0041 (random/jumping)

### Test Multi-Shop Isolation
1. (If you have access to another shop)
2. Switch to Shop B
3. Create customer in Shop B
4. **Expected:** First customer in Shop B = CUST0001 (not CUST0006)
5. This proves numbering is per-shop, not global

---

## 🎨 Test 4: Customer View & Edit Modals

### View Modal (Read-Only)
1. Go to **Customers** → Click any customer
2. Verify modal shows:
   - ✅ Customer name prominently
   - ✅ Customer number with copy button
   - ✅ Phone number (with WhatsApp link)
   - ✅ Email (if entered)
   - ✅ ID Type
   - ✅ ID photos (front/back)
   - ✅ All text readable without scrolling

### Edit Modal (Scrolling)
1. Click **Edit** button
2. Form should show all fields:
   - Name, Phone, Email, Address, City, State, Pincode
   - ID Type selector
   - Front photo upload
   - Back photo upload (if applicable)
3. **Scroll down** to see all fields
4. **Expected:** ✅ Smooth scrolling, no content cut off

---

## 🐛 Regression Tests (Verify No Broken Features)

### Bookings Still Work
1. Go to **Bookings**
2. Create a new booking
3. **Expected:** ✅ No errors, booking created normally

### Invoices Still Work
1. Go to a booking with invoice
2. View/print invoice
3. **Expected:** ✅ Customer name/number shown correctly

### Authentication Still Works
1. Logout and login again
2. Go to Customers
3. **Expected:** ✅ Only your shop's customers visible

---

## 📋 Manual Test Checklist

```
CUSTOMER DELETE PROTECTION
- [ ] Delete customer with 0 bookings → succeeds
- [ ] Delete customer with 1+ bookings → error message shows
- [ ] Error mentions "bookings"

PHOTO UPLOAD - FRONT/BACK
- [ ] Front photo uploads for new customer
- [ ] Back photo uploads for Aadhaar/DL/VoterID
- [ ] Back photo hidden for Passport
- [ ] Edit adds back photo without losing front
- [ ] Delete photo removes from DB, not just UI
- [ ] Photos survive page reload
- [ ] Photos visible across browsers
- [ ] Photos clickable to view full size

CUSTOMER NUMBER SEQUENCING
- [ ] First customer = CUST0001
- [ ] Second customer = CUST0002 (not jumping)
- [ ] Sequential per shop (if multi-shop)
- [ ] Customer number shown in badge on view modal
- [ ] Copy customer number button works

CUSTOMER MODALS
- [ ] View modal shows all details clearly
- [ ] Edit modal scrolls without cutting content
- [ ] Delete confirmation shows customer name
- [ ] WhatsApp button works on phone number
- [ ] Photo preview clickable

REGRESSIONS
- [ ] Bookings creation unaffected
- [ ] Invoice display correct
- [ ] Auth still works (logout/login)
- [ ] Only shop customers visible to staff
```

---

## 🚨 Common Issues & Debugging

### Photos Show "No photo uploaded yet" After Save
**Diagnosis:** Check browser console for errors
**Fix:** 
1. Verify `uploadCustomerIdPhoto()` succeeds (check network tab)
2. Check if Supabase Storage bucket exists: `customer-ids`
3. Verify RLS policies allow your shop_id

### Customer Number Showing as Empty or "CUST-"
**Diagnosis:** Trigger may have failed
**Fix:**
```sql
-- Manual fix: Regenerate for one shop
SELECT generate_customer_number('YOUR_SHOP_ID'::uuid);
```

### Delete Always Shows "Has Bookings" Even When None Exist
**Diagnosis:** DB count query returned wrong result
**Fix:**
1. Check bookings table has correct customer_id FK
2. Verify no deleted bookings are lingering (soft delete issue)
3. Manually test the trigger:
```sql
DELETE FROM customers WHERE id = 'TEST_ID' AND NOT EXISTS (SELECT 1 FROM bookings WHERE customer_id = 'TEST_ID');
```

### Photos Disappear After Logout
**Diagnosis:** Using local blob URLs instead of DB paths
**Fix:**
- Photos should be loaded from DB columns: `id_photo_front_path` / `id_photo_back_path`
- Not from `URL.createObjectURL()` in memory
- Check CustomerForm `useEffect` is running on mount

---

## Performance Notes

- **Large photo files:** Uploads may be slow
  - Suggested size: 1-2MB per photo (max 5MB)
  - Consider client-side compression in future
  
- **Signed URLs expire:** After ~1 hour
  - Auto-refresh on view (no action needed)
  - Safe to cache URLs for 5-10 minutes

---

## Success Criteria

✅ All tests in this guide pass → Fixes are working correctly

---

## Contact & Escalation

If any test fails:
1. Check the FIXES_STATUS_REPORT.md for details
2. Review migration file: `supabase/migrations/20260110_comprehensive_fixes.sql`
3. Check browser console for JavaScript errors
4. Check Supabase logs for DB errors
