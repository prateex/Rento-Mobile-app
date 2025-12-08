import { useState, useEffect, useMemo } from "react";
import MobileLayout from "@/components/layout/MobileLayout";
import { useStore, Booking, Customer } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Plus, Clock, ArrowRight, IndianRupee, CheckCircle, Edit2, Trash2, UserPlus, Phone, MessageCircle, FileText, Filter, X, CornerDownLeft, Ban } from "lucide-react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function Bookings() {
  const { bookings, bikes, customers, addBooking, updateBooking, deleteBooking, cancelBooking, returnBooking, user, addCustomer } = useStore();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [invoiceBooking, setInvoiceBooking] = useState<Booking | null>(null);
  
  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  const { toast } = useToast();
  const [location] = useLocation();

  useEffect(() => {
    if (location.includes("action=new")) {
      setIsAddOpen(true);
    }
  }, [location]);

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      if (b.status === 'Deleted') return false;
      if (filterStatus === 'all') return true;
      if (filterStatus === 'active') return b.status === 'Active';
      if (filterStatus === 'completed') return b.status === 'Completed';
      if (filterStatus === 'cancelled') return b.status === 'Cancelled';
      if (filterStatus === 'booked') return b.status === 'Booked';
      if (filterStatus === 'unpaid') return b.paymentStatus !== 'Paid';
      return true;
    }).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [bookings, filterStatus]);

  const BookingForm = ({ initialData, onClose }: { initialData?: Booking, onClose: () => void }) => {
    const [dateError, setDateError] = useState<string | null>(null);
    
    const formatDateTimeLocal = (date: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };
    
    const getInitialStartDate = () => {
      if (initialData?.startDate) {
        return formatDateTimeLocal(new Date(initialData.startDate));
      }
      return formatDateTimeLocal(new Date());
    };
    
    const getInitialEndDate = () => {
      if (initialData?.endDate) {
        return formatDateTimeLocal(new Date(initialData.endDate));
      }
      return formatDateTimeLocal(new Date(Date.now() + 86400000));
    };
    
    const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
      defaultValues: {
        startDate: getInitialStartDate(),
        endDate: getInitialEndDate(),
        bikeIds: initialData?.bikeIds || [],
        customerId: initialData?.customerId || '',
        rent: initialData?.rent || 0,
        deposit: initialData?.deposit || 0
      }
    });

    const selectedBikeIds = watch('bikeIds') || [];
    
    // Watch date values
    const startDate = watch('startDate');
    const endDate = watch('endDate');
    
    // Validate dates in real-time
    useEffect(() => {
      if (startDate && endDate) {
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();
        if (end <= start) {
          setDateError("End date/time must be after start date/time");
        } else {
          setDateError(null);
        }
      }
    }, [startDate, endDate]);
    
    useEffect(() => {
       if (startDate && endDate && selectedBikeIds.length > 0 && !initialData) {
          const start = new Date(startDate).getTime();
          const end = new Date(endDate).getTime();
          const diffDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
          
          const totalDailyPrice = bikes
             .filter(b => selectedBikeIds.includes(b.id))
             .reduce((sum, b) => sum + b.pricePerDay, 0);

          const calcRent = diffDays * totalDailyPrice;
          setValue('rent', calcRent);
       }
    }, [startDate, endDate, selectedBikeIds]);

    const onSubmit = (data: any) => {
      // Validate dates
      const startDateTime = new Date(data.startDate);
      const endDateTime = new Date(data.endDate);
      const start = startDateTime.getTime();
      const end = endDateTime.getTime();
      
      if (isNaN(start) || isNaN(end)) {
        toast({ title: "Invalid Dates", description: "Please enter valid start and end dates.", variant: "destructive" });
        return;
      }
      
      if (end <= start) {
        toast({ title: "Invalid Dates", description: "End date/time must be after start date/time.", variant: "destructive" });
        return;
      }

      if (!data.bikeIds || data.bikeIds.length === 0) {
        toast({ title: "No Bike Selected", description: "Please select at least one bike.", variant: "destructive" });
        return;
      }
      
      if (!data.customerId) {
        toast({ title: "No Customer Selected", description: "Please select a customer.", variant: "destructive" });
        return;
      }

      const hasOverlap = bookings.some(b => 
        b.id !== initialData?.id &&
        b.status !== 'Deleted' && b.status !== 'Cancelled' && b.status !== 'Completed' &&
        b.bikeIds.some(id => data.bikeIds.includes(id)) &&
        !(new Date(b.endDate).getTime() <= start || new Date(b.startDate).getTime() >= end)
      );

      if (hasOverlap) {
         toast({ title: "Booking Overlap", description: "One or more bikes are already booked for these dates.", variant: "destructive" });
         return;
      }
      
      const total = Number(data.rent) + Number(data.deposit);
      
      // Convert to ISO strings for storage
      const startDateISO = startDateTime.toISOString();
      const endDateISO = endDateTime.toISOString();

      if (initialData) {
        updateBooking(initialData.id, {
          ...data,
          startDate: startDateISO,
          endDate: endDateISO,
          rent: Number(data.rent),
          deposit: Number(data.deposit),
          totalAmount: total,
          history: [...(initialData.history || []), { byUserId: user?.id || 'unknown', timestamp: new Date().toISOString(), changes: 'Edited details' }]
        });
        toast({ title: "Booking Updated", description: "Changes saved." });
      } else {
         const newBooking: Booking = {
          id: Math.random().toString(36).substr(2, 9),
          bikeIds: data.bikeIds,
          customerId: data.customerId,
          startDate: startDateISO,
          endDate: endDateISO,
          rent: Number(data.rent),
          deposit: Number(data.deposit),
          totalAmount: total,
          status: 'Booked',
          paymentStatus: 'Pending',
          history: []
        };
        addBooking(newBooking);
        toast({ title: "Booking Created", description: "Reservation confirmed." });
      }
      onClose();
    };

    const toggleBikeSelection = (bikeId: string) => {
      const current = watch('bikeIds') || [];
      let newValue: string[];
      if (current.includes(bikeId)) {
        newValue = current.filter((id: string) => id !== bikeId);
      } else {
        newValue = [...current, bikeId];
      }
      setValue('bikeIds', newValue, { shouldValidate: true });
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Bikes</label>
          <input type="hidden" {...register('bikeIds', { 
            validate: (value) => (value && value.length > 0) || "Please select at least one bike" 
          })} />
          <div className={cn(
            "max-h-40 overflow-y-auto border rounded-md p-2 space-y-2",
            selectedBikeIds.length === 0 && errors.bikeIds ? "border-red-500" : "border-zinc-200"
          )}>
            {bikes.filter(b => b.status === 'Available' || (initialData?.bikeIds.includes(b.id))).map(bike => (
              <div key={bike.id} className="flex items-center space-x-2">
                <Checkbox 
                  id={`bike-${bike.id}`} 
                  checked={selectedBikeIds.includes(bike.id)}
                  onCheckedChange={() => toggleBikeSelection(bike.id)}
                />
                <label
                  htmlFor={`bike-${bike.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {bike.name} - <span className="text-muted-foreground">{bike.regNo} (₹{bike.pricePerDay})</span>
                </label>
              </div>
            ))}
          </div>
          {errors.bikeIds && (
            <p className="text-xs text-red-500">{errors.bikeIds.message as string || "Please select at least one bike"}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
             <label className="text-sm font-medium">Select Customer</label>
             <button type="button" className="text-xs text-primary-600 font-medium flex items-center" onClick={() => setIsAddCustomerOpen(true)}>
               <UserPlus size={12} className="mr-1" /> Add New
             </button>
          </div>
          <input type="hidden" {...register('customerId', { required: true })} />
          <Select 
            onValueChange={(val) => setValue('customerId', val, { shouldValidate: true })} 
            value={watch('customerId') || ''}
          >
            <SelectTrigger className={cn(!watch('customerId') && errors.customerId && "border-red-500")}>
              <SelectValue placeholder="Choose a customer" />
            </SelectTrigger>
            <SelectContent>
              {customers.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.customerId && !watch('customerId') && (
            <p className="text-xs text-red-500">Please select a customer</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date & Time</label>
              <Input 
                type="datetime-local" 
                {...register("startDate", { required: "Start date is required" })}
                className={cn(errors.startDate && "border-red-500")}
              />
              {errors.startDate && (
                <p className="text-xs text-red-500">{errors.startDate.message as string || "Required"}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date & Time</label>
              <Input 
                type="datetime-local" 
                {...register("endDate", { required: "End date is required" })}
                className={cn(errors.endDate && "border-red-500")}
              />
              {errors.endDate && (
                <p className="text-xs text-red-500">{errors.endDate.message as string || "Required"}</p>
              )}
            </div>
          </div>
          {dateError && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <X size={12} /> {dateError}
            </p>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Rent Amount (₹)</label>
            <Input type="number" {...register("rent", { required: true })} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Deposit (₹)</label>
            <Input type="number" {...register("deposit")} defaultValue={0} />
          </div>
        </div>
        
        <div className="sticky bottom-0 bg-background pt-2 border-t border-border mt-4">
            <Button type="submit" className="w-full h-12">{initialData ? 'Save Changes' : 'Create Booking'}</Button>
        </div>
      </form>
    );
  };
  
  const AddCustomerForm = () => {
    const { register, handleSubmit, watch, setValue } = useForm<Customer>();
    const idType = watch('idType', 'Aadhaar');

    const onSubmit = (data: any) => {
       const newCustomer = { 
         ...data, 
         id: Math.random().toString(36).substr(2, 9), 
         status: 'Verified',
         dateAdded: new Date().toISOString(),
         idPhotos: { front: 'mock-url' } // Mock upload
       };
       addCustomer(newCustomer);
       setIsAddCustomerOpen(false);
       toast({ title: "Customer Added", description: "New customer created." });
    };

    return (
       <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input {...register("name", { required: true })} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Phone</label>
            <Input {...register("phone", { required: true })} />
          </div>
          <div className="space-y-2">
             <label className="text-sm font-medium">ID Proof Type</label>
             <Select onValueChange={(val) => setValue('idType', val as any)} defaultValue="Aadhaar">
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
          
          <div className="grid grid-cols-2 gap-2">
             <div className="h-24 border border-dashed border-zinc-300 rounded-md flex flex-col items-center justify-center bg-zinc-50">
               <span className="text-xs text-muted-foreground">{idType} Front</span>
             </div>
             {(idType === 'Aadhaar' || idType === 'Voter ID' || idType === 'Driving License') && (
               <div className="h-24 border border-dashed border-zinc-300 rounded-md flex flex-col items-center justify-center bg-zinc-50">
                 <span className="text-xs text-muted-foreground">{idType} Back</span>
               </div>
             )}
          </div>

          <Button type="submit" className="w-full">Save Customer</Button>
       </form>
    );
  };

  const PaymentDialog = () => {
    if (!selectedBooking) return null;

    const handlePayment = () => {
      updateBooking(selectedBooking.id, { paymentStatus: 'Paid', status: 'Active' });
      setSelectedBooking(null);
      toast({
        title: "Payment Recorded",
        description: `Amount ₹${selectedBooking.totalAmount} marked as paid.`,
      });
    };

    return (
      <DialogContent className="sm:max-w-md top-[20%] translate-y-0">
         <DialogHeader>
           <DialogTitle>Record Payment</DialogTitle>
         </DialogHeader>
         <div className="py-6 text-center">
           <h2 className="text-3xl font-bold text-green-600 mb-2">₹{selectedBooking.totalAmount}</h2>
           <p className="text-muted-foreground">Total Amount Due</p>
           <div className="flex justify-center gap-4 mt-2 text-sm text-zinc-500">
             <span>Rent: ₹{selectedBooking.rent}</span>
             <span>+</span>
             <span>Deposit: ₹{selectedBooking.deposit}</span>
           </div>
         </div>
         <DialogFooter className="sm:justify-center flex-col gap-2">
           <Button className="w-full h-12 bg-green-600 hover:bg-green-700" onClick={handlePayment}>
             <CheckCircle className="mr-2 h-4 w-4" /> Mark as Paid (Cash/UPI)
           </Button>
           <Button variant="outline" className="w-full" onClick={() => setSelectedBooking(null)}>Cancel</Button>
         </DialogFooter>
      </DialogContent>
    );
  };
  
  const InvoiceDialog = () => {
     if (!invoiceBooking) return null;
     const customer = customers.find(c => c.id === invoiceBooking.customerId);
     const bookingBikes = bikes.filter(b => invoiceBooking.bikeIds.includes(b.id));

     return (
        <DialogContent className="sm:max-w-md h-[80vh] flex flex-col">
           <DialogHeader>
             <DialogTitle>Invoice #{invoiceBooking.id.toUpperCase()}</DialogTitle>
           </DialogHeader>
           <div className="flex-1 overflow-y-auto p-4 border rounded-md bg-zinc-50 text-sm space-y-4">
              <div className="flex justify-between border-b pb-4">
                 <div>
                   <h3 className="font-bold text-lg">City Bike Rentals</h3>
                   <p className="text-zinc-500">123 MG Road, Bangalore</p>
                   <p className="text-zinc-500">Phone: 9999999999</p>
                 </div>
                 <div className="text-right">
                   <p className="font-bold">INVOICE</p>
                   <p>Date: {new Date().toLocaleDateString()}</p>
                 </div>
              </div>
              
              <div>
                 <p className="font-bold">Bill To:</p>
                 <p>{customer?.name}</p>
                 <p>{customer?.phone}</p>
              </div>

              <div className="space-y-2">
                 <p className="font-bold border-b pb-1">Rental Details</p>
                 {bookingBikes.map(bike => (
                    <div key={bike.id} className="flex justify-between">
                       <span>{bike.name} ({bike.regNo})</span>
                       <span>₹{bike.pricePerDay}/day</span>
                    </div>
                 ))}
                 <div className="flex justify-between text-zinc-500 text-xs mt-2">
                    <span>Start: {new Date(invoiceBooking.startDate).toLocaleString()}</span>
                    <span>End: {new Date(invoiceBooking.endDate).toLocaleString()}</span>
                 </div>
              </div>

              <div className="space-y-2 pt-4 border-t">
                 <div className="flex justify-between">
                    <span>Rent Amount</span>
                    <span>₹{invoiceBooking.rent}</span>
                 </div>
                 <div className="flex justify-between">
                    <span>Security Deposit</span>
                    <span>₹{invoiceBooking.deposit}</span>
                 </div>
                 <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                    <span>Total</span>
                    <span>₹{invoiceBooking.totalAmount}</span>
                 </div>
              </div>
           </div>
           <DialogFooter>
              <Button className="w-full" onClick={() => {
                 toast({ title: "Invoice Downloaded", description: "PDF saved to device." });
                 setInvoiceBooking(null);
              }}>
                 <FileText className="mr-2 h-4 w-4" /> Download PDF
              </Button>
           </DialogFooter>
        </DialogContent>
     )
  }

  return (
    <MobileLayout>
      <div className="p-4 space-y-4 min-h-screen pb-24">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Bookings</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className={cn("rounded-full", showFilters && "bg-zinc-100")} onClick={() => setShowFilters(!showFilters)}>
               <Filter size={18} />
            </Button>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button size="icon" className="rounded-full h-10 w-10 shadow-md">
                  <Plus size={20} />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md top-[5%] translate-y-0 h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>New Booking</DialogTitle>
                </DialogHeader>
                <BookingForm onClose={() => setIsAddOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>

          <Dialog open={!!editingBooking} onOpenChange={(open) => !open && setEditingBooking(null)}>
            <DialogContent className="sm:max-w-md top-[5%] translate-y-0 h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Booking</DialogTitle>
              </DialogHeader>
              {editingBooking && <BookingForm initialData={editingBooking} onClose={() => setEditingBooking(null)} />}
            </DialogContent>
          </Dialog>
          
          <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
             <DialogContent className="sm:max-w-md top-[20%] translate-y-0">
               <DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
               <AddCustomerForm />
             </DialogContent>
          </Dialog>

          <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
             <PaymentDialog />
          </Dialog>
          
          <Dialog open={!!invoiceBooking} onOpenChange={(open) => !open && setInvoiceBooking(null)}>
             <InvoiceDialog />
          </Dialog>
        </div>
        
        {showFilters && (
           <div className="flex gap-2 overflow-x-auto pb-2 animate-in slide-in-from-top-2">
              <Badge variant={filterStatus === 'all' ? 'default' : 'outline'} onClick={() => setFilterStatus('all')}>All</Badge>
              <Badge variant={filterStatus === 'active' ? 'default' : 'outline'} onClick={() => setFilterStatus('active')}>Active</Badge>
              <Badge variant={filterStatus === 'booked' ? 'default' : 'outline'} onClick={() => setFilterStatus('booked')}>Booked</Badge>
              <Badge variant={filterStatus === 'unpaid' ? 'default' : 'outline'} onClick={() => setFilterStatus('unpaid')}>Unpaid</Badge>
              <Badge variant={filterStatus === 'completed' ? 'default' : 'outline'} onClick={() => setFilterStatus('completed')}>Completed</Badge>
           </div>
        )}

        <div className="space-y-4">
          {filteredBookings.map((booking) => {
            const bookingBikes = bikes.filter(b => booking.bikeIds.includes(b.id));
            const customer = customers.find(c => c.id === booking.customerId);
            
            return (
              <Card key={booking.id} className="shadow-sm border-zinc-100 overflow-hidden">
                <div className={cn("border-l-4 h-full", 
                   booking.status === 'Active' ? 'border-green-500' : 
                   booking.status === 'Completed' ? 'border-zinc-500' :
                   booking.status === 'Cancelled' ? 'border-red-300' :
                   'border-primary'
                )}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        {bookingBikes.length > 0 ? (
                           <div className="space-y-1">
                              {bookingBikes.map(b => (
                                <h3 key={b.id} className="font-bold text-sm">{b.name} <span className="text-zinc-400 font-normal text-xs">{b.regNo}</span></h3>
                              ))}
                           </div>
                        ) : <h3 className="font-bold text-red-500">No Bike Assigned</h3>}
                        
                        <div className="flex items-center gap-2 mt-2">
                           <p className="text-sm text-muted-foreground">{customer?.name}</p>
                           {customer?.phone && (
                              <div className="flex gap-1">
                                 <a href={`tel:${customer.phone}`} className="p-1 rounded-full bg-green-50 text-green-600 hover:bg-green-100">
                                   <Phone size={12} />
                                 </a>
                                 <a href={`https://wa.me/91${customer.phone}?text=Hello ${customer.name}, regarding your booking.`} target="_blank" className="p-1 rounded-full bg-green-50 text-green-600 hover:bg-green-100">
                                   <MessageCircle size={12} />
                                 </a>
                              </div>
                           )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                         <Badge variant="secondary" className={cn("uppercase text-[10px]", booking.status === 'Active' && 'bg-green-100 text-green-800')}>
                           {booking.status}
                         </Badge>
                         <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-400 hover:text-foreground" onClick={() => setInvoiceBooking(booking)}>
                               <FileText size={12} />
                            </Button>
                            {booking.status === 'Active' && (
                               <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-500 hover:text-blue-700" title="Return Bike" onClick={() => {
                                  if (confirm("Mark bike as returned and complete booking?")) {
                                     returnBooking(booking.id);
                                     toast({ title: "Bike Returned", description: "Booking marked as completed." });
                                  }
                               }}>
                                  <CornerDownLeft size={12} />
                               </Button>
                            )}
                            {user?.role === 'admin' && (
                               <>
                                 <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-400 hover:text-foreground" onClick={() => setEditingBooking(booking)}>
                                   <Edit2 size={12} />
                                 </Button>
                                 <Button variant="ghost" size="icon" className="h-6 w-6 text-red-300 hover:text-red-600" onClick={() => {
                                    if (confirm("Are you sure you want to delete this booking?")) {
                                       deleteBooking(booking.id);
                                       toast({ title: "Booking Deleted", description: "Record has been removed." });
                                    }
                                 }}>
                                   <Trash2 size={12} />
                                 </Button>
                               </>
                            )}
                         </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-zinc-600 mb-3 bg-zinc-50 p-2 rounded-md justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-zinc-400">Start</span>
                        <span className="font-medium text-xs">{format(new Date(booking.startDate), 'MMM dd, HH:mm')}</span>
                      </div>
                      <ArrowRight size={14} className="text-zinc-300" />
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-zinc-400">End</span>
                        <span className="font-medium text-xs">{format(new Date(booking.endDate), 'MMM dd, HH:mm')}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-zinc-100">
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <IndianRupee size={14} />
                        <span>{booking.totalAmount}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full ml-2",
                          booking.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        )}>
                          {booking.paymentStatus}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {(booking.status === 'Booked' || booking.status === 'Active') && (
                            <Button variant="outline" size="sm" className="h-8 text-xs text-red-500 border-red-100 hover:bg-red-50" onClick={() => {
                               if (confirm("Cancel this booking?")) {
                                  cancelBooking(booking.id);
                                  toast({ title: "Booking Cancelled", description: "Status updated." });
                               }
                            }}>
                               <Ban size={12} className="mr-1" /> Cancel
                            </Button>
                        )}
                        {booking.paymentStatus !== 'Paid' && booking.status !== 'Cancelled' && (
                           <Button size="sm" className="h-8 text-xs" onClick={() => setSelectedBooking(booking)}>
                             Pay Now
                           </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </MobileLayout>
  );
}
