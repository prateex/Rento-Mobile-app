import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useStore, Booking } from '@/lib/store';
import { 
  aggregateByDay, 
  aggregateByWeek, 
  aggregateByMonth, 
  exportToCSV,
  type PeriodType,
  type AggregatedRevenue
} from '@/lib/utils/aggregateRevenue';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  AreaChart, 
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Download, Calendar } from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, endOfMonth, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface RevenueReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RevenueReport({ open, onOpenChange }: RevenueReportProps) {
  const { bookings } = useStore();
  const [period, setPeriod] = useState<PeriodType>('daily');
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  
  const aggregatedData = useMemo((): AggregatedRevenue => {
    const now = new Date();
    
    switch (period) {
      case 'daily':
        return aggregateByDay(bookings, subDays(now, 30), now);
      case 'weekly':
        return aggregateByWeek(bookings, subWeeks(now, 12), now);
      case 'monthly':
        return aggregateByMonth(bookings, subMonths(now, 12), now);
      case 'custom':
        return aggregateByDay(bookings, customRange.from, customRange.to);
      default:
        return aggregateByDay(bookings, subDays(now, 30), now);
    }
  }, [bookings, period, customRange]);

  const renderChart = () => {
    const chartData = aggregatedData.data;
    
    if (period === 'daily' || period === 'custom') {
      return (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="label" 
              tick={{ fontSize: 10 }} 
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip 
              formatter={(value: number) => [`₹${value}`, 'Revenue']}
              labelStyle={{ fontWeight: 'bold' }}
            />
            <Line 
              type="monotone" 
              dataKey="total" 
              stroke="#FFD200" 
              strokeWidth={2}
              dot={{ fill: '#FFD200', strokeWidth: 2, r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      );
    }
    
    if (period === 'weekly') {
      return (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip 
              formatter={(value: number) => [`₹${value}`, 'Revenue']}
            />
            <Bar dataKey="total" fill="#FFD200" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }
    
    if (period === 'monthly') {
      return (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip 
              formatter={(value: number) => [`₹${value}`, 'Revenue']}
            />
            <Area 
              type="monotone" 
              dataKey="total" 
              stroke="#FFD200" 
              fill="#FFD200" 
              fillOpacity={0.3}
            />
          </AreaChart>
        </ResponsiveContainer>
      );
    }
    
    return null;
  };

  const handleExport = () => {
    const filename = `revenue-${period}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    exportToCSV(aggregatedData.data, filename);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Revenue Report</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="daily" className="text-xs">Daily</TabsTrigger>
              <TabsTrigger value="weekly" className="text-xs">Weekly</TabsTrigger>
              <TabsTrigger value="monthly" className="text-xs">Monthly</TabsTrigger>
              <TabsTrigger value="custom" className="text-xs">Custom</TabsTrigger>
            </TabsList>
          </Tabs>
          
          {period === 'custom' && (
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 text-xs">
                    <Calendar className="mr-2 h-3 w-3" />
                    {format(customRange.from, 'MMM dd')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={customRange.from}
                    onSelect={(date) => date && setCustomRange(prev => ({ ...prev, from: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="flex items-center text-muted-foreground">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 text-xs">
                    <Calendar className="mr-2 h-3 w-3" />
                    {format(customRange.to, 'MMM dd')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={customRange.to}
                    onSelect={(date) => date && setCustomRange(prev => ({ ...prev, to: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-green-50 rounded-lg border border-green-100">
              <p className="text-xs text-green-700 font-medium">Total Revenue</p>
              <p className="text-xl font-bold">₹{aggregatedData.totalRevenue.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-700 font-medium">Total Bookings</p>
              <p className="text-xl font-bold">{aggregatedData.totalBookings}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-xs text-amber-700 font-medium">Total Rent</p>
              <p className="text-xl font-bold">₹{aggregatedData.totalRent.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
              <p className="text-xs text-purple-700 font-medium">Total Deposit</p>
              <p className="text-xl font-bold">₹{aggregatedData.totalDeposit.toLocaleString()}</p>
            </div>
          </div>
          
          <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-100">
            {renderChart()}
          </div>
          
          <div className="max-h-40 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-zinc-100 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-medium">Period</th>
                  <th className="text-right p-2 font-medium">Bookings</th>
                  <th className="text-right p-2 font-medium">Rent</th>
                  <th className="text-right p-2 font-medium">Deposit</th>
                  <th className="text-right p-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {aggregatedData.data.slice(-10).reverse().map((row, idx) => (
                  <tr key={idx} className="border-b border-zinc-100">
                    <td className="p-2">{row.label}</td>
                    <td className="text-right p-2">{row.bookings}</td>
                    <td className="text-right p-2">₹{row.rent}</td>
                    <td className="text-right p-2">₹{row.deposit}</td>
                    <td className="text-right p-2 font-medium">₹{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <Button onClick={handleExport} variant="outline" className="w-full">
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
