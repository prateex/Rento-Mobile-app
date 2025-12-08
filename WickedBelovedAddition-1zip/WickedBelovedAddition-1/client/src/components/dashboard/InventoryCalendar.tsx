import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useStore, Bike, Booking, Customer } from '@/lib/store';
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  isSameDay,
  startOfDay,
  endOfDay,
  isWithinInterval,
  isToday,
} from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Phone, MessageCircle, User, ChevronLeft, ChevronRight, Calendar, ArrowLeftRight } from 'lucide-react';
import { useCalendarSegments, getSegmentsForBikeDay, CalendarSegment } from '@/hooks/useCalendarSegments';

interface InventoryCalendarProps {
  className?: string;
}

type ViewMode = 'month' | 'week' | 'day';

const SLANT_SIZE = 8;
const BAR_HEIGHT = 20;
const MAX_VISIBLE_STACKS = 3;

export default function InventoryCalendar({ className }: InventoryCalendarProps) {
  const { bikes, bookings, customers } = useStore();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => {
    switch (viewMode) {
      case 'month':
        return eachDayOfInterval({
          start: startOfMonth(currentDate),
          end: endOfMonth(currentDate),
        });
      case 'week':
        return eachDayOfInterval({
          start: startOfWeek(currentDate, { weekStartsOn: 1 }),
          end: endOfWeek(currentDate, { weekStartsOn: 1 }),
        });
      case 'day':
        return [startOfDay(currentDate)];
      default:
        return [];
    }
  }, [viewMode, currentDate]);

  const { bikeSegmentMap } = useCalendarSegments({
    bikes,
    bookings,
    days,
  });

  const navigatePrev = useCallback(() => {
    switch (viewMode) {
      case 'month':
        setCurrentDate((d) => subMonths(d, 1));
        break;
      case 'week':
        setCurrentDate((d) => subWeeks(d, 1));
        break;
      case 'day':
        setCurrentDate((d) => subDays(d, 1));
        break;
    }
  }, [viewMode]);

  const navigateNext = useCallback(() => {
    switch (viewMode) {
      case 'month':
        setCurrentDate((d) => addMonths(d, 1));
        break;
      case 'week':
        setCurrentDate((d) => addWeeks(d, 1));
        break;
      case 'day':
        setCurrentDate((d) => addDays(d, 1));
        break;
    }
  }, [viewMode]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const getBookingsForDate = useCallback(
    (date: Date) => {
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      
      return bookings.filter((b) => {
        if (b.status === 'Deleted' || b.status === 'Cancelled') return false;
        const bookingStart = parseISO(b.startDate);
        const bookingEnd = parseISO(b.endDate);
        
        const startsBeforeOrOnDayEnd = bookingStart <= dayEnd;
        const endsAfterDayStart = bookingEnd > dayStart;
        
        return startsBeforeOrOnDayEnd && endsAfterDayStart;
      });
    },
    [bookings]
  );

  const getAvailableBikesForDate = useCallback(
    (date: Date) => {
      const dayBookings = getBookingsForDate(date);
      const bookedBikeIds = dayBookings.flatMap((b) => b.bikeIds);
      return bikes.filter((b) => !bookedBikeIds.includes(b.id) && b.status !== 'Maintenance');
    },
    [bikes, getBookingsForDate]
  );

  const handleDayClick = useCallback((day: Date) => {
    setSelectedDate(day);
    setIsDayModalOpen(true);
  }, []);

  const handleBookingClick = useCallback((booking: Booking) => {
    setSelectedBooking(booking);
    setIsBookingModalOpen(true);
  }, []);

  const getTitle = () => {
    switch (viewMode) {
      case 'month':
        return format(currentDate, 'MMMM yyyy');
      case 'week':
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy');
    }
  };

  const customer = selectedBooking ? customers.find((c) => c.id === selectedBooking.customerId) : null;
  const selectedBookingBikes = selectedBooking ? bikes.filter((b) => selectedBooking.bikeIds.includes(b.id)) : [];
  const availableBikesOnSelectedDate = selectedDate ? getAvailableBikesForDate(selectedDate) : [];
  const bookingsOnSelectedDate = selectedDate ? getBookingsForDate(selectedDate) : [];

  const columnWidth = viewMode === 'month' ? 40 : viewMode === 'week' ? 80 : 200;

  return (
    <div className={cn('bg-white rounded-lg border border-zinc-200 overflow-hidden', className)}>
      <div className="p-3 border-b border-zinc-100 bg-zinc-50">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-bold text-sm">Inventory Calendar</h3>
            <p className="text-xs text-muted-foreground">Click bookings or dates for details</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={navigatePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={goToToday}>
              Today
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">{getTitle()}</h4>
          <div className="flex gap-1">
            {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
              <Button
                key={mode}
                variant={viewMode === mode ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs capitalize"
                onClick={() => setViewMode(mode)}
              >
                {mode}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto" ref={scrollContainerRef}>
        <div className="min-w-max">
          <div className="flex border-b border-zinc-200">
            <div className="w-[140px] min-w-[140px] p-2 bg-zinc-50 border-r border-zinc-200 sticky left-0 z-10">
              <span className="text-xs font-medium text-muted-foreground">Bikes</span>
            </div>
            {days.map((day, index) => (
              <div
                key={index}
                className={cn(
                  'flex-shrink-0 p-2 text-center border-r border-zinc-100 cursor-pointer hover:bg-zinc-50 transition-colors',
                  isToday(day) && 'bg-primary/10'
                )}
                style={{ width: columnWidth }}
                onClick={() => handleDayClick(day)}
              >
                <div className="text-[10px] text-muted-foreground uppercase">
                  {format(day, viewMode === 'day' ? 'EEEE' : 'EEE')}
                </div>
                <div className={cn('text-sm font-semibold', isToday(day) && 'text-primary')}>
                  {format(day, 'd')}
                </div>
              </div>
            ))}
          </div>

          {bikes.map((bike) => (
            <BikeRow
              key={bike.id}
              bike={bike}
              bikes={bikes}
              days={days}
              bikeSegmentMap={bikeSegmentMap}
              columnWidth={columnWidth}
              customers={customers}
              onBookingClick={handleBookingClick}
              onDayClick={handleDayClick}
            />
          ))}
        </div>
      </div>

      <BookingDetailModal
        open={isBookingModalOpen}
        onOpenChange={setIsBookingModalOpen}
        booking={selectedBooking}
        customer={customer}
        bikes={selectedBookingBikes}
      />

      <DayDetailModal
        open={isDayModalOpen}
        onOpenChange={setIsDayModalOpen}
        date={selectedDate}
        availableBikes={availableBikesOnSelectedDate}
        dayBookings={bookingsOnSelectedDate}
        customers={customers}
        bikes={bikes}
        onBookingClick={(booking) => {
          setSelectedBooking(booking);
          setIsDayModalOpen(false);
          setIsBookingModalOpen(true);
        }}
      />
    </div>
  );
}

interface BikeRowProps {
  bike: Bike;
  bikes: Bike[];
  days: Date[];
  bikeSegmentMap: Map<string, Map<number, CalendarSegment[]>>;
  columnWidth: number;
  customers: Customer[];
  onBookingClick: (booking: Booking) => void;
  onDayClick: (day: Date) => void;
}

function BikeRow({ bike, bikes, days, bikeSegmentMap, columnWidth, customers, onBookingClick, onDayClick }: BikeRowProps) {
  const rowSegments = useMemo(() => {
    const allSegments: CalendarSegment[] = [];
    days.forEach((_, dayIndex) => {
      const daySegments = getSegmentsForBikeDay(bikeSegmentMap, bike.id, dayIndex);
      allSegments.push(...daySegments);
    });
    return allSegments;
  }, [bikeSegmentMap, bike.id, days]);

  const maxStack = Math.min(
    Math.max(...rowSegments.map((s) => s.stackIndex + 1), 1),
    MAX_VISIBLE_STACKS
  );
  const rowHeight = Math.max(40, maxStack * (BAR_HEIGHT + 4) + 8);

  return (
    <div className="flex border-b border-zinc-100">
      <div className="w-[140px] min-w-[140px] p-2 bg-zinc-50 border-r border-zinc-200 sticky left-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md overflow-hidden flex-shrink-0 bg-zinc-100">
            <img src={bike.image} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">{bike.name}</p>
            <Badge
              variant="outline"
              className={cn(
                'text-[9px] px-1 py-0',
                bike.status === 'Available'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : bike.status === 'Booked'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              )}
            >
              {bike.status}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex relative" style={{ height: rowHeight }}>
        {days.map((day, dayIndex) => {
          const daySegments = getSegmentsForBikeDay(bikeSegmentMap, bike.id, dayIndex);
          const hiddenCount = Math.max(0, daySegments.length - MAX_VISIBLE_STACKS);

          return (
            <div
              key={dayIndex}
              className={cn(
                'flex-shrink-0 border-r border-zinc-100 relative cursor-pointer hover:bg-zinc-50/50 transition-colors',
                isToday(day) && 'bg-primary/5'
              )}
              style={{ width: columnWidth }}
              onClick={() => onDayClick(day)}
            >
              {daySegments.slice(0, MAX_VISIBLE_STACKS).map((segment) => (
                <BookingBar
                  key={segment.id}
                  segment={segment}
                  customers={customers}
                  bikes={bikes}
                  onClick={(e) => {
                    e.stopPropagation();
                    onBookingClick(segment.booking);
                  }}
                />
              ))}
              {hiddenCount > 0 && (
                <div
                  className="absolute bottom-1 right-1 text-[9px] bg-zinc-200 text-zinc-600 px-1 rounded"
                  style={{ zIndex: 5 }}
                >
                  +{hiddenCount}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface BookingBarProps {
  segment: CalendarSegment;
  customers: Customer[];
  bikes: Bike[];
  onClick: (e: React.MouseEvent) => void;
}

function BookingBar({ segment, customers, bikes, onClick }: BookingBarProps) {
  const customer = customers.find((c) => c.id === segment.booking.customerId);
  const bookingBikes = (bikes || []).filter((b) => segment.booking.bikeIds.includes(b.id));
  const statusColor = getStatusColor(segment.booking.status);
  const statusBorderColor = getStatusBorderColor(segment.booking.status);

  const clipPath = useMemo(() => {
    const slant = SLANT_SIZE;
    if (segment.isStartPartial && segment.isEndPartial) {
      return `polygon(${slant}px 0, calc(100% - ${slant}px) 0, 100% 50%, calc(100% - ${slant}px) 100%, ${slant}px 100%, 0 50%)`;
    } else if (segment.isStartPartial) {
      return `polygon(${slant}px 0, 100% 0, 100% 100%, ${slant}px 100%, 0 50%)`;
    } else if (segment.isEndPartial) {
      return `polygon(0 0, calc(100% - ${slant}px) 0, 100% 50%, calc(100% - ${slant}px) 100%, 0 100%)`;
    }
    return undefined;
  }, [segment.isStartPartial, segment.isEndPartial]);

  const top = 4 + segment.stackIndex * (BAR_HEIGHT + 4);

  return (
    <div
      className="absolute cursor-pointer transition-all hover:brightness-95 hover:z-10"
      style={{
        left: `${segment.leftPct}%`,
        width: `${segment.widthPct}%`,
        top,
        height: BAR_HEIGHT,
        backgroundColor: statusColor,
        borderLeft: segment.isFirstDay && !segment.isStartPartial ? `2px solid ${statusBorderColor}` : undefined,
        borderRight: segment.isLastDay && !segment.isEndPartial ? `2px solid ${statusBorderColor}` : undefined,
        borderTop: `1px solid ${statusBorderColor}`,
        borderBottom: `1px solid ${statusBorderColor}`,
        clipPath,
        zIndex: segment.stackIndex + 1,
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Booking for ${customer?.name || 'Unknown'} from ${format(parseISO(segment.booking.startDate), 'MMM d')} to ${format(parseISO(segment.booking.endDate), 'MMM d')}`}
    >
      <div className="px-1 py-0.5 text-[9px] font-medium truncate text-zinc-800 h-full flex items-center gap-1">
        {segment.isFirstDay && (
          <>
            <span>{customer?.name}</span>
            {bookingBikes.length > 0 && (
              <span className="text-zinc-500">
                ({bookingBikes.map(b => b.regNo || b.name).join(', ')})
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface BookingDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking | null;
  customer: Customer | null | undefined;
  bikes: Bike[];
}

function BookingDetailModal({ open, onOpenChange, booking, customer, bikes }: BookingDetailModalProps) {
  const { bookings, updatePaymentStatus } = useStore();
  
  if (!booking) return null;
  
  const currentBooking = bookings.find(b => b.id === booking.id) || booking;
  const paymentStatus = currentBooking.paymentStatus || 'Unpaid';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Booking Details</DialogTitle>
          <DialogDescription className="sr-only">
            View booking information including customer details, dates, and payment information
          </DialogDescription>
        </DialogHeader>
        {customer && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center">
                <User className="h-6 w-6 text-zinc-500" />
              </div>
              <div>
                <p className="font-bold">{customer.name}</p>
                <p className="text-sm text-muted-foreground">{customer.phone}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <a href={`tel:${customer.phone}`}>
                  <Phone className="h-4 w-4 mr-2" /> Call
                </a>
              </Button>
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <a href={`https://wa.me/${customer.phone}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
                </a>
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-2 bg-zinc-50 rounded-lg">
                <p className="text-xs text-muted-foreground">Start</p>
                <p className="font-medium">{format(parseISO(booking.startDate), 'MMM dd, HH:mm')}</p>
              </div>
              <div className="p-2 bg-zinc-50 rounded-lg">
                <p className="text-xs text-muted-foreground">End</p>
                <p className="font-medium">{format(parseISO(booking.endDate), 'MMM dd, HH:mm')}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Bikes</p>
              <div className="flex flex-wrap gap-1">
                {bikes.map((bike) => (
                  <Badge key={bike.id} variant="outline">
                    {bike.name} {bike.regNo && <span className="text-zinc-400 ml-1">({bike.regNo})</span>}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-green-50 rounded-lg">
                <p className="text-xs text-green-700">Rent</p>
                <p className="font-bold">₹{booking.rent}</p>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700">Deposit</p>
                <p className="font-bold">₹{booking.deposit}</p>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg">
                <p className="text-xs text-amber-700">Total</p>
                <p className="font-bold">₹{booking.totalAmount}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Payment Status</p>
              <div className="flex gap-1">
                {(['Unpaid', 'Partial', 'Paid'] as const).map((status) => (
                  <Button
                    key={status}
                    variant={paymentStatus === status ? 'default' : 'outline'}
                    size="sm"
                    className={cn(
                      'flex-1 text-xs',
                      paymentStatus === status && status === 'Paid' && 'bg-green-600 hover:bg-green-700',
                      paymentStatus === status && status === 'Partial' && 'bg-amber-500 hover:bg-amber-600',
                      paymentStatus === status && status === 'Unpaid' && 'bg-red-500 hover:bg-red-600'
                    )}
                    onClick={() => updatePaymentStatus(currentBooking.id, status)}
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>

            <Badge
              className={cn(
                'w-full justify-center py-1',
                currentBooking.status === 'Active'
                  ? 'bg-green-100 text-green-700'
                  : currentBooking.status === 'Booked'
                  ? 'bg-blue-100 text-blue-700'
                  : currentBooking.status === 'Completed'
                  ? 'bg-zinc-100 text-zinc-700'
                  : 'bg-red-100 text-red-700'
              )}
            >
              {currentBooking.status}
            </Badge>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface DayDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  availableBikes: Bike[];
  dayBookings: Booking[];
  customers: Customer[];
  bikes: Bike[];
  onBookingClick: (booking: Booking) => void;
}

function DayDetailModal({
  open,
  onOpenChange,
  date,
  availableBikes,
  dayBookings,
  customers,
  bikes,
  onBookingClick,
}: DayDetailModalProps) {
  if (!date) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{format(date, 'EEEE, MMMM dd, yyyy')}</DialogTitle>
          <DialogDescription className="sr-only">
            View available bikes and bookings for this date
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-green-50 rounded-lg border border-green-100">
              <p className="text-xs text-green-700 font-medium">Available</p>
              <p className="text-2xl font-bold">{availableBikes.length}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-700 font-medium">Bookings</p>
              <p className="text-2xl font-bold">{dayBookings.length}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Available Bikes</p>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {availableBikes.length > 0 ? (
                availableBikes.map((bike) => (
                  <Badge key={bike.id} variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    {bike.name} {bike.regNo && <span className="text-green-500">({bike.regNo})</span>}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No bikes available</p>
              )}
            </div>
          </div>

          {dayBookings.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Bookings on this day</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {dayBookings.map((booking) => {
                  const bookingCustomer = customers.find((c) => c.id === booking.customerId);
                  const bookingBikes = bikes.filter((b) => booking.bikeIds.includes(b.id));
                  return (
                    <div
                      key={booking.id}
                      className="p-2 bg-zinc-50 rounded-lg border border-zinc-100 cursor-pointer hover:bg-zinc-100 transition-colors"
                      onClick={() => onBookingClick(booking)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">{bookingCustomer?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {bookingBikes.map((b) => `${b.name}${b.regNo ? ` (${b.regNo})` : ''}`).join(', ')}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px]',
                            booking.status === 'Active'
                              ? 'bg-green-50 text-green-700'
                              : booking.status === 'Booked'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-zinc-50 text-zinc-700'
                          )}
                        >
                          {booking.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'Active':
      return '#dcfce7';
    case 'Booked':
      return '#dbeafe';
    case 'Completed':
      return '#f4f4f5';
    default:
      return '#fef2f2';
  }
}

function getStatusBorderColor(status: string): string {
  switch (status) {
    case 'Active':
      return '#16a34a';
    case 'Booked':
      return '#2563eb';
    case 'Completed':
      return '#71717a';
    default:
      return '#dc2626';
  }
}
