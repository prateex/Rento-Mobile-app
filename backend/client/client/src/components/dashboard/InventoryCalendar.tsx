import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useStore, Bike, Booking, Customer } from '@/lib/store';
import { getBlockedDatesFromStorage } from '@/lib/utils';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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

// Per-vehicle blocking storage helpers
const BLOCK_KEY = 'rento_blocked_vehicle_days';
function getBlockedDaysMap(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(BLOCK_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function setBlockedDaysMap(map: Record<string, string[]>) {
  localStorage.setItem(BLOCK_KEY, JSON.stringify(map));
}
function isBikeBlockedOnDate(bikeId: string, date: Date): boolean {
  const map = getBlockedDaysMap();
  const key = date.toISOString().slice(0,10);
  const arr = map[bikeId] || [];
  return arr.includes(key);
}
function toggleBikeBlockOnDate(bikeId: string, date: Date, block: boolean) {
  const map = getBlockedDaysMap();
  const key = date.toISOString().slice(0,10);
  const arr = new Set(map[bikeId] || []);
  if (block) arr.add(key); else arr.delete(key);
  map[bikeId] = Array.from(arr);
  setBlockedDaysMap(map);
}

export default function InventoryCalendar({ className }: InventoryCalendarProps) {
  const { bikes, bookings, customers } = useStore();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockingBike, setBlockingBike] = useState<{ bike: Bike; date: Date; isBlocked: boolean } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Define navigation functions BEFORE useEffect to avoid "before initialization" error
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

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Only respond to horizontal scroll or shift+scroll
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY) && !e.shiftKey) return;
      
      e.preventDefault();
      const delta = e.deltaX || e.deltaY;
      
      if (delta > 0) {
        navigateNext();
      } else {
        navigatePrev();
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [navigatePrev, navigateNext]);

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
      const bookedBikeIds = new Set(dayBookings.flatMap((b) => b.bikeIds));
      return bikes.filter((b) => !bookedBikeIds.has(b.id) && b.status !== 'Maintenance' && !isBikeBlockedOnDate(b.id, date));
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
  const blockedDatesSet = useMemo(() => new Set(getBlockedDatesFromStorage()), []);

  const columnWidth = viewMode === 'month' ? 40 : viewMode === 'week' ? 80 : 200;

  // compute footer availability stats
  const avgAvailable = useMemo(() => {
    if (days.length === 0) return bikes.length;
    const total = days.reduce((sum, d) => sum + getAvailableBikesForDate(d).length, 0);
    return Math.round(total / days.length);
  }, [days, bikes, getAvailableBikesForDate]);

  const bookingPercentage = useMemo(() => {
    if (bikes.length === 0) return 0;
    return Math.round(((bikes.length - avgAvailable) / bikes.length) * 100);
  }, [bikes.length, avgAvailable]);

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
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs border-primary" onClick={() => { goToToday(); setTimeout(() => scrollContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0); }}>
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
                  'flex-shrink-0 p-2 text-center border-r border-zinc-100 cursor-pointer hover:bg-zinc-50 transition-colors relative',
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
              onBlockClick={(bike, date, isBlocked) => {
                setBlockingBike({ bike, date, isBlocked });
                setBlockModalOpen(true);
              }}
            />
          ))}
        </div>
      </div>

        {/* Per-day summary section below calendar */}
        <div className="border-t border-zinc-100 bg-zinc-50 p-3 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {days.map((day, index) => {
              const bookedCount = Array.from(new Set((Array.from(bikeSegmentMap.values()).flatMap(m => (m.get(index) || []).map(s => s.bikeId))))).length;
              const percentage = bikes.length === 0 ? 0 : Math.round((bookedCount / bikes.length) * 100);
              return (
                <div key={index} className="flex flex-col gap-1 p-2 bg-white rounded border border-zinc-200 min-w-[120px]">
                  <div className="text-[10px] text-muted-foreground font-medium">{format(day, 'MMM dd')}</div>
                  <div className="text-xs">
                    <div>Tot: {bikes.length}</div>
                    <div>Booked: {bookedCount}</div>
                    <div>{percentage}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <BlockVehicleModal
        open={blockModalOpen}
        onOpenChange={setBlockModalOpen}
        bike={blockingBike?.bike || null}
        date={blockingBike?.date || null}
        isBlocked={blockingBike?.isBlocked || false}
        onConfirm={(block) => {
          if (blockingBike) {
            toggleBikeBlockOnDate(blockingBike.bike.id, blockingBike.date, block);
            setBlockModalOpen(false);
            setBlockingBike(null);
          }
        }}
      />

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
  onBlockClick?: (bike: Bike, date: Date, isBlocked: boolean) => void;
}

