import { useState, useEffect } from "react";
import MobileLayout from "@/components/layout/MobileLayout";
import { useStore, Customer } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Phone, CheckCircle2, UploadCloud, Eye, Edit2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";

export default function Customers() {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useStore();
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; customer?: Customer }>({ open: false });
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  );

  const CustomerForm = ({ initialData, onClose }: { initialData?: Customer, onClose: () => void }) => {
    const { register, handleSubmit, watch, setValue } = useForm<Customer>({
      defaultValues: initialData || { idType: 'Aadhaar' }
    });
    
    const idType = watch('idType');
    const [frontUrl, setFrontUrl] = useState<string>(initialData?.idPhotos?.front || '');
    const [backUrl, setBackUrl] = useState<string>(initialData?.idPhotos?.back || '');
    const [documents, setDocuments] = useState<{ type: string; url: string }[]>(initialData?.documents || []);

    const onSubmit = (data: any) => {
      if (initialData) {
         updateCustomer(initialData.id, { ...data, idPhotos: { front: frontUrl, back: backUrl }, documents });
         toast({ title: "Updated", description: "Customer details updated." });
      } else {
         const newCustomer: Customer = {
           ...data,
           id: Math.random().toString(36).substr(2, 9),
           status: 'Verified',
           dateAdded: new Date().toISOString(),
           idPhotos: { front: frontUrl, back: backUrl },
           documents
         };
         addCustomer(newCustomer);
         toast({ title: "Registered", description: `${newCustomer.name} has been registered.` });
      }
      onClose();
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Full Name</label>
          <Input {...register("name", { required: true })} placeholder="Rahul Kumar" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Phone Number</label>
          <Input type="tel" {...register("phone", { required: true })} placeholder="9876543210" />
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

        <div className="space-y-2">
          <label className="text-sm font-medium">Documents</label>
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-dashed border-zinc-300 rounded-lg p-2 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:bg-zinc-50 cursor-pointer h-24">
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => (document.getElementById('cust-front-gallery') as HTMLInputElement)?.click()}>
                {idType} Front (Gallery)
              </Button>
              <Button type="button" variant="secondary" size="sm" className="h-7 text-xs" onClick={() => (document.getElementById('cust-front-camera') as HTMLInputElement)?.click()}>
                {idType} Front (Camera)
              </Button>
              <input id="cust-front-gallery" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => setFrontUrl(e.target.files && e.target.files[0] ? URL.createObjectURL(e.target.files[0]) : frontUrl)} />
              <input id="cust-front-camera" type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => setFrontUrl(e.target.files && e.target.files[0] ? URL.createObjectURL(e.target.files[0]) : frontUrl)} />
            </div>
            {(idType === 'Aadhaar' || idType === 'Voter ID' || idType === 'Driving License') && (
              <div className="border border-dashed border-zinc-300 rounded-lg p-2 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:bg-zinc-50 cursor-pointer h-24">
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => (document.getElementById('cust-back-gallery') as HTMLInputElement)?.click()}>
                  {idType} Back (Gallery)
                </Button>
                <Button type="button" variant="secondary" size="sm" className="h-7 text-xs" onClick={() => (document.getElementById('cust-back-camera') as HTMLInputElement)?.click()}>
                  {idType} Back (Camera)
                </Button>
                <input id="cust-back-gallery" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => setBackUrl(e.target.files && e.target.files[0] ? URL.createObjectURL(e.target.files[0]) : backUrl)} />
                <input id="cust-back-camera" type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => setBackUrl(e.target.files && e.target.files[0] ? URL.createObjectURL(e.target.files[0]) : backUrl)} />
              </div>
            )}
          </div>
          <div className="space-y-2 mt-2">
            <label className="text-sm font-medium">Additional Documents</label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => (document.getElementById('cust-docs-gallery') as HTMLInputElement)?.click()}>
                Upload from Gallery
              </Button>
              <Button type="button" variant="secondary" size="sm" className="h-7 text-xs" onClick={() => (document.getElementById('cust-docs-camera') as HTMLInputElement)?.click()}>
                Open Camera
              </Button>
              <input id="cust-docs-gallery" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                setDocuments([
                  ...documents,
                  ...files.map(f => ({ type: idType, url: URL.createObjectURL(f) }))
                ]);
              }} />
              <input id="cust-docs-camera" type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }} onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                setDocuments([
                  ...documents,
                  ...files.map(f => ({ type: idType, url: URL.createObjectURL(f) }))
                ]);
              }} />
            </div>
            {documents.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-2">
                {documents.map((doc, i) => (
                  <div key={i} className="relative h-16 w-24 rounded-md overflow-hidden">
                    <img src={doc.url} className="h-full w-full object-cover" />
                    <button type="button" className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5" onClick={() => setDocuments(documents.filter((_, idx) => idx !== i))}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <Button type="submit" className="w-full h-12 mt-4">{initialData ? 'Save Changes' : 'Register Customer'}</Button>
      </form>
    );
  };

  return (
    <MobileLayout>
      <div className="p-4 space-y-4 min-h-screen pb-24">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Customers</h1>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="icon" className="rounded-full h-10 w-10 shadow-md">
                <Plus size={20} />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md top-[20%] translate-y-0">
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
              </DialogHeader>
              <CustomerForm onClose={() => setIsAddOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
        
          <Dialog open={!!viewingCustomer} onOpenChange={(open) => !open && setViewingCustomer(null)}>
           <DialogContent className="sm:max-w-md top-[20%] translate-y-0">
              <DialogHeader>
                 <DialogTitle>Customer Details</DialogTitle>
              </DialogHeader>
              {viewingCustomer && (
                 <div className="space-y-4">
                    <div className="flex items-center gap-4">
                       <div className="h-14 w-14 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 font-bold text-xl">
                          {viewingCustomer.name.charAt(0)}
                       </div>
                       <div>
                          <h2 className="font-bold text-lg">{viewingCustomer.name}</h2>
                          <div className="flex items-center gap-2">
                             <a href={`tel:${viewingCustomer.phone}`} className="text-primary-600 text-sm flex items-center">
                                <Phone size={14} className="mr-1" /> {viewingCustomer.phone}
                             </a>
                          </div>
                       </div>
                    </div>
                    
                    <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100 space-y-2">
                       <p className="text-xs font-bold text-muted-foreground uppercase">ID Proof ({viewingCustomer.idType})</p>
                       <div className="grid grid-cols-2 gap-2">
                          <div className="aspect-video bg-zinc-200 rounded-md overflow-hidden">
                            {viewingCustomer.idPhotos?.front ? (
                              <img src={viewingCustomer.idPhotos.front} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Front Photo</div>
                            )}
                          </div>
                          <div className="aspect-video bg-zinc-200 rounded-md overflow-hidden">
                            {viewingCustomer.idPhotos?.back ? (
                              <img src={viewingCustomer.idPhotos.back} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Back Photo</div>
                            )}
                          </div>
                       </div>
                        {viewingCustomer.documents && viewingCustomer.documents.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium">Additional Documents</p>
                            <div className="flex gap-2 flex-wrap">
                              {viewingCustomer.documents.map((doc, i) => (
                                <img key={i} src={doc.url} className="h-16 w-24 rounded-md object-cover" />
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                    
                    <div className="flex gap-2">
                       <Button className="flex-1" variant="outline" onClick={() => { setEditingCustomer(viewingCustomer); setViewingCustomer(null); }}>
                          <Edit2 size={16} className="mr-2" /> Edit Details
                       </Button>
                       <Button className="flex-1" variant="secondary" onClick={() => { setLocation(`/bookings?customerId=${viewingCustomer.id}`); setViewingCustomer(null); }}>
                          View Bookings
                       </Button>
                       <Button className="flex-1" variant="destructive" onClick={() => setConfirmDelete({ open: true, customer: viewingCustomer })}>
                          Delete
                       </Button>
                    </div>
                 </div>
              )}
           </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <Dialog open={confirmDelete.open} onOpenChange={(open) => setConfirmDelete({ open, customer: confirmDelete.customer })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Customer?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete({ open: false })}>Cancel</Button>
              <Button variant="destructive" className="flex-1" onClick={() => { if (confirmDelete.customer) { deleteCustomer(confirmDelete.customer.id); toast({ title: 'Customer Deleted' }); } setConfirmDelete({ open: false, customer: undefined }); }}>Delete</Button>
            </div>
          </DialogContent>
        </Dialog>
        
        <Dialog open={!!editingCustomer} onOpenChange={(open) => !open && setEditingCustomer(null)}>
           <DialogContent className="sm:max-w-md top-[20%] translate-y-0">
              <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
              {editingCustomer && <CustomerForm initialData={editingCustomer} onClose={() => setEditingCustomer(null)} />}
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

        <div className="space-y-3 mt-2">
          {filteredCustomers.map((customer) => (
            <Card key={customer.id} className="shadow-sm border-zinc-100 cursor-pointer hover:border-primary transition-colors" onClick={() => setViewingCustomer(customer)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 font-bold">
                    {customer.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold">{customer.name}</h3>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone size={12} />
                      <span>{customer.phone}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <Badge variant="outline" className="bg-green-50 text-green-700 border-green-100 gap-1">
                     <CheckCircle2 size={10} />
                     {customer.status}
                   </Badge>
                   <a href={`tel:${customer.phone}`} className="p-2 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600" onClick={(e) => e.stopPropagation()}>
                      <Phone size={16} />
                   </a>
                   <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setLocation(`/bookings?customerId=${customer.id}`); }}>View</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MobileLayout>
  );
}
