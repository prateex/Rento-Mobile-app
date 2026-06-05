# Photo Storage Quick Reference

## 🚀 Quick Start

### Upload Customer ID Photo
```typescript
import { uploadCustomerIdPhoto } from '@/lib/photoService';

const { shopId } = await getAuthContext();
const result = await uploadCustomerIdPhoto(
  shopId,
  customerId,
  'front', // or 'back'
  fileObject
);

if (result.success) {
  console.log('Photo uploaded:', result.data);
}
```

### Get Photo URL
```typescript
import { getCustomerIdPhotoUrl } from '@/lib/photoService';

const url = await getCustomerIdPhotoUrl(storagePath);
// URL valid for 1 hour
```

### Check Expiry
```typescript
import { getCustomerIdPhotos } from '@/lib/photoService';

const photos = await getCustomerIdPhotos(customerId);
photos.forEach(p => {
  console.log(`${p.photo_type}: ${p.days_until_expiry} days left`);
});
```

### Delete Photo
```typescript
import { deleteCustomerIdPhoto } from '@/lib/photoService';

await deleteCustomerIdPhoto(photoId, storagePath);
```

## 📁 Storage Paths

```
customer-id-photos/
  └── {shop_id}/
      └── {customer_id}/
          ├── front_{timestamp}.jpg
          └── back_{timestamp}.jpg

vehicle-damage-photos/
  └── {shop_id}/
      └── {vehicle_id}/
          └── {damage_id}/
              └── damage_{timestamp}.jpg
```

## 🔐 Security Rules

### Table RLS
```sql
-- Users can only access photos where shop_id matches their shop
CREATE POLICY "shop_isolation" ON customer_id_photos
FOR ALL TO authenticated
USING (shop_id IN (
  SELECT shop_id FROM users WHERE auth_id = auth.uid()
));
```

### Storage RLS
```sql
-- Users can only access photos in their shop folder
CREATE POLICY "shop_folder_access" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'customer-id-photos' AND
  (storage.foldername(name))[1] IN (
    SELECT shop_id::text FROM users WHERE auth_id = auth.uid()
  )
);
```

## ⏰ Expiry Flow

```
Upload → Active (expires_at = NULL)
           │
           ▼ (Booking completed)
       Expiring (expires_at = completed + 7 days)
           │
           ▼ (After 7 days)
       Expired (days_until_expiry < 0)
           │
           ▼ (Cleanup job runs)
       Deleted (removed from storage)
```

## 🛠️ Useful Queries

### Find Expired Photos
```sql
SELECT * FROM v_customer_id_photos
WHERE days_until_expiry < 0;
```

### Storage Usage
```sql
SELECT 
  bucket_id,
  COUNT(*) as files,
  pg_size_pretty(SUM(metadata->>'size')::bigint) as size
FROM storage.objects
WHERE bucket_id LIKE '%photo%'
GROUP BY bucket_id;
```

### Photos by Customer
```sql
SELECT 
  c.full_name,
  p.photo_type,
  p.expires_at,
  p.days_until_expiry
FROM v_customer_id_photos p
JOIN customers c ON c.id = p.customer_id
WHERE c.id = '<customer-id>';
```

## 🎨 UI Component

```tsx
import { PhotoUpload } from '@/components/PhotoUpload';

<PhotoUpload
  label="Aadhaar Front"
  currentPhotoUrl={photoUrl}
  onUpload={async (file) => {
    // Upload logic
  }}
  onDelete={async () => {
    // Delete logic
  }}
  expiryInfo={{
    expiresAt: '2025-01-16',
    daysUntilExpiry: 5
  }}
/>
```

## 🔧 Maintenance

### Manual Cleanup
```sql
SELECT cleanup_expired_id_photos();
```

### Schedule Cleanup (Edge Function)
```bash
supabase functions deploy cleanup-photos
supabase functions schedule cleanup-photos --cron "0 2 * * *"
```

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| 404 on signed URL | Regenerate (expires after 1h) |
| Permission denied | Check shop_id in path matches user |
| Upload fails | Check file size < 5MB, valid image type |
| Expiry not updating | Ensure booking status = 'Completed' |

## 📚 API Reference

### photoService.ts

```typescript
// Customer ID Photos
uploadCustomerIdPhoto(shopId, customerId, photoType, file)
  → Promise<{ success, data?, error? }>

getCustomerIdPhotoUrl(storagePath)
  → Promise<string | null>

getCustomerIdPhotos(customerId)
  → Promise<CustomerIdPhoto[]>

deleteCustomerIdPhoto(photoId, storagePath)
  → Promise<{ success, error? }>

// Vehicle Damage Photos
uploadVehicleDamagePhoto(shopId, vehicleId, damageId, file)
  → Promise<{ success, data?, error? }>

getVehicleDamagePhotoUrl(storagePath)
  → Promise<string | null>

getVehicleDamagePhotos(vehicleId)
  → Promise<VehicleDamagePhoto[]>

markDamageRepaired(damageId)
  → Promise<{ success, error? }>

deleteVehicleDamagePhoto(photoId, storagePath)
  → Promise<{ success, error? }>
```

### Types

```typescript
interface CustomerIdPhoto {
  id: string;
  shop_id: string;
  customer_id: string;
  photo_type: 'front' | 'back';
  storage_path: string;
  uploaded_at: string;
  expires_at?: string;
  booking_id?: string;
  days_until_expiry?: number;
}

interface VehicleDamagePhoto {
  id: string;
  shop_id: string;
  vehicle_id: string;
  damage_id: string;
  storage_path: string;
  uploaded_at: string;
  damage_repaired_at?: string;
}
```

## 🎯 Best Practices

1. **Always regenerate signed URLs** - They expire after 1 hour
2. **Use views for queries** - `v_customer_id_photos` includes expiry calculation
3. **Check success before UI updates** - Handle errors gracefully
4. **Store File objects during creation** - Upload after customer created
5. **Show loading states** - Photo uploads can take time on slow connections
6. **Validate file sizes** - Max 5MB to prevent storage abuse
7. **Use shop_id in paths** - Enables RLS enforcement
8. **Schedule cleanup jobs** - Prevent storage bloat from expired photos

---

**Last Updated**: 2025-01-09  
**Version**: 1.0.0  
**Status**: Production Ready
