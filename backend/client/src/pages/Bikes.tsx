import { useState, useEffect, useMemo, useCallback } from "react";
import MobileLayout from "@/components/layout/MobileLayout";
import { useStore, Bike, Damage, Booking, DamageType, getPermissions } from "@/lib/store";
import { safeArray, safeString } from "@/lib/safe";
import { validateUUID } from "@/lib/uuidValidation";
import { uiToDbSeverity, dbToUiSeverity } from "@/lib/damageSeverity";
import DamageForm, { DamageFormData } from "@/components/DamageForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Filter, Fuel, Calendar, UploadCloud, AlertTriangle, Gauge, X, Trash2, Edit2, CalendarDays, Bike as BikeIcon, Car as CarIcon, Camera, Image as ImageIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO, startOfDay, endOfDay, addDays, isWithinInterval } from "date-fns";
import { supabase } from "@/lib/supabase";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh-indicator";
import { getAuthContext } from "@/lib/shopIdHelper";
import vehicleModels from "@/data/vehiclemodel.json";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

  const getVehicleIcon = (type?: string) => {
  if (type === 'car') return <CarIcon size={16} />;
  return <BikeIcon size={16} />;
};
// Local helper to check per-vehicle block (shared key with calendar)
const VEHICLE_BLOCK_KEY = 'rento_blocked_vehicle_days';
function isBikeBlockedOnDateLocal(bikeId: string, date: Date | null): boolean {
  if (!date) return false;
  try {
    const raw = localStorage.getItem(VEHICLE_BLOCK_KEY);
    const map = raw ? JSON.parse(raw) as Record<string, string[]> : {};
    const key = date.toISOString().slice(0,10);
    const arr = map[bikeId] || [];
    return arr.includes(key);
  } catch {
    return false;
  }
}

const getVehicleLabel = (type?: string) => {
  return type === 'car' ? 'Car' : 'Bike';
};

