import { useMemo } from "react";
import MobileLayout from "@/components/layout/MobileLayout";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingUp, CheckCircle2, Activity, DollarSign, BarChart3 } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, isToday, parseISO } from "date-fns";

export default function Reports() {
  const { bookings } = useStore();

  // Helper: Get bookings for today
  const getTodaysBookings = useMemo(() => {
    return bookings.filter(b => 
      b.status !== 'cancelled' && b.status !== 'expired' &&
      b.startDate && 
      isToday(parseISO(b.startDate))
    );
  }, [bookings]);

  // Helper: Get active bookings
  const getActiveBookings = useMemo(() => {
    return bookings.filter(b => 
      b.status === 'active'
    );
  }, [bookings]);

  // Helper: Get completed bookings
  const getCompletedBookings = useMemo(() => {
    return bookings.filter(b => 
      b.status === 'completed'
    );
  }, [bookings]);

  // Helper: Calculate total revenue (completed bookings only)
  const getTotalRevenue = useMemo(() => {
    return getCompletedBookings.reduce((sum, booking) => {
      return sum + (booking.rent || 0);
    }, 0);
  }, [getCompletedBookings]);

  // Helper: Get current month bookings
  const getCurrentMonthBookings = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    return bookings.filter(b => {
      if (b.status === 'cancelled' || b.status === 'expired' || !b.startDate) return false;
      try {
        const bookingDate = parseISO(b.startDate);
        return isWithinInterval(bookingDate, { start: monthStart, end: monthEnd });
      } catch {
        return false;
      }
    });
  }, [bookings]);

  // Helper: Count bookings by status for current month
  const getMonthlyStatusCounts = useMemo(() => {
    const counts = {
      requested: 0,
      confirmed: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
      expired: 0,
    };

    getCurrentMonthBookings.forEach(b => {
      if (counts.hasOwnProperty(b.status)) {
        counts[b.status as keyof typeof counts]++;
      }
    });

    return counts;
  }, [getCurrentMonthBookings]);

  // Helper: Calculate current month revenue (completed only)
  const getMonthlyRevenue = useMemo(() => {
    return getCurrentMonthBookings
      .filter(b => b.status === 'completed')
      .reduce((sum, booking) => sum + (booking.rent || 0), 0);
  }, [getCurrentMonthBookings]);

  return (
    <MobileLayout>
      <div className="p-4 space-y-4 min-h-screen pb-24">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Reports</h1>
          <Badge variant="outline" className="gap-1">
            <Calendar size={12} />
            {format(new Date(), 'MMM yyyy')}
          </Badge>
        </div>

        {/* Today's Overview */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Calendar size={16} />
            Today's Overview
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-zinc-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{getTodaysBookings.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Bookings Today</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                    <Calendar size={20} className="text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{getActiveBookings.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Active Rentals</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
                    <Activity size={20} className="text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* All-Time Stats */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <BarChart3 size={16} />
            All-Time Statistics
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-zinc-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{getCompletedBookings.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Completed</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 size={20} className="text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">₹{getTotalRevenue.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">Total Revenue</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
                    <TrendingUp size={20} className="text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Monthly Summary */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <DollarSign size={16} />
            This Month ({format(new Date(), 'MMM yyyy')})
          </h2>

          <Card className="border-zinc-100 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Monthly Summary</span>
                <Badge variant="secondary">{getCurrentMonthBookings.length} bookings</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Revenue */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-3 rounded-lg border border-green-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-900">Revenue</span>
                  <span className="text-xl font-bold text-green-700">₹{getMonthlyRevenue.toLocaleString()}</span>
                </div>
                <p className="text-xs text-green-600 mt-1">From completed bookings</p>
              </div>

              {/* Status Breakdown */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Status Breakdown</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(getMonthlyStatusCounts).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between bg-zinc-50 p-2 rounded-md">
                      <span className="text-xs text-muted-foreground">
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                      <Badge variant="outline" className="text-xs">{count}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Average Revenue per Booking */}
              {getMonthlyStatusCounts.completed > 0 && (
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Avg per Booking</span>
                    <span className="text-sm font-semibold">₹{Math.round(getMonthlyRevenue / getMonthlyStatusCounts.completed).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Insights */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Quick Insights</h2>
          <div className="space-y-2">
            <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg">
              <p className="text-xs font-medium text-blue-900">Total Bookings</p>
              <p className="text-2xl font-bold text-blue-700">{bookings.filter(b => b.status !== 'cancelled' && b.status !== 'expired').length}</p>
            </div>
            
            <div className="bg-purple-50 border border-purple-100 p-3 rounded-lg">
              <p className="text-xs font-medium text-purple-900">Cancellation Rate</p>
              <p className="text-2xl font-bold text-purple-700">
                {bookings.length > 0
                  ? Math.round((bookings.filter(b => b.status === 'cancelled' || b.status === 'expired').length / bookings.length) * 100)
                  : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