function BikeRow({ bike, bikes, days, bikeSegmentMap, columnWidth, customers, onBookingClick, onDayClick, onBlockClick }: BikeRowProps) {
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
            <p className="text-[10px] text-muted-foreground truncate">{bike.regNo || 'N/A'}</p>
          </div>
        </div>
      </div>

      <div className="flex relative" style={{ height: rowHeight }}>
        {days.map((day, dayIndex) => {
          const daySegments = getSegmentsForBikeDay(bikeSegmentMap, bike.id, dayIndex);
          const isBlocked = isBikeBlockedOnDate(bike.id, day);
          return (
            <div
              key={dayIndex}
              className={cn(
                'flex-shrink-0 border-r border-zinc-100 relative cursor-pointer hover:bg-zinc-50/50 transition-colors',
                isToday(day) && 'bg-primary/5'
              )}
              style={{ width: columnWidth }}
              onClick={() => {
                if (daySegments.length === 0) {
                  onBlockClick?.(bike, day, isBlocked);
                } else {
                  onDayClick(day);
                }
              }}
            >
              {isBlocked && (
                <div className="absolute inset-1 bg-red-50 border border-red-200 rounded flex items-center justify-center">
                  <span className="text-[10px] font-medium text-red-700">Blocked</span>
                </div>
              )}
            </div>
          );
        })}

        {/* Continuous booking bars spanning multiple days */}
        {Array.from(
          rowSegments.reduce((map, seg) => {
            const list = map.get(seg.bookingId) || [];
            list.push(seg);
            map.set(seg.bookingId, list);
            return map;
          }, new Map<string, CalendarSegment[]>())
        ).map(([bookingId, segs]) => {
          const ordered = segs.sort((a, b) => a.dayIndex - b.dayIndex);
          const first = ordered[0];
          const last = ordered[ordered.length - 1];
          const firstLeftPx = first.dayIndex * columnWidth + (first.leftPct / 100) * columnWidth;
          const middleDays = Math.max(0, last.dayIndex - first.dayIndex - 1);
          const widthPx = first.dayIndex === last.dayIndex
            ? (first.widthPct / 100) * columnWidth
            : (1 - first.leftPct / 100) * columnWidth + middleDays * columnWidth + (last.widthPct / 100) * columnWidth;

          const top = 4 + first.stackIndex * (BAR_HEIGHT + 4);
          const customer = customers.find((c) => c.id === first.booking.customerId);
          const bookingBikes = (bikes || []).filter((b) => first.booking.bikeIds.includes(b.id));
          const statusColor = getStatusColor(first.booking.status);
          const statusBorderColor = getStatusBorderColor(first.booking.status);

          return (
            <div
              key={`bar-${bookingId}-${bike.id}`}
              className="absolute cursor-pointer transition-all hover:brightness-95 hover:z-10"
              style={{
                left: firstLeftPx,
                width: widthPx,
                top,
                height: BAR_HEIGHT,
                backgroundColor: statusColor,
                borderLeft: !first.isStartPartial ? `2px solid ${statusBorderColor}` : undefined,
                borderRight: !last.isEndPartial ? `2px solid ${statusBorderColor}` : undefined,
                borderTop: `1px solid ${statusBorderColor}`,
                borderBottom: `1px solid ${statusBorderColor}`,
                clipPath: `polygon(${SLANT_SIZE}px 0, 100% 0, calc(100% - ${SLANT_SIZE}px) 100%, 0 100%)`,
                zIndex: first.stackIndex + 1,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onBookingClick(first.booking);
              }}
            >
              <div className="px-1 py-0.5 text-[9px] font-medium truncate text-zinc-800 h-full flex items-center gap-2">
                <span className="truncate">{customer?.name}</span>
                {bookingBikes.length > 0 && (
                  <span className="text-[10px] text-zinc-700 ml-1 truncate">{bookingBikes.map(b => b.regNo || b.name).join(', ')}</span>
                )}
              </div>
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
    // Forward-slanting parallelogram for all segments
    return `polygon(${slant}px 0, 100% 0, calc(100% - ${slant}px) 100%, 0 100%)`;
  }, []);

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
      <div className="px-1 py-0.5 text-[9px] font-medium truncate text-zinc-800 h-full flex items-center gap-2">
        <span className="truncate">{customer?.name}</span>
        {bookingBikes.length > 0 && (
          <span className="text-[10px] text-zinc-700 ml-1 truncate">{bookingBikes.map(b => b.regNo || b.name).join(', ')}</span>
        )}
      </div>
    </div>
  );
}

interface BlockVehicleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bike: Bike | null;
  date: Date | null;
  isBlocked: boolean;
  onConfirm: (block: boolean) => void;
}