export default function Bikes() {
  const { bikes, bookings, addBike, updateBike, deleteBike, user, refreshAllData, shopId: storeShopId, resolveShopId } = useStore();
  const permissions = getPermissions(user?.role || null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string>("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  // Pull-to-refresh handler - preserve current filters, just rehydrate data
  const handleRefresh = useCallback(async () => {
    await refreshAllData();
  }, [refreshAllData]);
  
  const { containerRef, pullDistance, isRefreshing, pullProgress } = usePullToRefresh({
    onRefresh: handleRefresh,
  });
  const [editingBike, setEditingBike] = useState<Bike | null>(null);
  const [viewingBike, setViewingBike] = useState<Bike | null>(null);
  const [damagePreviewUrl, setDamagePreviewUrl] = useState<string | null>(null);
  
  // Shared damage form state
  const [editingDamage, setEditingDamage] = useState<Damage | null>(null);
  const [isDamageModalOpen, setIsDamageModalOpen] = useState(false);
  const [isDamageFormLoading, setIsDamageFormLoading] = useState(false);

  // Keep viewingBike in sync after refreshAllData updates bikes
  useEffect(() => {
    if (!viewingBike) return;
    const updated = bikes.find((b) => b.id === viewingBike.id);
    if (updated) {
      setViewingBike(updated);
    }
  }, [bikes, viewingBike?.id]);

  // ❌ REMOVED: Redundant vehicle fetch that was missing deleted_at filter
  // ❌ ROOT CAUSE: This useEffect was fetching vehicles WITHOUT filtering deleted_at
  // ❌ This caused soft-deleted vehicles to reappear after customer/booking delete
  // ✅ FIX: Removed entirely - store's refreshBikes() handles this correctly
  
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'tomorrow' | 'custom'>('all');
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  const { toast } = useToast();
  const [location] = useLocation();

  // Handle URL query params for actions
  useEffect(() => {
    if ((location || '').includes("action=new")) {
      setIsAddOpen(true);
    }
  }, [location]);

  const getAvailabilityDate = () => {
    if (dateFilter === 'today') return startOfDay(new Date());
    if (dateFilter === 'tomorrow') return startOfDay(addDays(new Date(), 1));
    if (dateFilter === 'custom' && customDate) return startOfDay(customDate);
    return null;
  };

  const isBikeAvailableOnDate = useMemo(() => {
    return (bikeId: string, date: Date | null) => {
      if (!date) return true;
      
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      
      const conflictingBookings = bookings.filter(booking => {
        if (booking.status === 'cancelled' || booking.status === 'completed' || booking.status === 'expired') return false;
        if (!booking.startDate || !booking.endDate || !safeArray<string>(booking.bikeIds).includes(bikeId)) return false;
        
        const bookingStart = parseISO(booking.startDate);
        const bookingEnd = parseISO(booking.endDate);
        
        return bookingStart < dayEnd && bookingEnd > dayStart;
      });
      
      return conflictingBookings.length === 0;
    };
  }, [bookings]);

  // Derive effective status for filters using current bookings
  const getEffectiveStatusForBike = useMemo(() => {
    return (bike: Bike, date: Date | null): string => {
      if (bike.status === 'Maintenance') return 'Maintenance';
      const dayStart = date ? startOfDay(date) : null;
      const dayEnd = date ? endOfDay(date) : null;
      const relevantBookings = bookings.filter((b: Booking) => b.startDate && b.endDate && safeArray<string>(b.bikeIds).includes(bike.id) && b.status !== 'cancelled' && b.status !== 'completed' && b.status !== 'expired');
      if (!date) {
        // If no date filter, prefer showing active status if any ongoing booking overlaps today
        const today = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());
        const todayBooking = relevantBookings.find(b => {
          if (!b.startDate || !b.endDate) return false;
          const s = parseISO(b.startDate);
          const e = parseISO(b.endDate);
          return s < todayEnd && e > today;
        });
        return todayBooking?.status || bike.status;
      }
      const match = relevantBookings.find(b => {
        if (!b.startDate || !b.endDate || !dayStart || !dayEnd) return false;
        const s = parseISO(b.startDate);
        const e = parseISO(b.endDate);
        return s < dayEnd && e > dayStart;
      });
      return match?.status || (isBikeAvailableOnDate(bike.id, date) ? 'Available' : 'Booked');
    };
  }, [bookings, isBikeAvailableOnDate]);

  const filteredBikes = useMemo(() => {
    const availabilityDate = getAvailabilityDate();
    
    return bikes.filter(bike => {
      const matchesSearch = bike.name.toLowerCase().includes(search.toLowerCase()) || 
                bike.regNo.toLowerCase().includes(search.toLowerCase()) ||
                (bike.brand || '').toLowerCase().includes(search.toLowerCase()) ||
                (bike.model || '').toLowerCase().includes(search.toLowerCase());
      const effectiveStatus = getEffectiveStatusForBike(bike, availabilityDate);
      const matchesFilter = filter === "all" || effectiveStatus.toLowerCase() === filter.toLowerCase();
      const matchesVehicleType = vehicleTypeFilter === "all" || (bike.type || 'bike') === vehicleTypeFilter;
      
      return matchesSearch && matchesFilter && matchesVehicleType;
    });
}, [bikes, search, filter, vehicleTypeFilter, dateFilter, customDate, getEffectiveStatusForBike]);

  const handleDamageFormSubmit = useCallback(
    async (data: DamageFormData) => {
      console.log('[handleDamageFormSubmit] START', { viewingBike: viewingBike?.id, editingDamage: editingDamage?.id });
      
      if (!viewingBike) {
        toast({
          title: 'Error',
          description: 'No vehicle selected',
          variant: 'destructive',
        });
        throw new Error('No vehicle selected');
      }

      // GUARD: Reject non-persisted damages for edit
      if (editingDamage && !editingDamage.isPersisted) {
        toast({
          title: 'Error',
          description: 'Damage not yet saved to database. Cannot edit until saved.',
          variant: 'destructive',
        });
        throw new Error('Damage not yet saved to database. Cannot edit until saved.');
      }

      try {
        console.log('[EDIT START]');
        setIsDamageFormLoading(true);
        const { shopId, userId } = await getAuthContext();
        console.log('[AUTH CONTEXT]', { shopId, userId });

        // Validate UUIDs before sending to Supabase
        validateUUID(viewingBike.id, 'vehicle_id');
        if (editingDamage) {
          validateUUID(editingDamage.id, 'damage_id');
        }

        const payload = editingDamage ? {
          type: data.type,
          severity: uiToDbSeverity(data.severity),
          description: data.notes || null,
          photo_urls: data.photoUrls.length > 0 ? data.photoUrls : null,
        } : {
          shop_id: shopId,
          user_id: userId,
          vehicle_id: viewingBike.id,
          booking_id: null,
          type: data.type,
          severity: uiToDbSeverity(data.severity),
          description: data.notes || null,
          photo_urls: data.photoUrls.length > 0 ? data.photoUrls : null,
          reported_by: userId,
          reported_at: new Date().toISOString(),
        };
        console.log('[EDIT PAYLOAD]', payload);

        if (editingDamage) {
          // UPDATE existing damage
          const { data: resultData, error } = await supabase
            .from('damages')
            .update(payload as any)
            .eq('id', editingDamage.id)
            .eq('shop_id', shopId);

          console.log('[EDIT SUPABASE RESULT]', { data: resultData, error });
          if (error) throw new Error(error.message);

          toast({
            title: 'Damage Updated',
            description: 'Changes saved to database.',
          });
        } else {
          // INSERT new damage
          const { data: resultData, error } = await supabase
            .from('damages')
            .insert(payload as any);

          console.log('[EDIT SUPABASE RESULT]', { data: resultData, error });
          if (error) throw new Error(error.message);

          toast({
            title: 'Damage Reported',
            description: 'Saved to database.',
          });
        }

        // Refresh all data to sync damages from public.damages table
        await refreshAllData();

        // Close modal and clear state
        setEditingDamage(null);
        setIsDamageModalOpen(false);
      } catch (error: any) {
        console.error('[handleDamageFormSubmit] ERROR', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to save damage',
          variant: 'destructive',
        });
        throw error;
      } finally {
        console.log('[EDIT FINALLY FIRED]');
        setIsDamageFormLoading(false);
      }
    },
    [editingDamage, viewingBike, refreshAllData, toast]
  );

  const handleDeleteDamage = useCallback(
    async (damage: Damage) => {
      if (!viewingBike?.id || !damage?.id) return;

      // GUARD: Reject non-persisted damages
      if (!damage.isPersisted) {
        toast({
          title: 'Cannot Delete',
          description: 'This damage has not been saved to the database yet.',
          variant: 'destructive',
        });
        return;
      }

      if (!window.confirm('Delete this damage? This will soft-delete in the database.')) {
        return;
      }

      try {
        setIsDamageFormLoading(true);
        const { shopId } = await getAuthContext();
        console.log('[DELETE RAW DAMAGE]', damage);
        console.log('[DELETE RAW ID]', damage?.id);
        console.log('[DAMAGE TRACE][delete start]', {
          bikeId: viewingBike.id,
          damageId: damage.id,
          typeofId: typeof damage.id,
          shopId,
        });

        // Validate UUID before sending to Supabase
        validateUUID(damage.id, 'damage_id');

        const { error } = await supabase
          .from('damages')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', damage.id)
          .eq('shop_id', shopId);

        if (error) throw new Error(error.message);
        console.log('[DAMAGE TRACE][delete success]', { bikeId: viewingBike.id, damageId: damage.id });

        // Refresh all data to sync damages from public.damages table
        await refreshAllData();

        // CRITICAL: Clear editing state after successful delete
        setEditingDamage(null);

        toast({
          title: 'Damage Deleted',
          description: 'Damage moved to recycle bin.',
        });
      } catch (err: any) {
        console.error('[handleDeleteDamage] failed', err);
        toast({
          title: 'Delete Failed',
          description: err?.message || String(err),
          variant: 'destructive',
        });
      } finally {
        setIsDamageFormLoading(false);
      }
    },
    [refreshAllData, toast, viewingBike]
  );

  const BikeForm = ({ initialData, onClose }: { initialData?: Bike, onClose: () => void }) => {
    const { register, handleSubmit, watch, setValue } = useForm<Bike>({
      defaultValues: initialData || {
        photos: [],
        status: 'Available',
        fuelType: 'Petrol',
        type: 'bike',
        brand: '',
        model: '',
        cc: '',
        segment: '',
        gearType: '',
        category: '',
        isPublished: false,
      }
    });

    const [vehicleTypeSelection, setVehicleTypeSelection] = useState<string>(initialData?.type || 'bike');
    const [brandSelection, setBrandSelection] = useState<string>(initialData?.brand || '');
    const [modelSelection, setModelSelection] = useState<string>(initialData?.model || '');
    const [brandIsOther, setBrandIsOther] = useState<boolean>(false);
    const [modelIsOther, setModelIsOther] = useState<boolean>(false);
    const [brandOpen, setBrandOpen] = useState<boolean>(false);
    const [modelOpen, setModelOpen] = useState<boolean>(false);

    // Vehicle master data helpers
    const vehicleTypeOptions = useMemo(() => {
      const types = ['Bike', 'Car', 'Scooter', 'EV'];
      // Deduplicate by returning unique array
      return Array.from(new Set(types));
    }, []);
    const brandsForType = useMemo(() => {
      const setBrands = new Set<string>();
      vehicleModels
        .filter(vm => vm.vehicle_type.toLowerCase() === (vehicleTypeSelection || 'bike').toLowerCase())
        .forEach(vm => setBrands.add(vm.brand));
      return Array.from(setBrands).sort();
    }, [vehicleTypeSelection]);

    const modelsForBrand = useMemo(() => {
      const setModels = new Set<string>();
      vehicleModels
        .filter(vm =>
          vm.vehicle_type.toLowerCase() === (vehicleTypeSelection || 'bike').toLowerCase() &&
          vm.brand === brandSelection
        )
        .forEach(vm => setModels.add(vm.model));
      return Array.from(setModels).sort();
    }, [vehicleTypeSelection, brandSelection]);

    const selectedMaster = useMemo(() => {
      return vehicleModels.find(vm =>
        vm.vehicle_type.toLowerCase() === (vehicleTypeSelection || 'bike').toLowerCase() &&
        vm.brand === brandSelection &&
        vm.model === modelSelection
      );
    }, [vehicleTypeSelection, brandSelection, modelSelection]);

    useEffect(() => {
      if (brandSelection && !brandIsOther) {
        const exists = brandsForType.includes(brandSelection);
        if (!exists) setBrandIsOther(true);
      }
    }, [brandSelection, brandIsOther, brandsForType]);

    useEffect(() => {
      if (modelSelection && !modelIsOther && !modelsForBrand.includes(modelSelection)) {
        setModelIsOther(true);
      }
    }, [modelSelection, modelIsOther, modelsForBrand]);
    
    // Mock multiple photos
    const [photos, setPhotos] = useState<string[]>(initialData?.photos || []);

    useEffect(() => {
      if (selectedMaster) {
        setValue('cc', selectedMaster.cc || '');
        setValue('segment', selectedMaster.segment || '');
        setValue('gearType', selectedMaster.gear_type || '');
        setValue('category', selectedMaster.category || '');
      }
    }, [selectedMaster, setValue]);
    // Mock previous damages for new bike
    const [previousDamages, setPreviousDamages] = useState<Damage[]>(initialData?.damages || []);

    // File inputs for camera/gallery
    const galleryInputRef = useState<HTMLInputElement | null>(null)[0];
    const cameraInputRef = useState<HTMLInputElement | null>(null)[0];
    const handleGalleryPick = (files: FileList | null) => {
      if (!files) return;
      const urls = Array.from(files).slice(0, Math.max(0, 6 - photos.length)).map(f => URL.createObjectURL(f));
      setPhotos([...photos, ...urls]);
    };
    const handleCameraShot = (files: FileList | null) => {
      if (!files) return;
      const urls = Array.from(files).slice(0, Math.max(0, 6 - photos.length)).map(f => URL.createObjectURL(f));
      setPhotos([...photos, ...urls]);
    };

    const handleRemovePhoto = (index: number) => {
      const newPhotos = [...photos];
      newPhotos.splice(index, 1);
      setPhotos(newPhotos);
    };
    
    const handleAddDamageMock = () => {
      const now = new Date().toISOString();
      setPreviousDamages(prev => ([
        ...prev,
        {
          id: Math.random().toString(36).substr(2, 9),
          type: 'Scratch',
          severity: 'minor',
          date: now,
          photoUrls: [],
          notes: '',
          addedBy: user?.id || 'unknown',
          addedAt: now
        }
      ]));
    };

    const handleUpdateDamage = (index: number, updates: Partial<Damage>) => {
      setPreviousDamages(prev => prev.map((damage, i) => i === index ? { ...damage, ...updates } : damage));
    };

    const handleAddDamagePhoto = (index: number, file?: File) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target?.result as string;
        setPreviousDamages(prev => prev.map((damage, i) => {
          if (i !== index) return damage;
          const existingPhotos = damage.photoUrls || [];
          if (existingPhotos.length >= 6) return damage;
          return { ...damage, photoUrls: [...existingPhotos, imageData] };
        }));
      };
      reader.readAsDataURL(file);
    };

    const handleRemoveDamagePhoto = (damageIndex: number, photoIndex: number) => {
      setPreviousDamages(prev => prev.map((damage, i) => {
        if (i !== damageIndex) return damage;
        const updatedPhotos = [...(damage.photoUrls || [])];
        updatedPhotos.splice(photoIndex, 1);
        return { ...damage, photoUrls: updatedPhotos };
      }));
    };

    const handleRemoveDamage = (index: number) => {
      setPreviousDamages(prev => prev.filter((_, i) => i !== index));
    };

    const [submitting, setSubmitting] = useState(false);

    const onSubmit = async (data: any) => {
      setSubmitting(true);
      const bikeData = {
        ...data,
        photos: photos.length > 0 ? photos : ['https://images.unsplash.com/photo-1558981806-ec527fa84c3d?auto=format&fit=crop&q=80&w=800'],
        image: photos.length > 0 ? photos[0] : 'https://images.unsplash.com/photo-1558981806-ec527fa84c3d?auto=format&fit=crop&q=80&w=800',
        openingKm: Number(data.openingKm),
        kmDriven: Number(data.kmDriven || data.openingKm),
        pricePerDay: Number(data.pricePerDay),
        damages: previousDamages
      };

      // Auto-generate display name if empty
      if (!bikeData.name || bikeData.name.trim().length === 0) {
        const vehicleLabel = (() => {
          const t = (vehicleTypeSelection || 'bike').toLowerCase();
          if (t === 'ev') return 'EV';
          if (t === 'scooter') return 'Scooter';
          if (t === 'car') return 'Car';
          return 'Bike';
        })();
        bikeData.name = `${vehicleLabel} - ${bikeData.brand || ''} ${bikeData.model || ''} ${bikeData.cc || ''}`.trim();
      }

      try {
        if (initialData) {
          await updateBike(initialData.id, bikeData);
          toast({ title: "Vehicle Updated", description: "Changes saved successfully." });
          onClose();
          return;
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const sessionUid = sessionData.session?.user?.id;
        const { data: userData } = await supabase.auth.getUser();
        const uid = sessionUid || userData?.user?.id;
        const resolvedShopId = storeShopId || await resolveShopId();
        try { console.log("AUTH UID (Bikes)", uid); } catch {}
        console.log('[RLS DEBUG][Vehicle Insert] auth.uid:', uid);
        console.log('[RLS DEBUG][Vehicle Insert] shop_id:', resolvedShopId);
        if (!uid) {
          toast({ title: 'Missing user', description: 'Authenticated user not found – blocking insert', variant: 'destructive' });
          throw new Error('Authenticated user not found – blocking insert');
        }
        if (!resolvedShopId) {
          toast({ title: 'Missing shop_id', description: 'shop_id not resolved – blocking insert', variant: 'destructive' });
          throw new Error('shop_id not resolved – blocking insert');
        }

        // CRITICAL: DB enum vehicle_type currently only allows {bike, car}; coerce anything else to 'bike'
        const normalizedType = bikeData.type === 'car' ? 'car' : 'bike';

        const normalizedFuel = bikeData.fuelType === 'Electric' ? 'Electric' : 'Petrol';
        const payload = {
          shop_id: resolvedShopId,
          owner_id: uid,
          registration_number: bikeData.regNo,
          type: normalizedType,
          name: bikeData.name || `${bikeData.brand || ''} ${bikeData.model || ''}`.trim() || bikeData.regNo,
          brand: bikeData.brand || null,
          model: bikeData.model || null,
          cc: bikeData.cc || null,
          segment: bikeData.segment || null,
          gear_type: bikeData.gearType || null,
          category: bikeData.category || null,
          year: Number(bikeData.modelYear) || null,
          image_url: bikeData.image || null,
          daily_rate: Number(bikeData.pricePerDay) || 0,
          status: 'Available',
          opening_km: Number(bikeData.openingKm) || 0,
          current_odometer: Number(bikeData.kmDriven) || 0,
          fuel_type: normalizedFuel,
          is_published: !!bikeData.isPublished,
        };
        
        console.log('[RLS DEBUG][Vehicle Insert] payload:', payload);
        
        const { data: row, error } = await supabase
          .from('vehicles')
          .insert(payload)
          .select('id, name, registration_number, type, fuel_type, brand, model, cc, segment, gear_type, category, year, image_url, daily_rate, status, opening_km, current_odometer, last_closing_odometer, is_published')
          .single();
        if (error) {
          console.error('[Vehicle Insert] Full error:', error);
          toast({ title: "Insert Failed", description: error.message || 'Unknown error', variant: "destructive" });
          throw error; // Hard fail
        }
        
        console.log('[Vehicle INSERT] Success:', row.id);

        const newBike: Bike = {
          id: row.id,
          name: row.name || `${row.brand || ''} ${row.model || ''}`.trim() || row.registration_number,
          brand: row.brand || undefined,
          model: row.model || undefined,
          cc: row.cc || bikeData.cc,
          segment: row.segment || bikeData.segment,
          gearType: row.gear_type || bikeData.gearType,
          category: row.category || bikeData.category,
          regNo: row.registration_number,
          modelYear: String(row.year ?? ''),
          fuelType: (['Petrol', 'Electric'].includes(row.fuel_type) ? row.fuel_type : 'Petrol') as any,
          type: row.type === 'car' ? 'car' : 'bike',
          pricePerDay: Number(row.daily_rate) || 0,
          status: row.status as any,
          image: row.image_url || bikeData.image,
          photos: [],
          openingKm: Number(row.opening_km) || 0,
          kmDriven: Number(row.current_odometer) || 0,
          lastClosingOdometer: row.last_closing_odometer ?? undefined,
          damages: Array.isArray(row.damages) ? row.damages as any : [],
          isPublished: row.is_published ?? false,
        };
        addBike(newBike);
        const { count } = await supabase
          .from('vehicles')
          .select('id', { count: 'exact', head: true });
        toast({ title: "Vehicle Added", description: `Saved to database. Total vehicles: ${count ?? 'n/a'}.` });
        onClose();
      } catch (error: any) {
        toast({ title: "Unexpected Error", description: error?.message || String(error), variant: "destructive" });
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Photos (Max 6)</label>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {photos.map((url, i) => (
              <div key={i} className="relative h-20 w-20 flex-shrink-0 rounded-md overflow-hidden group">
                 <img src={url} className="h-full w-full object-cover" />
                 <button type="button" onClick={() => handleRemovePhoto(i)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5">
                   <X size={12} />
                 </button>
              </div>
            ))}
            {photos.length < 6 && (
              <div className="h-20 w-20 flex-shrink-0 border border-dashed border-zinc-300 rounded-md flex flex-col items-center justify-center gap-2">
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Upload from gallery" onClick={() => (document.getElementById('bike-gallery-input') as HTMLInputElement)?.click()}>
                    <ImageIcon size={16} />
                  </Button>
                  <Button type="button" variant="secondary" size="icon" className="h-8 w-8" aria-label="Open camera" onClick={() => (document.getElementById('bike-camera-input') as HTMLInputElement)?.click()}>
                    <Camera size={16} />
                  </Button>
                </div>
                <input id="bike-gallery-input" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => handleGalleryPick(e.target.files)} />
                <input id="bike-camera-input" type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => handleCameraShot(e.target.files)} />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Vehicle Name (Optional)</label>
          <Input {...register("name")} placeholder="e.g. Royal Enfield Classic 350 (optional)" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Registration Number</label>
          <Input {...register("regNo", { required: true })} placeholder="KA-01-AB-1234" />
        </div>

        {/* 1. Vehicle Type */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Vehicle Type</label>
          <Select
            value={vehicleTypeSelection}
            onValueChange={(val) => {
              setVehicleTypeSelection(val);
              setBrandSelection('');
              setModelSelection('');
              setBrandIsOther(false);
              setModelIsOther(false);
              setValue('type', val.toLowerCase() as any);
            }}
          >
            <SelectTrigger className="w-full h-10">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {vehicleTypeOptions.map((opt) => (
                <SelectItem key={opt} value={opt.toLowerCase()}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 2. Brand */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Brand</label>
          <Popover open={brandOpen} onOpenChange={setBrandOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between">
                {brandSelection || 'Select brand'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0">
              <Command>
                <CommandInput placeholder="Search brand..." />
                <CommandList>
                  <CommandEmpty>No brand found.</CommandEmpty>
                  <CommandGroup>
                    {brandsForType.map((brand) => (
                      <CommandItem
                        key={brand}
                        value={brand}
                        onSelect={(val) => {
                          setBrandSelection(val);
                          setBrandIsOther(false);
                          setModelSelection('');
                          setValue('brand', val);
                          setBrandOpen(false);
                        }}
                      >
                        {brand}
                      </CommandItem>
                    ))}
                    <CommandItem
                      value="Other"
                      onSelect={() => {
                        setBrandIsOther(true);
                        setBrandSelection('');
                        setModelSelection('');
                        setValue('brand', '');
                        setBrandOpen(false);
                      }}
                    >
                      Other
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {brandIsOther && (
            <Input
              className="mt-2"
              placeholder="Enter brand"
              value={brandSelection}
              onChange={(e) => {
                setBrandSelection(e.target.value);
                setValue('brand', e.target.value);
              }}
            />
          )}
        </div>

        {/* 3. Model */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Model</label>
          <Popover open={modelOpen} onOpenChange={setModelOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between">
                {modelSelection || 'Select model'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0">
              <Command>
                <CommandInput placeholder="Search model..." />
                <CommandList>
                  <CommandEmpty>No model found.</CommandEmpty>
                  <CommandGroup>
                    {modelsForBrand.map((model) => (
                      <CommandItem
                        key={model}
                        value={model}
                        onSelect={(val) => {
                          setModelSelection(val);
                          setModelIsOther(false);
                          setValue('model', val);
                          setModelOpen(false);
                        }}
                      >
                        {model}
                      </CommandItem>
                    ))}
                    <CommandItem
                      value="Other"
                      onSelect={() => {
                        setModelIsOther(true);
                        setModelSelection('');
                        setValue('model', '');
                        setModelOpen(false);
                      }}
                    >
                      Other
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {modelIsOther && (
            <Input
              className="mt-2"
              placeholder="Enter model"
              value={modelSelection}
              onChange={(e) => {
                setModelSelection(e.target.value);
                setValue('model', e.target.value);
              }}
            />
          )}
        </div>

        {/* 4. CC (auto-filled) */}
        <div className="space-y-2">
          <label className="text-sm font-medium">CC</label>
          <Input {...register("cc")} placeholder="e.g. 110cc" />
        </div>

        {/* Auto-fill extras */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Segment</label>
            <Input {...register("segment")} placeholder="Commuter / Sports / Premium" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Gear Type</label>
            <Input {...register("gearType")} placeholder="Manual / Automatic" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <Input {...register("category")} placeholder="Budget / Sports / EV" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Model Year</label>
            <Input type="number" {...register("modelYear", { required: true })} placeholder="2023" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Price/Day (₹)</label>
            <Input type="number" {...register("pricePerDay", { required: true })} placeholder="1200" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Opening KM</label>
            <Input type="number" {...register("openingKm", { required: true })} placeholder="0" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Current KM Driven</label>
            <Input type="number" {...register("kmDriven")} placeholder="Same as Opening" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Fuel Type</label>
            <select {...register("fuelType")} className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1">
              <option value="Petrol">Petrol</option>
              <option value="Electric">Electric</option>
              <option value="CNG">CNG</option>
              <option value="Diesel">Diesel</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-md border border-zinc-200 p-3">
          <Checkbox
            id="isPublished"
            checked={!!watch('isPublished')}
            onCheckedChange={(checked) => setValue('isPublished', Boolean(checked))}
          />
          <label htmlFor="isPublished" className="text-sm font-medium">
            Publish on Website
          </label>
          <span className="text-xs text-muted-foreground">Customers can see and book this vehicle</span>
        </div>
        
        
        {/* Previous Damages Section */}
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <label className="text-sm font-medium">Previous Damages</label>
              <p className="text-xs text-muted-foreground">Log known issues with type, severity, notes, and photos.</p>
            </div>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={handleAddDamageMock}>
              <Plus size={12} className="mr-1" /> Add Damage
            </Button>
          </div>
          {previousDamages.length > 0 ? (
            <div className="space-y-3">
              {previousDamages.map((damage, idx) => {
                const cameraId = `damage-camera-${idx}`;
                const galleryId = `damage-gallery-${idx}`;
                return (
                  <div key={damage.id || idx} className="rounded-md border bg-white p-3 shadow-sm space-y-3">
                    <div className="flex items-start gap-2">
                      <Select value={damage.type || 'Scratch'} onValueChange={(val) => handleUpdateDamage(idx, { type: val as DamageType })}>
                        <SelectTrigger className="h-9 text-sm flex-1">
                          <SelectValue placeholder="Damage type" />
                        </SelectTrigger>
                        <SelectContent>
                          {['Scratch','Dent','Broken Mirror','Tyre','Mechanical','Other'].map(option => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={damage.severity || 'minor'} onValueChange={(val) => handleUpdateDamage(idx, { severity: val as 'minor' | 'major' })}>
                        <SelectTrigger className="h-9 text-sm w-28">
                          <SelectValue placeholder="Severity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minor">Minor</SelectItem>
                          <SelectItem value="major">Major</SelectItem>
                        </SelectContent>
                      </Select>
                      <Badge variant={damage.severity === 'major' ? 'destructive' : 'secondary'} className="text-[10px] self-center">
                        {damage.severity || 'minor'}
                      </Badge>
                      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500" onClick={() => handleRemoveDamage(idx)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium">Notes</label>
                      <Textarea
                        placeholder="Describe the damage..."
                        className="text-sm"
                        rows={2}
                        value={damage.notes || ''}
                        onChange={(e) => handleUpdateDamage(idx, { notes: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Photos</span>
                        <span className="text-[10px] text-muted-foreground">{(damage.photoUrls || []).length}/6</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          id={cameraId}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => handleAddDamagePhoto(idx, e.target.files?.[0])}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-9 text-xs flex-1"
                          onClick={() => document.getElementById(cameraId)?.click()}
                        >
                          <Camera size={14} className="mr-2" /> Camera
                        </Button>

                        <input
                          id={galleryId}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleAddDamagePhoto(idx, e.target.files?.[0])}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-9 text-xs flex-1"
                          onClick={() => document.getElementById(galleryId)?.click()}
                        >
                          <ImageIcon size={14} className="mr-2" /> Gallery
                        </Button>
                      </div>

                      {(damage.photoUrls || []).length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {(damage.photoUrls || []).map((photoUrl: string, pidx: number) => (
                            <div key={pidx} className="relative h-16 w-16 rounded overflow-hidden border">
                              <img src={photoUrl} alt={`Damage photo ${pidx + 1}`} className="h-full w-full object-cover" />
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="absolute -top-2 -right-2 h-6 w-6 p-0 bg-red-500 hover:bg-red-600 text-white rounded-full"
                                onClick={() => handleRemoveDamagePhoto(idx, pidx)}
                              >
                                <X size={12} />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded bg-zinc-50">
              No damages recorded
            </div>
          )}
        </div>

        {initialData && (
           <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
               <select {...register("status")} className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1">
                <option value="Available">Available</option>
                <option value="Booked">Booked</option>
                <option value="Maintenance">Maintenance</option>
              </select>
           </div>
        )}

        <Button type="submit" className="w-full h-12 mt-4" disabled={submitting}>
          {initialData ? 'Save Changes' : 'Add Vehicle'}
        </Button>
      </form>
    );
  };

  return (
    <MobileLayout>
      <div ref={containerRef} className="p-4 space-y-4 min-h-screen pb-24 relative">
        <PullToRefreshIndicator 
          pullDistance={pullDistance} 
          isRefreshing={isRefreshing} 
          pullProgress={pullProgress} 
        />
        
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Vehicles</h1>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="icon" className="rounded-full h-10 w-10 shadow-md">
                <Plus size={20} />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md top-[5%] translate-y-0 h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Vehicle</DialogTitle>
              </DialogHeader>
              <BikeForm onClose={() => setIsAddOpen(false)} />
            </DialogContent>
          </Dialog>

          <Dialog open={!!editingBike} onOpenChange={(open) => !open && setEditingBike(null)}>
            <DialogContent className="sm:max-w-md top-[5%] translate-y-0 h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Vehicle</DialogTitle>
              </DialogHeader>
              {editingBike && <BikeForm initialData={editingBike} onClose={() => setEditingBike(null)} />}
            </DialogContent>
          </Dialog>

          <Dialog open={!!viewingBike} onOpenChange={(open) => !open && setViewingBike(null)}>
             <DialogContent className="sm:max-w-md top-[10%] translate-y-0 h-[85vh] overflow-y-auto p-0 gap-0">
               {viewingBike && (
                 <div>
                   <div className="h-56 w-full relative bg-zinc-100">
                      <img src={viewingBike.image} className="w-full h-full object-cover" />
                      <div className="absolute top-4 right-4">
                         {permissions.canEditVehicle && (
                           <Button size="icon" variant="secondary" className="rounded-full h-8 w-8 shadow-sm" onClick={() => { setEditingBike(viewingBike); setViewingBike(null); }}>
                             <Edit2 size={14} />
                           </Button>
                         )}
                      </div>
                   </div>
                   <div className="p-4 space-y-4">
                      <div>
                        <h2 className="text-2xl font-bold">{viewingBike.name}</h2>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{viewingBike.regNo}</Badge>
                          <Badge variant={viewingBike.status === 'Available' ? 'default' : 'secondary'}>{viewingBike.status}</Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                         <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                            <p className="text-xs text-muted-foreground">Price/Day</p>
                            <p className="text-lg font-bold">{typeof viewingBike.pricePerDay === 'number' && viewingBike.pricePerDay > 0 ? `₹${viewingBike.pricePerDay}` : '—'}</p>
                         </div>
                         <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                            <p className="text-xs text-muted-foreground">Odometer</p>
                            <div className="flex items-center gap-1">
                               <Gauge size={14} className="text-muted-foreground" />
                              <p className="text-lg font-bold">{typeof viewingBike.kmDriven === 'number' ? `${viewingBike.kmDriven} km` : '—'}</p>
                            </div>
                         </div>
                      </div>
                      
                      {/* Photos */}
                      <div className="space-y-2">
                        <h3 className="font-semibold text-sm">Photos</h3>
                        <div className="flex gap-2 overflow-x-auto">
                           {viewingBike.photos?.map((url, i) => (
                             <img key={i} src={url} className="h-20 w-20 rounded-md object-cover flex-shrink-0" />
                           ))}
                        </div>
                      </div>

                      {/* Damages */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <h3 className="font-semibold text-sm">Reported Damages</h3>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setIsDamageModalOpen(true)}>
                            <AlertTriangle size={12} className="mr-1" /> Report
                          </Button>
                        </div>
                        {viewingBike.damages && viewingBike.damages.filter(d => d.isPersisted).length > 0 ? (
                           <div className="space-y-2">
                             {(() => {
                               const persistedDamages = viewingBike?.damages?.filter(d => d.isPersisted) || [];
                               console.log('[RENDER DAMAGES]', {
                                 bikeId: viewingBike?.id,
                                 damages: persistedDamages
                               });
                               persistedDamages.forEach(d =>
                                 console.log('[RENDER DAMAGE ITEM]', {
                                   id: d.id,
                                   typeofId: typeof d.id,
                                   full: d
                                 })
                               );
                               return null;
                             })()}
                             {viewingBike.damages.filter(d => d.isPersisted).map((damage) => (
                               <div key={damage.id} className="relative flex gap-3 bg-red-50 p-2 rounded-lg border border-red-100">
                                  {damage.photoUrls && damage.photoUrls.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setDamagePreviewUrl(damage.photoUrls?.[0] || null)}
                                      className="h-12 w-12 rounded-md overflow-hidden border bg-white"
                                    >
                                      <img src={damage.photoUrls[0]} className="h-full w-full object-cover" />
                                    </button>
                                  )}
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                       <Badge variant="destructive" className="text-[10px] h-5 px-1">
                                         {damage.severity}
                                       </Badge>
                                       <span className="text-xs text-muted-foreground">{new Date(damage.date).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-xs mt-1 text-zinc-800">{damage.notes || 'No notes provided'}</p>
                                  </div>
                                  {permissions.canEditVehicle && (
                                    <div className="flex items-start gap-1">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-muted-foreground"
                                        onClick={() => {
                                            console.log('[DAMAGE TRACE][edit open] damage', { id: damage.id, typeofId: typeof damage.id });
                                          setEditingDamage(damage);
                                          setIsDamageModalOpen(true);
                                        }}
                                      >
                                        <Edit2 size={14} />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-red-500"
                                        onClick={() => handleDeleteDamage(damage)}
                                      >
                                        <Trash2 size={14} />
                                      </Button>
                                    </div>
                                  )}
                               </div>
                             ))}
                           </div>
                        ) : (
                          <div className="text-center py-4 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
                            <p className="text-xs text-muted-foreground">No damages reported</p>
                          </div>
                        )}
                      </div>

                      {/* Owner Actions */}
                      {permissions.canDeleteVehicle && (
                         <div className="pt-4 border-t border-zinc-100">
                           <Button 
                             variant="outline" 
                             className="w-full text-red-600 border-red-200 hover:bg-red-50" 
                             onClick={async () => { 
                               if (!window.confirm(`Delete ${viewingBike.name}? This action cannot be undone.`)) return;
                               try {
                                 console.log('[Delete Bike] Attempting to delete:', viewingBike.id, 'at', new Date().toISOString());
                                 await deleteBike(viewingBike.id);
                                 console.log('[Delete Bike] Delete successful at', new Date().toISOString());
                                 setViewingBike(null);
                                 toast({ 
                                   title: "Vehicle Deleted", 
                                   description: `${viewingBike.name} has been successfully removed.` 
                                 });
                                 console.log('[Delete Bike] Starting refreshAllData at', new Date().toISOString());
                                 await refreshAllData();
                                 console.log('[Delete Bike] refreshAllData completed at', new Date().toISOString());
                               } catch (error: any) {
                                 const message = error?.message || 'Failed to delete vehicle';
                                 console.error('[Delete Bike] Delete failed:', error);
                                 toast({ 
                                   title: "Delete Failed", 
                                   description: message, 
                                   variant: "destructive" 
                                 });
                               }
                             }}
                           >
                              <Trash2 size={16} className="mr-2" /> Delete Vehicle
                            </Button>
                         </div>
                      )}
                   </div>
                 </div>
               )}
             </DialogContent>
          </Dialog>
          
          <Dialog open={isDamageModalOpen} onOpenChange={setIsDamageModalOpen}>
            <DialogContent className="sm:max-w-md top-[20%] translate-y-0">
              <DialogHeader>
                <DialogTitle>{editingDamage ? 'Edit Damage' : 'Report Damage'}</DialogTitle>
              </DialogHeader>
              {viewingBike && (
                <DamageForm
                  initialDamage={editingDamage}
                  onSubmit={handleDamageFormSubmit}
                  onCancel={() => {
                    setEditingDamage(null);
                    setIsDamageModalOpen(false);
                  }}
                  isLoading={isDamageFormLoading}
                  title={editingDamage ? 'Edit Damage' : 'Report Damage'}
                  submitLabel={editingDamage ? 'Save Changes' : 'Report Damage'}
                />
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={!!damagePreviewUrl} onOpenChange={(open) => !open && setDamagePreviewUrl(null)}>
            <DialogContent className="sm:max-w-md">
              {damagePreviewUrl && (
                <img src={damagePreviewUrl} className="w-full h-auto rounded-md object-contain" />
              )}
            </DialogContent>
          </Dialog>

        </div>

        {/* Search & Filter */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
              <Input 
                placeholder="Search vehicles..." 
                className="pl-9 bg-zinc-50 border-zinc-200"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[110px] bg-zinc-50 border-zinc-200">
                <div className="flex items-center gap-2">
                  <Filter size={14} />
                  <span className="truncate">{filter === 'all' ? 'All' : filter}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Available">Available</SelectItem>
                <SelectItem value="Booked">Booked</SelectItem>
                <SelectItem value="Maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
            <Select value={vehicleTypeFilter} onValueChange={setVehicleTypeFilter}>
              <SelectTrigger className="h-9 w-[120px] rounded-full bg-white border-zinc-200 text-xs">
                <div className="flex items-center gap-2">
                  <Filter size={14} />
                  <span className="truncate">
                    {vehicleTypeFilter === 'all'
                      ? 'All'
                      : vehicleTypeFilter === 'bike'
                        ? 'Bikes'
                        : vehicleTypeFilter === 'car'
                          ? 'Cars'
                          : vehicleTypeFilter === 'scooter'
                            ? 'Scooters'
                            : 'EV'}
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="bike">Bikes</SelectItem>
                <SelectItem value="car">Cars</SelectItem>
                <SelectItem value="scooter">Scooters</SelectItem>
                <SelectItem value="ev">EV</SelectItem>
              </SelectContent>
            </Select>          </div>
          
          {/* Quick Date Filters */}
          <div className="flex gap-1.5">
            <Button
              variant={dateFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={() => { setDateFilter('all'); setCustomDate(undefined); }}
            >
              All Dates
            </Button>
            <Button
              variant={dateFilter === 'today' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={() => { setDateFilter('today'); setCustomDate(undefined); }}
            >
              Today
            </Button>
            <Button
              variant={dateFilter === 'tomorrow' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={() => { setDateFilter('tomorrow'); setCustomDate(undefined); }}
            >
              Tomorrow
            </Button>
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={dateFilter === 'custom' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs flex-1"
                >
                  <CalendarDays size={12} className="mr-1" />
                  {dateFilter === 'custom' && customDate ? format(customDate, 'MMM dd') : 'Date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  mode="single"
                  selected={customDate}
                  onSelect={(date) => {
                    setCustomDate(date);
                    setDateFilter('custom');
                    setIsDatePickerOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          
          {dateFilter !== 'all' && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <span>Showing {filteredBikes.length} vehicles available on</span>
              <span className="font-medium text-foreground">
                {dateFilter === 'today' ? 'Today' : 
                 dateFilter === 'tomorrow' ? 'Tomorrow' : 
                 customDate ? format(customDate, 'MMM dd, yyyy') : ''}
              </span>
              <button 
                className="ml-1 text-primary underline" 
                onClick={() => { setDateFilter('all'); setCustomDate(undefined); }}
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Bike List */}
        <div className="space-y-4 mt-2">
          {filteredBikes.map((bike) => {
            // Get date-specific status only when a specific date is selected
            const availabilityDate = getAvailabilityDate();
            const dateSpecificStatus = dateFilter !== 'all' ? getEffectiveStatusForBike(bike, availabilityDate) : bike.status;
            const shouldShowDateStatus = dateFilter !== 'all';
            const isBookedStatus = ['requested', 'confirmed', 'active'].includes(String(dateSpecificStatus));
            const displayStatus = isBookedStatus ? 'Booked' : dateSpecificStatus;
            
            return (
            <Card key={bike.id} className="overflow-hidden border-zinc-100 shadow-sm active:scale-[0.99] transition-transform duration-200 cursor-pointer" onClick={() => setViewingBike(bike)}>
              <div className="h-40 w-full relative bg-zinc-100">
                <img src={bike.image} alt={bike.name} className="w-full h-full object-cover" />
                <div className="absolute top-3 right-3">
                  {shouldShowDateStatus && (
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "font-semibold shadow-sm",
                        displayStatus === 'Available' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 
                        displayStatus === 'Booked' ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' : 
                        'bg-red-100 text-red-800 hover:bg-red-100'
                      )}
                    >
                      {displayStatus}
                    </Badge>
                  )}
                </div>
                {bike.damages && bike.damages.filter(d => d.isPersisted).length > 0 && (
                   <div className="absolute bottom-3 right-3">
                     <Badge variant="destructive" className="flex items-center gap-1 shadow-sm">
                       <AlertTriangle size={10} /> {bike.damages.filter(d => d.isPersisted).length} Damage
                     </Badge>
                   </div>
                )}
              </div>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{bike.name || bike.regNo || '(No name)'}</h3>
                    <p className="text-muted-foreground text-sm font-mono mt-0.5">{bike.regNo || '(No reg)'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">₹{typeof bike.pricePerDay === 'number' && bike.pricePerDay > 0 ? bike.pricePerDay : '—'}</p>
                    <p className="text-xs text-muted-foreground">/day</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-zinc-100">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar size={14} />
                    <span>{bike.modelYear || '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Fuel size={14} />
                    <span>{bike.fuelType || '—'}</span>
                  </div>
                   <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
                    <Gauge size={14} />
                    <span>{typeof bike.kmDriven === 'number' ? `${bike.kmDriven} km` : '—'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      </div>
    </MobileLayout>
  );
}
