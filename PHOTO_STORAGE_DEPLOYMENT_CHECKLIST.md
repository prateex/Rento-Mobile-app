# 📋 Photo Storage Deployment Checklist

## Pre-Deployment Verification

### Database ✅
- [x] Migration `20260109120000_photo_storage_lifecycle.sql` exists
- [x] Tables created: `customer_id_photos`, `vehicle_damage_photos`
- [x] RLS policies enabled on both tables
- [x] Indexes created on: shop_id, customer_id, vehicle_id, expires_at
- [x] Functions deployed: calculate_photo_expiry, cleanup_expired_id_photos, cleanup_damage_photos, update_id_photo_expiry
- [x] Triggers active: update_customer_id_photo_expiry_trigger, cleanup_damage_photos_trigger
- [x] Views created: v_customer_id_photos, v_vehicle_damage_photos

**Verification:**
```bash
# Run in project root
docker exec supabase_db_Rento-App-03 psql -U postgres -d postgres -c "\dt *photos*"
docker exec supabase_db_Rento-App-03 psql -U postgres -d postgres -c "SELECT routine_name FROM information_schema.routines WHERE routine_name LIKE '%photo%';"
```

### Storage ✅
- [x] Bucket `customer-id-photos` created (private)
- [x] Bucket `vehicle-damage-photos` created (private)
- [x] RLS policies applied on storage.objects (6 total)
  - [x] Shop members read customer ID photos
  - [x] Shop members upload customer ID photos
  - [x] Shop members delete customer ID photos
  - [x] Shop members read vehicle damage photos
  - [x] Shop members upload vehicle damage photos
  - [x] Shop members delete vehicle damage photos

**Verification:**
```bash
docker exec supabase_db_Rento-App-03 psql -U postgres -d postgres -c "SELECT id, public FROM storage.buckets WHERE id LIKE '%photo%';"
docker exec supabase_db_Rento-App-03 psql -U postgres -d postgres -c "SELECT policyname FROM pg_policies WHERE tablename = 'objects';"
```

### Frontend ✅
- [x] Photo service created: `backend/client/src/lib/photoService.ts`
- [x] PhotoUpload component created: `backend/client/src/components/PhotoUpload.tsx`
- [x] Customers page integrated with photo upload
- [x] TypeScript errors resolved
- [x] Imports added to Customers.tsx

**Verification:**
```bash
cd backend/client
npm run build
# Should complete without errors (existing TS errors are unrelated)
```

## Local Testing Checklist

### Basic Functionality
- [ ] Create new customer with front photo
- [ ] Create new customer with front + back photo
- [ ] Edit existing customer and upload photo
- [ ] Delete customer photo
- [ ] Download customer photo
- [ ] Verify photos appear in Supabase Storage dashboard

### Expiry Tracking
- [ ] Create booking with customer
- [ ] Mark booking as 'Completed'
- [ ] Verify `expires_at` is set to completion_date + 7 days
- [ ] Check countdown shows "X days left"
- [ ] Verify color coding:
  - Gray for 3+ days
  - Orange for 1-2 days
  - Red for expired

### Security
- [ ] Create customer in Shop A
- [ ] Upload photo for customer in Shop A
- [ ] Login as user from Shop B
- [ ] Verify cannot see photos from Shop A
- [ ] Test RLS query:
  ```sql
  -- As Shop B user, should return 0 rows
  SELECT * FROM customer_id_photos WHERE shop_id = '<shop-a-id>';
  ```

### Error Handling
- [ ] Try uploading file > 5MB (should reject)
- [ ] Try uploading non-image file (should reject)
- [ ] Try deleting photo (should ask confirmation)
- [ ] Check error messages are user-friendly

### Performance
- [ ] Upload large photo (3-4MB) and check loading state
- [ ] Upload multiple photos quickly
- [ ] Verify signed URLs work (no 404 errors)
- [ ] Check browser console for errors

## Production Deployment Steps

### 1. Backup Current Database
```bash
# Create backup before applying migration
supabase db dump --data-only > backup_before_photos_$(date +%Y%m%d).sql
```

### 2. Apply Migration to Production
```bash
# Review migration first
cat supabase/migrations/20260109120000_photo_storage_lifecycle.sql

# Apply to production (after thorough testing!)
supabase db push --project-ref <your-project-ref>
```

### 3. Create Storage Buckets in Production
```sql
-- Run in Supabase SQL Editor (Production)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('customer-id-photos', 'customer-id-photos', false, 5242880, ARRAY['image/*']),
  ('vehicle-damage-photos', 'vehicle-damage-photos', false, 5242880, ARRAY['image/*']);
```

### 4. Apply Storage RLS Policies
```bash
# Copy temp SQL file to production container
# Create file: storage_policies_prod.sql with content from migration

# Apply via Supabase Dashboard SQL Editor
# Or use psql if direct access available
```

### 5. Deploy Frontend
```bash
cd backend/client
npm run build
# Deploy dist/ to your hosting platform
```

### 6. Set Up Periodic Cleanup Job

