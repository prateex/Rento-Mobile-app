import { useState, useEffect, useMemo, useCallback } from "react";
import MobileLayout from "@/components/layout/MobileLayout";
import { useStore, Booking, BookingStatus, Customer, Bike, Damage, DamageType, getPermissions } from "@/lib/store";
import { safeString, safeArray, isValidDateString } from "@/lib/safe";
import { validateUUID } from "@/lib/uuidValidation";
import { uiToDbSeverity } from "@/lib/damageSeverity";
import DamageForm, { DamageFormData } from "@/components/DamageForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Calendar as CalendarIcon, Plus, Clock, ArrowRight, IndianRupee, Edit2, Trash2, UserPlus, Phone, MessageCircle, FileText, Filter, X, CornerDownLeft, Ban, Play, Send, Bike as BikeIcon, Car as CarIcon, Search, ChevronDown, ArrowUpDown } from "lucide-react";
import { format, addDays, subDays, setHours, setMinutes, startOfDay } from "date-fns";
import { getAuthContext as getCentralizedAuthContext } from "@/lib/shopIdHelper";
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
import { supabase } from "@/lib/supabase";
import { logDbCall, printDbLogReport } from "@/lib/dbLogger";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh-indicator";
import {
  fromDbBookingStatus,
  fromDbPaymentStatus,
  mapBookingPayloadToDb,
} from "@shared/bookingEnums";

const getVehicleIcon = (type?: string) => {
  return type === 'car' ? <CarIcon size={16} /> : <BikeIcon size={16} />;
};

const getVehicleLabel = (type?: string) => {
  return type === 'car' ? 'Car' : 'Bike';
};

