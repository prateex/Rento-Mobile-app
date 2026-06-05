import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Booking, Customer, Bike, BookingStatus } from './store';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Status color mapping
export function getStatusColor(status: BookingStatus): string {
  const colorMap: Record<BookingStatus, string> = {
    requested: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-blue-100 text-blue-700',
    active: 'bg-green-100 text-green-700',
    completed: 'bg-gray-100 text-gray-700',
    cancelled: 'bg-red-100 text-red-600',
    expired: 'bg-orange-100 text-orange-700'
  };
  return colorMap[status] || 'bg-gray-100 text-gray-800';
}

export function getStatusLabel(status: BookingStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// Status border color mapping for booking card left border
export function getStatusBorderColor(status: BookingStatus): string {
  const borderColorMap: Record<BookingStatus, string> = {
    requested: 'border-yellow-400',
    confirmed: 'border-blue-400',
    active: 'border-green-400',
    completed: 'border-gray-300',
    cancelled: 'border-red-300',
    expired: 'border-orange-400'
  };
  return borderColorMap[status] || 'border-gray-300';
}

// Blocked dates helper (stored as ISO yyyy-mm-dd strings)
export function getBlockedDatesFromStorage(key = 'rento_blocked_dates'): string[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as string[] : [];
  } catch (e) {
    return [];
  }
}

export function isDateBlocked(date: Date, key = 'rento_blocked_dates') {
  const list = getBlockedDatesFromStorage(key);
  const keyStr = date.toISOString().slice(0,10);
  return list.includes(keyStr);
}

// WhatsApp message template helpers
export function formatWhatsAppMessage(
  template: string,
  booking: Booking,
  customer: Customer,
  bikes: Bike[],
  shopDetails?: { name?: string; address?: string; phone?: string; email?: string; gstNumber?: string }
): string {
  const bookingBikes = bikes.filter(b => booking.bikeIds.includes(b.id));
  const bikeNames = bookingBikes.map(b => `${b.name} (${b.regNo})`).join(', ');
  
  const remainingBalance = booking.totalAmount - (booking.deposit || 0);
  const refundAmount = (booking.deposit || 0) - (booking.depositDeduction || 0);
  
  let message = template
    .replace(/{customerName}/g, customer.name)
    .replace(/{bookingNumber}/g, booking.bookingNumber)
    .replace(/{bikeName}/g, bookingBikes[0]?.name || 'Unknown')
    .replace(/{regNo}/g, bookingBikes[0]?.regNo || 'N/A')
    .replace(/{bikeNames}/g, bikeNames)
    .replace(/{startDate}/g, new Date(booking.startDate).toLocaleDateString('en-IN'))
    .replace(/{endDate}/g, new Date(booking.endDate).toLocaleDateString('en-IN'))
    .replace(/{totalAmount}/g, booking.totalAmount.toString())
    .replace(/{paidAmount}/g, booking.totalAmount.toString())
    .replace(/{remainingBalance}/g, Math.max(0, remainingBalance).toString())
    .replace(/{paymentMode}/g, booking.paymentMode || 'N/A')
    .replace(/{invoiceNumber}/g, booking.invoiceNumber || 'Pending')
    .replace(/{depositDeduction}/g, (booking.depositDeduction || 0).toString())
    .replace(/{refundAmount}/g, refundAmount.toString())
    .replace(/{deposit}/g, (booking.deposit || 0).toString())
    .replace(/{shopName}/g, shopDetails?.name || 'Rental Shop')
    .replace(/{shopAddress}/g, shopDetails?.address || '')
    .replace(/{shopPhone}/g, shopDetails?.phone || '')
    .replace(/{shopEmail}/g, shopDetails?.email || '')
    .replace(/{shopGST}/g, shopDetails?.gstNumber || '');
  
  return message;
}

// Generate WhatsApp share URL
export function getWhatsAppShareUrl(phoneNumber: string, message: string): string {
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
}
