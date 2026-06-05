import { supabase } from './supabase';

const CUSTOMER_ID_BUCKET = 'customer-ids';

export interface CustomerIdPhoto {
  path: string;
  signedUrl?: string;
}

export interface VehicleDamagePhoto {
  id: string;
  shop_id: string;
  vehicle_id: string;
  damage_id: string;
  storage_path: string;
  uploaded_at: string;
  damage_repaired_at?: string;
}

const buildCustomerIdPath = (shopId: string, customerId: string, fileName: string) =>
  `shop/${shopId}/customers/${customerId}/ids/${fileName}`;

const generateFileName = (prefix: string, originalName: string) => {
  const extension = originalName.split('.').pop() || 'jpg';
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`;
};

/**
 * Upload a single customer ID photo to the customer-ids bucket.
 */
export async function uploadCustomerIdPhoto(
  shopId: string,
  customerId: string,
  file: File
): Promise<{ success: boolean; path?: string; signedUrl?: string; error?: string }> {
  try {
    const fileName = generateFileName('id', file.name);
    const storagePath = buildCustomerIdPath(shopId, customerId, fileName);

    const { error: uploadError } = await supabase.storage
      .from(CUSTOMER_ID_BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return { success: false, error: uploadError.message };
    }

    const signedUrl = await getCustomerIdPhotoUrl(storagePath);
    return { success: true, path: storagePath, signedUrl: signedUrl || undefined };
  } catch (error) {
    console.error('Upload error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Create a signed URL for a stored customer ID photo.
 */
export async function getCustomerIdPhotoUrl(storagePath: string, expiresInSeconds = 3600): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(CUSTOMER_ID_BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error) {
      console.error('Signed URL error:', error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Get URL error:', error);
    return null;
  }
}

/**
 * Create signed URLs for a batch of storage paths.
 */
export async function getCustomerIdPhotoUrls(paths: string[], expiresInSeconds = 3600): Promise<string[]> {
  const results: string[] = [];

  for (const path of paths) {
    const url = await getCustomerIdPhotoUrl(path, expiresInSeconds);
    if (url) results.push(url);
  }

  return results;
}

/**
 * Delete a customer ID photo from storage.
 */
export async function deleteCustomerIdPhoto(path: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error: storageError } = await supabase.storage
      .from(CUSTOMER_ID_BUCKET)
      .remove([path]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
      return { success: false, error: storageError.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Upload vehicle damage photo to storage and create metadata record
 */
export async function uploadVehicleDamagePhoto(
  shopId: string,
  vehicleId: string,
  damageId: string,
  file: File
): Promise<{ success: boolean; data?: VehicleDamagePhoto; error?: string }> {
  try {
    const timestamp = Date.now();
    const extension = file.name.split('.').pop() || 'jpg';
    const fileName = `damage_${timestamp}.${extension}`;
    const storagePath = `${shopId}/${vehicleId}/${damageId}/${fileName}`;

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('vehicle-damage-photos')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return { success: false, error: uploadError.message };
    }

    // Create metadata record
    const { data: metadataData, error: metadataError } = await supabase
      .from('vehicle_damage_photos')
      .insert({
        shop_id: shopId,
        vehicle_id: vehicleId,
        damage_id: damageId,
        storage_path: storagePath
      })
      .select()
      .single();

    if (metadataError) {
      console.error('Metadata insert error:', metadataError);
      // Try to delete uploaded file
      await supabase.storage.from('vehicle-damage-photos').remove([storagePath]);
      return { success: false, error: metadataError.message };
    }

    return { success: true, data: metadataData };
  } catch (error) {
    console.error('Upload error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get signed URL for vehicle damage photo (valid for 1 hour)
 */
export async function getVehicleDamagePhotoUrl(storagePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('vehicle-damage-photos')
      .createSignedUrl(storagePath, 3600); // 1 hour

    if (error) {
      console.error('Signed URL error:', error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Get URL error:', error);
    return null;
  }
}

/**
 * Get all damage photos for a vehicle
 */
export async function getVehicleDamagePhotos(
  vehicleId: string
): Promise<VehicleDamagePhoto[]> {
  try {
    const { data, error } = await supabase
      .from('v_vehicle_damage_photos')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .is('deleted_at', null)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Get photos error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Get photos error:', error);
    return [];
  }
}

/**
 * Mark damage as repaired (triggers auto-cleanup of photos)
 */
export async function markDamageRepaired(
  damageId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('vehicle_damage_photos')
      .update({ damage_repaired_at: new Date().toISOString() })
      .eq('damage_id', damageId);

    if (error) {
      console.error('Mark repaired error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Mark repaired error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Delete vehicle damage photo (removes from storage and metadata)
 */
export async function deleteVehicleDamagePhoto(
  photoId: string,
  storagePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete from storage first
    const { error: storageError } = await supabase.storage
      .from('vehicle-damage-photos')
      .remove([storagePath]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
      return { success: false, error: storageError.message };
    }

    const { error: metadataError } = await supabase
      .from('vehicle_damage_photos')
      .delete()
      .eq('id', photoId);

    if (metadataError) {
      console.error('Metadata delete error:', metadataError);
      return { success: false, error: metadataError?.message || 'Photo not deleted' };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Health check for Supabase Storage availability.
 * Returns true only if storage is reachable and responsive.
 */
export async function checkStorageHealth(): Promise<{ healthy: boolean; error?: string }> {
  try {
    // Attempt to list files in the customer-ids bucket (lightweight operation)
    const { data, error } = await supabase.storage
      .from(CUSTOMER_ID_BUCKET)
      .list('shop', { limit: 1 });

    if (error) {
      const errorMsg = error.message || 'Unknown storage error';
      console.error('[Storage Health] Error:', errorMsg);
      
      // Detect specific error types
      if (errorMsg.includes('503') || errorMsg.includes('Service Unavailable')) {
        return { healthy: false, error: 'Storage service unavailable' };
      }
      if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('DNS')) {
        return { healthy: false, error: 'Cannot reach storage service' };
      }
      if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
        return { healthy: false, error: 'Storage service timeout' };
      }
      
      return { healthy: false, error: errorMsg };
    }

    if (data !== null) {
      console.log('[Storage Health] Storage is reachable and responsive');
      return { healthy: true };
    }

    return { healthy: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Storage Health] Exception:', errorMsg);
    
    if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('DNS')) {
      return { healthy: false, error: 'Cannot reach storage service' };
    }
    if (errorMsg.includes('timeout') || errorMsg.includes('network')) {
      return { healthy: false, error: 'Storage service unreachable' };
    }
    
    return { healthy: false, error: errorMsg };
  }
}