export default function Bookings() {
  const { bookings, bikes, customers, addBooking, addCustomer, updateBooking, deleteBooking, user, settings, updateBike, whatsappTemplates, assignInvoiceNumber, refreshAllData, refreshBookings, generateInvoice, shopDetails, users, pickupPoints, fetchPickupPoints } = useStore();
  const permissions = getPermissions(user?.role || null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [invoiceBooking, setInvoiceBooking] = useState<Booking | null>(null);
  const [returnFlowBooking, setReturnFlowBooking] = useState<Booking | null>(null);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [whatsappDialogType, setWhatsappDialogType] = useState<'booking' | 'payment' | 'invoice'>('booking');
  const [markedTakenBooking, setMarkedTakenBooking] = useState<Booking | null>(null);
  const [openingOdometerInputs, setOpeningOdometerInputs] = useState<Record<string, string>>({});
  const [paymentFlow, setPaymentFlow] = useState<{ booking: Booking; mode: 'advance' | 'full' } | null>(null);
  const [idDocsOpen, setIdDocsOpen] = useState(false);
  const [idDocsLoading, setIdDocsLoading] = useState(false);
  const [idDocs, setIdDocs] = useState<Array<{ id: string; document_type: string; image_url: string }>>([]);
  
  // Status Lifecycle Guardrails
  const isValidStatusTransition = (currentStatus: BookingStatus, newStatus: BookingStatus): boolean => {
    // Final states cannot transition
    if (currentStatus === 'completed' || currentStatus === 'cancelled' || currentStatus === 'expired') return false;
    
    // Valid transitions
    const validTransitions: Record<BookingStatus, BookingStatus[]> = {
      requested: ['confirmed', 'cancelled', 'expired'],
      confirmed: ['active', 'cancelled'],
      active: ['completed'],
      completed: [],
      cancelled: [],
      expired: [],
    };
    
    return validTransitions[currentStatus]?.includes(newStatus) || false;
  };
  
  const isBookingEditable = (booking: Booking): boolean => {
    // Online bookings are read-only
    if (booking.isOnlineBooking) return false;
    
    // Completed, Cancelled bookings are read-only
    // If invoice is generated and locked, booking cannot be edited
    if (booking.invoiceLocked || booking.invoice || booking.invoiceNumber) {
      return false;
    }
    return booking.status !== 'completed' && booking.status !== 'cancelled' && booking.status !== 'expired';
  };
  
  // NEW: Staff can edit/delete booking ONLY if status is Booked or Confirmed (before taken)
  // Owner can edit/delete anytime (except Completed/Cancelled)
  const canUserEditBooking = (booking: Booking): boolean => {
    if (!isBookingEditable(booking)) return false;
    
    // Owner/Admin can edit until invoice is generated
    if (permissions.canEditBooking) return true;

    // Staff can edit ONLY before vehicle is taken
    if (user?.role === 'staff') {
      return booking.status === 'requested' || booking.status === 'confirmed';
    }

    return false;
  };
  
  const canUserDeleteBooking = (booking: Booking): boolean => {
    if (booking.invoiceLocked || booking.invoice || booking.invoiceNumber) return false;

    // Owner/Admin can delete after return but only if invoice not generated
    if (permissions.canDeleteBooking) {
      if (booking.status === 'completed') {
        return !booking.invoiceNumber;
      }
      return booking.status === 'requested' || booking.status === 'confirmed' || booking.status === 'active';
    }

    // Staff can delete only before taken
    if (user?.role === 'staff') {
      return booking.status === 'requested' || booking.status === 'confirmed';
    }

    return false;
  };
  
  const canMarkTaken = (booking: Booking): boolean => {
    // Only Confirmed bookings can be marked as taken
    return booking.status === 'confirmed';
  };
  
  const canReturn = (booking: Booking): boolean => {
    // Only Active bookings can be returned
    return booking.status === 'active';
  };
  
  const canGenerateInvoice = (booking: Booking): boolean => {
    // Only Completed bookings can generate invoice
    return booking.status === 'completed';
  };
  
  const canUpdatePayment = (booking: Booking): boolean => {
    // Cannot update payment for Cancelled, Completed, or invoiced bookings
    if (booking.invoice || booking.invoiceLocked) return false;
    return booking.status !== 'cancelled' && booking.status !== 'completed' && booking.status !== 'expired';
  };

  const canCancelBooking = (booking: Booking): boolean => {
    if (booking.status === 'cancelled' || booking.status === 'completed' || booking.status === 'expired') return false;
    if (booking.isOnlineBooking) {
      return booking.status === 'requested' || booking.status === 'confirmed';
    }
    return booking.status === 'requested' || booking.status === 'confirmed';
  };

  const handleAcceptOnlineBooking = async (booking: Booking) => {
    try {
      if (!booking.isOnlineBooking || booking.status !== 'requested') return;

      const vehicleId = booking.vehicleId || booking.bikeIds?.[0];
      if (!vehicleId) {
        toast({ title: 'Cannot confirm', description: 'No vehicle assigned for this booking.', variant: 'destructive' });
        return;
      }

      const { data: availability, error: availabilityError } = await supabase.rpc('check_vehicle_available', {
        p_vehicle_id: vehicleId,
        p_start_date: booking.pickupAt || booking.startDate,
        p_end_date: booking.dropoffAt || booking.endDate,
      });

      if (availabilityError) {
        throw availabilityError;
      }

      const isAvailable = Array.isArray(availability)
        ? (availability.length === 0 ? true : !!availability[0]?.is_available)
        : true;

      if (!isAvailable) {
        toast({ title: 'Not Available', description: 'Vehicle is no longer available for this time range.', variant: 'destructive' });
        return;
      }

      await updateBooking(booking.id, { status: 'confirmed' });
      toast({ title: 'Booking Confirmed', description: 'Online booking has been confirmed.' });
    } catch (error: any) {
      console.error('Error confirming online booking:', error);
      toast({ title: 'Confirm Failed', description: error.message || 'Unable to confirm booking.', variant: 'destructive' });
    }
  };

  const handleRejectOnlineBooking = async (booking: Booking) => {
    try {
      if (!booking.isOnlineBooking || booking.status !== 'requested') return;

      await updateBooking(booking.id, { status: 'cancelled', cancelledAt: new Date().toISOString() });
      toast({ title: 'Booking Cancelled', description: 'Online booking has been cancelled.' });
    } catch (error: any) {
      console.error('Error rejecting online booking:', error);
      toast({ title: 'Cancel Failed', description: error.message || 'Unable to cancel booking.', variant: 'destructive' });
    }
  };

  const handleViewIdDocuments = async (booking: Booking) => {
    if (!booking.customerAuthId) {
      toast({ title: 'No ID Docs', description: 'Customer ID not available for this booking.', variant: 'destructive' });
      return;
    }

    try {
      setIdDocsLoading(true);
      const { data, error } = await supabase
        .from('customer_id_documents')
        .select('id, document_type, image_url')
        .eq('customer_auth_id', booking.customerAuthId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setIdDocs(data || []);
      setIdDocsOpen(true);
    } catch (error: any) {
      console.error('Failed to load ID documents:', error);
      toast({ title: 'Failed', description: error.message || 'Unable to load ID documents', variant: 'destructive' });
    } finally {
      setIdDocsLoading(false);
    }
  };
  
  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [bookingTypeFilter, setBookingTypeFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilterStart, setDateFilterStart] = useState<string | null>(null);
  const [dateFilterEnd, setDateFilterEnd] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmedPaymentFilter, setConfirmedPaymentFilter] = useState<'all' | 'full' | 'advance'>('all');
  const [filterCustomerId, setFilterCustomerId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'active' | 'completed'>('newest');

  const setFilterStatusPersist = useCallback((status: string) => {
    setFilterStatus(status);
    localStorage.setItem('bookings_filter_status', status);
  }, []);
  
  const { toast } = useToast();
  const [location, navigate] = useLocation();

  // Pull-to-refresh handler - resets all filters
  const handleRefresh = useCallback(async () => {
    setFilterStatusPersist('all');
    setBookingTypeFilter('all');
    setSearchTerm('');
    setDateFilterStart(null);
    setDateFilterEnd(null);
    setConfirmedPaymentFilter('all');
    setFilterCustomerId(null);
    setSortBy('newest');
    setShowFilters(false);
    localStorage.removeItem('bookings_filter_status');
    await refreshAllData();
  }, [refreshAllData, setFilterStatusPersist]);
  
  const { containerRef, pullDistance, isRefreshing, pullProgress } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  useEffect(() => {
    if ((location || '').includes("action=new")) {
      setIsAddOpen(true);
    }
    // Read filter from query and persist
    try {
      const url = new URL(window.location.href);
      const qFilter = url.searchParams.get('filter');
      const qCustomer = url.searchParams.get('customerId');
      if (qFilter) {
        const normalized = qFilter === 'booked' ? 'requested' : qFilter;
        setFilterStatusPersist(normalized);
      } else {
        const saved = localStorage.getItem('bookings_filter_status');
        if (saved) {
          const normalized = saved === 'booked' ? 'requested' : saved;
          setFilterStatusPersist(normalized);
        }
      }
      setFilterCustomerId(qCustomer);
    } catch {}
  }, [location]);

  // Use centralized getAuthContext from shopIdHelper
  const getAuthContext = getCentralizedAuthContext;

  // Fetch bookings from Supabase on mount
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
          .from('bookings')
          .select('*')
          .eq('shop_id', shopId);
        
        if (!error && Array.isArray(rows)) {
          rows.forEach(row => {
            if (!bookings.find(b => b.id === row.id)) {
              addBooking({
                id: row.id,
                bookingNumber: row.booking_number || '',
                bikeIds: Array.isArray(row.vehicle_ids) ? row.vehicle_ids : [],
                customerId: row.customer_id || '',
                pickupPointId: row.pickup_point_id ?? undefined,
                customerAuthId: row.customer_auth_id ?? undefined,
                vehicleId: row.vehicle_id ?? undefined,
                startDate: row.start_date || new Date().toISOString(),
                endDate: row.end_date || new Date().toISOString(),
                rent: Number(row.rent ?? row.total_amount ?? 0),
                deposit: Number(row.deposit ?? 0),
                totalAmount: Number(row.total_amount ?? row.rent ?? 0),
                status: fromDbBookingStatus(row.status),
                paymentStatus: fromDbPaymentStatus(row.payment_status),
                advanceAmount: Number(row.advance_amount || 0),
                remainingAmount: Number(row.balance_amount || 0),
                openingOdometer: row.opening_odometer ?? undefined,
                closingOdometer: row.closing_odometer ?? undefined,
                takenAt: row.taken_at ?? undefined,
                returnedAt: row.returned_at ?? undefined,
                cancelledAt: row.cancelled_at ?? undefined,
                invoiceNumber: row.invoice_number ?? undefined,
                depositDeduction: row.deposit_deduction ?? undefined,
                notes: row.notes ?? undefined,
                isOnlineBooking: row.is_online_booking ?? false,
                customerName: row.customer_name ?? undefined,
                customerPhone: row.customer_phone ?? undefined,
                pickupAt: row.pickup_at ?? undefined,
                dropoffAt: row.dropoff_at ?? undefined,
                history: []
              });
            }
          });
        }
      } catch (e) {
        console.error('Error fetching bookings:', e);
      }
    })();
  }, [user]);

  // Realtime sync for online bookings
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData.session?.user?.id;
        if (!uid) return;

        const { data: userData } = await supabase.from('users').select('shop_id').eq('auth_id', uid).single();
        const shopId = userData?.shop_id;
        if (!shopId) return;

        channel = supabase
          .channel('bookings_realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'bookings', filter: `shop_id=eq.${shopId}` },
            () => {
              refreshBookings();
            }
          )
          .subscribe();
      } catch (e) {
        console.error('Failed to subscribe to booking updates:', e);
      }
    })();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [refreshBookings]);

  const filteredBookings = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return bookings
      .filter(b => {
        if (filterCustomerId && b.customerId !== filterCustomerId) return false;
        
        // Booking type filter (online/offline)
        if (bookingTypeFilter === 'online' && !b.isOnlineBooking) return false;
        if (bookingTypeFilter === 'offline' && b.isOnlineBooking) return false;
        
        // Status filters
        if (filterStatus === 'cancelled') return b.status === 'cancelled';
        if (filterStatus === 'expired') return b.status === 'expired';
        if (b.status === 'cancelled' || b.status === 'expired') return false;
        if (filterStatus === 'active') return b.status === 'active';
        if (filterStatus === 'completed') return b.status === 'completed';
        if (filterStatus === 'requested') return b.status === 'requested';
        if (filterStatus === 'confirmed') {
          const isConfirmed = b.status === 'confirmed';
          if (!isConfirmed) return false;
          if (confirmedPaymentFilter === 'full') return b.paymentStatus === 'paid';
          if (confirmedPaymentFilter === 'advance') return b.paymentStatus === 'partial';
          return true;
        }
        if (filterStatus === 'unpaid') return b.paymentStatus !== 'paid';
        return true;
      })
      .filter(b => {
        if (!normalizedSearch) return true;
        const customer = customers.find(c => c.id === b.customerId);
        const bookingMatch = safeString(b.bookingNumber).toLowerCase().includes(normalizedSearch) || safeString(b.id).toLowerCase().includes(normalizedSearch);
        const nameMatch = safeString(customer?.name).toLowerCase().includes(normalizedSearch);
        const phoneMatch = safeString(customer?.phone).replace(/\s+/g, '').includes(normalizedSearch.replace(/\s+/g, ''));
        const customerNumberMatch = safeString(customer?.customerNumber).toLowerCase().includes(normalizedSearch);
        return bookingMatch || nameMatch || phoneMatch || customerNumberMatch;
      })
      .sort((a, b) => {
        // Apply sorting based on user selection
        if (sortBy === 'active') {
          // Active bookings first
          const aIsActive = a.status === 'active' ? 1 : 0;
          const bIsActive = b.status === 'active' ? 1 : 0;
          if (aIsActive !== bIsActive) return bIsActive - aIsActive;
        } else if (sortBy === 'completed') {
          // Completed bookings first
          const aIsCompleted = a.status === 'completed' ? 1 : 0;
          const bIsCompleted = b.status === 'completed' ? 1 : 0;
          if (aIsCompleted !== bIsCompleted) return bIsCompleted - aIsCompleted;
        }
        
        // Then sort by date (newest or oldest)
        const dateA = a.startDate && isValidDateString(a.startDate) ? new Date(a.startDate).getTime() : 0;
        const dateB = b.startDate && isValidDateString(b.startDate) ? new Date(b.startDate).getTime() : 0;
        
        if (sortBy === 'oldest') {
          return dateA - dateB; // Oldest first
        }
        
        // Default: newest first
        return dateB - dateA;
      });
  }, [bookings, filterStatus, bookingTypeFilter, confirmedPaymentFilter, customers, searchTerm, sortBy]);

  const filteredBookingsWithDate = useMemo(() => {
    let list = filteredBookings;
    if (dateFilterStart || dateFilterEnd) {
      const start = dateFilterStart ? new Date(dateFilterStart) : null;
      const end = dateFilterEnd ? new Date(dateFilterEnd) : null;
      list = list.filter(b => {
        if (!b.startDate || !b.endDate) return false;
        const bStart = new Date(b.startDate);
        const bEnd = new Date(b.endDate);
        if (isNaN(bStart.getTime()) || isNaN(bEnd.getTime())) return false;
        if (start && bEnd <= start) return false;
        if (end && bStart >= addDays(end, 1)) return false;
        return true;
      });
    }
    return list;
  }, [filteredBookings, dateFilterStart, dateFilterEnd]);

  const handlePaymentSelection = (booking: Booking, selection: 'unpaid' | 'advance' | 'full') => {
    if (booking.status === 'cancelled' || booking.status === 'completed' || booking.status === 'expired') return;

    const total = booking.totalAmount || (booking.rent + booking.deposit);
    const history = Array.isArray(booking.history) ? booking.history : [];

    if (selection === 'unpaid') {
      updateBooking(booking.id, {
        paymentStatus: 'unpaid',
        status: 'requested',
        advanceAmount: undefined,
        remainingAmount: total,
        paymentMode: undefined,
        paymentType: undefined,
        paidAt: undefined,
        paidBy: undefined,
        history: [...history, { byUserId: user?.id || 'unknown', timestamp: new Date().toISOString(), changes: 'Marked as Unpaid' }]
      }).catch((error) => console.error('Error updating booking:', error));
      toast({ title: 'Payment Updated', description: 'Booking set to unpaid.' });
      return;
    }

    if (selection === 'advance') {
      setPaymentFlow({ booking, mode: 'advance' });
      return;
    }

    setPaymentFlow({ booking, mode: 'full' });
  };

  const handleMarkTaken = async (booking: Booking, openingOdometers: Record<string, number>) => {
    try {
      const { shopId } = await getAuthContext();
      const now = new Date().toISOString();

      const openingValues = Object.values(openingOdometers || {}).filter((v) => !Number.isNaN(v));
      const bookingOpeningOdometer = openingValues.length > 0 ? Math.min(...openingValues) : 0;
      
      const { data, error } = await supabase
        .from('bookings')
        .update(mapBookingPayloadToDb({
          status: 'active',
          opening_odometer: bookingOpeningOdometer,
          taken_at: now,
        }))
        .eq('id', booking.id)
        .select('status, opening_odometer, taken_at, start_datetime, start_date')
        .single();

      if (error) throw new Error(error.message);

      updateBooking(booking.id, {
        status: fromDbBookingStatus(data.status),
        openingOdometer: data.opening_odometer ?? bookingOpeningOdometer,
        takenAt: data.taken_at ?? now,
      }).catch((error) => console.error('Error updating booking:', error));

      // Guard bikeIds with safeArray
      const bikeIdsToUpdate = safeArray<string>(booking.bikeIds);
      if (bikeIdsToUpdate.length > 0) {
        for (const bikeId of bikeIdsToUpdate) {
          const odometerValue = openingOdometers[bikeId] ?? bookingOpeningOdometer;
          await supabase
            .from('vehicles')
            .update({ status: 'Rented', current_odometer: odometerValue })
            .eq('id', bikeId)
            .eq('shop_id', shopId);
        }
      }
      
      toast({ title: 'Vehicle Taken', description: `Opening odometer recorded. Status: Active.` });
    } catch (e: any) {
      toast({ title: 'Mark Taken Failed', description: e?.message || String(e), variant: 'destructive' });
      throw e;
    }
  };

  const handleCancelBooking = async (booking: Booking) => {
    try {
      const { shopId } = await getAuthContext();
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('bookings')
        .update(mapBookingPayloadToDb({ status: 'cancelled', cancelled_at: now }))
        .eq('id', booking.id)
        .select('status, cancelled_at')
        .single();
      if (error) throw new Error(error.message);

      updateBooking(booking.id, {
        status: fromDbBookingStatus(data.status),
        cancelledAt: data.cancelled_at ?? now,
      }).catch((error) => console.error('Error updating booking:', error));

      // Guard bikeIds with safeArray
      const bikeIdsToRelease = safeArray<string>(booking.bikeIds);
      if (bikeIdsToRelease.length > 0) {
        await supabase
          .from('vehicles')
          .update({ status: 'Available' })
          .in('id', bikeIdsToRelease)
          .eq('shop_id', shopId);
      }
      
      toast({ title: 'Booking Cancelled', description: 'Booking has been cancelled and vehicles released.' });
    } catch (e: any) {
      toast({ title: 'Cancel Failed', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  const handleDeleteBooking = async (booking: Booking) => {
    try {
      await deleteBooking(booking.id);
      toast({ 
        title: "Booking Deleted", 
        description: `Booking ${booking.bookingNumber} has been successfully removed.` 
      });
      await refreshAllData();
    } catch (error: any) {
      const message = error?.message || 'Failed to delete booking';
      toast({ 
        title: "Delete Failed", 
        description: message, 
        variant: "destructive" 
      });
    }
  };

  const AdvancePaymentDialog = () => {
    const flow = paymentFlow;
    if (!flow || flow.mode !== 'advance') return null;

    const booking = flow.booking;
    const total = booking.totalAmount || (booking.rent + booking.deposit);
    const [amount, setAmount] = useState<number>(booking.advanceAmount || 0);
    const [method, setMethod] = useState<'Cash' | 'UPI' | 'Other'>(booking.paymentMode || 'Cash');
    const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
    const [utrNumber, setUtrNumber] = useState<string>('');
    const balancePreview = Math.max(total - amount, 0);

    const handleSaveAdvance = async () => {
      if (!amount || amount <= 0) {
        toast({ title: "Advance Required", description: "Enter a valid advance amount.", variant: "destructive" });
        return;
      }
      if (amount >= total) {
        toast({ title: "Advance Too High", description: "Advance must be less than total amount.", variant: "destructive" });
        return;
      }

      try {
        const authContext = await getAuthContext();
        if (!authContext) return;
        const { shopId, userId } = authContext;

        const paymentPayload = {
          shop_id: shopId,
          booking_id: booking.id,
          amount: amount,
          payment_mode: method,
          utr_number: method === 'UPI' && utrNumber ? utrNumber : null,
          notes: null,
        };

        const { data: payRow, error: payErr } = await supabase
          .from('payments')
          .insert(paymentPayload)
          .select('id')
          .single();
        
        logDbCall({
          file: 'Bookings.tsx',
          function: 'handleRecordAdvancePayment',
          operation: 'INSERT',
          table: 'payments',
          columns: ['id', 'shop_id', 'booking_id', 'amount', 'payment_mode', 'notes'],
          payload: paymentPayload,
          error: payErr?.message,
          success: !payErr,
        });
        
        if (payErr) {
          toast({ title: "Payment Insert Failed", description: payErr.message, variant: "destructive" });
          return;
        }

        const { data: updated, error: updErr } = await supabase
          .from('bookings')
          .update(mapBookingPayloadToDb({
            payment_status: 'partial',
            status: 'confirmed',
            advance_amount: amount,
            balance_amount: balancePreview,
            payment_date: paymentDate ? paymentDate.toISOString() : null,
            utr_number: method === 'UPI' && utrNumber ? utrNumber : null,
          }))
          .eq('id', booking.id)
          .select('id')
          .single();
        if (updErr) {
          toast({ title: "Booking Update Failed", description: updErr.message, variant: "destructive" });
          return;
        }

        const history = Array.isArray(booking.history) ? booking.history : [];
        updateBooking(booking.id, {
          paymentStatus: 'partial',
          status: 'confirmed',
          advanceAmount: amount,
          remainingAmount: balancePreview,
          paymentMode: method,
          paymentType: method,
          history: [...history, { byUserId: user?.id || 'unknown', timestamp: new Date().toISOString(), changes: `Advance ₹${amount} via ${method}` }]
        }).catch((error) => console.error('Error updating booking:', error));
        setPaymentFlow(null);
        toast({ title: "Advance Saved", description: "Booking confirmed with advance payment." });
      } catch (e: any) {
        toast({ title: "Unexpected Error", description: e?.message || String(e), variant: "destructive" });
      }
    };

    return (
      <DialogContent className="sm:max-w-md top-[20%] translate-y-0 max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Record Advance Payment</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 pr-4">
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
            <label className="text-sm font-medium">Payment Date (Optional)</label>
            <Input
              type="date"
              value={paymentDate ? format(paymentDate, 'yyyy-MM-dd') : ''}
              onChange={(e) => setPaymentDate(e.target.value ? new Date(e.target.value) : undefined)}
            />
          </div>
          {method === 'UPI' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">UTR Number (Optional)</label>
              <Input
                type="text"
                placeholder="Enter UTR/Transaction ID"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
              />
            </div>
          )}
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

  const handleReturnFlow = async (
    booking: Booking,
    updatedBooking: Partial<Booking>,
    bikeUpdates: Array<{ bikeId: string; damages: Damage[]; lastClosingOdometer: number }>
  ) => {
    try {
      const { shopId, userId } = await getAuthContext();
      const now = new Date().toISOString();

      const depositDeduction = updatedBooking.depositDeduction ?? booking.depositDeduction ?? 0;
      const refundAmount = Math.max(0, (booking.deposit || 0) - depositDeduction);

      console.log('[Booking Return] Target booking.id:', booking.id);
      console.log('[Booking Return] Update payload:', {
        status: 'completed',
        payment_status: updatedBooking.paymentStatus || booking.paymentStatus,
        closing_odometer: updatedBooking.closingOdometer,
        deposit_deduction: depositDeduction,
        refund_amount: refundAmount,
      });

      // Single DB update - trigger will generate invoice_number if invoice_pending=false
      const { data, error } = await supabase
        .from('bookings')
        .update(mapBookingPayloadToDb({
          status: 'completed',
          payment_status: updatedBooking.paymentStatus || booking.paymentStatus,
          closing_odometer: updatedBooking.closingOdometer,
          deposit_deduction: depositDeduction,
          damage_notes: updatedBooking.damageNotes || null,
          invoice_pending: updatedBooking.invoicePending ?? false,
          refund_amount: refundAmount,
          returned_at: now,
        }))
        .eq('id', booking.id)
        .select('status, payment_status, closing_odometer, returned_at, invoice_number, deposit_deduction, damage_notes, invoice_pending, refund_amount')
        .single();

      if (error) {
        console.error('[Booking Return] DB update error:', error);
        throw new Error(error.message);
      }
      
      console.log('[Booking Return] Success:', data);

      updateBooking(booking.id, {
        ...updatedBooking,
        status: fromDbBookingStatus(data.status),
        paymentStatus: fromDbPaymentStatus(data.payment_status),
        closingOdometer: data.closing_odometer ?? updatedBooking.closingOdometer,
        returnedAt: data.returned_at ?? now,
        invoiceNumber: data.invoice_number,  // DB-generated invoice number
        depositDeduction: data.deposit_deduction ?? depositDeduction,
        damageNotes: data.damage_notes ?? updatedBooking.damageNotes,
        invoicePending: data.invoice_pending ?? updatedBooking.invoicePending,
        refundAmount: data.refund_amount ?? refundAmount,
      }).catch((error) => console.error('Error updating booking:', error));

      for (const { bikeId, damages, lastClosingOdometer } of bikeUpdates) {
        const bike = bikes.find(b => b.id === bikeId);
        console.log('[RETURN FLOW] Persisting damages for bike:', {
          bikeId,
          damagesToPersist: damages.map(d => ({ id: d.id, type: d.type, severity: d.severity })),
        });
        
        // Persist damages to database (CRITICAL: throw on error)
        for (const damage of damages) {
          const { error: damageError } = await supabase
            .from('damages')
            .insert({
              shop_id: shopId,
              user_id: userId,
              vehicle_id: bikeId,
              booking_id: booking.id,
              type: damage.type,
              severity: uiToDbSeverity(damage.severity),
              description: damage.notes || null,
              photo_urls: damage.photoUrls && damage.photoUrls.length > 0 ? damage.photoUrls : null,
              reported_by: userId,
              reported_at: new Date().toISOString(),
            });
          
          if (damageError) {
            console.error('[RETURN FLOW] Damage insert failed:', damageError);
            throw new Error(`Failed to persist damage: ${damageError.message}`);
          }
        }
        
        // Update vehicle metadata only (NOT damages array)
        await supabase
          .from('vehicles')
          .update({
            status: 'Available',
            current_odometer: lastClosingOdometer,
          })
          .eq('id', bikeId)
          .eq('shop_id', shopId);

        if (bike) {
          // Update bike in store with new status and odometer only
          await updateBike(bikeId, {
            lastClosingOdometer: lastClosingOdometer,
            status: 'Available'
            // NOTE: damages will be refreshed from DB sync via refreshAllData()
          }).catch((error) => console.error('Error updating bike:', error));
          
          console.log('[RETURN FLOW] Vehicle updated, damages persisted to public.damages table');
        }
      }

      // CRITICAL: Refresh all data to load newly inserted damages from public.damages table
      console.log('[RETURN FLOW] Refreshing all data to sync damages from DB');
      await refreshAllData();
      console.log('[RETURN FLOW] Damages refreshed successfully');
    } catch (e: any) {
      toast({ title: 'Return Failed', description: e?.message || String(e), variant: 'destructive' });
      throw e;
    }
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
    const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
    const [utrNumber, setUtrNumber] = useState<string>('');
    const remainingAfterPayment = Math.max(balanceAmount - amount, 0);

    const handleSavePayment = async () => {
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

      try {
        const authContext = await getAuthContext();
        if (!authContext) return;
        const { shopId, userId } = authContext;

        const { data: payRow, error: payErr } = await supabase
          .from('payments')
          .insert({
            shop_id: shopId,
            booking_id: booking.id,
            amount: amount,
            payment_mode: method,
            utr_number: method === 'UPI' && utrNumber ? utrNumber : null,
            notes: null,
          })
          .select('id')
          .single();
        if (payErr) {
          toast({ title: "Payment Insert Failed", description: payErr.message, variant: "destructive" });
          return;
        }

        const { data: updated, error: updErr } = await supabase
          .from('bookings')
          .update(mapBookingPayloadToDb({
            payment_status: 'paid',
            status: 'confirmed',
            advance_amount: previousAdvance || 0,
            balance_amount: 0,
            payment_date: paymentDate ? paymentDate.toISOString() : null,
            utr_number: method === 'UPI' && utrNumber ? utrNumber : null,
          }))
          .eq('id', booking.id)
          .select('id')
          .single();
        if (updErr) {
          toast({ title: "Booking Update Failed", description: updErr.message, variant: "destructive" });
          return;
        }

        const now = new Date().toISOString();
        const history = Array.isArray(booking.history) ? booking.history : [];
        updateBooking(booking.id, {
          paymentStatus: 'paid',
          status: 'confirmed',
          paymentMode: method,
          paymentType: method,
          remainingAmount: remainingAfterPayment,
          advanceAmount: previousAdvance || undefined,
          paidAt: now,
          paidBy: user?.id,
          history: [...history, { byUserId: user?.id || 'unknown', timestamp: now, changes: `Full payment ₹${amount} via ${method}` }]
        }).catch((error) => console.error('Error updating booking:', error));
        setPaymentFlow(null);
        toast({ title: "Payment Recorded", description: remainingAfterPayment > 0 ? "Balance still pending." : "Booking marked as fully paid." });
      } catch (e: any) {
        toast({ title: "Unexpected Error", description: e?.message || String(e), variant: "destructive" });
      }
    };

    return (
      <DialogContent className="sm:max-w-md top-[20%] translate-y-0 max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Record Full Payment</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 pr-4">
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
            <label className="text-sm font-medium">Payment Date (Optional)</label>
            <Input
              type="date"
              value={paymentDate ? format(paymentDate, 'yyyy-MM-dd') : ''}
              onChange={(e) => setPaymentDate(e.target.value ? new Date(e.target.value) : undefined)}
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
          
          {method === 'UPI' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">UTR Number (Optional)</label>
              <Input
                type="text"
                placeholder="Enter UTR/Transaction ID"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
              />
            </div>
          )}
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
    const { settings, addBooking, pickupPoints, fetchPickupPoints } = useStore();
    const [dateError, setDateError] = useState<string | null>(null);
    const [backdateError, setBackdateError] = useState<string | null>(null);
    const [overlapError, setOverlapError] = useState<string | null>(null);
    const [vehicleSearch, setVehicleSearch] = useState<string>("");
    const [datesConfirmed, setDatesConfirmed] = useState<boolean>(!!initialData);
    const [damagePreviewBike, setDamagePreviewBike] = useState<Bike | null>(null);
    const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
    
    const minDate = subDays(new Date(), 7);
    const defaultPickupPoint = pickupPoints.find((point) => point.isDefault) || pickupPoints[0];

    useEffect(() => {
      if (pickupPoints.length === 0) {
        void fetchPickupPoints();
      }
    }, [pickupPoints.length, fetchPickupPoints]);
    
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
    const [submitting, setSubmitting] = useState(false);
    
    const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
      defaultValues: {
        bikeIds: initialData?.bikeIds || [],
        customerId: initialData?.customerId || '',
        pickupPointId: initialData?.pickupPointId || defaultPickupPoint?.id || '',
        rent: initialData?.rent || 0,
        deposit: initialData?.deposit || 0
      }
    });
    const hours12 = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
    const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

    useEffect(() => {
      if (!watch('pickupPointId') && defaultPickupPoint?.id) {
        setValue('pickupPointId', defaultPickupPoint.id, { shouldValidate: true });
      }
    }, [defaultPickupPoint?.id, setValue, watch]);
    
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
        if (safeArray<string>(initialData?.bikeIds).includes(bike.id)) return true;
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
          b.status !== 'cancelled' && b.status !== 'completed' && b.status !== 'expired' &&
          b.startDate && b.endDate && safeArray<string>(b.bikeIds).includes(bike.id) &&
          !(new Date(b.endDate).getTime() <= startDT.getTime() || new Date(b.startDate).getTime() >= endDT.getTime())
        );
        return !hasOverlap;
      });
    };
    
    const filteredAvailableVehicles = getAvailableVehicles().filter(b =>
      safeString(b.name).toLowerCase().includes(vehicleSearch.toLowerCase()) ||
      safeString(b.regNo).toLowerCase().includes(vehicleSearch.toLowerCase())
    );

    const selectedBikeIds = watch('bikeIds') || [];
    
    // Check for double booking conflicts
    const checkForOverlaps = (): string | null => {
      const startDT = getStartDateTime();
      const endDT = getEndDateTime();
      
      if (!startDT || !endDT || selectedBikeIds.length === 0) return null;
      
      for (const bikeId of selectedBikeIds) {
        const bike = bikes.find(b => b.id === bikeId);
        if (!bike) continue;
        
        const conflictingBooking = bookings.find(b => 
          b.id !== initialData?.id &&
          b.status !== 'cancelled' && b.status !== 'completed' && b.status !== 'expired' &&
          b.startDate && b.endDate && safeArray<string>(b.bikeIds).includes(bikeId) &&
          !(new Date(b.endDate).getTime() <= startDT.getTime() || new Date(b.startDate).getTime() >= endDT.getTime())
        );
        
        if (conflictingBooking) {
          const customer = customers.find(c => c.id === conflictingBooking.customerId);
          return `${bike.name || bike.regNo} is already booked for ${customer?.name || 'another customer'} during this period`;
        }
      }
      
      return null;
    };
    
    useEffect(() => {
      const startDT = getStartDateTime();
      const endDT = getEndDateTime();
      
      if (!startDT || !endDT) {
        setDateError(null);
        setBackdateError(null);
        setOverlapError(null);
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
    
    // Validate for double booking when bikes are selected or dates change
    useEffect(() => {
      const overlapMsg = checkForOverlaps();
      setOverlapError(overlapMsg);
    }, [selectedBikeIds, startDate, startHour12, startMinute, startAmPm, endDate, endHour12, endMinute, endAmPm]);
    
    useEffect(() => {
       if (selectedBikeIds.length > 0 && !initialData) {
          const startDT = getStartDateTime();
          const endDT = getEndDateTime();
          
          if (!startDT || !endDT) return;
          
          const start = startDT.getTime();
          const end = endDT.getTime();
          const diffDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
          
          const totalDailyPrice = bikes
             .filter(b => safeArray<string>(selectedBikeIds).includes(b.id))
             .reduce((sum, b) => {
               // CRITICAL: Defensive check to prevent NaN if pricePerDay is missing
               const price = typeof b.pricePerDay === 'number' && b.pricePerDay > 0 ? b.pricePerDay : 0;
               return sum + price;
             }, 0);

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

    const onSubmit = async (data: any) => {
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

      if (pickupPoints.length === 0) {
        toast({ title: "Pickup Point Required", description: "Please add a pickup point to start accepting bookings.", variant: "destructive" });
        return;
      }

      if (!data.pickupPointId) {
        toast({ title: "Pickup Point Required", description: "Please select a pickup point.", variant: "destructive" });
        return;
      }

      const hasOverlap = bookings.some(b => 
        b.id !== initialData?.id &&
        b.status !== 'cancelled' && b.status !== 'completed' && b.status !== 'expired' &&
        b.startDate && b.endDate &&
        safeArray<string>(b.bikeIds).some(id => safeArray<string>(data.bikeIds).includes(id)) &&
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
        setSubmitting(true);
        try {
          await updateBooking(initialData.id, {
            ...data,
            startDate: startDateISO,
            endDate: endDateISO,
            rent: Number(data.rent),
            deposit: Number(data.deposit),
            totalAmount: total,
            history: [...(initialData.history || []), { byUserId: user?.id || 'unknown', timestamp: new Date().toISOString(), changes: 'Edited details' }]
          });
          toast({ title: "Booking Updated", description: "Changes saved." });
          onClose();
        } catch (error: any) {
          console.error('[Booking Edit] Error:', error);
          toast({ 
            title: "Error", 
            description: error?.message || "Failed to update booking",
            variant: "destructive"
          });
        } finally {
          setSubmitting(false);
        }
        return;
      } else {
        try {
          const { uid, shopId, userId } = await getAuthContext();

          const payload = mapBookingPayloadToDb({
            shop_id: shopId,
            customer_id: data.customerId,
            pickup_point_id: data.pickupPointId,
            vehicle_ids: data.bikeIds,
            start_date: startDateISO,
            end_date: endDateISO,
            start_datetime: startDateISO,
            end_datetime: endDateISO,
            status: 'requested',
            rent: Number(data.rent),
            deposit: Number(data.deposit),
            total_amount: total,
            advance_amount: 0,
            balance_amount: total,
            payment_status: 'unpaid',
            notes: null,
          });

          const { data: inserted, error } = await supabase
            .from('bookings')
            .insert(payload)
            .select('id, booking_number, customer_id, pickup_point_id, vehicle_ids, start_date, end_date, start_datetime, end_datetime, total_amount, rent, deposit, advance_amount, balance_amount, payment_status, status, opening_odometer, closing_odometer, taken_at, returned_at, cancelled_at, notes, invoice_number')
            .single();

          if (error) {
            toast({ title: "Insert Failed", description: error.message, variant: "destructive" });
            return;
          }

          // Immediately update with start_datetime and end_datetime to ensure they're set
          const datetimeUpdate = {
            start_datetime: startDateISO,
            end_datetime: endDateISO
          };
          await supabase
            .from('bookings')
            .update(datetimeUpdate)
            .eq('id', inserted.id)
            .select('start_datetime, end_datetime');

          const newBooking: Booking = {
            id: inserted.id,
            bookingNumber: inserted.booking_number,
            bikeIds: Array.isArray(inserted.vehicle_ids) ? inserted.vehicle_ids : [],
            customerId: inserted.customer_id,
            pickupPointId: inserted.pickup_point_id ?? undefined,
            startDate: inserted.start_datetime || inserted.start_date,
            endDate: inserted.end_datetime || inserted.end_date,
            rent: Number(inserted.rent ?? data.rent),
            deposit: Number(inserted.deposit ?? data.deposit),
            totalAmount: Number(inserted.total_amount),
            status: fromDbBookingStatus(inserted.status),
            paymentStatus: fromDbPaymentStatus(inserted.payment_status),
            remainingAmount: Number(inserted.balance_amount),
            invoiceNumber: inserted.invoice_number ?? undefined,
            notes: inserted.notes ?? undefined,
            openingOdometer: inserted.opening_odometer ?? undefined,
            closingOdometer: inserted.closing_odometer ?? undefined,
            takenAt: inserted.taken_at ?? undefined,
            returnedAt: inserted.returned_at ?? undefined,
            cancelledAt: inserted.cancelled_at ?? undefined,
            history: []
          };

          addBooking(newBooking);

          const { count } = await supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true });
          toast({ title: "Booking Created", description: `Saved to database. Total bookings: ${count ?? 'n/a'}.` });
        } catch (e: any) {
          toast({ title: "Unexpected Error", description: e?.message || String(e), variant: "destructive" });
          return;
        }
      }
      onClose();
    };

    const toggleBikeSelection = (bikeId: string) => {
      const current = watch('bikeIds') || [];
      let newValue: string[];
      if (safeArray<string>(current).includes(bikeId)) {
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
                          checked={safeArray<string>(selectedBikeIds).includes(bike.id)}
                          onCheckedChange={() => toggleBikeSelection(bike.id)}
                        />
                        <label
                          htmlFor={`bike-${bike.id}`}
                          className="text-sm font-medium leading-none flex-1 flex items-center gap-2 cursor-pointer"
                        >
                          <span className="flex items-center gap-1">{getVehicleIcon(bike.type)} {getVehicleLabel(bike.type)}</span>
                          <div className="flex flex-col">
                            <span>{bike.name}</span>
                            <span className="text-xs text-muted-foreground">{bike.regNo} • ₹{typeof bike.pricePerDay === 'number' && bike.pricePerDay > 0 ? bike.pricePerDay : '—'}/day</span>
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
                <label className="text-sm font-medium">Pickup Point</label>
                {pickupPoints.length === 0 && (
                  <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    Please add a pickup point to start accepting bookings.
                  </div>
                )}
                <input type="hidden" {...register('pickupPointId', {
                  validate: (value) => !!value || 'Select a pickup point'
                })} />
                <Select
                  onValueChange={(val) => setValue('pickupPointId', val, { shouldValidate: true })}
                  value={watch('pickupPointId') || ''}
                  disabled={pickupPoints.length === 0}
                >
                  <SelectTrigger className={cn(!watch('pickupPointId') && errors.pickupPointId && "border-red-500")}>
                    <SelectValue placeholder={pickupPoints.length === 0 ? "Add a pickup point in Settings" : "Select pickup point"} />
                  </SelectTrigger>
                  <SelectContent>
                    {pickupPoints.map((point) => (
                      <SelectItem key={point.id} value={point.id}>
                        {point.name}{point.isDefault ? ' (Default)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.pickupPointId && pickupPoints.length > 0 && !watch('pickupPointId') && (
                  <p className="text-xs text-red-500">{errors.pickupPointId.message as string}</p>
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

              {/* Overlap Error Alert */}
              {overlapError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-800">
                    <p className="font-semibold">Double Booking Detected</p>
                    <p className="text-xs mt-1">{overlapError}</p>
                  </div>
                </div>
              )}

              {/* Rent & Deposit */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rent (₹)</label>
                  <Input type="number" {...register("rent", { required: true })} disabled={initialData && !canUserEditBooking(initialData)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Deposit (₹)</label>
                  <Input type="number" {...register("deposit")} defaultValue={0} disabled={initialData && !canUserEditBooking(initialData)} />
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
                disabled={submitting || pickupPoints.length === 0 || !!overlapError || !!dateError || !!backdateError}
              >
                {submitting ? 'Saving...' : (initialData ? 'Save Changes' : 'Create Booking')}
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

    const onSubmit = async (data: any) => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData.session?.user?.id;
        try { console.log("AUTH UID (Bookings:AddCustomer)", uid); } catch {}
        if (!uid) {
          toast({ title: "Not Signed In", description: "Please sign in before adding customers.", variant: "destructive" });
          return;
        }
        const { data: shops, error: shopError } = await supabase
          .from('rental_shops')
          .select('*')
          .limit(1);
        if (shopError) {
          toast({ title: "Shop Lookup Failed", description: shopError.message, variant: "destructive" });
          return;
        }
        const shopId = shops && shops[0]?.id;
        if (!shopId) {
          toast({ title: "No Shop Found", description: "Create a shop before adding customers.", variant: "destructive" });
          return;
        }
        const payload = {
          shop_id: shopId,
          user_id: uid,
          full_name: data.name,
          phone: data.phone,
          email: null,
          address: null,
          id_type: data.idType || 'Aadhaar',
          id_photos: { front: 'mock-url' },
          documents: null,
          status: 'Verified',
          notes: null,
        };
        const { data: inserted, error } = await supabase
          .from('customers')
          .insert(payload)
          .select('id,full_name,phone,id_type,id_photos,status,created_at')
          .single();
        if (error) {
          toast({ title: "Insert Failed", description: error.message, variant: "destructive" });
          return;
        }
        addCustomer({
          id: inserted.id,
          name: inserted.full_name,
          phone: inserted.phone,
          idType: inserted.id_type,
          idPhotos: inserted.id_photos || { front: 'mock-url' },
          status: inserted.status || 'Verified',
          dateAdded: inserted.created_at || new Date().toISOString(),
        });
        setIsAddCustomerOpen(false);
        const { count } = await supabase
          .from('customers')
          .select('id', { count: 'exact', head: true });
        toast({ title: "Customer Added", description: `New customer saved. Total customers: ${count ?? 'n/a'}.` });
      } catch (e: any) {
        toast({ title: "Unexpected Error", description: e?.message || String(e), variant: "destructive" });
      }
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
     const bookingBikes = bikes.filter(b => safeArray<string>(invoiceBooking.bikeIds).includes(b.id));

     const handleGenerateInvoice = async () => {
       const invoice = await generateInvoice(invoiceBooking.id);
       if (invoice) {
         toast({ 
           title: "Invoice Generated", 
           description: `Invoice ${invoice.invoiceNumber} created successfully.` 
         });
         setInvoiceBooking(null);
       } else {
         toast({ 
           title: "Invoice Generation Failed", 
           description: "Unable to generate invoice. Check console for details.",
           variant: "destructive"
         });
       }
     };

     return (
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden">
           <DialogHeader>
             <DialogTitle>Generate Invoice</DialogTitle>
           </DialogHeader>
           <div className="flex-1 overflow-y-auto p-4 border rounded-md bg-zinc-50 text-sm space-y-4">
              <div className="flex justify-between border-b pb-4">
                 <div>
                   <h3 className="font-bold text-lg">{shopDetails.name || 'City Bike Rentals'}</h3>
                   <p className="text-zinc-500">{shopDetails.address || '123 MG Road'}</p>
                   <p className="text-zinc-500">Phone: {shopDetails.phone || '9999999999'}</p>
                 </div>
                 <div className="text-right">
                   <p className="font-bold">INVOICE</p>
                   <p>Date: {format(new Date(), 'MMM dd, yyyy')}</p>
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
                       <span className="flex items-center gap-2">
                         <span className="flex items-center gap-1">
                           {getVehicleIcon(bike.type)} {getVehicleLabel(bike.type)}
                         </span> 
                         {bike.name} ({bike.regNo})
                       </span>
                       <span>₹{typeof bike.pricePerDay === 'number' && bike.pricePerDay > 0 ? bike.pricePerDay : '—'}/day</span>
                    </div>
                 ))}
                 <div className="flex justify-between text-zinc-500 text-xs mt-2">
                    <span>Start: {format(new Date(invoiceBooking.startDate), 'MMM dd, HH:mm')}</span>
                    <span>End: {format(new Date(invoiceBooking.endDate), 'MMM dd, HH:mm')}</span>
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
                 {(invoiceBooking.depositDeduction || invoiceBooking.depositDeduction === 0) && (
                   <>
                     <div className="flex justify-between text-red-600">
                        <span>Deposit Deduction</span>
                        <span>-₹{invoiceBooking.depositDeduction}</span>
                     </div>
                     <div className="flex justify-between text-green-600">
                        <span>Deposit Refund</span>
                        <span>₹{invoiceBooking.deposit - (invoiceBooking.depositDeduction || 0)}</span>
                     </div>
                   </>
                 )}
                 <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                    <span>Total Payable</span>
                    <span>₹{invoiceBooking.rent - (invoiceBooking.depositDeduction || 0)}</span>
                 </div>
              </div>
           </div>
           <div className="flex flex-col gap-2 border-t pt-4">
             <Button className="w-full" onClick={handleGenerateInvoice}>
               <FileText className="mr-2 h-4 w-4" /> Generate Invoice
             </Button>
             <Button variant="ghost" className="w-full" onClick={() => setInvoiceBooking(null)}>
               Cancel
             </Button>
           </div>
        </DialogContent>
     )
  }

  return (
    <>
    <MobileLayout>
      <div ref={containerRef} className="p-4 space-y-4 min-h-screen pb-24 relative">
        <PullToRefreshIndicator 
          pullDistance={pullDistance} 
          isRefreshing={isRefreshing} 
          pullProgress={pullProgress} 
        />
        
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">Bookings</h1>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="relative w-full sm:w-48">
              <Search size={16} className="absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by booking ID, name, phone"
                className="pl-8 h-10 text-sm"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full">
                  <ArrowUpDown size={18} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortBy('newest')}>
                  {sortBy === 'newest' && '✓ '}Newest First
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('oldest')}>
                  {sortBy === 'oldest' && '✓ '}Oldest First
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('active')}>
                  {sortBy === 'active' && '✓ '}Active Bookings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('completed')}>
                  {sortBy === 'completed' && '✓ '}Completed Bookings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

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
             <DialogContent className="sm:max-w-md top-[20%] translate-y-0 max-h-[90vh] flex flex-col overflow-hidden">
               <DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
               <div className="flex-1 overflow-y-auto pr-4">
                 <AddCustomerForm />
               </div>
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

          <Dialog open={idDocsOpen} onOpenChange={setIdDocsOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Customer ID Documents</DialogTitle>
              </DialogHeader>
              {idDocsLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : idDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents found.</p>
              ) : (
                <div className="space-y-3">
                  {idDocs.map((doc) => (
                    <div key={doc.id} className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">{doc.document_type}</p>
                      <img src={doc.image_url} className="w-full rounded border" />
                    </div>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
        
        {showFilters && (
           <div className="flex gap-2 overflow-x-auto pb-2 animate-in slide-in-from-top-2">
              <Badge variant={filterStatus === 'all' ? 'default' : 'outline'} onClick={() => setFilterStatusPersist('all')}>All</Badge>
              <Badge variant={filterStatus === 'requested' ? 'default' : 'outline'} onClick={() => setFilterStatusPersist('requested')}>Requested</Badge>
              <Badge variant={filterStatus === 'confirmed' ? 'default' : 'outline'} onClick={() => { setFilterStatusPersist('confirmed'); setConfirmedPaymentFilter('all'); }}>Confirmed</Badge>
              <Badge variant={filterStatus === 'active' ? 'default' : 'outline'} onClick={() => setFilterStatusPersist('active')}>Active</Badge>
              <Badge variant={filterStatus === 'unpaid' ? 'default' : 'outline'} onClick={() => setFilterStatusPersist('unpaid')}>Unpaid</Badge>
              <Badge variant={filterStatus === 'completed' ? 'default' : 'outline'} onClick={() => setFilterStatusPersist('completed')}>Completed</Badge>
              <Badge variant={filterStatus === 'cancelled' ? 'default' : 'outline'} onClick={() => setFilterStatusPersist('cancelled')}>Cancelled</Badge>
              <Badge variant={filterStatus === 'expired' ? 'default' : 'outline'} onClick={() => setFilterStatusPersist('expired')}>Expired</Badge>
           </div>
        )}

        {/* Booking Type Filter (Online/Offline) */}
        {showFilters && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            <span className="text-xs text-muted-foreground self-center">Type:</span>
            <Badge 
              variant={bookingTypeFilter === 'all' ? 'default' : 'outline'} 
              onClick={() => setBookingTypeFilter('all')}
            >
              All
            </Badge>
            <Badge 
              variant={bookingTypeFilter === 'online' ? 'default' : 'outline'} 
              onClick={() => setBookingTypeFilter('online')}
              className={bookingTypeFilter === 'online' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
            >
              Online
            </Badge>
            <Badge 
              variant={bookingTypeFilter === 'offline' ? 'default' : 'outline'} 
              onClick={() => setBookingTypeFilter('offline')}
            >
              Offline
            </Badge>
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
           <div className="space-y-2">
             <div className="flex gap-2 items-center">
               <Button 
                 size="sm" 
                 variant="outline" 
                 className="h-8"
                 onClick={() => {
                   const today = format(new Date(), 'yyyy-MM-dd');
                   setDateFilterStart(today);
                   setDateFilterEnd(today);
                 }}
               >
                 Today
               </Button>
               <Button 
                 size="sm" 
                 variant="outline" 
                 className="h-8"
                 onClick={() => {
                   const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
                   setDateFilterStart(tomorrow);
                   setDateFilterEnd(tomorrow);
                 }}
               >
                 Tomorrow
               </Button>
             </div>
             <div className="flex gap-2 items-center">
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
           </div>
        )}

        <div className="space-y-4">
          {filteredBookingsWithDate.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">No bookings found</div>
          ) : filteredBookingsWithDate.map((booking) => {
            const bookingBikes = bikes.filter(b => safeArray<string>(booking.bikeIds).includes(b.id));
            const customer = customers.find(c => c.id === booking.customerId);
            const pickupPoint = pickupPoints.find((point) => point.id === booking.pickupPointId);
            const displayName = booking.isOnlineBooking ? (booking.customerName || customer?.name) : customer?.name;
            const displayPhone = booking.isOnlineBooking ? (booking.customerPhone || customer?.phone) : customer?.phone;
            const pickupDisplay = booking.isOnlineBooking ? (booking.pickupAt || booking.startDate) : booking.startDate;
            const dropoffDisplay = booking.isOnlineBooking ? (booking.dropoffAt || booking.endDate) : booking.endDate;
            
            return (
              <Card key={booking.id} className="shadow-sm border-zinc-100 overflow-hidden">
                 <div className={cn("border-l-4 h-full", getStatusBorderColor(booking.status))}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold px-2 py-1 bg-blue-100 text-blue-700 rounded">{booking.bookingNumber}</span>
                          {booking.invoiceNumber && <span className="text-xs font-bold px-2 py-1 bg-green-100 text-green-700 rounded">{booking.invoiceNumber}</span>}
                          {/* ONLINE/OFFLINE badge */}
                          <span className={cn(
                            "text-xs font-medium px-2 py-1 rounded",
                            booking.isOnlineBooking 
                              ? "bg-yellow-100 text-yellow-700" 
                              : "bg-gray-100 text-gray-600"
                          )}>
                            {booking.isOnlineBooking ? "ONLINE" : "OFFLINE"}
                          </span>
                        </div>
                        {bookingBikes.length > 0 ? (
                           <div className="space-y-1">
                              {bookingBikes.map(b => (
                                <h3 key={b.id} className="font-bold text-sm flex items-center gap-1">{getVehicleIcon(b.type)} {getVehicleLabel(b.type)} {b.name} <span className="text-zinc-400 font-normal text-xs">{b.regNo}</span></h3>
                              ))}
                           </div>
                        ) : <h3 className="font-bold text-red-500">No Vehicle Assigned</h3>}
                        
                        <div className="flex items-center gap-2 mt-2">
                          <p className="text-sm text-muted-foreground">{displayName}</p>
                          {displayPhone && (
                            <div className="flex gap-1">
                              <a href={`tel:${displayPhone}`} className="p-1 rounded-full bg-green-50 text-green-600 hover:bg-green-100">
                                <Phone size={12} />
                              </a>
                              <a href={`https://wa.me/91${displayPhone}?text=Hello ${displayName || ''}, regarding your booking.`} target="_blank" className="p-1 rounded-full bg-green-50 text-green-600 hover:bg-green-100">
                                <MessageCircle size={12} />
                              </a>
                            </div>
                          )}
                        </div>
                        {booking.isOnlineBooking && (
                          <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                            <p className="text-[10px] text-yellow-800">
                              🔒 Online booking – details locked
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                         <span className={cn("uppercase text-[10px] px-2 py-1 rounded font-medium", getStatusColor(booking.status))}>
                           {booking.status}
                         </span>
                         {booking.isOnlineBooking && booking.status === 'requested' && permissions.canEditBooking && (
                           <div className="flex gap-2">
                             <Button
                               size="sm"
                               className="h-7 bg-green-600 hover:bg-green-700 text-white"
                               onClick={() => handleAcceptOnlineBooking(booking)}
                             >
                               Accept
                             </Button>
                             <Button
                               size="sm"
                               variant="outline"
                               className="h-7 border-red-200 text-red-600 hover:bg-red-50"
                               onClick={() => handleRejectOnlineBooking(booking)}
                             >
                               Reject
                             </Button>
                           </div>
                         )}
                         <div className="flex gap-1">
                           {canGenerateInvoice(booking) && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className={cn(
                                "h-6 w-6",
                                booking.invoiceNumber ? "text-green-500 hover:text-green-700" : "text-zinc-400 hover:text-foreground"
                              )}
                              title={booking.invoiceNumber ? "View / Print Invoice" : "Generate Invoice"}
                              onClick={() => {
                                if (booking.invoiceNumber) {
                                  // Navigate to invoice print page if invoice exists
                                  navigate(`/invoice/${booking.id}`);
                                } else {
                                  // Open generate dialog if invoice doesn't exist
                                  setInvoiceBooking(booking);
                                }
                              }}
                            >
                              <FileText size={12} />
                            </Button>
                           )}
                             {canMarkTaken(booking) && (
                               <Button variant="ghost" size="icon" className="h-6 w-6 text-green-500 hover:text-green-700" title="Mark as Taken" onClick={() => {
                                  setMarkedTakenBooking(booking);
                               const defaults = Object.fromEntries(safeArray<string>(booking.bikeIds).map(id => [id, '']));
                               setOpeningOdometerInputs(defaults);
                               }}>
                                  <Play size={12} />
                               </Button>
                            )}
                            {canReturn(booking) && (
                               <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-500 hover:text-blue-700" title="Return Vehicle" onClick={() => setReturnFlowBooking(booking)}>
                                  <CornerDownLeft size={12} />
                               </Button>
                            )}
                            {canUserEditBooking(booking) && (
                               <>
                                 <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-400 hover:text-foreground" onClick={() => setEditingBooking(booking)}>
                                   <Edit2 size={12} />
                                 </Button>
                                 <Button variant="ghost" size="icon" className="h-6 w-6 text-red-300 hover:text-red-600" onClick={() => {
                                    if (confirm(`Delete booking ${booking.bookingNumber}? This action cannot be undone.`)) {
                                      handleDeleteBooking(booking);
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
                        <span className="font-medium text-xs">
                          {pickupDisplay ? format(new Date(pickupDisplay), 'MMM dd, HH:mm') : 'N/A'}
                        </span>
                      </div>
                      <ArrowRight size={14} className="text-zinc-300" />
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-zinc-400">End</span>
                        <span className="font-medium text-xs">
                          {dropoffDisplay ? format(new Date(dropoffDisplay), 'MMM dd, HH:mm') : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground mb-3">
                      {pickupPoint
                        ? `Pickup: ${pickupPoint.name}${pickupPoint.addressText ? ` - ${pickupPoint.addressText}` : ''}`
                        : 'Pickup: Not set'}
                    </div>

                    {booking.closingOdometer !== undefined && (
                      <div className="bg-green-50 border border-green-200 p-2 rounded-md mb-3 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-600">
                            <span className="text-[10px] text-zinc-400">Closing Odometer: </span>
                            <span className="font-medium text-xs">{booking.closingOdometer} km</span>
                          </span>
                          {canUserEditBooking(booking) && (
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
                          <Badge variant={booking.paymentStatus === 'paid' ? 'default' : booking.paymentStatus === 'partial' ? 'secondary' : 'outline'}>
                            {booking.paymentStatus}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground leading-tight flex flex-col">
                          <span>Rent: ₹{booking.rent} • Deposit: ₹{booking.deposit}</span>
                          <span>Advance: ₹{booking.advanceAmount || 0}{booking.paymentMode ? ` • ${booking.paymentMode}` : ''}</span>
                          {booking.remainingAmount !== undefined && (
                            <span>Balance: ₹{Math.max(booking.remainingAmount, 0)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        {booking.isOnlineBooking && booking.customerAuthId && (
                          <Button
                            variant="outline"
                            className="h-[16.85px] min-h-0 px-[6px] py-[2px] text-[10px] leading-none rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 flex items-center gap-[2px]"
                            onClick={() => handleViewIdDocuments(booking)}
                            disabled={idDocsLoading}
                          >
                            ID Docs
                          </Button>
                        )}
                        {permissions.canEditBooking && canUpdatePayment(booking) && (
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

                        {customer && isBookingEditable(booking) && (
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

                        {customer && booking.paymentStatus !== 'paid' && isBookingEditable(booking) && (
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

                        {canCancelBooking(booking) && (
                          <Button
                            variant="outline"
                            className="h-[16.85px] min-h-0 px-[6px] py-[2px] text-[10px] leading-none rounded-md border border-red-200 text-red-500 hover:bg-red-50 flex items-center gap-[2px]"
                            onClick={() => {
                              if (confirm('Cancel this booking?')) {
                                handleCancelBooking(booking);
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
          assignInvoiceNumber={assignInvoiceNumber}
        onClose={() => setReturnFlowBooking(null)}
        onReturn={(updatedBooking, bikeUpdates) => {
          handleReturnFlow(returnFlowBooking, updatedBooking, bikeUpdates)
            .then(() => {
              setReturnFlowBooking(null);
              toast({ title: "Return Processed", description: "Booking return flow completed." });
            })
            .catch(() => {});
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
          }).catch((error) => console.error('Error updating booking:', error));
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
                <strong>Vehicles:</strong> {safeArray<string>(markedTakenBooking.bikeIds).map(id => bikes.find(b => b.id === id)?.name || 'Unknown').join(', ')}
              </p>
            </div>

            <div className="space-y-3">
              {bikes.filter(b => safeArray<string>(markedTakenBooking.bikeIds).includes(b.id)).map((bike) => (
                <div key={bike.id} className="border border-zinc-200 rounded-lg p-3 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">{bike.name}</p>
                    <span className="text-xs text-muted-foreground">{bike.regNo}</span>
                  </div>
                  <Input
                    type="number"
                    placeholder="Opening odometer (km)"
                    value={openingOdometerInputs[bike.id] || ''}
                    onChange={(e) => setOpeningOdometerInputs((prev) => ({ ...prev, [bike.id]: e.target.value }))}
                    min="0"
                  />
                  {bike.lastClosingOdometer !== undefined && (
                    <p className="text-[10px] text-muted-foreground">Last recorded: {bike.lastClosingOdometer} km</p>
                  )}
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Record the odometer for each vehicle before marking the booking as Active.
              </p>
            </div>
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
                const bookingBikeIds = safeArray<string>(markedTakenBooking.bikeIds);
                const invalidBike = bookingBikeIds.find((id) => !openingOdometerInputs[id] || isNaN(Number(openingOdometerInputs[id])));
                if (invalidBike) {
                  const bikeName = bikes.find(b => b.id === invalidBike)?.name || 'vehicle';
                  toast({ title: "Error", description: `Enter a valid odometer for ${bikeName}`, variant: "destructive" });
                  return;
                }

                const odometerRecord = bookingBikeIds.reduce<Record<string, number>>((acc, id) => {
                  acc[id] = Number(openingOdometerInputs[id]);
                  return acc;
                }, {});

                handleMarkTaken(markedTakenBooking, odometerRecord)
                  .then(() => {
                    toast({ title: "Vehicle Taken", description: "Booking is now active with recorded odometer readings." });
                    setMarkedTakenBooking(null);
                  })
                  .catch(() => {});
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
const ReturnFlowModal = ({ booking, bikes, customers, assignInvoiceNumber, onClose, onReturn }: {
  booking: Booking;
  bikes: Bike[];
  customers: Customer[];
  assignInvoiceNumber: (bookingId: string) => void;
  onClose: () => void;
  onReturn: (updatedBooking: Partial<Booking>, bikeUpdates: Array<{ bikeId: string; damages: Damage[]; lastClosingOdometer: number }>) => void;
}) => {
  const [step, setStep] = useState<'odometer' | 'damages' | 'deposit' | 'invoice'>('odometer');
  const [closingOdometers, setClosingOdometers] = useState<Record<string, string>>({});
  const [damagesByBike, setDamagesByBike] = useState<Record<string, Damage[]>>({});
  const [damageNotes, setDamageNotes] = useState<string>('');
  const [depositDeduction, setDepositDeduction] = useState<string>('0');
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  
  // Damage form modal for return flow
  const [isReturnDamageFormOpen, setIsReturnDamageFormOpen] = useState(false);
  const [selectedBikeForDamage, setSelectedBikeForDamage] = useState<Bike | null>(null);
  const [isReturnDamageFormLoading, setIsReturnDamageFormLoading] = useState(false);
  
  const bookingBikes = useMemo(() => bikes.filter(b => safeArray<string>(booking.bikeIds).includes(b.id)), [bikes, booking.bikeIds]);
  const customer = customers.find(c => c.id === booking.customerId);
  const { toast } = useToast();

  useEffect(() => {
    const defaultClosings = Object.fromEntries(bookingBikes.map(b => [b.id, '']));
    const defaultDamages = Object.fromEntries(bookingBikes.map(b => [b.id, [] as Damage[]]));
    setClosingOdometers(defaultClosings);
    setDamagesByBike(defaultDamages);
  }, [booking.id, bookingBikes]);

  const updateClosingOdometer = (bikeId: string, value: string) => {
    setClosingOdometers((prev) => ({ ...prev, [bikeId]: value }));
  };

  const addDamageForBike = (bikeId: string) => {
    const bike = bookingBikes.find(b => b.id === bikeId);
    if (bike) {
      console.log('[DAMAGE TRACE][return flow open] bike', bike);
      setSelectedBikeForDamage(bike);
      setIsReturnDamageFormOpen(true);
    }
  };

  const updateDamageForBike = (bikeId: string, index: number, updates: Partial<Damage>) => {
    setDamagesByBike((prev) => {
      const list = [...(prev[bikeId] || [])];
      list[index] = { ...list[index], ...updates };
      return { ...prev, [bikeId]: list };
    });
  };

  const removeDamageForBike = (bikeId: string, index: number) => {
    setDamagesByBike((prev) => {
      const list = [...(prev[bikeId] || [])];
      list.splice(index, 1);
      return { ...prev, [bikeId]: list };
    });
  };

  const handleReturnDamageFormSubmit = async (data: DamageFormData) => {
    if (!selectedBikeForDamage) {
      throw new Error('No bike selected');
    }

    try {
      setIsReturnDamageFormLoading(true);
      
      // Add damage to temporary damages list (NOT persisted yet)
      const newDamage: Damage = {
        id: `temp-${Date.now()}-${Math.random()}`, // Temp ID, will be replaced with DB UUID on final submit
        type: data.type,
        severity: data.severity,
        date: new Date().toISOString(),
        notes: data.notes,
        photoUrls: data.photoUrls,
        addedBy: 'return_flow',
        addedAt: new Date().toISOString(),
        isPersisted: false, // CRITICAL: temp damages are not yet in DB
      };
      console.log('[DAMAGE CREATED]', newDamage);
      console.log('[DAMAGE TRACE][return flow create] damage', newDamage);

      setDamagesByBike((prev) => ({
        ...prev,
        [selectedBikeForDamage.id]: [...(prev[selectedBikeForDamage.id] || []), newDamage],
      }));

      setIsReturnDamageFormOpen(false);
      setSelectedBikeForDamage(null);
    } finally {
      setIsReturnDamageFormLoading(false);
    }
  };

  const handleNextStep = () => {
    if (step === 'odometer') {
      const missingBike = bookingBikes.find((bike) => closingOdometers[bike.id]?.trim() === '' || isNaN(Number(closingOdometers[bike.id])));
      if (missingBike) {
        toast({ title: 'Required', description: `Enter closing odometer for ${missingBike.name}.`, variant: 'destructive' });
        return;
      }

      if (booking.openingOdometer) {
        const lowerReading = bookingBikes.find((bike) => Number(closingOdometers[bike.id]) < (booking.openingOdometer || 0));
        if (lowerReading) {
          toast({ title: 'Invalid Odometer', description: `${lowerReading.name} cannot have a reading below opening odometer.`, variant: 'destructive' });
          return;
        }
      }
      setStep('damages');
    } else if (step === 'damages') {
      setStep('deposit');
    } else if (step === 'deposit') {
      setStep('invoice');
    }
  };

  const completeReturn = (invoicePendingFlag: boolean) => {
    // Don't call assignInvoiceNumber separately - let the DB trigger handle it in handleReturnFlow
    
    const closingNumbers = bookingBikes.map((bike) => Number(closingOdometers[bike.id] || 0)).filter((n) => !Number.isNaN(n));
    const closingForBooking = closingNumbers.length ? Math.max(...closingNumbers) : undefined;
    const parsedDeduction = Number(depositDeduction) || 0;

    const updates: Partial<Booking> = {
      closingOdometer: closingForBooking,
      depositDeduction: parsedDeduction,
      damageNotes: damageNotes || undefined,
      returnedAt: new Date().toISOString(),
      status: 'completed',
      finalized: true,
      invoicePending: invoicePendingFlag,
    };

    const bikeUpdates = bookingBikes.map((bike) => ({
      bikeId: bike.id,
      damages: damagesByBike[bike.id] || [],
      lastClosingOdometer: Number(closingOdometers[bike.id] || closingForBooking || 0),
    }));

    onReturn(updates, bikeUpdates);
  };

  const handleGenerateInvoice = () => completeReturn(false);
  const handleGenerateInvoiceLater = () => completeReturn(true);

  return (
    <>
    <Dialog open={!!booking} onOpenChange={onClose}>
      <DialogContent className="max-w-lg overflow-y-auto max-h-[90vh]">
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
                <p><span className="font-medium">Vehicles:</span> {bookingBikes.map(b => `${b.name} (${b.regNo})`).join(', ')}</p>
              </div>
            </div>

            <div className="space-y-3">
              {bookingBikes.map((bike) => {
                const closingValue = closingOdometers[bike.id] || '';
                const lastClosing = bike.lastClosingOdometer;
                return (
                  <div key={bike.id} className="border border-zinc-200 rounded-lg p-3 bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">{bike.name}</p>
                      <span className="text-xs text-muted-foreground">{bike.regNo}</span>
                    </div>
                    <Input
                      type="number"
                      placeholder="Closing odometer (km)"
                      value={closingValue}
                      onChange={(e) => updateClosingOdometer(bike.id, e.target.value)}
                    />
                    {lastClosing !== undefined && (
                      <p className="text-[10px] text-muted-foreground">Last closing: {lastClosing} km</p>
                    )}
                  </div>
                );
              })}
            </div>

            <Button onClick={handleNextStep} className="w-full">Continue to Damages</Button>
          </div>
        )}

        {step === 'damages' && (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {bookingBikes.map((bike) => {
              const bikeDamages = damagesByBike[bike.id] || [];
              return (
                <div key={bike.id} className="space-y-3 border border-zinc-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-sm">{bike.name}</h3>
                      <p className="text-[11px] text-muted-foreground">{bike.regNo}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => addDamageForBike(bike.id)}>+ Add Damage</Button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium">Previous Damages</p>
                    {bike.damages && bike.damages.length > 0 ? (
                      <div className="space-y-2">
                        {bike.damages.map((damage, idx) => (
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
                      <p className="text-xs text-muted-foreground">No previous damages</p>
                    )}
                  </div>

                  {bikeDamages.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium">New Damages</p>
                      {bikeDamages.map((damage, idx) => (
                        <div key={idx} className="bg-red-50 border border-red-200 p-2 rounded text-sm space-y-2">
                          <div className="flex gap-2">
                            <Select value={damage.type} onValueChange={(val) => updateDamageForBike(bike.id, idx, { type: val as DamageType })}>
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
                            <Select value={damage.severity} onValueChange={(val) => updateDamageForBike(bike.id, idx, { severity: val as any })}>
                              <SelectTrigger className="h-8 text-xs w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="minor">Minor</SelectItem>
                                <SelectItem value="major">Major</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500" onClick={() => removeDamageForBike(bike.id, idx)}>
                              <X size={14} />
                            </Button>
                          </div>
                          
                          <Input 
                            placeholder="Damage notes..." 
                            className="h-8 text-xs"
                            value={damage.notes}
                            onChange={(e) => updateDamageForBike(bike.id, idx, { notes: e.target.value })}
                          />

                          <div className="space-y-2">
                            <label className="text-xs font-medium block">Photos</label>
                            <div className="flex gap-2">
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                id={`camera-${bike.id}-${idx}`}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                      const imageData = event.target?.result as string;
                                      updateDamageForBike(bike.id, idx, {
                                        photoUrls: [...(damage.photoUrls || []), imageData]
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
                                onClick={() => document.getElementById(`camera-${bike.id}-${idx}`)?.click()}
                              >
                                📷 Camera
                              </Button>

                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                id={`gallery-${bike.id}-${idx}`}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                      const imageData = event.target?.result as string;
                                      updateDamageForBike(bike.id, idx, {
                                        photoUrls: [...(damage.photoUrls || []), imageData]
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
                                onClick={() => document.getElementById(`gallery-${bike.id}-${idx}`)?.click()}
                              >
                                🖼️ Gallery
                              </Button>
                            </div>

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
                                        const updated = (damage.photoUrls || []).filter((_, i) => i !== pidx);
                                        updateDamageForBike(bike.id, idx, { photoUrls: updated });
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
                  )}
                </div>
              );
            })}

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
            {/* Show total KM driven */}
            {booking.openingOdometer && (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm space-y-1">
                {bookingBikes.map((bike) => {
                  const closing = Number(closingOdometers[bike.id] || 0);
                  const opening = booking.openingOdometer || 0;
                  const kmDriven = Math.max(0, closing - opening);
                  return (
                    <p key={bike.id}>
                      <span className="font-medium">{bike.name}:</span> {kmDriven} km driven (Opening: {opening} km → Closing: {closing} km)
                    </p>
                  );
                })}
              </div>
            )}

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
              <p><span className="font-medium">Closing Odometer:</span> {bookingBikes.map((bike) => `${closingOdometers[bike.id] || '—'} km`).join(', ')}</p>
              {booking.openingOdometer && (
                <p><span className="font-medium">Total KM Driven:</span> {bookingBikes.map((bike) => {
                  const closing = Number(closingOdometers[bike.id] || 0);
                  const opening = booking.openingOdometer || 0;
                  return `${Math.max(0, closing - opening)} km`;
                }).join(', ')}</p>
              )}
              <p><span className="font-medium">Damages Found:</span> {Object.values(damagesByBike).reduce((acc, list) => acc + list.length, 0)}</p>
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

    {/* Damage Form Modal for Return Flow */}
    <Dialog open={isReturnDamageFormOpen} onOpenChange={setIsReturnDamageFormOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report Damage - {selectedBikeForDamage?.name}</DialogTitle>
        </DialogHeader>
        {selectedBikeForDamage && (
          <DamageForm
            onSubmit={handleReturnDamageFormSubmit}
            onCancel={() => {
              setIsReturnDamageFormOpen(false);
              setSelectedBikeForDamage(null);
            }}
            isLoading={isReturnDamageFormLoading}
            title="Report Damage"
            submitLabel="Add Damage"
          />
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
