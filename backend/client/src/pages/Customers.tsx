import { useState, useEffect, useCallback } from "react";
import MobileLayout from "@/components/layout/MobileLayout";
import { useStore, Customer, getPermissions } from "@/lib/store";
import { safeString } from "@/lib/safe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Phone, CheckCircle2, UploadCloud, Eye, Edit2, Camera, Image as ImageIcon, Copy, Trash2, MessageCircle, User, X, Download, MapPin, Clock } from "lucide-react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh-indicator";
import { ImageViewer } from "@/components/ImageViewer";
import { getAuthContext } from "@/lib/shopIdHelper";
import {
  uploadCustomerIdPhoto,
  getCustomerIdPhotoUrl,
  getCustomerIdPhotoUrls,
  deleteCustomerIdPhoto,
  checkStorageHealth,
  type CustomerIdPhoto
} from "@/lib/photoService";
import { downloadVCF } from "@/lib/contactHelper";
import { calculateIdPhotoDeletionTime, formatDeletionTimer } from "@/lib/idPhotoDeletionHelper";

export default function Customers() {
  console.log('[Customers] RENDER at', new Date().getTime());
  const { customers, addCustomer, updateCustomer, deleteCustomer, user, refreshAllData, shopId: storeShopId, resolveShopId } = useStore();
  const permissions = getPermissions(user?.role || null);
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  const handleAddOpenChange = (open: boolean) => {
    console.log('[Dialog] onOpenChange:', open, 'from:', isAddOpen);
    setIsAddOpen(open);
  };
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [viewingCustomerIdPhotos, setViewingCustomerIdPhotos] = useState<{ front?: string; back?: string }>({});
  const [loadingIdPhotos, setLoadingIdPhotos] = useState(false);
  // Task 1: Deletion timer state
  const [deletionInfo, setDeletionInfo] = useState<ReturnType<typeof calculateIdPhotoDeletionTime> | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; customer?: Customer }>({ open: false });
  const [imageViewerSrc, setImageViewerSrc] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Pull-to-refresh handler - resets search
  const handleRefresh = useCallback(async () => {
    setSearch('');
    await refreshAllData();
  }, [refreshAllData]);
  
  const { containerRef, pullDistance, isRefreshing, pullProgress } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  // Task 7: Lazy load ID photos only when viewing customer details
  // Task 1: Also calculate deletion timer when viewing customer
  useEffect(() => {
    if (!viewingCustomer) {
      setViewingCustomerIdPhotos({});
      setDeletionInfo(null);
      return;
    }

    const loadIdPhotos = async () => {
      setLoadingIdPhotos(true);
      try {
        const { data: photoRows } = await supabase
          .from('customer_id_photos')
          .select('side, file_path')
          .eq('customer_id', viewingCustomer.id)
          .is('deleted_at', null);

        if (photoRows && photoRows.length > 0) {
          const photos: { front?: string; back?: string } = {};
          
          for (const photo of photoRows) {
            const url = await getCustomerIdPhotoUrl(photo.file_path);
            if (url && photo.side === 'front') {
              photos.front = url;
            } else if (url && photo.side === 'back') {
              photos.back = url;
            }
          }
          
          setViewingCustomerIdPhotos(photos);
        }
      } catch (error) {
        console.error('Failed to load ID photos:', error);
      } finally {
        setLoadingIdPhotos(false);
      }
    };

    // Task 1: Calculate deletion timer based on last completed booking
    const loadDeletionInfo = async () => {
      try {
        // Find the most recent completed booking for this customer
        const { data: bookings } = await supabase
          .from('bookings')
          .select('completed_at')
          .eq('customer_id', viewingCustomer.id)
          .eq('status', 'Completed')
          .is('deleted_at', null)
          .order('completed_at', { ascending: false })
          .limit(1);

        const lastCompletedAt = bookings?.[0]?.completed_at ? new Date(bookings[0].completed_at) : null;
        const info = calculateIdPhotoDeletionTime(lastCompletedAt);
        setDeletionInfo(info);
      } catch (error) {
        console.error('Failed to calculate deletion info:', error);
        setDeletionInfo(null);
      }
    };

    loadIdPhotos();
    loadDeletionInfo();
  }, [viewingCustomer]);

  // Fetch customers from Supabase on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData.session?.user?.id;
        if (!uid) return;
        
        const { data: userData } = await supabase.from('users').select('shop_id').eq('auth_id', uid).single();
        const shopId = userData?.shop_id;
        if (!shopId) return;
        
        const { data: rows, error } = await supabase
          .from('customers')
          .select('id,full_name,phone,email,address,id_type,documents,status,created_at,customer_number')
          .eq('shop_id', shopId)
          .is('deleted_at', null);
        
        if (!error && Array.isArray(rows)) {
          // Load ID photos from customer_id_photos table
          const { data: photoRows, error: photoError } = await supabase
            .from('customer_id_photos')
            .select('customer_id, side, file_path, storage_bucket')
            .eq('shop_id', shopId)
            .is('deleted_at', null);
          
          // Build photo map by customer_id
          const photoMap: Record<string, Partial<Record<'front' | 'back', { path: string; bucket: string }>>> = {};
          if (photoRows && !photoError) {
            for (const photo of photoRows) {
              if (!photoMap[photo.customer_id]) {
                photoMap[photo.customer_id] = {};
              }
              photoMap[photo.customer_id][photo.side as 'front' | 'back'] = {
                path: photo.file_path,
                bucket: photo.storage_bucket
              };
            }
          } else if (photoError) {
            console.error('[Customers] Photo fetch error:', photoError);
          }
          
          const photoService = await import('@/lib/photoService');
          
          for (const row of rows) {
            if (!customers.find(c => c.id === row.id)) {
              // Load signed URLs for ID photos
              let frontUrl = '';
              let backUrl = '';
              
              const customerPhotos = photoMap[row.id];
              if (customerPhotos?.front) {
                try {
                  const url = await photoService.getCustomerIdPhotoUrl(customerPhotos.front.path);
                  frontUrl = url || '';
                } catch (e) {
                  console.error('[Customers] Failed to get front photo URL:', e);
                }
              }
              
              if (customerPhotos?.back) {
                try {
                  const url = await photoService.getCustomerIdPhotoUrl(customerPhotos.back.path);
                  backUrl = url || '';
                } catch (e) {
                  console.error('[Customers] Failed to get back photo URL:', e);
                }
              }
              
              addCustomer({
                id: row.id,
                name: row.full_name || '',
                phone: row.phone || '',
                email: row.email,
                address: row.address,
                idType: row.id_type as any,
                idPhotos: { 
                  front: frontUrl, 
                  back: backUrl || undefined 
                },
                documents: row.documents,
                status: row.status as any,
                dateAdded: row.created_at || new Date().toISOString(),
                customerNumber: row.customer_number || undefined,
              });
            }
          }
        }
      } catch (e) {
        console.error('[Customers] Fetch error:', e);
      }
    })();
  }, []);

  const filteredCustomers = customers.filter(c => 
    (
      safeString(c.name).toLowerCase().includes(search.toLowerCase()) || 
      safeString(c.phone).includes(search) ||
      (c.customerNumber && safeString(c.customerNumber).toLowerCase().includes(search.toLowerCase()))
    )
  );

  const CustomerForm = useCallback(({ initialData, onClose }: { initialData?: Customer, onClose: () => void }) => {
    console.log('[CustomerForm] RENDER - initialData:', initialData?.id || 'UNDEFINED (ADD MODE)', 'onClose:', !!onClose, 'at:', new Date().getTime());
    const { register, handleSubmit, watch, setValue, reset } = useForm<Customer>({
      defaultValues: initialData || { idType: 'Aadhaar' }
    });
    
    const idType = watch('idType');
    
    // PART 1: Dedicated state for pending photos (NOT in react-hook-form)
    const [pendingIdPhotos, setPendingIdPhotos] = useState<{
      front?: { file: File; previewUrl: string }
      back?: { file: File; previewUrl: string }
    }>({});
    console.log('[pendingIdPhotos] Current state:', Object.keys(pendingIdPhotos).map(k => `${k}: ${pendingIdPhotos[k as keyof typeof pendingIdPhotos]?.previewUrl ? 'HAS_URL' : 'NO_URL'}`));
    
    // DB/uploaded photo URLs (for edit mode)
    const [idPhotoFrontUrl, setIdPhotoFrontUrl] = useState<string>('');
    const [idPhotoBackUrl, setIdPhotoBackUrl] = useState<string>('');
    const [idPhotoFrontPath, setIdPhotoFrontPath] = useState<string>('');
    const [idPhotoBackPath, setIdPhotoBackPath] = useState<string>('');
    const [frontUploaded, setFrontUploaded] = useState<boolean>(false);
    const [backUploaded, setBackUploaded] = useState<boolean>(false);
    
    const [documents, setDocuments] = useState<{ type: string; url: string }[]>(initialData?.documents || []);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    // Cleanup blob URLs from pendingIdPhotos on unmount
    useEffect(() => {
      console.log('[CustomerForm useEffect] Mount - initialData:', !!initialData);
      return () => {
        console.log('[CustomerForm useEffect] UNMOUNT - about to revoke blob URLs. pendingIdPhotos:', pendingIdPhotos);
        if (pendingIdPhotos.front?.previewUrl) {
          URL.revokeObjectURL(pendingIdPhotos.front.previewUrl);
        }
        if (pendingIdPhotos.back?.previewUrl) {
          URL.revokeObjectURL(pendingIdPhotos.back.previewUrl);
        }
      };
    }, []);

    // Load existing ID photos from customer_id_photos table
    useEffect(() => {
      console.log('[useEffect] Loading photos for customer:', initialData?.id);
      (async () => {
        if (!initialData?.id) return;
        try {
          const { data: photoRows, error } = await supabase
            .from('customer_id_photos')
            .select('side, file_path, storage_bucket')
            .eq('customer_id', initialData.id);
          
          if (!error && photoRows) {
            const photoService = await import('@/lib/photoService');
            for (const photo of photoRows) {
              if (photo.side === 'front') {
                setIdPhotoFrontPath(photo.file_path);
                const url = await photoService.getCustomerIdPhotoUrl(photo.file_path);
                setIdPhotoFrontUrl(url || '');
                setFrontUploaded(true);
              } else if (photo.side === 'back') {
                setIdPhotoBackPath(photo.file_path);
                const url = await photoService.getCustomerIdPhotoUrl(photo.file_path);
                setIdPhotoBackUrl(url || '');
                setBackUploaded(true);
              }
            }
          }
        } catch (err) {
          console.error('Load ID photos error:', err);
        }
      })();
    }, [initialData?.id]);

    // PART 2: Handle photo selection - preview only, no upload
    const handleIdPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
      const file = e.target.files?.[0];
      console.log(`[Photo Select] ${side}: File =`, file?.name, 'Size:', file?.size, 'Type:', file?.type);
      if (!file) return;

      // Validate file
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Invalid File', description: 'Please upload an image', variant: 'destructive' });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'File Too Large', description: 'Max 5MB allowed', variant: 'destructive' });
        return;
      }

      // Generate preview immediately (blob URL)
      const previewUrl = URL.createObjectURL(file);
      console.log(`[Photo Select] previewUrl created:`, previewUrl);
      
      // Save to pendingIdPhotos ONLY
      console.log(`[Photo Select] BEFORE setPendingIdPhotos:`, pendingIdPhotos);
      setPendingIdPhotos(prev => {
        // Revoke old preview if replacing
        if (prev[side]?.previewUrl) {
          URL.revokeObjectURL(prev[side].previewUrl);
        }
        const newState = {
          ...prev,
          [side]: { file, previewUrl }
        };
        console.log(`[Photo Select] AFTER setPendingIdPhotos:`, newState);
        return newState;
      });

      console.log(`[Photo Select] Toast shown. Setting e.target.value = ''`);
      toast({ title: 'Photo Selected', description: 'Click Register Customer to upload.' });
      e.target.value = '';
    };

    // Delete ID photo
    const handleDeleteIdPhoto = async (side: 'front' | 'back') => {
      if (!confirm(`Delete ${side} ID photo?`)) return;

      const pathToDelete = side === 'front' ? idPhotoFrontPath : idPhotoBackPath;
      
      // For edit mode: delete from storage + DB
      if (pathToDelete && initialData?.id) {
        const result = await deleteCustomerIdPhoto(pathToDelete);
        if (!result.success) {
          toast({ title: 'Delete Failed', description: result.error, variant: 'destructive' });
          return;
        }
        
        const { error } = await supabase
          .from('customer_id_photos')
          .delete()
          .eq('customer_id', initialData.id)
          .eq('side', side);
        
        if (error) {
          toast({ title: 'Delete Failed', description: 'Failed to remove photo record', variant: 'destructive' });
          return;
        }

        if (side === 'front') {
          setIdPhotoFrontPath('');
          setIdPhotoFrontUrl('');
          setFrontUploaded(false);
        } else {
          setIdPhotoBackPath('');
          setIdPhotoBackUrl('');
          setBackUploaded(false);
        }
      } else {
        // For add mode: just clear pending photo
        setPendingIdPhotos(prev => {
          const newState = { ...prev };
          if (newState[side]?.previewUrl) {
            URL.revokeObjectURL(newState[side].previewUrl);
          }
          delete newState[side];
          return newState;
        });
      }

      toast({ title: 'Deleted', description: 'ID photo removed' });
    };

    const onSubmit = async (formData: any) => {
      console.log('[onSubmit] START - initialData:', !!initialData, 'formData:', formData);
      console.log('[onSubmit] pendingIdPhotos at submit:', pendingIdPhotos);
      
      if (initialData) {
        setSubmitting(true);
        try {
          // Edit mode: Update metadata
          await updateCustomer(initialData.id, { ...formData, documents });
          
          // Handle ID photo updates if any pending
          const { uid, shopId } = await getAuthContext();
          const storageHealth = await checkStorageHealth();
          
          if (!storageHealth.healthy) {
            console.warn('[Customer Edit] Storage unavailable:', storageHealth.error);
            toast({ 
              title: 'Customer Updated', 
              description: 'Photos will be uploaded when storage is available.',
              variant: 'default' 
            });
          } else {
            // Upload new photos if changed
            for (const side of ['front', 'back'] as const) {
              if (pendingIdPhotos[side]) {
                try {
                  const result = await uploadCustomerIdPhoto(shopId, initialData.id, pendingIdPhotos[side].file);
                  if (result.success && result.path) {
                    // Delete old photo record (soft delete)
                    await supabase
                      .from('customer_id_photos')
                      .update({ deleted_at: new Date().toISOString() })
                      .eq('customer_id', initialData.id)
                      .eq('side', side)
                      .is('deleted_at', null);
                    
                    // Insert new photo record
                    const { error: insertError } = await supabase
                      .from('customer_id_photos')
                      .insert({
                        shop_id: shopId,
                        customer_id: initialData.id,
                        side: side,
                        file_path: result.path,
                        storage_bucket: 'customer-id-photos'
                      });
                    
                    if (!insertError) {
                      toast({ 
                        title: `${side === 'front' ? 'Front' : 'Back'} ID Photo`, 
                        description: 'Updated successfully', 
                        duration: 2000 
                      });
                    } else {
                      console.error(`[Customer Edit] ${side} photo DB insert failed:`, insertError);
                    }
                  }
                } catch (uploadErr: any) {
                  console.error(`[Customer Edit] ${side} photo upload error:`, uploadErr);
                }
              }
            }
          }
          
          toast({ title: "Updated", description: "Customer details updated." });
          setPendingIdPhotos({});
          onClose();
        } catch (error: any) {
          console.error('[Customer Edit] Error:', error);
          toast({ 
            title: "Error", 
            description: error?.message || "Failed to update customer",
            variant: "destructive"
          });
        } finally {
          setSubmitting(false);
        }
        return;
      }

      // PART 4: STRICT SUBMIT FLOW FOR NEW CUSTOMER
      console.log('[onSubmit] NEW CUSTOMER MODE');
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionToken = sessionData.session?.access_token;
        const sessionUid = sessionData.session?.user?.id;
        const { data: userData } = await supabase.auth.getUser();
        const uid = sessionUid || userData?.user?.id;
        const resolvedShopId = storeShopId || await resolveShopId();
        console.log('[RLS DEBUG][Customer Insert] auth.uid:', uid);
        console.log('[RLS DEBUG][Customer Insert] shop_id:', resolvedShopId);
        
        if (!sessionToken) {
          toast({ title: 'Auth Error', description: 'Session token not available', variant: 'destructive' });
          return;
        }
        if (!uid) {
          toast({ title: 'Missing user', description: 'Authenticated user not found – blocking insert', variant: 'destructive' });
          throw new Error('Authenticated user not found – blocking insert');
        }
        if (!resolvedShopId) {
          toast({ title: 'Missing shop_id', description: 'shop_id not resolved – blocking insert', variant: 'destructive' });
          throw new Error('shop_id not resolved – blocking insert');
        }

        const deviceId = useStore.getState().getDeviceId();

        // STEP 1: Check for duplicate phone
        const { data: existingCustomers, error: checkErr } = await supabase
          .from('customers')
          .select('id, phone')
          .eq('shop_id', resolvedShopId)
          .eq('phone', formData.phone)
          .limit(1);

        if (existingCustomers && existingCustomers.length > 0) {
          toast({ 
            title: "Phone Already Exists", 
            description: "This phone number is already registered with another customer in your shop.", 
            variant: "destructive" 
          });
          return;
        }

        // STEP 2: Call backend API to insert customer (replaces direct Supabase insert)
        const payload = {
          shop_id: resolvedShopId,
          name: formData.name,
          full_name: formData.name,
          phone: formData.phone,
          email: formData.email || null,
          address: formData.address || null,
          id_type: formData.idType || 'Aadhaar',
          id_photos: [],
          documents: documents && documents.length ? documents : null,
          status: 'Verified',
          notes: formData.notes || null,
        };

        console.log('[Customer Insert] Calling backend API with payload:', payload);

        const apiResponse = await fetch('/api/customers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
            'x-device-id': deviceId,
          },
          body: JSON.stringify(payload),
        });

        if (!apiResponse.ok) {
          const errorData = await apiResponse.json();
          const errorMsg = errorData.error || errorData.message || 'Failed to create customer';
          const hint = errorData.hint ? ` ${errorData.hint}` : '';
          console.error('[Customer Insert] API Error:', errorMsg, errorData.hint || '');
          toast({ title: "Insert Failed", description: `${errorMsg}${hint}`, variant: "destructive" });
          return;
        }

        const apiResult = await apiResponse.json();
        const inserted = apiResult.customer;
        const row = inserted;
        
        if (!row || !row.id) {
          toast({ title: "Insert Incomplete", description: "No customer ID returned from backend.", variant: "destructive" });
          return;
        }

        // STEP 3: Now we have customer_id - prepare customer object for UI
        const newCustomer: Customer = {
          id: row.id,
          name: row.full_name,
          phone: row.phone,
          email: row.email || undefined,
          address: row.address || undefined,
          idType: row.id_type,
          idPhotos: { front: '', back: '' },
          documents: row.documents || documents || [],
          status: row.status || 'Verified',
          dateAdded: row.created_at || new Date().toISOString(),
          notes: payload.notes || undefined,
          customerNumber: row.customer_number || `CUST-${row.id.substring(0, 8)}`,
        };

        // STEP 4: Upload pending photos (if any)
        let uploadedFrontPath = '';
        let uploadedBackPath = '';
        let frontSignedUrl = '';
        let backSignedUrl = '';
        let frontUploadFailed = false;
        let backUploadFailed = false;
        let storageHealthy = true;

        // Check storage once before any uploads
        if (pendingIdPhotos.front || pendingIdPhotos.back) {
          const storageHealth = await checkStorageHealth();
          if (!storageHealth.healthy) {
            console.warn('[Customer Create] Storage unavailable:', storageHealth.error);
            storageHealthy = false;
            toast({ 
              title: 'Storage Unavailable', 
              description: 'Customer created. Photos will be uploaded when Supabase Storage is available.',
              variant: 'destructive' 
            });
          }
        }

        // Upload front photo if pending
        if (pendingIdPhotos.front && storageHealthy) {
          try {
            const result = await uploadCustomerIdPhoto(resolvedShopId, row.id, pendingIdPhotos.front.file);
            if (result.success && result.path) {
              // STEP 5: Insert into customer_id_photos table
              const { error: insertError } = await supabase
                .from('customer_id_photos')
                .insert({
                  shop_id: resolvedShopId,
                  customer_id: row.id,
                  side: 'front',
                  file_path: result.path,
                  storage_bucket: 'customer-id-photos'
                });
              
              if (!insertError) {
                uploadedFrontPath = result.path;
                // STEP 6: Get signed URL for preview
                const resolvedFrontUrl = result.signedUrl || (await getCustomerIdPhotoUrl(result.path)) || '';
                if (resolvedFrontUrl) {
                  frontSignedUrl = resolvedFrontUrl;
                }
                toast({ title: 'Front ID Photo', description: 'Uploaded successfully', duration: 2000 });
              } else {
                frontUploadFailed = true;
                console.error('[Customer Create] Front photo DB insert failed:', insertError);
              }
            } else {
              frontUploadFailed = true;
              const errorMsg = result.error || 'Upload failed';
              console.error('[Customer Create] Front photo upload error:', errorMsg);
            }
          } catch (uploadErr: any) {
            frontUploadFailed = true;
            console.error('[Customer Create] Front photo upload error:', uploadErr);
          }
        }

        // Upload back photo if pending
        if (pendingIdPhotos.back && storageHealthy) {
          try {
            const result = await uploadCustomerIdPhoto(resolvedShopId, row.id, pendingIdPhotos.back.file);
            if (result.success && result.path) {
              // STEP 5: Insert into customer_id_photos table
              const { error: insertError } = await supabase
                .from('customer_id_photos')
                .insert({
                  shop_id: resolvedShopId,
                  customer_id: row.id,
                  side: 'back',
                  file_path: result.path,
                  storage_bucket: 'customer-id-photos'
                });
              
              if (!insertError) {
                uploadedBackPath = result.path;
                // STEP 6: Get signed URL for preview
                const resolvedBackUrl = result.signedUrl || (await getCustomerIdPhotoUrl(result.path)) || '';
                if (resolvedBackUrl) {
                  backSignedUrl = resolvedBackUrl;
                }
                toast({ title: 'Back ID Photo', description: 'Uploaded successfully', duration: 2000 });
              } else {
                backUploadFailed = true;
                console.error('[Customer Create] Back photo DB insert failed:', insertError);
              }
            } else {
              backUploadFailed = true;
              const errorMsg = result.error || 'Upload failed';
              console.error('[Customer Create] Back photo upload error:', errorMsg);
            }
          } catch (uploadErr: any) {
            backUploadFailed = true;
            console.error('[Customer Create] Back photo upload error:', uploadErr);
          }
        }

        // STEP 7: Update customer object with signed URLs
        if (frontSignedUrl || backSignedUrl) {
          newCustomer.idPhotos = {
            front: frontSignedUrl || '',
            back: backSignedUrl || undefined
          };
        }

        // Add customer to store
        addCustomer(newCustomer);

        // Get count for display
        const { count } = await supabase
          .from('customers')
          .select('id', { count: 'exact', head: true });

        // Build toast message based on results
        let photoStatus = '';
        let toastVariant: 'default' | 'destructive' = 'default';
        
        if (frontUploadFailed || backUploadFailed) {
          if (frontUploadFailed && backUploadFailed) {
            photoStatus = ' (Photo uploads failed - please edit customer to retry)';
            toastVariant = 'destructive';
          } else if (frontUploadFailed) {
            photoStatus = ' (Front photo upload failed - please edit customer to retry)';
          } else {
            photoStatus = ' (Back photo upload failed - please edit customer to retry)';
          }
        } else if (uploadedFrontPath && uploadedBackPath) {
          photoStatus = ' (with ID photos)';
        } else if (uploadedFrontPath || uploadedBackPath) {
          photoStatus = ' (with 1 ID photo)';
        }
        
        toast({ 
          title: "Customer Registered", 
          description: `${newCustomer.name} added successfully${photoStatus}. Total: ${count ?? 'n/a'}`,
          variant: toastVariant
        });

        // PART 5: ONLY reset after full success, and only clear pending photos
        console.log('[onSubmit] SUCCESS - clearing pendingIdPhotos and closing dialog');
        setPendingIdPhotos({});
        // DO NOT call reset() - let the dialog close naturally
        onClose();
      } catch (e: any) {
        toast({ title: "Unexpected Error", description: e?.message || String(e), variant: "destructive" });
      }
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Full Name</label>
          <Input {...register("name", { required: true })} placeholder="Rahul Kumar" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Phone Number</label>
          <Input 
            type="tel" 
            {...register("phone", { 
              required: 'Phone number is required',
              minLength: { value: 10, message: 'Phone must be exactly 10 digits' },
              maxLength: { value: 10, message: 'Phone must be exactly 10 digits' },
              pattern: { value: /^\d{10}$/, message: 'Phone must be 10 numeric digits' }
            })} 
            placeholder="9876543210"
            inputMode="numeric"
            maxLength={10}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Email (Optional)</label>
          <Input type="email" {...register("email")} placeholder="customer@example.com" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Address</label>
          <Input {...register("address")} placeholder="House No., Street, Area" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">City</label>
            <Input {...register("city")} placeholder="City" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">State</label>
            <Input {...register("state")} placeholder="State" />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Pincode</label>
          <Input {...register("pincode")} placeholder="123456" maxLength={6} />
        </div>
        
        <div className="space-y-2">
           <label className="text-sm font-medium">ID Proof Type</label>
           <Select onValueChange={(val) => setValue('idType', val as any)} defaultValue={initialData?.idType || "Aadhaar"}>
            <SelectTrigger>
              <SelectValue placeholder="Select ID Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Aadhaar">Aadhaar Card</SelectItem>
              <SelectItem value="Driving License">Driving License</SelectItem>
              <SelectItem value="Voter ID">Voter ID</SelectItem>
              <SelectItem value="Passport">Passport</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ID Photos Section */}
        <fieldset className="border rounded-lg p-4 space-y-4">
          <legend className="text-sm font-semibold">ID Proof Photos ({idType})</legend>
          
          {/* FRONT Photo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Front Side</label>
              <div className="flex gap-1">
                <input id="id-photo-front-camera" type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => handleIdPhotoUpload(e, 'front')} disabled={uploading} />
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost"
                  onClick={() => document.getElementById('id-photo-front-camera')?.click()}
                  disabled={uploading}
                  className="h-7 px-2 text-xs"
                >
                  <Camera size={12} className="mr-1" /> Take
                </Button>
                
                <input id="id-photo-front-gallery" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleIdPhotoUpload(e, 'front')} disabled={uploading} />
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost"
                  onClick={() => document.getElementById('id-photo-front-gallery')?.click()}
                  disabled={uploading}
                  className="h-7 px-2 text-xs"
                >
                  <ImageIcon size={12} className="mr-1" /> Select
                </Button>
              </div>
            </div>
            
            {(() => {
              const shouldShowPreview = pendingIdPhotos.front?.previewUrl || idPhotoFrontUrl;
              console.log(`[Render] Front preview check: pendingIdPhotos.front?.previewUrl=${pendingIdPhotos.front?.previewUrl}, idPhotoFrontUrl=${idPhotoFrontUrl}, shouldShow=${!!shouldShowPreview}`);
              return shouldShowPreview ? (
              <div className="relative border-2 border-green-200 bg-green-50 rounded-lg overflow-hidden">
                <img src={pendingIdPhotos.front?.previewUrl || idPhotoFrontUrl} className="h-40 w-full object-cover cursor-pointer" onClick={() => setImageViewerSrc(pendingIdPhotos.front?.previewUrl || idPhotoFrontUrl || '')} />
                <button
                  type="button"
                  onClick={() => handleDeleteIdPhoto('front')}
                  className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700 shadow-md"
                  title="Delete front photo"
                >
                  <Trash2 size={16} />
                </button>
                {pendingIdPhotos.front ? (
                  <div className="absolute bottom-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">Preview</div>
                ) : (
                  <div className="absolute bottom-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded">✓ Uploaded</div>
                )}
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50">
                <ImageIcon size={32} className="mx-auto mb-2 text-gray-400" />
                <p className="text-xs text-gray-600">No photo uploaded yet</p>
              </div>
            );
            })()}
          </div>
          
          {/* BACK Photo (conditional based on ID type) */}
          {(idType === 'Aadhaar' || idType === 'Driving License' || idType === 'Voter ID') && (
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Back Side</label>
                <div className="flex gap-1">
                  <input id="id-photo-back-camera" type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => handleIdPhotoUpload(e, 'back')} disabled={uploading} />
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="ghost"
                    onClick={() => document.getElementById('id-photo-back-camera')?.click()}
                    disabled={uploading}
                    className="h-7 px-2 text-xs"
                  >
                    <Camera size={12} className="mr-1" /> Take
                  </Button>
                  
                  <input id="id-photo-back-gallery" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleIdPhotoUpload(e, 'back')} disabled={uploading} />
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="ghost"
                    onClick={() => document.getElementById('id-photo-back-gallery')?.click()}
                    disabled={uploading}
                    className="h-7 px-2 text-xs"
                  >
                    <ImageIcon size={12} className="mr-1" /> Select
                  </Button>
                </div>
              </div>
              
              {pendingIdPhotos.back?.previewUrl || idPhotoBackUrl ? (
                <div className="relative border-2 border-green-200 bg-green-50 rounded-lg overflow-hidden">
                  <img src={pendingIdPhotos.back?.previewUrl || idPhotoBackUrl} className="h-40 w-full object-cover cursor-pointer" onClick={() => setImageViewerSrc(pendingIdPhotos.back?.previewUrl || idPhotoBackUrl || '')} />
                  <button
                    type="button"
                    onClick={() => handleDeleteIdPhoto('back')}
                    className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700 shadow-md"
                    title="Delete back photo"
                  >
                    <Trash2 size={16} />
                  </button>
                  {pendingIdPhotos.back ? (
                    <div className="absolute bottom-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">Preview</div>
                  ) : (
                    <div className="absolute bottom-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded">✓ Uploaded</div>
                  )}
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50">
                  <ImageIcon size={32} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-xs text-gray-600">No photo uploaded yet</p>
                </div>
              )}
            </div>
          )}
        </fieldset>

        {/* Additional Documents Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Additional Documents</label>
            <Button type="button" size="icon" variant="outline" className="h-6 w-6" onClick={() => setDocuments([...documents, { type: 'Other', url: '' }])}>
              <Plus size={14} />
            </Button>
          </div>
          
          {documents.length > 0 && (
            <div className="grid gap-2">
              {documents.map((doc, i) => (
                <div key={i} className="border border-dashed border-zinc-300 rounded-lg p-3 flex items-center justify-between">
                  {doc.url ? (
                    <img src={doc.url} className="h-12 w-12 object-cover rounded" />
                  ) : (
                    <div className="h-12 w-12 bg-zinc-100 rounded flex items-center justify-center">
                      <UploadCloud size={16} className="text-zinc-400" />
                    </div>
                  )}
                  <div className="flex gap-1 flex-1 ml-2">
                    <button type="button" onClick={() => (document.getElementById(`doc-gallery-${i}`) as HTMLInputElement)?.click()} className="p-1.5 hover:bg-zinc-100 rounded text-zinc-600">
                      <ImageIcon size={16} />
                    </button>
                    <button type="button" onClick={() => (document.getElementById(`doc-camera-${i}`) as HTMLInputElement)?.click()} className="p-1.5 hover:bg-zinc-100 rounded text-zinc-600">
                      <Camera size={16} />
                    </button>
                  </div>
                  <button type="button" onClick={() => setDocuments(documents.filter((_, idx) => idx !== i))} className="p-1.5 hover:bg-red-50 rounded text-red-600">
                    <X size={16} />
                  </button>
                  <input id={`doc-gallery-${i}`} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const newDocs = [...documents];
                      newDocs[i].url = URL.createObjectURL(file);
                      setDocuments(newDocs);
                    }
                  }} />
                  <input id={`doc-camera-${i}`} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const newDocs = [...documents];
                      newDocs[i].url = URL.createObjectURL(file);
                      setDocuments(newDocs);
                    }
                  }} />
                </div>
              ))}
            </div>
          )}
        </div>

        <Button 
          type="submit" 
          className="w-full h-12 mt-4" 
          disabled={submitting}
          onClick={() => console.log('[Button] Register Customer clicked. submitting:', submitting, 'initialData:', !!initialData, 'pendingIdPhotos:', pendingIdPhotos)}
        >
          {submitting ? 'Saving...' : (initialData ? 'Save Changes' : 'Register Customer')}
        </Button>
      </form>
    );
  }, [addCustomer, toast, user?.role, supabase, updateCustomer]);

  return (
    <MobileLayout>
      <div ref={containerRef} className="p-4 space-y-4 min-h-screen pb-24 relative">
        <PullToRefreshIndicator 
          pullDistance={pullDistance} 
          isRefreshing={isRefreshing} 
          pullProgress={pullProgress} 
        />
        
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Customers</h1>
          <Dialog open={isAddOpen} onOpenChange={handleAddOpenChange}>
            <DialogTrigger asChild>
              <Button size="icon" className="rounded-full h-10 w-10 shadow-md">
                <Plus size={20} />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md top-[5%] translate-y-0 max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
              </DialogHeader>
              <CustomerForm onClose={() => setIsAddOpen(false)} />
            </DialogContent>
          </Dialog>

        </div>

        {/* Delete confirmation */}
        <Dialog open={confirmDelete.open} onOpenChange={(open) => setConfirmDelete({ open, customer: confirmDelete.customer })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Customer?</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {confirmDelete.customer ? (
                  <>This will permanently remove {confirmDelete.customer.name} from your customer database.</>
                ) : (
                  <>This action cannot be undone.</>
                )}
              </p>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete({ open: false })}>Cancel</Button>
              <Button 
                variant="destructive" 
                className="flex-1" 
                onClick={async () => {
                  if (!confirmDelete.customer) return;
                  
                  try {
                    console.log('[Delete Customer] Dialog: Attempting to delete:', confirmDelete.customer.id, 'at', new Date().toISOString());
                    await deleteCustomer(confirmDelete.customer.id);
                    console.log('[Delete Customer] Dialog: Delete successful at', new Date().toISOString());
                    toast({ 
                      title: 'Customer Deleted', 
                      description: `${confirmDelete.customer.name} has been removed.` 
                    });
                    console.log('[Delete Customer] Dialog: Starting refreshAllData at', new Date().toISOString());
                    await refreshAllData();
                    console.log('[Delete Customer] Dialog: refreshAllData completed at', new Date().toISOString());
                  } catch (error: any) {
                    console.error('[Delete Customer] Dialog: Delete failed:', error);
                    const message = error?.message || 'Failed to delete customer';
                    
                    if (message.includes('bookings') || message.includes('booking')) {
                      toast({ 
                        title: 'Cannot Delete Customer', 
                        description: 'This customer has existing bookings and cannot be deleted.',
                        variant: 'destructive' 
                      });
                    } else {
                      toast({ 
                        title: 'Delete Failed', 
                        description: message, 
                        variant: 'destructive' 
                      });
                    }
                  }
                  
                  setConfirmDelete({ open: false, customer: undefined });
                }}
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        
        <Dialog open={!!editingCustomer} onOpenChange={(open) => !open && setEditingCustomer(null)}>
           <DialogContent className="sm:max-w-md top-[5%] translate-y-0 max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
              {editingCustomer && <CustomerForm initialData={editingCustomer} onClose={() => setEditingCustomer(null)} />}
           </DialogContent>
        </Dialog>

        {/* Customer Details Modal - Task 8: Redesigned for professional look */}
        <Dialog open={!!viewingCustomer} onOpenChange={(open) => !open && setViewingCustomer(null)}>
          <DialogContent className="sm:max-w-md top-[5%] translate-y-0 max-h-[90vh] overflow-y-auto">
            <DialogHeader className="relative">
              <div className="flex items-center justify-between pr-8">
                <div className="flex items-center justify-between w-full">
                  <DialogTitle className="text-lg flex items-center gap-3">
                    {viewingCustomer?.name}
                  </DialogTitle>
                  {viewingCustomer?.customerNumber && (
                    <button
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-primary text-white text-xs font-semibold shadow hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40 ml-4 border border-primary"
                      onClick={() => {
                        navigator.clipboard.writeText(viewingCustomer.customerNumber || '');
                        toast({ title: 'Copied', description: 'Customer ID copied' });
                      }}
                    >
                      {viewingCustomer.customerNumber}
                      <Copy size={12} />
                    </button>
                  )}
                </div>
              </div>
            </DialogHeader>
            
            {viewingCustomer && (
              <div className="space-y-4 mt-2">
                {/* Task 5 & 4: Contact Information Section with Call, WhatsApp, Save Contact */}
                <div className="bg-zinc-50 rounded-lg p-3 space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">Contact</h4>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Phone size={14} className="text-muted-foreground" />
                    <span className="flex-1">{viewingCustomer.phone}</span>
                  </div>

                  {viewingCustomer.email && (
                    <div className="text-sm text-muted-foreground">{viewingCustomer.email}</div>
                  )}

                  {/* Task 4: Display customer address */}
                  {(viewingCustomer.address || viewingCustomer.city || viewingCustomer.state) && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground pt-1">
                      <MapPin size={14} className="mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        {viewingCustomer.address && <div>{viewingCustomer.address}</div>}
                        <div className="flex gap-1">
                          {viewingCustomer.city && <span>{viewingCustomer.city}</span>}
                          {viewingCustomer.city && viewingCustomer.state && <span>,</span>}
                          {viewingCustomer.state && <span>{viewingCustomer.state}</span>}
                          {viewingCustomer.pincode && <span>- {viewingCustomer.pincode}</span>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Task 5: Action buttons - Call, WhatsApp, Save to Contacts */}
                  <div className="flex gap-2 pt-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1 h-8 text-xs"
                      onClick={() => window.location.href = `tel:${viewingCustomer.phone}`}
                    >
                      <Phone size={12} className="mr-1" /> Call
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1 h-8 text-xs"
                      onClick={() => window.open(`https://wa.me/91${viewingCustomer.phone.replace(/\D/g, '').slice(-10)}`)}
                    >
                      <MessageCircle size={12} className="mr-1" /> WhatsApp
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1 h-8 text-xs"
                      onClick={() => downloadVCF({
                        name: viewingCustomer.name,
                        phone: viewingCustomer.phone,
                        email: viewingCustomer.email,
                        address: [viewingCustomer.address, viewingCustomer.city, viewingCustomer.state, viewingCustomer.pincode].filter(Boolean).join(', ')
                      })}
                    >
                      <Download size={12} className="mr-1" /> Save
                    </Button>
                  </div>
                </div>

                {/* ID Proofs Section */}
                {(viewingCustomerIdPhotos.front || viewingCustomerIdPhotos.back) && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase">ID Proof ({viewingCustomer.idType})</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {viewingCustomerIdPhotos.front && (
                        <div className="border rounded-lg overflow-hidden">
                          <img src={viewingCustomerIdPhotos.front} className="h-32 w-full object-cover" alt="Front ID" />
                          <Button size="sm" variant="ghost" className="w-full h-7 text-xs" onClick={() => setImageViewerSrc(viewingCustomerIdPhotos.front!)}>
                            <Eye size={12} className="mr-1" /> View
                          </Button>
                        </div>
                      )}
                      {viewingCustomerIdPhotos.back && (
                        <div className="border rounded-lg overflow-hidden">
                          <img src={viewingCustomerIdPhotos.back} className="h-32 w-full object-cover" alt="Back ID" />
                          <Button size="sm" variant="ghost" className="w-full h-7 text-xs" onClick={() => setImageViewerSrc(viewingCustomerIdPhotos.back!)}>
                            <Eye size={12} className="mr-1" /> View
                          </Button>
                        </div>
                      )}
                    </div>
                    {loadingIdPhotos && (
                      <div className="text-xs text-muted-foreground text-center py-2">Loading ID photos...</div>
                    )}
                  </div>
                )}

                {/* Additional Documents */}
                {viewingCustomer.documents && viewingCustomer.documents.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase">Additional Documents</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {viewingCustomer.documents.map((doc, i) => (
                        <div key={i} className="border rounded-lg overflow-hidden">
                          <img src={doc.url} className="h-32 w-full object-cover" alt={`Document ${i + 1}`} />
                          <Button size="sm" variant="ghost" className="w-full h-7 text-xs" onClick={() => setImageViewerSrc(doc.url)}>
                            <Eye size={12} className="mr-1" /> View
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2 pt-2 border-t">
                  {/* Task 1: Display deletion timer if ID photos exist */}
                  {(viewingCustomerIdPhotos.front || viewingCustomerIdPhotos.back) && deletionInfo && (
                    <div className="flex items-center gap-2 text-xs bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                      <Clock size={14} className="text-yellow-700 flex-shrink-0" />
                      <span className="text-yellow-700 flex-1">
                        {formatDeletionTimer(deletionInfo)}
                      </span>
                      {deletionInfo.isExpired && (
                        <span className="text-[10px] text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Ready</span>
                      )}
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    {permissions.canEditCustomer && (
                      <>
                        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => {
                          setEditingCustomer(viewingCustomer);
                          setViewingCustomer(null);
                        }}>
                          <Edit2 size={12} className="mr-1" /> Edit
                        </Button>
                        {/* Task 1: Disable delete button if ID photos can't be deleted yet */}
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          className="flex-1 h-8 text-xs" 
                          disabled={!!(deletionInfo && !deletionInfo.canDelete && (viewingCustomerIdPhotos.front || viewingCustomerIdPhotos.back))}
                          onClick={() => {
                            setConfirmDelete({ open: true, customer: viewingCustomer });
                            setViewingCustomer(null);
                          }}
                        >
                          <Trash2 size={12} className="mr-1" /> Delete
                        </Button>
                      </>
                    )}
                    <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => {
                      setLocation(`/bookings?filter=all&customerId=${viewingCustomer.id}`);
                    }}>
                      View Bookings
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
          <Input 
            placeholder="Search by name or phone..." 
            className="pl-9 bg-zinc-50 border-zinc-200"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Task 3: Improved customer list layout */}
        <div className="space-y-2 mt-3">
          {filteredCustomers.map((customer) => (
            <Card 
              key={customer.id} 
              className="shadow-sm border-zinc-200 hover:shadow-md hover:border-primary/50 transition-all cursor-pointer relative overflow-hidden min-w-[420px]" 
              onClick={() => setViewingCustomer(customer)}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-4 justify-between">
                  {/* Customer info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-yellow-100 to-yellow-200 flex items-center justify-center text-yellow-700 font-bold text-lg flex-shrink-0">
                      {customer.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{customer.name}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <Phone size={11} />
                        <span>{customer.phone}</span>
                      </div>
                      {/* Show city/state if available */}
                      {(customer.city || customer.state) && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground/70 mt-0.5">
                          <MapPin size={10} />
                          <span className="truncate">
                            {customer.city}{customer.city && customer.state ? ', ' : ''}{customer.state}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Customer number badge (not absolute, fits row) */}
                  {customer.customerNumber && (
                    <div className="flex items-center gap-1 bg-primary text-white px-2 py-0.5 rounded-full border border-primary shadow-sm ml-2">
                      <span className="text-[10px] font-mono">{customer.customerNumber}</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(customer.customerNumber || '');
                          toast({ title: 'Copied', description: 'Customer ID copied' });
                        }}
                        className="hover:bg-primary/80 rounded p-0.5"
                        title="Copy Customer Number"
                      >
                        <Copy size={8} />
                      </button>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1.5 py-0">
                      <CheckCircle2 size={9} className="mr-0.5" />
                      {customer.status}
                    </Badge>
                    <a 
                      href={`tel:${customer.phone}`} 
                      className="p-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors" 
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone size={13} />
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Image Viewer */}
        {imageViewerSrc && (
          <ImageViewer
            src={imageViewerSrc}
            open={!!imageViewerSrc}
            onClose={() => setImageViewerSrc(null)}
            title="Customer Document"
          />
        )}
      </div>
    </MobileLayout>
  );
}
