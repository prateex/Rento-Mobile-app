import { useState, useEffect } from "react";
import MobileLayout from "@/components/layout/MobileLayout";
import { useStore, Bike, Damage } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Filter, Fuel, Calendar, UploadCloud, AlertTriangle, Gauge, X, Trash2, Edit2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

export default function Bikes() {
  const { bikes, addBike, updateBike, deleteBike, user } = useStore();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingBike, setEditingBike] = useState<Bike | null>(null);
  const [viewingBike, setViewingBike] = useState<Bike | null>(null);
  const [isDamageModalOpen, setIsDamageModalOpen] = useState(false);
  
  const { toast } = useToast();
  const [location] = useLocation();

  // Handle URL query params for actions
  useEffect(() => {
    if (location.includes("action=new")) {
      setIsAddOpen(true);
    }
  }, [location]);

  const filteredBikes = bikes.filter(bike => {
    const matchesSearch = bike.name.toLowerCase().includes(search.toLowerCase()) || 
                          bike.regNo.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || bike.status.toLowerCase() === filter.toLowerCase();
    return matchesSearch && matchesFilter;
  });

  const BikeForm = ({ initialData, onClose }: { initialData?: Bike, onClose: () => void }) => {
    const { register, handleSubmit, watch, setValue } = useForm<Bike>({
      defaultValues: initialData || {
        photos: [],
        status: 'Available',
        fuelType: 'Petrol'
      }
    });
    
    // Mock multiple photos
    const [photos, setPhotos] = useState<string[]>(initialData?.photos || []);
    // Mock previous damages for new bike
    const [previousDamages, setPreviousDamages] = useState<Damage[]>(initialData?.damages || []);

    const handleAddPhoto = () => {
       // Mock adding a photo
       const newPhoto = 'https://images.unsplash.com/photo-1558981806-ec527fa84c3d?auto=format&fit=crop&q=80&w=800';
       setPhotos([...photos, newPhoto]);
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
        toast({ title: "Bike Updated", description: "Changes saved successfully." });
      } else {
        const newBike = {
           ...bikeData,
           id: Math.random().toString(36).substr(2, 9),
        };
        addBike(newBike);
        toast({ title: "Bike Added", description: `${newBike.name} added to fleet.` });
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
              <div onClick={handleAddPhoto} className="h-20 w-20 flex-shrink-0 border border-dashed border-zinc-300 rounded-md flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-zinc-50">
                <UploadCloud size={20} className="text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Add Photo</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Bike Name</label>
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

        <Button type="submit" className="w-full h-12 mt-4">{initialData ? 'Save Changes' : 'Add Bike'}</Button>
      </form>
    );
  };

  const DamageReportForm = ({ bikeId, onClose }: { bikeId: string, onClose: () => void }) => {
    const { register, handleSubmit } = useForm<Damage>();
    
    const onSubmit = (data: any) => {
      const newDamage: Damage = {
        id: Math.random().toString(36).substr(2, 9),
        type: data.type || 'Other',
        severity: data.severity,
        date: new Date().toISOString(),
        photoUrls: ['https://images.unsplash.com/photo-1449426468159-d96dbf08f19f?auto=format&fit=crop&q=80&w=800'],
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
        <div className="space-y-2">
          <label className="text-sm font-medium">Severity</label>
           <select {...register("severity")} className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1">
             <option value="minor">Minor (Scratches, Dents)</option>
             <option value="major">Major (Engine, Structural)</option>
           </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Notes</label>
          <Textarea {...register("notes", { required: true })} placeholder="Describe the damage..." />
        </div>
        <div className="space-y-2">
           <label className="text-sm font-medium">Photo</label>
           <div className="h-24 border border-dashed border-zinc-300 rounded-md flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-zinc-50">
              <UploadCloud size={20} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Upload Damage Photo</span>
           </div>
        </div>
        <Button type="submit" variant="destructive" className="w-full h-12 mt-4">Report Damage</Button>
      </form>
    );
  };

  return (
    <MobileLayout>
      <div className="p-4 space-y-4 min-h-screen pb-24">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Bikes</h1>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="icon" className="rounded-full h-10 w-10 shadow-md">
                <Plus size={20} />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md top-[5%] translate-y-0 h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Bike</DialogTitle>
              </DialogHeader>
              <BikeForm onClose={() => setIsAddOpen(false)} />
            </DialogContent>
          </Dialog>

          <Dialog open={!!editingBike} onOpenChange={(open) => !open && setEditingBike(null)}>
            <DialogContent className="sm:max-w-md top-[5%] translate-y-0 h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Bike</DialogTitle>
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
                            <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={() => { deleteBike(viewingBike.id); setViewingBike(null); toast({title: "Bike Deleted"}); }}>
                               <Trash2 size={16} className="mr-2" /> Delete Bike
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
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
            <Input 
              placeholder="Search bikes..." 
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