function BlockVehicleModal({ open, onOpenChange, bike, date, isBlocked, onConfirm }: BlockVehicleModalProps) {
  if (!bike || !date) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isBlocked ? 'Unblock Vehicle' : 'Block Vehicle'}
          </DialogTitle>
          <DialogDescription>
            {isBlocked 
              ? `Unblock ${bike.name} (${bike.regNo}) for ${format(date, 'MMM dd, yyyy')}?`
              : `Block ${bike.name} (${bike.regNo}) for ${format(date, 'MMM dd, yyyy')}?`
            }
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isBlocked 
              ? 'This vehicle will be available for booking on this date.'
              : 'This vehicle will not be available for booking on this date.'
            }
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => onConfirm(!isBlocked)}
            className={isBlocked ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
          >
            {isBlocked ? 'Unblock' : 'Block'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [, setLocation] = useLocation();
  const blockedKey = 'rento_blocked_dates';
  const getBlockedDates = () => {
    try {
      const raw = localStorage.getItem(blockedKey);
      return raw ? JSON.parse(raw) as string[] : [];
    } catch (e) {
      return [];
    }
  };

  const setBlockedDate = (d: Date) => {
    const list = getBlockedDates();
    const key = d.toISOString().slice(0,10);
    if (!list.includes(key)) {
      list.push(key);
      localStorage.setItem(blockedKey, JSON.stringify(list));
    }
  };

  const isBlocked = getBlockedDates().includes(date.toISOString().slice(0,10));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <div>
              <DialogTitle>{format(date, 'EEEE, MMMM dd, yyyy')}</DialogTitle>
              <DialogDescription className="sr-only">View available vehicles and bookings for this date</DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { setLocation(`/bookings?action=new&start=${date.toISOString()}`); onOpenChange(false); }}>Create Booking</Button>
            </div>
          </div>
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
            <p className="text-xs font-medium text-muted-foreground">Available Vehicles</p>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {availableBikes.length > 0 ? (
                availableBikes.map((bike) => (
                  <Badge key={bike.id} variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    {bike.name} {bike.regNo && <span className="text-green-500">({bike.regNo})</span>}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No vehicles available</p>
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
    case 'Booked':
      return '#fde68a'; // Yellow
    case 'Advance Paid':
      return '#fdba74'; // Orange
    case 'Confirmed':
      return '#93c5fd'; // Blue
    case 'Active':
      return '#86efac'; // Green
    case 'Completed':
      return '#e5e7eb'; // Grey
    case 'Cancelled':
      return '#fca5a5'; // Red
    default:
      return '#e5e7eb';
  }
}

function getStatusBorderColor(status: string): string {
  switch (status) {
    case 'Booked':
      return '#f59e0b';
    case 'Advance Paid':
      return '#f97316';
    case 'Confirmed':
      return '#2563eb';
    case 'Active':
      return '#16a34a';
    case 'Completed':
      return '#6b7280';
    case 'Cancelled':
      return '#dc2626';
    default:
      return '#6b7280';
  }
}
