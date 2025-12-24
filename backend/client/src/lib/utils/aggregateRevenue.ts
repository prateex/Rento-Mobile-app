import { Booking } from '@/lib/store';
import { 
  format, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  isWithinInterval,
  parseISO
} from 'date-fns';

export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface RevenueDataPoint {
  label: string;
  date: Date;
  bookings: number;
  rent: number;
  deposit: number;
  total: number;
}

export interface AggregatedRevenue {
  data: RevenueDataPoint[];
  totalRevenue: number;
  totalBookings: number;
  totalRent: number;
  totalDeposit: number;
}

function getValidBookings(bookings: Booking[]): Booking[] {
  return bookings.filter(b => b.status !== 'Deleted' && b.status !== 'Cancelled');
}

function getBookingsInRange(bookings: Booking[], start: Date, end: Date): Booking[] {
  return getValidBookings(bookings).filter(b => {
    const bookingStart = parseISO(b.startDate);
    return isWithinInterval(bookingStart, { start: startOfDay(start), end: endOfDay(end) });
  });
}

export function aggregateByDay(bookings: Booking[], startDate: Date, endDate: Date): AggregatedRevenue {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const validBookings = getValidBookings(bookings);
  
  const data: RevenueDataPoint[] = days.map(day => {
    const dayBookings = validBookings.filter(b => {
      const bookingStart = startOfDay(parseISO(b.startDate));
      return bookingStart.getTime() === startOfDay(day).getTime();
    });
    
    return {
      label: format(day, 'MMM dd'),
      date: day,
      bookings: dayBookings.length,
      rent: dayBookings.reduce((sum, b) => sum + (b.rent || 0), 0),
      deposit: dayBookings.reduce((sum, b) => sum + (b.deposit || 0), 0),
      total: dayBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0)
    };
  });
  
  return calculateTotals(data);
}

export function aggregateByWeek(bookings: Booking[], startDate: Date, endDate: Date): AggregatedRevenue {
  const weeks = eachWeekOfInterval({ start: startDate, end: endDate });
  const validBookings = getValidBookings(bookings);
  
  const data: RevenueDataPoint[] = weeks.map((weekStart, index) => {
    const weekEnd = endOfWeek(weekStart);
    const weekBookings = validBookings.filter(b => {
      const bookingStart = parseISO(b.startDate);
      return isWithinInterval(bookingStart, { start: weekStart, end: weekEnd });
    });
    
    return {
      label: `Week ${index + 1}`,
      date: weekStart,
      bookings: weekBookings.length,
      rent: weekBookings.reduce((sum, b) => sum + (b.rent || 0), 0),
      deposit: weekBookings.reduce((sum, b) => sum + (b.deposit || 0), 0),
      total: weekBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0)
    };
  });
  
  return calculateTotals(data);
}

export function aggregateByMonth(bookings: Booking[], startDate: Date, endDate: Date): AggregatedRevenue {
  const months = eachMonthOfInterval({ start: startDate, end: endDate });
  const validBookings = getValidBookings(bookings);
  
  const data: RevenueDataPoint[] = months.map(monthStart => {
    const monthEnd = endOfMonth(monthStart);
    const monthBookings = validBookings.filter(b => {
      const bookingStart = parseISO(b.startDate);
      return isWithinInterval(bookingStart, { start: monthStart, end: monthEnd });
    });
    
    return {
      label: format(monthStart, 'MMM yyyy'),
      date: monthStart,
      bookings: monthBookings.length,
      rent: monthBookings.reduce((sum, b) => sum + (b.rent || 0), 0),
      deposit: monthBookings.reduce((sum, b) => sum + (b.deposit || 0), 0),
      total: monthBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0)
    };
  });
  
  return calculateTotals(data);
}

function calculateTotals(data: RevenueDataPoint[]): AggregatedRevenue {
  return {
    data,
    totalRevenue: data.reduce((sum, d) => sum + d.total, 0),
    totalBookings: data.reduce((sum, d) => sum + d.bookings, 0),
    totalRent: data.reduce((sum, d) => sum + d.rent, 0),
    totalDeposit: data.reduce((sum, d) => sum + d.deposit, 0)
  };
}

export function exportToCSV(data: RevenueDataPoint[], filename: string = 'revenue-report.csv'): void {
  const headers = ['Period', 'Bookings', 'Rent (₹)', 'Deposit (₹)', 'Total (₹)'];
  const rows = data.map(d => [d.label, d.bookings, d.rent, d.deposit, d.total]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
