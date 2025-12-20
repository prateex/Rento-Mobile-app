import { useState, useEffect, useMemo } from "react";
import MobileLayout from "@/components/layout/MobileLayout";
import { useStore, Bike, Damage, Booking } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Filter, Fuel, Calendar, UploadCloud, AlertTriangle, Gauge, X, Trash2, Edit2, CalendarDays, Bike as BikeIcon, Car as CarIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO, startOfDay, endOfDay, addDays, isWithinInterval } from "date-fns";

const getVehicleIcon = (type?: string) => {
  return type === 'car' ? <CarIcon size={16} /> : <BikeIcon size={16} />;
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
  const { bikes, bookings, addBike, updateBike, deleteBike, user } = useStore();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string>("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingBike, setEditingBike] = useState<Bike | null>(null);
  const [viewingBike, setViewingBike] = useState<Bike | null>(null);
  const [isDamageModalOpen, setIsDamageModalOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'tomorrow' | 'custom'>('all');
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  const { toast } = useToast();
  const [location] = useLocation();

  // Handle URL query params for actions
  useEffect(() => {
    if (location.includes("action=new")) {
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
        if (booking.status === 'Deleted' || booking.status === 'Cancelled' || booking.status === 'Completed') return false;
        if (!booking.bikeIds.includes(bikeId)) return false;
        
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
      const relevantBookings = bookings.filter((b: Booking) => b.bikeIds.includes(bike.id) && b.status !== 'Deleted');
      if (!date) {
        // If no date filter, prefer showing active status if any ongoing booking overlaps today
        const today = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());
        const todayBooking = relevantBookings.find(b => {
          const s = parseISO(b.startDate);
          const e = parseISO(b.endDate);
          return s < todayEnd && e > today;
        });
        return todayBooking?.status || bike.status;
      }
      const match = relevantBookings.find(b => {
        const s = parseISO(b.startDate);
        const e = parseISO(b.endDate);
        return dayStart && dayEnd ? (s < dayEnd && e > dayStart) : false;
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
      const matchesDateAvailability = dateFilter === 'all' || 
        (bike.status !== 'Maintenance' && isBikeAvailableOnDate(bike.id, availabilityDate) && !isBikeBlockedOnDateLocal(bike.id, availabilityDate));
      
      return matchesSearch && matchesFilter && matchesDateAvailability && matchesVehicleType;
    });
  }, [bikes, search, filter, vehicleTypeFilter, dateFilter, customDate, isBikeAvailableOnDate, getEffectiveStatusForBike]);

  const BikeForm = ({ initialData, onClose }: { initialData?: Bike, onClose: () => void }) => {
    const { register, handleSubmit, watch, setValue } = useForm<Bike>({
      defaultValues: initialData || {
        photos: [],
        status: 'Available',
        fuelType: 'Petrol',
        type: 'bike',
        brand: '',
        model: ''
      }
    });
    
    // Mock multiple photos
    const [photos, setPhotos] = useState<string[]>(initialData?.photos || []);
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
       setPreviousDamages([...previousDamages, {
          id: Math.random().toString(36).substr(2, 9),
          type: 'Scratch',
          severity: 'minor',
          date: new Date().toISOString(),
          photoUrls: ['https://images.unsplash.com/photo-1449426468159-d96dbf08f19f?auto=format&fit=crop&q=80&w=800'],
          notes: 'Previous damage noted on entry',
          addedBy: user?.id || 'unknown',
          addedAt: new Date().toISOString()
       }]);
    }

    const onSubmit = (data: any) => {
      const bikeData = {
        ...data,
        photos: photos.length > 0 ? photos : ['https://images.unsplash.com/photo-1558981806-ec527fa84c3d?auto=format&fit=crop&q=80&w=800'],
        image: photos.length > 0 ? photos[0] : 'https://images.unsplash.com/photo-1558981806-ec527fa84c3d?auto=format&fit=crop&q=80&w=800',
        openingKm: Number(data.openingKm),
        kmDriven: Number(data.kmDriven || data.openingKm),
        pricePerDay: Number(data.pricePerDay),
        damages: previousDamages
      };

      if (initialData) {
        updateBike(initialData.id, bikeData);
        toast({ title: "Vehicle Updated", description: "Changes saved successfully." });
      } else {
        const newBike = {
           ...bikeData,
           id: Math.random().toString(36).substr(2, 9),
        };
        addBike(newBike);
        toast({ title: "Vehicle Added", description: `${newBike.name} added to fleet.` });
      }
      onClose();
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
              <div className="h-20 w-20 flex-shrink-0 border border-dashed border-zinc-300 rounded-md flex flex-col items-center justify-center gap-1">
                <Button type="button" variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => (document.getElementById('bike-gallery-input') as HTMLInputElement)?.click()}>
                  Upload from Gallery
                </Button>
                <Button type="button" variant="secondary" size="sm" className="h-6 text-[10px]" onClick={() => (document.getElementById('bike-camera-input') as HTMLInputElement)?.click()}>
                  Open Camera
                </Button>
                <input id="bike-gallery-input" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => handleGalleryPick(e.target.files)} />
                <input id="bike-camera-input" type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => handleCameraShot(e.target.files)} />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Vehicle Name</label>
          <Input {...register("name", { required: true })} placeholder="e.g. Royal Enfield Classic 350" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Registration Number</label>
          <Input {...register("regNo", { required: true })} placeholder="KA-01-AB-1234" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Model Year</label>
            <Input type="number" {...register("modelYear", { required: true })} placeholder="2023" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Price/Day (₹)</label>
            <Input type="number" {...register("pricePerDay", { required: true })} placeholder="1200" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Brand</label>
            <Input {...register("brand")} placeholder="e.g. Honda" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            <Input {...register("model")} placeholder="e.g. Activa 6G" />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Opening KM</label>
            <Input type="number" {...register("openingKm", { required: true })} placeholder="0" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Current KM Driven</label>
            <Input type="number" {...register("kmDriven")} placeholder="Same as Opening" />
          </div>
        </div>

        <div className="space-y-2">
            <label className="text-sm font-medium">Fuel Type</label>
           <select {...register("fuelType")} className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1">
             <option value="Petrol">Petrol</option>
             <option value="Electric">Electric</option>
           </select>
        </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>
            <select {...register("type")} className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm">
             <option value="bike">Bike</option>
             <option value="car">Car</option>
            </select>
          </div>
        
        {/* Previous Damages Section */}
        <div className="space-y-2">
           <div className="flex justify-between items-center">
              <label className="text-sm font-medium">Previous Damages</label>
              <Button type="button" variant="outline" size="sm" className="h-6 text-xs" onClick={handleAddDamageMock}>
                 <Plus size={10} className="mr-1" /> Add
              </Button>
           </div>
            {previousDamages.length > 0 ? (
              <div className="space-y-2">
                 {previousDamages.map((d, i) => (
                  <div key={i} className="bg-zinc-50 p-2 rounded border flex gap-2 items-center">
                    <img src={d.photoUrls[0]} className="h-8 w-8 rounded bg-zinc-200" />
                    <span className="text-xs flex-1">{d.notes}</span>
                    <Badge variant="secondary" className="text-[10px]">{d.severity}</Badge>
                    <Button type="button" variant="ghost" size="sm" className="h-6" onClick={() => setPreviousDamages(previousDamages.filter((_, idx) => idx !== i))}>
                     <Trash2 size={12} />
                    </Button>
                  </div>
                 ))}
              </div>
           ) : (
              <div className="text-xs text-muted-foreground text-center py-2 border border-dashed rounded bg-zinc-50">
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

        <Button type="submit" className="w-full h-12 mt-4">{initialData ? 'Save Changes' : 'Add Vehicle'}</Button>
      </form>
    );
  };

  const DamageReportForm = ({ bikeId, onClose }: { bikeId: string, onClose: () => void }) => {
    const { register, handleSubmit, setValue, watch } = useForm<Damage>();
    const [damagePhotos, setDamagePhotos] = useState<string[]>([]);
    const [damageDate, setDamageDate] = useState<Date>(new Date());
    const [isDatePickerOpenDamage, setIsDatePickerOpenDamage] = useState(false);
    
    const damageTypes = ['Scratch', 'Dent', 'Crack', 'Paint Chip', 'Tire Damage', 'Mirror', 'Light', 'Other'] as const;
    
    const handleAddDamagePhoto = () => {
      if (damagePhotos.length < 4) {
        const mockPhoto = 'https://images.unsplash.com/photo-1449426468159-d96dbf08f19f?auto=format&fit=crop&q=80&w=800';
        setDamagePhotos([...damagePhotos, mockPhoto]);
      }
    };
    
    const handleRemoveDamagePhoto = (index: number) => {
      const newPhotos = [...damagePhotos];
      newPhotos.splice(index, 1);
      setDamagePhotos(newPhotos);
    };
    
    const onSubmit = (data: any) => {
      const newDamage: Damage = {
        id: Math.random().toString(36).substr(2, 9),
        type: data.type || 'Other',
        severity: data.severity,
        date: damageDate.toISOString(),
        photoUrls: damagePhotos.length > 0 ? damagePhotos : ['https://images.unsplash.com/photo-1449426468159-d96dbf08f19f?auto=format&fit=crop&q=80&w=800'],
        notes: data.notes,
        addedBy: user?.id || 'unknown',
        addedAt: new Date().toISOString()
      };
      
      const bike = bikes.find(b => b.id === bikeId);
      if (bike) {
        updateBike(bikeId, { damages: [...(bike.damages || []), newDamage] });
        toast({ title: "Damage Reported", description: "Damage log added to bike history." });
      }
      onClose();
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Damage Type</label>
            <select 
              {...register("type", { required: true })} 
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {damageTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Severity</label>
            <select 
              {...register("severity", { required: true })} 
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="minor">Minor</option>
              <option value="moderate">Moderate</option>
              <option value="major">Major</option>
            </select>
          </div>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Date of Damage</label>
          <Popover open={isDatePickerOpenDamage} onOpenChange={setIsDatePickerOpenDamage}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal h-10"
              >
                <CalendarDays size={14} className="mr-2" />
                {format(damageDate, 'PPP')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={damageDate}
                onSelect={(date) => {
                  if (date) setDamageDate(date);
                  setIsDatePickerOpenDamage(false);
                }}
                disabled={{ after: new Date() }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Photos (Max 4)</label>
          <div className="flex gap-2 flex-wrap">
            {damagePhotos.map((url, i) => (
              <div key={i} className="relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden group">
                <img src={url} className="h-full w-full object-cover" />
                <button 
                  type="button" 
                  onClick={() => handleRemoveDamagePhoto(i)} 
                  className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            {damagePhotos.length < 4 && (
              <div 
                onClick={handleAddDamagePhoto} 
                className="h-16 w-16 flex-shrink-0 border border-dashed border-zinc-300 rounded-md flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:bg-zinc-50"
              >
                <UploadCloud size={16} className="text-muted-foreground" />
                <span className="text-[9px] text-muted-foreground">Add</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Notes</label>
          <Textarea 
            {...register("notes")} 
            placeholder="Describe the damage location and details..." 
            className="min-h-[80px]"
          />
        </div>
        
        <Button type="submit" variant="destructive" className="w-full h-12 mt-4">
          <AlertTriangle size={16} className="mr-2" /> Report Damage
        </Button>
      </form>
    );
  };

  return (
    <MobileLayout>
      <div className="p-4 space-y-4 min-h-screen pb-24">
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
                         <Button size="icon" variant="secondary" className="rounded-full h-8 w-8 shadow-sm" onClick={() => { setEditingBike(viewingBike); setViewingBike(null); }}>
                           <Edit2 size={14} />
                         </Button>
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
                            <p className="text-lg font-bold">₹{viewingBike.pricePerDay}</p>
                         </div>
                         <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                            <p className="text-xs text-muted-foreground">Odometer</p>
                            <div className="flex items-center gap-1">
                               <Gauge size={14} className="text-muted-foreground" />
                              <p className="text-lg font-bold">{viewingBike.kmDriven} km</p>
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
                        {viewingBike.damages && viewingBike.damages.length > 0 ? (
                           <div className="space-y-2">
                             {viewingBike.damages.map((damage) => (
                               <div key={damage.id} className="flex gap-3 bg-red-50 p-2 rounded-lg border border-red-100">
                                  <img src={damage.photoUrls[0]} className="h-12 w-12 rounded-md object-cover bg-white" />
                                  <div>
                                    <div className="flex items-center gap-2">
                                       <Badge variant="destructive" className="text-[10px] h-5 px-1">{damage.severity}</Badge>
                                       <span className="text-xs text-muted-foreground">{new Date(damage.date).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-xs mt-1 text-zinc-800">{damage.notes}</p>
                                  </div>
                               </div>
                             ))}
                           </div>
                        ) : (
                          <div className="text-center py-4 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
                            <p className="text-xs text-muted-foreground">No damages reported</p>
                          </div>
                        )}
                      </div>

                      {/* Admin Actions */}
                      {user?.role === 'admin' && (
                         <div className="pt-4 border-t border-zinc-100">
                           <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={() => { deleteBike(viewingBike.id); setViewingBike(null); toast({title: "Vehicle Deleted"}); }}>
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
                 <DialogTitle>Report Damage</DialogTitle>
               </DialogHeader>
               {viewingBike && <DamageReportForm bikeId={viewingBike.id} onClose={() => setIsDamageModalOpen(false)} />}
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
                <SelectItem value="Advance Paid">Advance Paid</SelectItem>
                <SelectItem value="Confirmed">Confirmed</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
                <SelectItem value="Maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
            <Select value={vehicleTypeFilter} onValueChange={setVehicleTypeFilter}>
              <SelectTrigger className="h-9 w-[120px] rounded-full bg-white border-zinc-200 text-xs">
                <div className="flex items-center gap-2">
                  <Filter size={14} />
                  <span className="truncate">{vehicleTypeFilter === 'all' ? 'All' : vehicleTypeFilter === 'bike' ? 'Bikes' : 'Cars'}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="bike">Bikes</SelectItem>
                <SelectItem value="car">Cars</SelectItem>
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
          {filteredBikes.map((bike) => (
            <Card key={bike.id} className="overflow-hidden border-zinc-100 shadow-sm active:scale-[0.99] transition-transform duration-200 cursor-pointer" onClick={() => setViewingBike(bike)}>
              <div className="h-40 w-full relative bg-zinc-100">
                <img src={bike.image} alt={bike.name} className="w-full h-full object-cover" />
                <div className="absolute top-3 right-3">
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "font-semibold shadow-sm",
                      bike.status === 'Available' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 
                      bike.status === 'Booked' ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' : 
                      'bg-red-100 text-red-800 hover:bg-red-100'
                    )}
                  >
                    {bike.status}
                  </Badge>
                </div>
                {bike.damages && bike.damages.length > 0 && (
                   <div className="absolute bottom-3 right-3">
                     <Badge variant="destructive" className="flex items-center gap-1 shadow-sm">
                       <AlertTriangle size={10} /> {bike.damages.length} Damage
                     </Badge>
                   </div>
                )}
              </div>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{bike.name}</h3>
                    <p className="text-muted-foreground text-sm font-mono mt-0.5">{bike.regNo}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">₹{bike.pricePerDay}</p>
                    <p className="text-xs text-muted-foreground">/day</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-zinc-100">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar size={14} />
                    <span>{bike.modelYear}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Fuel size={14} />
                    <span>{bike.fuelType}</span>
                  </div>
                   <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
                    <Gauge size={14} />
                    <span>{bike.kmDriven} km</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MobileLayout>
  );
}
