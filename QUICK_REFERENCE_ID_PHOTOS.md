# Customer ID Photo Fix - Quick Reference

## What Was Fixed
✅ Customer ID photos now persist after logout/login  
✅ Photos work across multiple browsers/devices  
✅ Added Camera + Gallery upload buttons  
✅ Support for multiple ID photos per customer  
✅ Made customer dialogs scrollable  

## Key Changes

### Database
- `customers.id_photos`: JSONB → **text[]** (array of storage paths)
- New bucket: `customer-ids` (private, 5MB limit)
- Path format: `shop/{shop_id}/customers/{customer_id}/ids/{filename}`

### Upload Flow
1. Click **Camera** or **Gallery** button
2. Select/capture image (max 5MB)
3. Photo uploads to Supabase Storage
4. Path saved in DB (`id_photos` array)
5. Signed URL generated for display

### Storage Policies (RLS)
- Users can only access photos from their own shop
- 3 policies: SELECT, INSERT, DELETE

## Testing (Quick)

### Test Upload
1. Open http://localhost:5001/
2. Go to Customers → Add Customer
3. Fill form + upload photo via Camera/Gallery
4. Submit → Photo should appear in customer details

### Test Persistence
1. Upload photos for a customer
2. Logout → Login
3. View customer → Photos still visible ✅

### Test Cross-Browser
1. Upload in Chrome
2. Open in Firefox with same login
3. Photos visible in both browsers ✅

## Files Changed
1. `supabase/migrations/20260109152000_customer_id_photos_array.sql` - Migration
2. `backend/client/src/lib/photoService.ts` - Simplified API
3. `backend/client/src/pages/Customers.tsx` - Camera+Gallery UI

## Verification
```bash
# Check column type
docker exec supabase_db_Rento-App-03 psql -U postgres -c "\d+ customers" | findstr id_photos

# Check bucket
docker exec supabase_db_Rento-App-03 psql -U postgres -c "SELECT * FROM storage.buckets WHERE id = 'customer-ids';"

# Check policies
docker exec supabase_db_Rento-App-03 psql -U postgres -c "SELECT policyname FROM pg_policies WHERE policyname LIKE '%customer_ids%';"
```

## Status
✅ Migration applied  
✅ Dev server running: http://localhost:5001/  
✅ Ready for testing  

## Documentation
- Full details: `CUSTOMER_ID_PHOTO_FIX_COMPLETE.md`
- Test guide: `CUSTOMER_ID_PHOTO_TEST_GUIDE.md`
