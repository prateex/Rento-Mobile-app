import { useState, useMemo, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import { useStore, Bike, Booking, Customer } from '@/lib/store';
import { format, parseISO, isSameDay, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Phone, MessageCircle, Calendar, Clock, User } from 'lucide-react';

interface InventoryCalendarProps {
  className?: string;
}

export default function InventoryCalendar({ className }: InventoryCalendarProps) {
  const { bikes, bookings, customers } = useStore();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);

  const resources = useMemo(() => {
    return bikes.map(bike => ({
      id: bike.id,
      title: `${bike.name} • ${bike.regNo}`,
      bike: bike,
      extendedProps: {
        status: bike.status,
        image: bike.image,
        pricePerDay: bike.pricePerDay
      }
    }));
  }, [bikes]);

  const events = useMemo(() => {
    return bookings
      .filter(b => b.status !== 'Deleted' && b.status !== 'Cancelled')
      .flatMap(booking => {
        const customer = customers.find(c => c.id === booking.customerId);
        return booking.bikeIds.map(bikeId => ({
          id: `${booking.id}-${bikeId}`,
          resourceId: bikeId,
          start: booking.startDate,
          end: booking.endDate,
          title: customer?.name || 'Unknown',
          backgroundColor: getStatusColor(booking.status),
          borderColor: getStatusBorderColor(booking.status),
          textColor: '#000',
          extendedProps: {
            booking,
            customer,
            status: booking.status
          }
        }));
      });
  }, [bookings, customers]);

  const getBookingsForDate = useCallback((date: Date) => {
    return bookings.filter(b => {
      if (b.status === 'Deleted' || b.status === 'Cancelled') return false;
      const start = startOfDay(parseISO(b.startDate));
      const end = endOfDay(parseISO(b.endDate));
      return isWithinInterval(date, { start, end });
    });
  }, [bookings]);

  const getAvailableBikesForDate = useCallback((date: Date) => {
    const dayBookings = getBookingsForDate(date);
    const bookedBikeIds = dayBookings.flatMap(b => b.bikeIds);
    return bikes.filter(b => !bookedBikeIds.includes(b.id) && b.status !== 'Maintenance');
  }, [bikes, getBookingsForDate]);

  const handleEventClick = (info: any) => {
    const booking = info.event.extendedProps.booking as Booking;
    setSelectedBooking(booking);
    setIsBookingModalOpen(true);
  };

  const handleDateClick = (info: any) => {
    setSelectedDate(new Date(info.dateStr));
    setIsDayModalOpen(true);
  };

  const renderResourceContent = (arg: any) => {
    const bike = arg.resource.extendedProps as { status: string; image: string; pricePerDay: number };
    return (
      <div className="flex items-center gap-2 p-1">
        <div className="w-8 h-8 rounded-md overflow-hidden flex-shrink-0 bg-zinc-100">
          <img 
            src={bike.image} 
            alt="" 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium truncate">{arg.resource.title}</p>
          <Badge 
            variant="outline" 
            className={cn(
              "text-[9px] px-1 py-0",
              bike.status === 'Available' ? 'bg-green-50 text-green-700 border-green-200' :
              bike.status === 'Booked' ? 'bg-blue-50 text-blue-700 border-blue-200' :
              'bg-amber-50 text-amber-700 border-amber-200'
            )}
          >
            {bike.status}
          </Badge>
        </div>
      </div>
    );
  };

  const customer = selectedBooking ? customers.find(c => c.id === selectedBooking.customerId) : null;
  const selectedBookingBikes = selectedBooking ? bikes.filter(b => selectedBooking.bikeIds.includes(b.id)) : [];
  const availableBikesOnSelectedDate = selectedDate ? getAvailableBikesForDate(selectedDate) : [];
  const bookingsOnSelectedDate = selectedDate ? getBookingsForDate(selectedDate) : [];

  return (
    <div className={cn("bg-white rounded-lg border border-zinc-200 overflow-hidden", className)}>
      <div className="p-3 border-b border-zinc-100 bg-zinc-50">
        <h3 className="font-bold text-sm">Inventory Calendar</h3>
        <p className="text-xs text-muted-foreground">Click on bookings to view details, click dates to see availability</p>
      </div>
      
      <div className="calendar-container">
        <FullCalendar
          plugins={[resourceTimelinePlugin, interactionPlugin]}
          initialView="resourceTimelineWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'resourceTimelineDay,resourceTimelineWeek,resourceTimelineMonth'
          }}
          resources={resources}
          events={events}
          resourceAreaWidth="200px"
          slotMinWidth={60}
          height="auto"
          aspectRatio={1.5}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          resourceLabelContent={renderResourceContent}
          slotLabelFormat={{
            weekday: 'short',
            day: 'numeric'
          }}
          eventContent={(arg) => (
            <div className="px-1 py-0.5 text-[10px] font-medium truncate">
              {arg.event.title}
            </div>
          )}
          nowIndicator={true}
          editable={false}
        />
      </div>

      <Dialog open={isBookingModalOpen} onOpenChange={setIsBookingModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {selectedBooking && customer && (
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
                  <p className="font-medium">{format(parseISO(selectedBooking.startDate), 'MMM dd, HH:mm')}</p>
                </div>
                <div className="p-2 bg-zinc-50 rounded-lg">
                  <p className="text-xs text-muted-foreground">End</p>
                  <p className="font-medium">{format(parseISO(selectedBooking.endDate), 'MMM dd, HH:mm')}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Bikes</p>
                <div className="flex flex-wrap gap-1">
                  {selectedBookingBikes.map(bike => (
                    <Badge key={bike.id} variant="outline">{bike.name}</Badge>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-700">Rent</p>
                  <p className="font-bold">₹{selectedBooking.rent}</p>
                </div>
                <div className="p-2 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-700">Deposit</p>
                  <p className="font-bold">₹{selectedBooking.deposit}</p>
                </div>
                <div className="p-2 bg-amber-50 rounded-lg">
                  <p className="text-xs text-amber-700">Total</p>
                  <p className="font-bold">₹{selectedBooking.totalAmount}</p>
                </div>
              </div>
              
              <Badge 
                className={cn(
                  "w-full justify-center py-1",
                  selectedBooking.status === 'Active' ? 'bg-green-100 text-green-700' :
                  selectedBooking.status === 'Booked' ? 'bg-blue-100 text-blue-700' :
                  selectedBooking.status === 'Completed' ? 'bg-zinc-100 text-zinc-700' :
                  'bg-red-100 text-red-700'
                )}
              >
                {selectedBooking.status}
              </Badge>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDayModalOpen} onOpenChange={setIsDayModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedDate && format(selectedDate, 'EEEE, MMMM dd, yyyy')}
            </DialogTitle>
          </DialogHeader>
          {selectedDate && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                  <p className="text-xs text-green-700 font-medium">Available</p>
                  <p className="text-2xl font-bold">{availableBikesOnSelectedDate.length}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-xs text-blue-700 font-medium">Bookings</p>
                  <p className="text-2xl font-bold">{bookingsOnSelectedDate.length}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Available Bikes</p>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {availableBikesOnSelectedDate.length > 0 ? (
                    availableBikesOnSelectedDate.map(bike => (
                      <Badge key={bike.id} variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {bike.name}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No bikes available</p>
                  )}
                </div>
              </div>
              
              {bookingsOnSelectedDate.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Bookings on this day</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {bookingsOnSelectedDate.map(booking => {
                      const bookingCustomer = customers.find(c => c.id === booking.customerId);
                      const bookingBikes = bikes.filter(b => booking.bikeIds.includes(b.id));
                      return (
                        <div 
                          key={booking.id} 
                          className="p-2 bg-zinc-50 rounded-lg border border-zinc-100 cursor-pointer hover:bg-zinc-100 transition-colors"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setIsDayModalOpen(false);
                            setIsBookingModalOpen(true);
                          }}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">{bookingCustomer?.name}</p>
                              <p className="text-xs text-muted-foreground">{bookingBikes[0]?.name}</p>
                            </div>
                            <Badge 
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                booking.status === 'Active' ? 'bg-green-50 text-green-700' :
                                booking.status === 'Booked' ? 'bg-blue-50 text-blue-700' :
                                'bg-zinc-50 text-zinc-700'
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
          )}
        </DialogContent>
      </Dialog>

      <style>{`
        .calendar-container .fc {
          font-size: 11px;
        }
        .calendar-container .fc-toolbar-title {
          font-size: 14px !important;
          font-weight: 600;
        }
        .calendar-container .fc-button {
          font-size: 11px !important;
          padding: 4px 8px !important;
        }
        .calendar-container .fc-button-primary {
          background-color: #FFD200 !important;
          border-color: #FFD200 !important;
          color: #000 !important;
        }
        .calendar-container .fc-button-primary:not(:disabled):hover {
          background-color: #E6BD00 !important;
          border-color: #E6BD00 !important;
        }
        .calendar-container .fc-button-primary:not(:disabled).fc-button-active {
          background-color: #000 !important;
          border-color: #000 !important;
          color: #fff !important;
        }
        .calendar-container .fc-resource-timeline .fc-resource-area {
          width: 200px !important;
        }
        .calendar-container .fc-event {
          border-radius: 4px;
          cursor: pointer;
        }
        .calendar-container .fc-datagrid-cell-cushion {
          padding: 4px;
        }
        .calendar-container .fc-timeline-slot {
          min-width: 60px;
        }
        .calendar-container .fc-col-header-cell {
          cursor: pointer;
        }
        .calendar-container .fc-col-header-cell:hover {
          background-color: #f5f5f5;
        }
      `}</style>
    </div>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'Active': return '#dcfce7';
    case 'Booked': return '#dbeafe';
    case 'Completed': return '#f4f4f5';
    default: return '#fef2f2';
  }
}

function getStatusBorderColor(status: string): string {
  switch (status) {
    case 'Active': return '#16a34a';
    case 'Booked': return '#2563eb';
    case 'Completed': return '#71717a';
    default: return '#dc2626';
  }
}