**Option A: Supabase Edge Function** (Recommended)
```bash
# Create edge function
supabase functions new cleanup-photos

# Add code:
cat > supabase/functions/cleanup-photos/index.ts << 'EOF'
import { createClient } from '@supabase/supabase-js';

Deno.serve(async () => {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data, error } = await supabaseAdmin.rpc('cleanup_expired_id_photos');
  
  return new Response(
    JSON.stringify({ deleted: data, error, timestamp: new Date().toISOString() }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
EOF

# Deploy function
supabase functions deploy cleanup-photos --project-ref <your-project-ref>

# Schedule to run daily at 2 AM
supabase functions schedule cleanup-photos --cron "0 2 * * *" --project-ref <your-project-ref>
```

**Option B: pg_cron** (If available)
```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup at 2 AM
SELECT cron.schedule(
  'cleanup-expired-photos',
  '0 2 * * *',
  'SELECT cleanup_expired_id_photos();'
);
```

### 7. Configure Monitoring

**Add to monitoring dashboard:**
- Storage usage per bucket
- Number of photos per shop
- Number of expired photos
- Photo upload errors
- Signed URL generation failures

**Example queries for monitoring:**
```sql
-- Storage usage
SELECT 
  bucket_id,
  COUNT(*) as files,
  pg_size_pretty(SUM(metadata->>'size')::bigint) as size
FROM storage.objects
WHERE bucket_id IN ('customer-id-photos', 'vehicle-damage-photos')
GROUP BY bucket_id;

-- Expired photos count
SELECT COUNT(*) FROM customer_id_photos WHERE expires_at < NOW();

-- Photos uploaded today
SELECT COUNT(*) FROM customer_id_photos 
WHERE DATE(uploaded_at) = CURRENT_DATE;

-- Top shops by photo count
SELECT shop_id, COUNT(*) 
FROM customer_id_photos 
GROUP BY shop_id 
ORDER BY COUNT(*) DESC 
LIMIT 10;
```

### 8. Update Documentation
- [ ] Update API documentation with photo endpoints
- [ ] Add photo storage to user manual
- [ ] Document backup/restore procedures
- [ ] Update system architecture diagram

### 9. Post-Deployment Verification
- [ ] Test photo upload on production
- [ ] Verify RLS policies work
- [ ] Check signed URLs are generated correctly
- [ ] Test multi-shop isolation
- [ ] Verify cleanup job is scheduled
- [ ] Monitor error logs for 24 hours

## Rollback Plan

### If Issues Occur:

1. **Disable Photo Upload in UI** (quick fix):
   ```typescript
   // In Customers.tsx, temporarily comment out PhotoUpload components
   ```

2. **Remove Storage Policies** (if RLS causing issues):
   ```sql
   DROP POLICY "Shop members read customer ID photos" ON storage.objects;
   DROP POLICY "Shop members upload customer ID photos" ON storage.objects;
   DROP POLICY "Shop members delete customer ID photos" ON storage.objects;
   DROP POLICY "Shop members read vehicle damage photos" ON storage.objects;
   DROP POLICY "Shop members upload vehicle damage photos" ON storage.objects;
   DROP POLICY "Shop members delete vehicle damage photos" ON storage.objects;
   ```

3. **Restore Database** (nuclear option):
   ```bash
   # Restore from backup
   supabase db reset --db-url <production-db-url>
   psql <production-db-url> < backup_before_photos_*.sql
   ```

## Environment-Specific Configuration

### Local Development
```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<local-anon-key>
```

### Staging
```
SUPABASE_URL=https://<staging-project>.supabase.co
SUPABASE_ANON_KEY=<staging-anon-key>
```

### Production
```
SUPABASE_URL=https://<prod-project>.supabase.co
SUPABASE_ANON_KEY=<prod-anon-key>
```

## Success Metrics

Track these metrics post-deployment:

- **Photo Upload Rate**: X photos per day
- **Storage Usage**: Total GB used per bucket
- **Expiry Rate**: X% of photos expire vs. downloaded
- **Error Rate**: < 1% upload failures
- **Performance**: < 3s average upload time
- **Cost**: Storage costs within budget

## Known Limitations

1. **File Size**: 5MB maximum per photo
2. **Signed URL Expiry**: 1 hour (regenerate if stale)
3. **Cleanup Frequency**: Daily (not real-time)
4. **Supported Formats**: Images only (jpg, png, webp, etc.)
5. **Mobile Camera**: Depends on browser support for `capture` attribute

## Future Enhancements

- [ ] Image compression before upload
- [ ] OCR for ID verification
- [ ] Bulk photo download (zip)
- [ ] Photo gallery modal
- [ ] Offline upload queue
- [ ] Photo annotation tools
- [ ] Automated quality checks
- [ ] Face detection for IDs

## Support Contacts

**Technical Issues:**
- Developer: [Your Name]
- DevOps: [DevOps Team]
- Supabase Support: support@supabase.io

**Documentation:**
- Implementation: PHOTO_STORAGE_IMPLEMENTATION_COMPLETE.md
- Testing: PHOTO_STORAGE_TESTING_GUIDE.md
- Quick Reference: PHOTO_STORAGE_QUICK_REFERENCE.md
- Summary: PHOTO_STORAGE_SUMMARY.md

---

**Deployment Date**: _____________  
**Deployed By**: _____________  
**Deployment Status**: ⬜ Pending | ⬜ In Progress | ⬜ Complete  
**Post-Deployment Review**: _____________
