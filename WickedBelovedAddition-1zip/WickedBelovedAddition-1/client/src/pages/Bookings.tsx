import { useState, useEffect, useMemo } from "react";
import MobileLayout from "@/components/layout/MobileLayout";
import { useStore, Booking, Customer, Bike, Damage, DamageType } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Plus, Clock, ArrowRight, IndianRupee, Edit2, Trash2, UserPlus, Phone, MessageCircle, FileText, Filter, X, CornerDownLeft, Ban, Play, Send, Bike as BikeIcon, Car as CarIcon, Search, ChevronDown } from "lucide-react";
import { format, addDays, subDays, setHours, setMinutes, startOfDay } from "date-fns";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { cn, getStatusColor, getStatusBorderColor } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { WhatsAppDialog } from "@/components/WhatsAppDialog";

const getVehicleIcon = (type?: string) => {
  return type === 'car' ? <CarIcon size={16} /> : <BikeIcon size={16} />;
};

const getVehicleLabel = (type?: string) => {
  return type === 'car' ? 'Car' : 'Bike';
};

export default function Bookings() {
  const { bookings, bikes, customers, addBooking, updateBooking, deleteBooking, cancelBooking, returnBooking, markBookingAsTaken, user, addCustomer, settings, updateBike, whatsappTemplates } = useStore();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [invoiceBooking, setInvoiceBooking] = useState<Booking | null>(null);
  const [returnFlowBooking, setReturnFlowBooking] = useState<Booking | null>(null);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [whatsappDialogType, setWhatsappDialogType] = useState<'booking' | 'payment' | 'invoice'>('booking');
  const [markedTakenBooking, setMarkedTakenBooking] = useState<Booking | null>(null);
  const [openingOdometerInput, setOpeningOdometerInput] = useState<string>('');
  const [paymentFlow, setPaymentFlow] = useState<{ booking: Booking; mode: 'advance' | 'full' } | null>(null);
  
  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilterStart, setDateFilterStart] = useState<string | null>(null);
  const [dateFilterEnd, setDateFilterEnd] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmedPaymentFilter, setConfirmedPaymentFilter] = useState<'all' | 'full' | 'advance'>('all');
  const [filterCustomerId, setFilterCustomerId] = useState<string | null>(null);
  
  const { toast } = useToast();
  const [location] = useLocation();

  useEffect(() => {
    if (location.includes("action=new")) {
      setIsAddOpen(true);
    }
    // Read filter from query and persist
    try {
      const url = new URL(window.location.href);
      const qFilter = url.searchParams.get('filter');
      const qCustomer = url.searchParams.get('customerId');
      if (qFilter) {
        setFilterStatus(qFilter);
        localStorage.setItem('bookings_filter_status', qFilter);
      } else {
        const saved = localStorage.getItem('bookings_filter_status');
        if (saved) setFilterStatus(saved);
      }
      setFilterCustomerId(qCustomer);
    } catch {}
  }, [location]);

  const filteredBookings = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return bookings
      .filter(b => {
        if (b.status === 'Deleted') return false;
        if (filterCustomerId && b.customerId !== filterCustomerId) return false;
        if (filterStatus === 'cancelled') return b.status === 'Cancelled';
        if (b.status === 'Cancelled') return false;
        if (filterStatus === 'active') return b.status === 'Active';
        if (filterStatus === 'completed') return b.status === 'Completed';
        if (filterStatus === 'booked') return b.status === 'Booked';
        if (filterStatus === 'confirmed') {
          const isConfirmed = b.status === 'Confirmed' || b.status === 'Advance Paid';
          if (!isConfirmed) return false;
          if (confirmedPaymentFilter === 'full') return b.paymentStatus === 'Paid';
          if (confirmedPaymentFilter === 'advance') return b.paymentStatus === 'Partial';
          return true;
        }
        if (filterStatus === 'unpaid') return b.paymentStatus !== 'Paid';
        return true;
      })
      .filter(b => {
        if (!normalizedSearch) return true;
        const customer = customers.find(c => c.id === b.customerId);
        const bookingMatch = b.bookingNumber.toLowerCase().includes(normalizedSearch) || b.id.toLowerCase().includes(normalizedSearch);
        const nameMatch = customer?.name?.toLowerCase().includes(normalizedSearch) || false;
        const phoneMatch = (customer?.phone || '').replace(/\s+/g, '').includes(normalizedSearch.replace(/\s+/g, ''));
        return bookingMatch || nameMatch || phoneMatch;
      })
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [bookings, filterStatus, confirmedPaymentFilter, customers, searchTerm]);

  const filteredBookingsWithDate = useMemo(() => {
    let list = filteredBookings;
    if (dateFilterStart || dateFilterEnd) {
      const start = dateFilterStart ? new Date(dateFilterStart) : null;
      const end = dateFilterEnd ? new Date(dateFilterEnd) : null;
      list = list.filter(b => {
        const bStart = new Date(b.startDate);
        const bEnd = new Date(b.endDate);
        if (start && bEnd <= start) return false;
        if (end && bStart >= addDays(end, 1)) return false;
        return true;
      });
    }
    return list;
  }, [filteredBookings, dateFilterStart, dateFilterEnd]);

  const handlePaymentSelection = (booking: Booking, selection: 'unpaid' | 'advance' | 'full') => {
    if (booking.status === 'Cancelled' || booking.status === 'Completed') return;

    const total = booking.totalAmount || (booking.rent + booking.deposit);
    const history = Array.isArray(booking.history) ? booking.history : [];

    if (selection === 'unpaid') {
      updateBooking(booking.id, {
        paymentStatus: 'Unpaid',
        status: 'Booked',
        advanceAmount: undefined,
        remainingAmount: total,
        paymentMode: undefined,
        paymentType: undefined,
        paidAt: undefined,
        paidBy: undefined,
        history: [...history, { byUserId: user?.id || 'unknown', timestamp: new Date().toISOString(), changes: 'Marked as Unpaid' }]
      });
      toast({ title: 'Payment Updated', description: 'Booking set to unpaid.' });
      return;
    }

    if (selection === 'advance') {
      setPaymentFlow({ booking, mode: 'advance' });
      return;
    }

    setPaymentFlow({ booking, mode: 'full' });
  };

  const AdvancePaymentDialog = () => {
    const flow = paymentFlow;
    if (!flow || flow.mode !== 'advance') return null;

    const booking = flow.booking;
    const total = booking.totalAmount || (booking.rent + booking.deposit);
    const [amount, setAmount] = useState<number>(booking.advanceAmount || 0);
    const [method, setMethod] = useState<'Cash' | 'UPI' | 'Other'>(booking.paymentMode || 'Cash');
    const balancePreview = Math.max(total - amount, 0);

    const handleSaveAdvance = () => {
      if (!amount || amount <= 0) {
        toast({ title: "Advance Required", description: "Enter a valid advance amount.", variant: "destructive" });
        return;
      }
      if (amount >= total) {
        toast({ title: "Advance Too High", description: "Advance must be less than total amount.", variant: "destructive" });
        return;
      }

      const history = Array.isArray(booking.history) ? booking.history : [];
      updateBooking(booking.id, {
        paymentStatus: 'Partial',
        status: 'Confirmed',
        advanceAmount: amount,
        remainingAmount: balancePreview,
        paymentMode: method,
        paymentType: method,
        history: [...history, { byUserId: user?.id || 'unknown', timestamp: new Date().toISOString(), changes: `Advance ₹${amount} via ${method}` }]
      });
      setPaymentFlow(null);
      toast({ title: "Advance Saved", description: "Booking confirmed with advance payment." });
    };

    return (
      <DialogContent className="sm:max-w-md top-[20%] translate-y-0">
        <DialogHeader>
          <DialogTitle>Record Advance Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm">
            <p className="font-semibold">Total: ₹{total}</p>
            <p className="text-muted-foreground text-xs">Rent ₹{booking.rent} + Deposit ₹{booking.deposit}</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Advance Amount (₹)</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={1}
            />
            <p className="text-xs text-muted-foreground">Balance after advance: ₹{balancePreview}</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Payment Method</label>
            <Select value={method} onValueChange={(val) => setMethod(val as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="UPI">UPI</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="sm:justify-center flex-col gap-2">
          <Button className="w-full h-11 bg-green-600 hover:bg-green-700" onClick={handleSaveAdvance}>
            Save Advance & Confirm
          </Button>
          <Button variant="outline" className="w-full" onClick={() => setPaymentFlow(null)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    );
  };

  const FullPaymentDialog = () => {
    const flow = paymentFlow;
    if (!flow || flow.mode !== 'full') return null;

    const booking = flow.booking;
    const total = booking.totalAmount || (booking.rent + booking.deposit);
    const previousAdvance = booking.advanceAmount || 0;
    const balanceAmount = Math.max(total - previousAdvance, 0);
    const [amount, setAmount] = useState<number>(balanceAmount);
    const [method, setMethod] = useState<'Cash' | 'UPI' | 'Other'>(booking.paymentMode || 'Cash');
    const remainingAfterPayment = Math.max(balanceAmount - amount, 0);

    const handleSavePayment = () => {
      if (!amount || amount <= 0) {
        toast({ title: "Amount Required", description: "Enter the amount received.", variant: "destructive" });
        return;
      }
      if (amount < balanceAmount) {
        toast({ title: "Amount Too Low", description: "Enter the full balance to mark as paid.", variant: "destructive" });
        return;
      }
      if (amount > total) {
        toast({ title: "Amount Too High", description: "Amount cannot exceed total charges.", variant: "destructive" });
        return;
      }

      const now = new Date().toISOString();
      const history = Array.isArray(booking.history) ? booking.history : [];
      updateBooking(booking.id, {
        paymentStatus: 'Paid',
        status: 'Confirmed',
        paymentMode: method,
        paymentType: method,
        remainingAmount: remainingAfterPayment,
        advanceAmount: previousAdvance || undefined,
        paidAt: now,
        paidBy: user?.id,
        history: [...history, { byUserId: user?.id || 'unknown', timestamp: now, changes: `Full payment ₹${amount} via ${method}` }]
      });
      setPaymentFlow(null);
      toast({ title: "Payment Recorded", description: remainingAfterPayment > 0 ? "Balance still pending." : "Booking marked as fully paid." });
    };

    return (
      <DialogContent className="sm:max-w-md top-[20%] translate-y-0">
        <DialogHeader>
          <DialogTitle>Record Full Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 p-3 rounded text-sm">
            <p className="font-semibold">Total: ₹{total}</p>
            <p className="text-muted-foreground text-xs">Rent ₹{booking.rent} + Deposit ₹{booking.deposit}</p>
            <p className="text-xs text-green-800 mt-1">Advance collected: ₹{previousAdvance}</p>
            <p className="text-sm font-semibold mt-1">Balance: ₹{balanceAmount}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Amount Received Now (₹)</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={1}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Payment Method</label>
            <Select value={method} onValueChange={(val) => setMethod(val as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="UPI">UPI</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="sm:justify-center flex-col gap-2">
          <Button className="w-full h-11 bg-green-600 hover:bg-green-700" onClick={handleSavePayment}>
            Save & Confirm
          </Button>
          <Button variant="outline" className="w-full" onClick={() => setPaymentFlow(null)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    );
  };

  const BookingForm = ({ initialData, onClose }: { initialData?: Booking, onClose: () => void }) => {
    const { settings, getNextBookingNumber, addBooking } = useStore();
    const [dateError, setDateError] = useState<string | null>(null);
    const [backdateError, setBackdateError] = useState<string | null>(null);
    const [vehicleSearch, setVehicleSearch] = useState<string>("");
    const [datesConfirmed, setDatesConfirmed] = useState<boolean>(!!initialData);
    const [damagePreviewBike, setDamagePreviewBike] = useState<Bike | null>(null);
    const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
    
    const minDate = subDays(new Date(), 7);
    
    const getInitialStartDateTime = () => {
      if (initialData?.startDate) {
        return new Date(initialData.startDate);
      }
      return new Date();
    };
    
    const getInitialEndDateTime = () => {
      if (initialData?.endDate) {
        return new Date(initialData.endDate);
      }
      const start = getInitialStartDateTime();
      return new Date(start.getTime() + 8 * 60 * 60 * 1000);
    };
    
    const [startDate, setStartDate] = useState<Date | undefined>(initialData ? startOfDay(getInitialStartDateTime()) : undefined);
    const [startHour12, setStartHour12] = useState<string>(initialData ? ((getInitialStartDateTime().getHours() % 12) || 12).toString() : "");
    const [startMinute, setStartMinute] = useState<string>(initialData ? getInitialStartDateTime().getMinutes().toString().padStart(2, '0') : "");
    const [startAmPm, setStartAmPm] = useState<string>(initialData ? (getInitialStartDateTime().getHours() >= 12 ? "PM" : "AM") : "");
    
    const [endDate, setEndDate] = useState<Date | undefined>(initialData ? startOfDay(getInitialEndDateTime()) : undefined);
    const [endHour12, setEndHour12] = useState<string>(initialData ? ((getInitialEndDateTime().getHours() % 12) || 12).toString() : "");
    const [endMinute, setEndMinute] = useState<string>(initialData ? getInitialEndDateTime().getMinutes().toString().padStart(2, '0') : "");
    const [endAmPm, setEndAmPm] = useState<string>(initialData ? (getInitialEndDateTime().getHours() >= 12 ? "PM" : "AM") : "");
    const [is24Hours, setIs24Hours] = useState(false);
    const [is48Hours, setIs48Hours] = useState(false);
    
    const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
      defaultValues: {
        bikeIds: initialData?.bikeIds || [],
        customerId: initialData?.customerId || '',
        rent: initialData?.rent || 0,
        deposit: initialData?.deposit || 0
      }
    });
    const hours12 = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
    const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
    
    const convertTo24Hour = (hour12: string, amPm: string): number => {
      let hour = parseInt(hour12);
      if (amPm === "AM" && hour === 12) hour = 0;
      if (amPm === "PM" && hour !== 12) hour += 12;
      return hour;
    };
    
    const getStartDateTime = (): Date | null => {
      if (!startDate || !startHour12 || !startMinute || !startAmPm) return null;
      const date = new Date(startDate);
      date.setHours(convertTo24Hour(startHour12, startAmPm), parseInt(startMinute), 0, 0);
      return date;
    };
    
    const getEndDateTime = (): Date | null => {
      if (!endDate || !endHour12 || !endMinute || !endAmPm) return null;
      const date = new Date(endDate);
      date.setHours(convertTo24Hour(endHour12, endAmPm), parseInt(endMinute), 0, 0);
      return date;
    };
    
    const getAvailableVehicles = (): typeof bikes => {
      const startDT = getStartDateTime();
      const endDT = getEndDateTime();
      
      if (!startDT || !endDT) return bikes.filter(b => b.status === 'Available');
      
      return bikes.filter(bike => {
        if (bike.status === 'Maintenance') return false;
        if (initialData?.bikeIds.includes(bike.id)) return true;
        // check blocked dates in range
        const blockedListRaw = localStorage.getItem('rento_blocked_dates');
        const blockedList: string[] = blockedListRaw ? JSON.parse(blockedListRaw) : [];
        if (blockedList.length > 0 && startDT && endDT) {
          const check = new Date(startDT);
          while (check <= endDT) {
            const k = check.toISOString().slice(0,10);
            if (blockedList.includes(k)) return false;
            check.setDate(check.getDate()+1);
          }
        }
        const hasOverlap = bookings.some(b => 
          b.id !== initialData?.id &&
          b.status !== 'Deleted' && b.status !== 'Cancelled' && b.status !== 'Completed' &&
          b.bikeIds.includes(bike.id) &&
          !(new Date(b.endDate).getTime() <= startDT.getTime() || new Date(b.startDate).getTime() >= endDT.getTime())
        );
        return !hasOverlap;
      });
    };
    
    const filteredAvailableVehicles = getAvailableVehicles().filter(b =>
      b.name.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
      b.regNo.toLowerCase().includes(vehicleSearch.toLowerCase())
    );

    const selectedBikeIds = watch('bikeIds') || [];
    
    useEffect(() => {
      const startDT = getStartDateTime();
      const endDT = getEndDateTime();
      
      if (!startDT || !endDT) {
        setDateError(null);
        setBackdateError(null);
        return;
      }
      
      if (endDT.getTime() <= startDT.getTime()) {
        setDateError("End date/time must be after start date/time");
      } else {
        setDateError(null);
      }
      
      const sevenDaysAgo = subDays(new Date(), 7).getTime();
      if (!settings.allowBackdateOverride && startDT.getTime() < sevenDaysAgo) {
        setBackdateError("Bookings cannot be created more than 7 days in the past");
      } else {
        setBackdateError(null);
      }
    }, [startDate, startHour12, startMinute, startAmPm, endDate, endHour12, endMinute, endAmPm]);
    
    useEffect(() => {
       if (selectedBikeIds.length > 0 && !initialData) {
          const startDT = getStartDateTime();
          const endDT = getEndDateTime();
          
          if (!startDT || !endDT) return;
          
          const start = startDT.getTime();
          const end = endDT.getTime();
          const diffDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
          
          const totalDailyPrice = bikes
             .filter(b => selectedBikeIds.includes(b.id))
             .reduce((sum, b) => sum + b.pricePerDay, 0);

          const calcRent = diffDays * totalDailyPrice;
          setValue('rent', calcRent);
       }
    }, [startDate, startHour12, startMinute, startAmPm, endDate, endHour12, endMinute, endAmPm, selectedBikeIds]);

    // Handle 24/48 hour auto-set logic
    useEffect(() => {
      const startDT = getStartDateTime();
      if (!startDT) return;

      if (is24Hours) {
        const endDT = new Date(startDT.getTime() + 24 * 60 * 60 * 1000);
        setEndDate(startOfDay(endDT));
        const newEndHour = endDT.getHours();
        setEndHour12(((newEndHour % 12) || 12).toString());
        setEndMinute(endDT.getMinutes().toString().padStart(2, '0'));
        setEndAmPm(newEndHour >= 12 ? "PM" : "AM");
      } else if (is48Hours) {
        const endDT = new Date(startDT.getTime() + 48 * 60 * 60 * 1000);
        setEndDate(startOfDay(endDT));
        const newEndHour = endDT.getHours();
        setEndHour12(((newEndHour % 12) || 12).toString());
        setEndMinute(endDT.getMinutes().toString().padStart(2, '0'));
        setEndAmPm(newEndHour >= 12 ? "PM" : "AM");
      }
    }, [is24Hours, is48Hours, startDate, startHour12, startMinute, startAmPm]);

    // Uncheck duration options if user manually edits endTime
    const handleEndTimeChange = () => {
      if (is24Hours || is48Hours) {
        setIs24Hours(false);
        setIs48Hours(false);
      }
    };

    const onSubmit = (data: any) => {
      const startDateTime = getStartDateTime();
      const endDateTime = getEndDateTime();
      if (!startDateTime || !endDateTime) {
        toast({ title: "Missing Dates", description: "Please select start and end date/time.", variant: "destructive" });
        return;
      }
      const start = startDateTime.getTime();
      const end = endDateTime.getTime();
      
      if (end <= start) {
        toast({ title: "Invalid Dates", description: "End date/time must be after start date/time.", variant: "destructive" });
        return;
      }
      
      const sevenDaysAgo = subDays(new Date(), 7).getTime();
      if (!settings.allowBackdateOverride && start < sevenDaysAgo) {
        toast({ title: "Back-dating Error", description: "Bookings can only be created up to 7 days in the past.", variant: "destructive" });
        return;
      }

      if (!data.bikeIds || data.bikeIds.length === 0) {
        toast({ title: "No Vehicle Selected", description: "Please select at least one vehicle.", variant: "destructive" });
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
         toast({ title: "Vehicle Overlap", description: "One or more vehicles are already booked for these dates.", variant: "destructive" });
         return;
      }
      
      const total = Number(data.rent) + Number(data.deposit);

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
          bookingNumber: getNextBookingNumber(),
          bikeIds: data.bikeIds,
          customerId: data.customerId,
          startDate: startDateISO,
          endDate: endDateISO,
          rent: Number(data.rent),
          deposit: Number(data.deposit),
          totalAmount: total,
          status: 'Booked',
          paymentStatus: 'Unpaid',
          remainingAmount: total,
          history: []
        };
        addBooking(newBooking);
        toast({ title: "Booking Created", description: "Reservation saved as unpaid." });
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

    const handleConfirmDates = () => {
      if (!startDate || !endDate) {
        toast({ title: "Incomplete", description: "Please select both start and end dates.", variant: "destructive" });
        return;
      }
      if (dateError || backdateError) {
        toast({ title: "Invalid Dates", description: dateError || backdateError, variant: "destructive" });
        return;
      }
      setDatesConfirmed(true);
    };

    return (
      <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
        {/* STEP 1: Date & Time Selection */}
        {!datesConfirmed ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 py-2 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">1</div>
              <span className="text-sm font-medium">Select Rental Dates & Times</span>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon size={16} /> Rental Period
              </label>
              
              <div className="border rounded-lg p-3 bg-zinc-50">
                <div className="flex justify-center">
                  <Calendar 
                    mode="range"
                    selected={{ from: startDate, to: endDate }}
                    onSelect={(range) => {
                      if (range?.from) {
                        setStartDate(startOfDay(range.from));
                        if (range?.to) {
                          setEndDate(startOfDay(range.to));
                        } else {
                          setEndDate(startOfDay(range.from));
                        }
                        setDatesConfirmed(false);
                      }
                    }}
                    disabled={minDate ? { before: minDate } : undefined}
                    numberOfMonths={1}
                    className="rounded-md"
                  />
                </div>
              </div>

              {/* START TIME - 12 Hour AM/PM */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Clock size={14} /> Start Date & Time
                </label>
                <div className="flex gap-2 items-center">
                  <Select value={startHour12} onValueChange={setStartHour12}>
                    <SelectTrigger className="flex-1 max-w-[80px]">
                      <SelectValue placeholder="HH" />
                    </SelectTrigger>
                    <SelectContent className="max-h-40">
                      {hours12.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="font-bold">:</span>
                  <Select value={startMinute} onValueChange={setStartMinute}>
                    <SelectTrigger className="flex-1 max-w-[80px]">
                      <SelectValue placeholder="MM" />
                    </SelectTrigger>
                    <SelectContent className="max-h-40">
                      {minutes.map(m => (
                        <SelectItem key={m} value={m}>{String(m).padStart(2, '0')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={startAmPm} onValueChange={setStartAmPm}>
                    <SelectTrigger className="flex-1 max-w-[70px]">
                      <SelectValue placeholder="AM/PM" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {startDate && <p className="text-xs text-muted-foreground">{format(startDate, 'EEE, MMM d, yyyy')}</p>}
              </div>

              {/* END TIME - 12 Hour AM/PM */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Clock size={14} /> End Date & Time
                </label>
                <div className="flex gap-2 items-center">
                  <Select value={endHour12} onValueChange={setEndHour12}>
                    <SelectTrigger className="flex-1 max-w-[80px]">
                      <SelectValue placeholder="HH" />
                    </SelectTrigger>
                    <SelectContent className="max-h-40">
                      {hours12.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="font-bold">:</span>
                  <Select value={endMinute} onValueChange={setEndMinute}>
                    <SelectTrigger className="flex-1 max-w-[80px]">
                      <SelectValue placeholder="MM" />
                    </SelectTrigger>
                    <SelectContent className="max-h-40">
                      {minutes.map(m => (
                        <SelectItem key={m} value={m}>{String(m).padStart(2, '0')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={endAmPm} onValueChange={(val) => { handleEndTimeChange(); setEndAmPm(val); }}>
                    <SelectTrigger className="flex-1 max-w-[70px]">
                      <SelectValue placeholder="AM/PM" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {endDate && <p className="text-xs text-muted-foreground">{format(endDate, 'EEE, MMM d, yyyy')}</p>}
              </div>

              {/* Duration Quick Select */}
              <div className="space-y-2 bg-blue-50 p-3 rounded-lg">
                <label className="text-sm font-medium">Quick Duration Select</label>
                <div className="flex gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="24hours" 
                      checked={is24Hours}
                      onCheckedChange={(checked) => {
                        setIs24Hours(checked as boolean);
                        if (checked) setIs48Hours(false);
                      }}
                    />
                    <label htmlFor="24hours" className="text-sm cursor-pointer">24 Hours</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="48hours" 
                      checked={is48Hours}
                      onCheckedChange={(checked) => {
                        setIs48Hours(checked as boolean);
                        if (checked) setIs24Hours(false);
                      }}
                    />
                    <label htmlFor="48hours" className="text-sm cursor-pointer">48 Hours</label>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Manually editing end time will disable these options</p>
              </div>

              {dateError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <X size={12} /> {dateError}
                </p>
              )}
              {backdateError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <X size={12} /> {backdateError}
                </p>
              )}
            </div>

            <Button 
              type="button" 
              onClick={handleConfirmDates}
              className="w-full h-11"
              disabled={!startDate || !endDate || !!dateError || !!backdateError}
            >
              Continue to Select Vehicles →
            </Button>
          </div>
        ) : (
          // STEP 2: Vehicle Selection with Search
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold">✓</div>
                <span className="text-xs font-medium">
                  {startDate && endDate ? format(startDate, 'MMM d') + ' - ' + format(endDate, 'MMM d') : 'Dates selected'}
                </span>
              </div>
              <button 
                type="button"
                className="text-xs text-blue-600 font-medium hover:underline"
                onClick={() => setDatesConfirmed(false)}
              >
                Change
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">2</div>
                <span>Select Vehicles</span>
              </label>

              {/* Vehicle Search */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
                <Input 
                  placeholder="Search by vehicle name or reg. number..."
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Available Vehicles List */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {filteredAvailableVehicles.length} vehicle{filteredAvailableVehicles.length !== 1 ? 's' : ''} available
                </p>
                <div className={cn(
                  "max-h-48 overflow-y-auto border rounded-md p-2 space-y-2",
                  selectedBikeIds.length === 0 && errors.bikeIds ? "border-red-500" : "border-zinc-200"
                )}>
                  {filteredAvailableVehicles.length > 0 ? (
                    filteredAvailableVehicles.map(bike => (
                      <div key={bike.id} className="flex items-center space-x-2 p-2 hover:bg-zinc-100 rounded">
                        <Checkbox 
                          id={`bike-${bike.id}`} 
                          checked={selectedBikeIds.includes(bike.id)}
                          onCheckedChange={() => toggleBikeSelection(bike.id)}
                        />
                        <label
                          htmlFor={`bike-${bike.id}`}
                          className="text-sm font-medium leading-none flex-1 flex items-center gap-2 cursor-pointer"
                        >
                          <span className="flex items-center gap-1">{getVehicleIcon(bike.type)} {getVehicleLabel(bike.type)}</span>
                          <div className="flex flex-col">
                            <span>{bike.name}</span>
                            <span className="text-xs text-muted-foreground">{bike.regNo} • ₹{bike.pricePerDay}/day</span>
                          </div>
                        </label>
                        <div className="flex items-center">
                          {bike.damages && bike.damages.length > 0 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={(e) => {
                                e.preventDefault();
                                setDamagePreviewBike(bike);
                              }}
                            >
                              View damages ({bike.damages.length})
                            </Button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">No damages</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No vehicles available for selected dates</p>
                  )}
                </div>
                <input type="hidden" {...register('bikeIds', { 
                  validate: (value) => (value && value.length > 0) || "Please select at least one vehicle" 
                })} />
                {errors.bikeIds && (
                  <p className="text-xs text-red-500">{errors.bikeIds.message as string || "Please select at least one vehicle"}</p>
                )}
              </div>

              {/* Customer Selection */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between">
                   <label className="text-sm font-medium">Customer</label>
                   <button type="button" className="text-xs text-blue-600 font-medium flex items-center hover:underline" onClick={() => setIsAddCustomerOpen(true)}>
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

              {/* Rent & Deposit */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rent (₹)</label>
                  <Input type="number" {...register("rent", { required: true })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Deposit (₹)</label>
                  <Input type="number" {...register("deposit")} defaultValue={0} />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-background pt-2 border-t border-border mt-4 flex gap-2">
              <Button 
                type="button"
                variant="outline"
                onClick={() => setDatesConfirmed(false)}
                className="flex-1 h-11"
              >
                ← Back
              </Button>
              <Button 
                type="submit" 
                className="flex-1 h-11"
              >
                {initialData ? 'Save Changes' : 'Create Booking'}
              </Button>
            </div>
          </div>
        )}
      </form>

      {damagePreviewBike && (
        <Dialog open={!!damagePreviewBike} onOpenChange={(open) => !open && setDamagePreviewBike(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Previous Damages - {damagePreviewBike.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {damagePreviewBike.damages && damagePreviewBike.damages.length > 0 ? (
                damagePreviewBike.damages.map((damage, idx) => (
                  <div key={idx} className="border rounded p-3 bg-amber-50 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{damage.type}</span>
                      <Badge variant={damage.severity === 'major' ? 'destructive' : 'secondary'} className="text-[10px]">
                        {damage.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{damage.notes || 'No notes'}</p>
                    {damage.photoUrls && damage.photoUrls.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {damage.photoUrls.map((url, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            className="h-16 w-16 border rounded overflow-hidden"
                            onClick={() => setLightboxPhoto(url)}
                          >
                            <img src={url} alt={`Damage ${pIdx + 1}`} className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No recorded damages.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {lightboxPhoto && (
        <Dialog open={!!lightboxPhoto} onOpenChange={(open) => !open && setLightboxPhoto(null)}>
          <DialogContent className="sm:max-w-lg">
            <img src={lightboxPhoto} alt="Damage photo" className="w-full h-full object-contain" />
          </DialogContent>
        </Dialog>
      )}
      </>
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

  const InvoiceDialog = () => {
     if (!invoiceBooking) return null;
     const customer = customers.find(c => c.id === invoiceBooking.customerId);
     const bookingBikes = bikes.filter(b => invoiceBooking.bikeIds.includes(b.id));

     const handleSavePdf = () => {
       updateBooking(invoiceBooking.id, {
         invoicePending: false,
         invoiceGeneratedAt: new Date().toISOString(),
       });
       toast({ title: "Invoice Ready", description: "PDF prepared for download." });
       setInvoiceBooking(null);
     };

     const handleSendWhatsApp = () => {
       updateBooking(invoiceBooking.id, {
         invoicePending: false,
         invoiceGeneratedAt: new Date().toISOString(),
         whatsappSent: { ...invoiceBooking.whatsappSent, invoice: true }
       });
       toast({ title: "Invoice Sent", description: "Invoice shared via WhatsApp." });
       setInvoiceBooking(null);
     };

     const handleGenerateLater = () => {
       updateBooking(invoiceBooking.id, { invoicePending: true });
       toast({ title: "Invoice Deferred", description: "Marked to generate later." });
       setInvoiceBooking(null);
     };

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
                       <span className="flex items-center gap-2"><span className="flex items-center gap-1">{getVehicleIcon(bike.type)} {getVehicleLabel(bike.type)}</span> {bike.name} ({bike.regNo})</span>
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
              <DialogFooter className="flex flex-col gap-2">
                <Button className="w-full" onClick={handleSavePdf}>
                  <FileText className="mr-2 h-4 w-4" /> Save as PDF
                </Button>
                <Button variant="outline" className="w-full" onClick={handleSendWhatsApp}>
                  <MessageCircle className="mr-2 h-4 w-4" /> Send via WhatsApp
                </Button>
                <Button variant="ghost" className="w-full" onClick={handleGenerateLater}>
                  Generate Invoice Later
                </Button>
              </DialogFooter>
        </DialogContent>
     )
  }

  return (
    <>
    <MobileLayout>
      <div className="p-4 space-y-4 min-h-screen pb-24">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">Bookings</h1>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="relative w-full sm:w-64">
              <Search size={16} className="absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by booking ID, name, phone"
                className="pl-8 h-10"
              />
            </div>

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

          <Dialog open={paymentFlow?.mode === 'advance'} onOpenChange={(open) => !open && setPaymentFlow(null)}>
            <AdvancePaymentDialog />
          </Dialog>

          <Dialog open={paymentFlow?.mode === 'full'} onOpenChange={(open) => !open && setPaymentFlow(null)}>
            <FullPaymentDialog />
          </Dialog>
          
          <Dialog open={!!invoiceBooking} onOpenChange={(open) => !open && setInvoiceBooking(null)}>
             <InvoiceDialog />
          </Dialog>
        </div>
        
        {showFilters && (
           <div className="flex gap-2 overflow-x-auto pb-2 animate-in slide-in-from-top-2">
              <Badge variant={filterStatus === 'all' ? 'default' : 'outline'} onClick={() => setFilterStatus('all')}>All</Badge>
              <Badge variant={filterStatus === 'booked' ? 'default' : 'outline'} onClick={() => setFilterStatus('booked')}>Booked</Badge>
              <Badge variant={filterStatus === 'confirmed' ? 'default' : 'outline'} onClick={() => { setFilterStatus('confirmed'); setConfirmedPaymentFilter('all'); }}>Confirmed</Badge>
              <Badge variant={filterStatus === 'active' ? 'default' : 'outline'} onClick={() => setFilterStatus('active')}>Active</Badge>
              <Badge variant={filterStatus === 'unpaid' ? 'default' : 'outline'} onClick={() => setFilterStatus('unpaid')}>Unpaid</Badge>
              <Badge variant={filterStatus === 'completed' ? 'default' : 'outline'} onClick={() => setFilterStatus('completed')}>Completed</Badge>
                <Badge variant={filterStatus === 'cancelled' ? 'default' : 'outline'} onClick={() => setFilterStatus('cancelled')}>Cancelled</Badge>
           </div>
        )}

        {showFilters && filterStatus === 'confirmed' && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            <Badge variant={confirmedPaymentFilter === 'all' ? 'default' : 'outline'} onClick={() => setConfirmedPaymentFilter('all')}>All Confirmed</Badge>
            <Badge variant={confirmedPaymentFilter === 'full' ? 'default' : 'outline'} onClick={() => setConfirmedPaymentFilter('full')}>Fully Paid</Badge>
            <Badge variant={confirmedPaymentFilter === 'advance' ? 'default' : 'outline'} onClick={() => setConfirmedPaymentFilter('advance')}>Advance Only</Badge>
          </div>
        )}

        {showFilters && (
           <div className="flex gap-2 items-center mb-2">
             <div className="flex items-center gap-2">
               <label className="text-xs text-muted-foreground">From</label>
               <Input type="date" value={dateFilterStart || ''} onChange={(e) => setDateFilterStart(e.target.value || null)} className="h-8 text-sm" />
             </div>
             <div className="flex items-center gap-2">
               <label className="text-xs text-muted-foreground">To</label>
               <Input type="date" value={dateFilterEnd || ''} onChange={(e) => setDateFilterEnd(e.target.value || null)} className="h-8 text-sm" />
             </div>
             <Button size="sm" variant="ghost" onClick={() => { setDateFilterStart(null); setDateFilterEnd(null); }}>Clear</Button>
           </div>
        )}

        <div className="space-y-4">
          {filteredBookingsWithDate.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">No bookings found</div>
          ) : filteredBookingsWithDate.map((booking) => {
            const bookingBikes = bikes.filter(b => booking.bikeIds.includes(b.id));
            const customer = customers.find(c => c.id === booking.customerId);
            
            return (
              <Card key={booking.id} className="shadow-sm border-zinc-100 overflow-hidden">
                 <div className={cn("border-l-4 h-full", getStatusBorderColor(booking.status))}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold px-2 py-1 bg-blue-100 text-blue-700 rounded">{booking.bookingNumber}</span>
                          {booking.invoiceNumber && <span className="text-xs font-bold px-2 py-1 bg-green-100 text-green-700 rounded">{booking.invoiceNumber}</span>}
                        </div>
                        {bookingBikes.length > 0 ? (
                           <div className="space-y-1">
                              {bookingBikes.map(b => (
                                <h3 key={b.id} className="font-bold text-sm flex items-center gap-1">{getVehicleIcon(b.type)} {getVehicleLabel(b.type)} {b.name} <span className="text-zinc-400 font-normal text-xs">{b.regNo}</span></h3>
                              ))}
                           </div>
                        ) : <h3 className="font-bold text-red-500">No Vehicle Assigned</h3>}
                        
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
                         <span className={cn("uppercase text-[10px] px-2 py-1 rounded font-medium", getStatusColor(booking.status))}>
                           {booking.status}
                         </span>
                         <div className="flex gap-1">
                           {booking.status === 'Completed' && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-400 hover:text-foreground" onClick={() => setInvoiceBooking(booking)}>
                              <FileText size={12} />
                            </Button>
                           )}
                             {booking.status === 'Confirmed' && (
                               <Button variant="ghost" size="icon" className="h-6 w-6 text-green-500 hover:text-green-700" title="Mark as Taken" onClick={() => {
                                  setMarkedTakenBooking(booking);
                                  setOpeningOdometerInput('');
                               }}>
                                  <Play size={12} />
                               </Button>
                            )}
                            {booking.status === 'Active' && (
                               <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-500 hover:text-blue-700" title="Return Vehicle" onClick={() => setReturnFlowBooking(booking)}>
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

                    {booking.closingOdometer !== undefined && (
                      <div className="bg-green-50 border border-green-200 p-2 rounded-md mb-3 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-600">
                            <span className="text-[10px] text-zinc-400">Closing Odometer: </span>
                            <span className="font-medium text-xs">{booking.closingOdometer} km</span>
                          </span>
                          {user?.role === 'admin' && (
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-blue-500" title="Edit odometer">
                              <Edit2 size={12} />
                            </Button>
                          )}
                        </div>
                        {booking.depositDeduction !== undefined && (
                          <p className="text-[10px] text-zinc-600 mt-1">Deposit Deduction: ₹{booking.depositDeduction}</p>
                        )}
                      </div>
                    )}

                    <div className="flex justify-between items-start pt-2 border-t border-zinc-100 gap-3">
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2 font-medium">
                          <IndianRupee size={14} />
                          <span>{booking.totalAmount}</span>
                          <Badge variant={booking.paymentStatus === 'Paid' ? 'default' : booking.paymentStatus === 'Partial' ? 'secondary' : 'outline'}>
                            {booking.paymentStatus}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground leading-tight flex flex-col">
                          <span>Advance: ₹{booking.advanceAmount || 0}{booking.paymentMode ? ` • ${booking.paymentMode}` : ''}</span>
                          {booking.remainingAmount !== undefined && (
                            <span>Balance: ₹{Math.max(booking.remainingAmount, 0)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        {booking.status !== 'Cancelled' && booking.status !== 'Completed' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8">
                                Update Payment Status <ChevronDown size={14} className="ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => handlePaymentSelection(booking, 'unpaid')}>Unpaid</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePaymentSelection(booking, 'advance')}>Advance Paid</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePaymentSelection(booking, 'full')}>Full Paid</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}

                        {customer && booking.status !== 'Cancelled' && booking.status !== 'Completed' && (
                          <Button
                            variant="outline"
                            className="h-[16.85px] min-h-0 px-[6px] py-[2px] text-[10px] leading-none rounded-md border border-green-200 text-green-600 hover:bg-green-50 flex items-center gap-[2px]"
                            onClick={() => {
                              setSelectedBooking(booking);
                              setWhatsappDialogType('booking');
                              setWhatsappDialogOpen(true);
                            }}
                          >
                            <MessageCircle size={12} />
                            Booking
                          </Button>
                        )}

                        {customer && booking.paymentStatus !== 'Paid' && (
                          <Button
                            variant="outline"
                            className="h-[16.85px] min-h-0 px-[6px] py-[2px] text-[10px] leading-none rounded-md border border-green-200 text-green-600 hover:bg-green-50 flex items-center gap-[2px]"
                            onClick={() => {
                              setSelectedBooking(booking);
                              setWhatsappDialogType('payment');
                              setWhatsappDialogOpen(true);
                            }}
                          >
                            <MessageCircle size={12} />
                            Payment
                          </Button>
                        )}

                        {(booking.status === 'Booked' ||
                          booking.status === 'Advance Paid' ||
                          booking.status === 'Confirmed' ||
                          booking.status === 'Active') && (
                          <Button
                            variant="outline"
                            className="h-[16.85px] min-h-0 px-[6px] py-[2px] text-[10px] leading-none rounded-md border border-red-200 text-red-500 hover:bg-red-50 flex items-center gap-[2px]"
                            onClick={() => {
                              if (confirm('Cancel this booking?')) {
                                cancelBooking(booking.id);
                                toast({ title: 'Booking Cancelled', description: 'Status updated.' });
                              }
                            }}
                          >
                            <Ban size={12} />
                            Cancel
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

    {returnFlowBooking && (
      <ReturnFlowModal 
        booking={returnFlowBooking} 
        bikes={bikes}
        customers={customers}
        onClose={() => setReturnFlowBooking(null)}
        onReturn={(updatedBooking, bikeUpdates) => {
          // Update booking with return details
          updateBooking(returnFlowBooking.id, updatedBooking);
          
          // Update bikes with new damages and lastClosingOdometer
          bikeUpdates.forEach(({ bikeId, damages, lastClosingOdometer }) => {
            const bike = bikes.find(b => b.id === bikeId);
            if (bike) {
              updateBike(bikeId, {
                damages: [...(bike.damages || []), ...damages],
                lastClosingOdometer,
                status: 'Available'
              });
            }
          });
          
          setReturnFlowBooking(null);
          toast({ title: "Return Processed", description: "Booking return flow completed." });
        }}
      />
    )}

    {selectedBooking && (
      <WhatsAppDialog
        open={whatsappDialogOpen}
        onOpenChange={setWhatsappDialogOpen}
        booking={selectedBooking}
        customer={customers.find(c => c.id === selectedBooking.customerId)!}
        bikes={bikes}
        title={whatsappDialogType === 'booking' ? 'Booking Confirmation' : whatsappDialogType === 'payment' ? 'Payment Confirmation' : 'Invoice Message'}
        description={whatsappDialogType === 'booking' ? 'Send booking confirmation to customer' : whatsappDialogType === 'payment' ? 'Send payment confirmation to customer' : 'Send invoice details to customer'}
        template={whatsappDialogType === 'booking' ? whatsappTemplates.bookingConfirmation : whatsappDialogType === 'payment' ? whatsappTemplates.paymentConfirmation : whatsappTemplates.invoiceMessage}
        onSent={(message) => {
          updateBooking(selectedBooking.id, {
            whatsappSent: {
              ...selectedBooking.whatsappSent,
              [whatsappDialogType === 'booking' ? 'bookingConfirmation' : whatsappDialogType === 'payment' ? 'paymentConfirmation' : 'invoice']: true
            }
          });
          toast({ title: "Message Sent", description: `${whatsappDialogType.charAt(0).toUpperCase() + whatsappDialogType.slice(1)} message sent via WhatsApp.` });
        }}
      />
    )}

    {markedTakenBooking && (
      <Dialog open={!!markedTakenBooking} onOpenChange={(open) => !open && setMarkedTakenBooking(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark Vehicle as Taken</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                <strong>Booking:</strong> {markedTakenBooking.bookingNumber}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Vehicle:</strong> {bikes.find(b => markedTakenBooking.bikeIds.includes(b.id))?.name || 'Unknown'}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Opening Odometer Reading (km)</label>
              <Input
                type="number"
                placeholder="Enter odometer reading"
                value={openingOdometerInput}
                onChange={(e) => setOpeningOdometerInput(e.target.value)}
                min="0"
              />
              <p className="text-xs text-muted-foreground">
                Please record the current odometer reading before taking the vehicle
              </p>
            </div>

            {bikes.find(b => markedTakenBooking.bikeIds.includes(b.id))?.lastClosingOdometer !== undefined && (
              <div className="bg-blue-50 border border-blue-200 p-2 rounded-md text-sm">
                <p className="text-xs text-muted-foreground">
                  <strong>Last recorded:</strong> {bikes.find(b => markedTakenBooking.bikeIds.includes(b.id))?.lastClosingOdometer} km
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMarkedTakenBooking(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!openingOdometerInput.trim()) {
                  toast({ title: "Error", description: "Please enter odometer reading", variant: "destructive" });
                  return;
                }

                const odometer = Number(openingOdometerInput);
                if (isNaN(odometer) || odometer < 0) {
                  toast({ title: "Error", description: "Please enter a valid odometer reading", variant: "destructive" });
                  return;
                }

                markBookingAsTaken(markedTakenBooking.id, odometer);
                toast({ title: "Vehicle Taken", description: `Booking is now active with opening odometer: ${odometer} km` });
                setMarkedTakenBooking(null);
              }}
            >
              Mark as Taken
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}

/**
 * Return Flow Modal Component
 * Handles: Closing odometer, damage assessment, deposit deduction, invoice generation
 */
const ReturnFlowModal = ({ booking, bikes, customers, onClose, onReturn }: {
  booking: Booking;
  bikes: Bike[];
  customers: Customer[];
  onClose: () => void;
  onReturn: (updatedBooking: Partial<Booking>, bikeUpdates: Array<{ bikeId: string; damages: Damage[]; lastClosingOdometer: number }>) => void;
}) => {
  const [step, setStep] = useState<'odometer' | 'damages' | 'deposit' | 'invoice'>('odometer');
  const [closingOdometer, setClosingOdometer] = useState<string>('');
  const [newDamages, setNewDamages] = useState<Damage[]>([]);
  const [damageNotes, setDamageNotes] = useState<string>('');
  const [depositDeduction, setDepositDeduction] = useState<string>('0');
  const [showInvoice, setShowInvoice] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  
  const bookingBikes = bikes.filter(b => booking.bikeIds.includes(b.id));
  const customer = customers.find(c => c.id === booking.customerId);
  const { toast } = useToast();

  const handleAddDamage = () => {
    const newDamage: Damage = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'Other',
      severity: 'minor',
      date: new Date().toISOString(),
      photoUrls: [],
      notes: '',
      addedBy: 'system',
      addedAt: new Date().toISOString()
    };
    setNewDamages([...newDamages, newDamage]);
  };

  const handleUpdateDamage = (index: number, updates: Partial<Damage>) => {
    const updated = [...newDamages];
    updated[index] = { ...updated[index], ...updates };
    setNewDamages(updated);
  };

  const handleRemoveDamage = (index: number) => {
    setNewDamages(newDamages.filter((_, i) => i !== index));
  };

  const handleNextStep = () => {
    if (step === 'odometer') {
      if (!closingOdometer) {
        toast({ title: "Required", description: "Please enter closing odometer reading.", variant: "destructive" });
        return;
      }
      setStep('damages');
    } else if (step === 'damages') {
      setStep('deposit');
    } else if (step === 'deposit') {
      setStep('invoice');
    }
  };

  const completeReturn = (invoicePendingFlag: boolean) => {
    const updates: Partial<Booking> = {
      closingOdometer: parseInt(closingOdometer),
      depositDeduction: parseFloat(depositDeduction),
      damageNotes: damageNotes || undefined,
      returnedAt: new Date().toISOString(),
      status: 'Completed',
      finalized: true,
      invoicePending: invoicePendingFlag,
    };

    const bikeUpdates = bookingBikes.map(bike => ({
      bikeId: bike.id,
      damages: newDamages,
      lastClosingOdometer: parseInt(closingOdometer)
    }));

    onReturn(updates, bikeUpdates);
    setShowInvoice(false);
  };

  const handleGenerateInvoice = () => completeReturn(false);
  const handleGenerateInvoiceLater = () => completeReturn(true);

  return (
    <>
    <Dialog open={!!booking} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Return Vehicle Flow</DialogTitle>
        </DialogHeader>

        {step === 'odometer' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Booking Details</h3>
              <div className="bg-zinc-50 p-3 rounded text-sm space-y-1">
                <p><span className="font-medium">Booking:</span> {booking.bookingNumber}</p>
                <p><span className="font-medium">Customer:</span> {customer?.name}</p>
                <p><span className="font-medium">Vehicles:</span> {bookingBikes.map(b => b.name).join(', ')}</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Closing Odometer Reading (KM)</label>
              <Input 
                type="number" 
                placeholder="Enter odometer reading" 
                value={closingOdometer}
                onChange={(e) => setClosingOdometer(e.target.value)}
              />
              {bookingBikes[0]?.lastClosingOdometer && (
                <p className="text-xs text-muted-foreground">
                  Last closing: {bookingBikes[0].lastClosingOdometer} km
                </p>
              )}
            </div>

            <Button onClick={handleNextStep} className="w-full">Continue to Damages</Button>
          </div>
        )}

        {step === 'damages' && (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            <div>
              <h3 className="font-semibold mb-2">Previous Damages</h3>
              {bookingBikes[0]?.damages && bookingBikes[0].damages.length > 0 ? (
                <div className="space-y-2">
                  {bookingBikes[0].damages.map((damage, idx) => (
                    <div key={idx} className="bg-yellow-50 border border-yellow-200 p-2 rounded text-sm">
                      <p className="font-medium">{damage.type} <Badge className="ml-2 text-xs" variant={damage.severity === 'major' ? 'destructive' : 'secondary'}>{damage.severity}</Badge></p>
                      <p className="text-xs text-muted-foreground">{damage.notes}</p>
                      {damage.photoUrls && damage.photoUrls.length > 0 && (
                        <div className="flex gap-2 flex-wrap mt-2">
                          {damage.photoUrls.map((photoUrl, pidx) => (
                            <button
                              key={pidx}
                              type="button"
                              className="h-16 w-16 rounded overflow-hidden border"
                              onClick={() => setLightboxPhoto(photoUrl)}
                            >
                              <img src={photoUrl} alt={`Previous damage ${pidx + 1}`} className="h-full w-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No previous damages</p>
              )}
            </div>

            <Separator className="my-3" />

            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">New Damages Found</h3>
                <Button size="sm" variant="outline" onClick={handleAddDamage}>+ Add Damage</Button>
              </div>

              {newDamages.length > 0 ? (
                <div className="space-y-2">
                  {newDamages.map((damage, idx) => (
                    <div key={idx} className="bg-red-50 border border-red-200 p-2 rounded text-sm space-y-2">
                      <div className="flex gap-2">
                        <Select value={damage.type} onValueChange={(val) => handleUpdateDamage(idx, { type: val as DamageType })}>
                          <SelectTrigger className="h-8 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Scratch">Scratch</SelectItem>
                            <SelectItem value="Dent">Dent</SelectItem>
                            <SelectItem value="Broken Mirror">Broken Mirror</SelectItem>
                            <SelectItem value="Tyre">Tyre</SelectItem>
                            <SelectItem value="Mechanical">Mechanical</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={damage.severity} onValueChange={(val) => handleUpdateDamage(idx, { severity: val as any })}>
                          <SelectTrigger className="h-8 text-xs w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minor">Minor</SelectItem>
                            <SelectItem value="major">Major</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500" onClick={() => handleRemoveDamage(idx)}>
                          <X size={14} />
                        </Button>
                      </div>
                      
                      <Input 
                        placeholder="Damage notes..." 
                        className="h-8 text-xs"
                        value={damage.notes}
                        onChange={(e) => handleUpdateDamage(idx, { notes: e.target.value })}
                      />

                      {/* Photo Upload Section */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium block">Photos</label>
                        <div className="flex gap-2">
                          {/* Camera Input */}
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            id={`camera-${idx}`}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const imageData = event.target?.result as string;
                                  handleUpdateDamage(idx, {
                                    photoUrls: [...damage.photoUrls, imageData]
                                  });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs flex-1"
                            onClick={() => document.getElementById(`camera-${idx}`)?.click()}
                          >
                            📷 Camera
                          </Button>

                          {/* Gallery Input */}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            id={`gallery-${idx}`}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const imageData = event.target?.result as string;
                                  handleUpdateDamage(idx, {
                                    photoUrls: [...damage.photoUrls, imageData]
                                  });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs flex-1"
                            onClick={() => document.getElementById(`gallery-${idx}`)?.click()}
                          >
                            🖼️ Gallery
                          </Button>
                        </div>

                        {/* Photo Preview */}
                        {damage.photoUrls && damage.photoUrls.length > 0 && (
                          <div className="flex gap-2 flex-wrap mt-2">
                            {damage.photoUrls.map((photoUrl, pidx) => (
                              <div key={pidx} className="relative">
                                <img
                                  src={photoUrl}
                                  alt={`Damage photo ${pidx + 1}`}
                                  className="h-16 w-16 object-cover rounded border border-red-300"
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="absolute -top-2 -right-2 h-5 w-5 p-0 bg-red-500 hover:bg-red-600 text-white rounded-full"
                                  onClick={() => {
                                    const updated = damage.photoUrls.filter((_, i) => i !== pidx);
                                    handleUpdateDamage(idx, { photoUrls: updated });
                                  }}
                                >
                                  <X size={12} />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No new damages added</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Summary Notes</label>
              <Textarea 
                placeholder="Any additional notes about the return..."
                value={damageNotes}
                onChange={(e) => setDamageNotes(e.target.value)}
                className="h-20 text-xs"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('odometer')} className="flex-1">Back</Button>
              <Button onClick={handleNextStep} className="flex-1">Continue to Deposit</Button>
            </div>
          </div>
        )}

        {step === 'deposit' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm space-y-1">
              <p><span className="font-medium">Original Deposit:</span> ₹{booking.deposit}</p>
              <p><span className="font-medium">Deduction for Damages:</span> ₹{depositDeduction}</p>
              <p className="font-semibold"><span>Refund Amount:</span> ₹{Math.max(0, booking.deposit - parseFloat(depositDeduction))}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Deposit Deduction Amount (₹)</label>
              <Input 
                type="number" 
                placeholder="0" 
                value={depositDeduction}
                onChange={(e) => setDepositDeduction(e.target.value)}
                min="0"
                max={booking.deposit.toString()}
              />
              <p className="text-xs text-muted-foreground">Deduction will be subtracted from the original deposit of ₹{booking.deposit}</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('damages')} className="flex-1">Back</Button>
              <Button onClick={handleNextStep} className="flex-1">Generate Invoice</Button>
            </div>
          </div>
        )}

        {step === 'invoice' && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 p-3 rounded text-sm">
              <p className="font-semibold text-green-900">✓ Return Details Confirmed</p>
            </div>

            <div className="bg-zinc-50 p-3 rounded space-y-2 text-sm">
              <p><span className="font-medium">Booking:</span> {booking.bookingNumber}</p>
              <p><span className="font-medium">Closing Odometer:</span> {closingOdometer} km</p>
              <p><span className="font-medium">Damages Found:</span> {newDamages.length}</p>
              <p><span className="font-medium">Deposit Deduction:</span> ₹{depositDeduction}</p>
              <p className="font-semibold"><span>Refund:</span> ₹{Math.max(0, booking.deposit - parseFloat(depositDeduction))}</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('deposit')} className="flex-1">Back</Button>
              <Button onClick={handleGenerateInvoice} className="flex-1 bg-green-600 hover:bg-green-700">
                Generate Invoice
              </Button>
              <Button variant="secondary" onClick={handleGenerateInvoiceLater} className="flex-1">
                Generate Later
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {lightboxPhoto && (
      <Dialog open={!!lightboxPhoto} onOpenChange={(open) => !open && setLightboxPhoto(null)}>
        <DialogContent className="sm:max-w-lg">
          <img src={lightboxPhoto} alt="Damage" className="w-full h-full object-contain" />
        </DialogContent>
      </Dialog>
    )}
    </>
  );
};
