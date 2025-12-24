import { lazy, Suspense, useState } from "react";
import MobileLayout from "@/components/layout/MobileLayout";
import { useStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Bike, Calendar, TrendingUp, Plus, ArrowRight, EyeOff, CalendarDays, Car as CarIcon } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import RevenueReport from "@/components/dashboard/RevenueReport";
import { useRef, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const InventoryCalendar = lazy(() => import("@/components/dashboard/InventoryCalendar"));

const getVehicleIcon = (type?: string) => {
  return type === 'car' ? <CarIcon size={20} className="text-[hsl(49,100%,50%)]" /> : <Bike size={20} className="text-[hsl(49,100%,50%)]" />;
};

const getVehicleLabel = (type?: string) => {
  return type === 'car' ? 'Car' : 'Bike';
};

export default function Dashboard() {
  const { user, bikes, bookings, settings } = useStore();
  const [isRevenueReportOpen, setIsRevenueReportOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(true);
  const calendarRef = useRef<HTMLDivElement | null>(null);
  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
  const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const isOnToday = (startISO: string, endISO: string) => {
    const start = new Date(startISO);
    const end = new Date(endISO);
    return start <= dayEnd && end > dayStart;
  };
  const bookedTodayBikeIds = new Set<string>();
  const activeTodayBikeIds = new Set<string>();
  bookings.forEach(b => {
    if (b.status === 'Deleted' || b.status === 'Cancelled') return;
    if (isOnToday(b.startDate, b.endDate)) {
      if (b.status === 'Active') {
        b.bikeIds.forEach(id => activeTodayBikeIds.add(id));
      } else {
        b.bikeIds.forEach(id => bookedTodayBikeIds.add(id));
      }
    }
  });
  const maintenanceBikeIds = new Set<string>(bikes.filter(b => b.status === 'Maintenance').map(b => b.id));
  
  const stats = {
    totalBikes: bikes.length,
    available: Math.max(0, bikes.length - bookedTodayBikeIds.size - activeTodayBikeIds.size - maintenanceBikeIds.size),
    booked: bikes.filter(b => b.status === 'Booked').length,
    revenue: bookings.filter(b => b.status !== 'Deleted' && b.status !== 'Cancelled').reduce((acc, curr) => acc + (curr.totalAmount || 0), 0)
  };

  return (
    <MobileLayout>
      <div className="p-4 space-y-6">
        <div className="flex justify-between items-center pt-2">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground text-sm">Welcome back, {user?.name}</p>
          </div>
          <div className="flex gap-2">
             <div className="h-10 w-10 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center">
               <span className="font-bold text-primary-foreground text-sm">
                 {user?.name?.[0] ?? '?'}
               </span>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-white border-zinc-100 shadow-sm cursor-pointer hover:border-primary transition-colors" onClick={() => { window.location.href = "/bikes?status=available&date=today"; }}>
            <CardContent className="p-4 flex flex-col justify-between h-32">
              <div className="p-2 bg-zinc-100 w-fit rounded-lg">
                <Bike size={20} className="text-[hsl(49,100%,50%)]" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium">Available Vehicles</p>
                <h3 className="text-2xl font-bold mt-1">{stats.available}/{stats.totalBikes}</h3>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-zinc-100 shadow-sm cursor-pointer hover:border-primary transition-colors" onClick={() => setIsRevenueReportOpen(true)}>
            <CardContent className="p-4 flex flex-col justify-between h-32">
              <div className="p-2 bg-zinc-100 w-fit rounded-lg">
                <TrendingUp size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium">Total Revenue</p>
                {settings.showRevenueOnDashboard ? (
                  <h3 className="text-2xl font-bold mt-1">₹{stats.revenue}</h3>
                ) : (
                  <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                    <EyeOff size={16} /> <span className="text-sm font-medium">Hidden</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-zinc-100 shadow-sm cursor-pointer"
            onClick={() => { window.location.href = "/bookings?filter=active"; }}
          >
            <CardContent className="p-4 flex flex-col justify-between h-32">
              <div className="p-2 bg-zinc-100 w-fit rounded-lg">
                <Calendar size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium">Active Bookings</p>
                <h3 className="text-2xl font-bold mt-1">{bookings.filter(b => b.status === 'Active').length}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-zinc-100 shadow-sm cursor-pointer" onClick={() => { setShowCalendar(true); setTimeout(() => { calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 0); }}>
            <CardContent className="p-4 flex flex-col justify-between h-32">
              <div className="p-2 bg-zinc-100 w-fit rounded-lg">
                <CalendarDays size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium">Calendar</p>
                <h3 className="text-sm font-medium mt-1">Open Inventory Calendar</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-bold">Quick Actions</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <Button onClick={() => { window.location.href = "/bookings?action=new"; }} className="h-14 px-6 rounded-xl shadow-sm flex items-center gap-2 whitespace-nowrap">
              <Plus size={18} /> New Booking
            </Button>
            <Link href="/bikes?action=new">
              <Button variant="outline" className="h-14 px-6 rounded-xl bg-white border-zinc-200 flex items-center gap-2 whitespace-nowrap hover:bg-zinc-50">
                <Bike size={18} /> Add Vehicle
              </Button>
            </Link>
            <Button onClick={() => { window.location.href = "/customers?action=new"; }} variant="outline" className="h-14 px-6 rounded-xl bg-white border-zinc-200 flex items-center gap-2 whitespace-nowrap hover:bg-zinc-50">
              <Plus size={18} /> Add Customer
            </Button>
          </div>
        </div>

        {showCalendar && (
          <Suspense fallback={
            <div className="bg-white rounded-lg border border-zinc-200 p-4 space-y-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-60" />
              <Skeleton className="h-[300px] w-full" />
            </div>
          }>
            <div ref={calendarRef}>
              <InventoryCalendar />
            </div>
          </Suspense>
        )}

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold">Recent Bookings</h2>
            <Link href="/bookings" className="text-xs font-medium text-primary-600 flex items-center">
              View All <ArrowRight size={12} className="ml-1" />
            </Link>
          </div>
          
          <div className="space-y-3">
            {bookings.filter(b => b.status !== 'Deleted').slice(0, 3).map((booking) => {
              const bookingBikes = bikes.filter(b => booking.bikeIds.includes(b.id));
              const primaryBike = bookingBikes[0];
              
              return (
                <Card key={booking.id} className="shadow-sm border-zinc-100 overflow-hidden">
                  <div className="flex p-3 gap-3">
                    <div className="h-16 w-16 bg-zinc-100 rounded-lg flex-shrink-0 overflow-hidden">
                      <img src={primaryBike?.image} alt={primaryBike?.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <h4 className="font-bold text-sm flex items-center gap-1">
                        {getVehicleIcon(primaryBike?.type)} {getVehicleLabel(primaryBike?.type)} {primaryBike?.name}
                        {bookingBikes.length > 1 && <span className="text-xs text-muted-foreground"> +{bookingBikes.length - 1} more</span>}
                      </h4>
                      <p className="text-xs text-muted-foreground">{primaryBike?.regNo}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={cn("px-2 py-0.5 text-[10px] font-bold rounded-full uppercase", 
                          booking.status === 'Active' ? 'bg-green-100 text-green-700' : 
                          booking.status === 'Completed' ? 'bg-zinc-100 text-zinc-700' :
                          booking.status === 'Booked' ? 'bg-blue-100 text-blue-700' : 
                          'bg-red-100 text-red-700'
                        )}>
                          {booking.status}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(booking.startDate), 'dd MMM')}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col justify-center items-end">
                      <span className="font-bold text-sm">₹{booking.totalAmount}</span>
                      <span className="text-[10px] text-muted-foreground">{booking.paymentStatus}</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
        
        <RevenueReport open={isRevenueReportOpen} onOpenChange={setIsRevenueReportOpen} />
      </div>
    </MobileLayout>
  );
}
