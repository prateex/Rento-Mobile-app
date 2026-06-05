/**
 * Safe utility functions to prevent runtime crashes from undefined/null values
 */

/**
 * Safely converts a value to a string, returning empty string for undefined/null
 */
export function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

/**
 * Safely converts a value to an array, returning empty array for non-arrays
 */
export function safeArray<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value;
  return [];
}

/**
 * Safely checks if a string/array includes a value
 */
export function safeIncludes(haystack: unknown, needle: unknown): boolean {
  if (typeof haystack === 'string' && (typeof needle === 'string' || typeof needle === 'number')) {
    return haystack.includes(String(needle));
  }
  if (Array.isArray(haystack)) {
    return haystack.includes(needle);
  }
  return false;
}

/**
 * Safely splits a string, returns empty array for non-strings
 */
export function safeSplit(value: unknown, separator?: string | RegExp): string[] {
  if (typeof value === 'string') {
    return value.split(separator as any);
  }
  return [];
}

/**
 * Safely maps over an array
 */
export function safeMap<T, U>(arr: unknown, fn: (item: T, index: number) => U): U[] {
  if (Array.isArray(arr)) {
    return arr.map(fn);
  }
  return [];
}

/**
 * Safely filters an array
 */
export function safeFilter<T>(arr: unknown, fn: (item: T, index: number) => boolean): T[] {
  if (Array.isArray(arr)) {
    return arr.filter(fn);
  }
  return [];
}

/**
 * Safely checks if a date string is valid before parsing
 */
export function isValidDateString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !isNaN(Date.parse(value));
}

// ============================================
// ADVANCED SAFETY UTILITIES
// ============================================

/**
 * Safely converts a value to a number with fallback
 */
export function safeNumber(value: unknown, defaultValue = 0): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Safely converts a value to a Date object, returns null if invalid
 */
export function safeDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  try {
    const date = new Date(String(value));
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

// ============================================
// DATA NORMALIZATION LAYER
// ============================================

import type { Booking, Customer, Bike, Damage } from './store';

/**
 * Normalize Damage object to ensure all fields are safe
 */
export function normalizeDamage(damage: any): Damage {
  return {
    id: safeString(damage?.id || Math.random().toString(36).substr(2, 9)),
    type: damage?.type || 'Other',
    severity: damage?.severity || 'minor',
    date: isValidDateString(damage?.date) ? damage.date : new Date().toISOString(),
    photoUrls: safeArray<string>(damage?.photoUrls),
    notes: safeString(damage?.notes),
    addedBy: safeString(damage?.addedBy || 'unknown'),
    addedAt: isValidDateString(damage?.addedAt) ? damage.addedAt : new Date().toISOString()
  };
}

/**
 * Normalize Booking object to ensure all fields are safe for rendering
 * - Ensures dates are always valid or current date
 * - Ensures arrays are always arrays
 * - Ensures numbers are always numbers
 * - Converts snake_case DB fields to camelCase
 */
export function normalizeBooking(booking: any): Booking {
  if (!booking) {
    throw new Error('Cannot normalize null/undefined booking');
  }

  const startDate = booking.start_date || booking.startDate;
  const endDate = booking.end_date || booking.endDate;

  return {
    id: safeString(booking.id),
    bookingNumber: safeString(booking.booking_number || booking.bookingNumber || 'BK0000'),
    invoiceNumber: booking.invoice_number || booking.invoiceNumber,
    bikeIds: safeArray<string>(booking.bike_ids || booking.bikeIds),
    customerId: safeString(booking.customer_id || booking.customerId),
    startDate: isValidDateString(startDate) ? startDate : new Date().toISOString(),
    endDate: isValidDateString(endDate) ? endDate : new Date().toISOString(),
    rent: safeNumber(booking.rent),
    deposit: safeNumber(booking.deposit),
    totalAmount: safeNumber(booking.total_amount || booking.totalAmount),
    status: booking.status || 'Booked',
    paymentStatus: booking.payment_status || booking.paymentStatus || 'Unpaid',
    paymentChoice: booking.payment_choice || booking.paymentChoice,
    paymentMode: booking.payment_mode || booking.paymentMode,
    paymentType: booking.payment_type || booking.paymentType,
    utrNumber: booking.utr_number || booking.utrNumber,
    advanceAmount: safeNumber(booking.advance_amount || booking.advanceAmount, undefined),
    remainingAmount: safeNumber(booking.remaining_amount || booking.remainingAmount, undefined),
    startImage: booking.start_image || booking.startImage,
    endImage: booking.end_image || booking.endImage,
    openingOdometer: safeNumber(booking.opening_odometer || booking.openingOdometer, undefined),
    closingOdometer: safeNumber(booking.closing_odometer || booking.closingOdometer, undefined),
    damagesDuringRental: safeArray<any>(booking.damages_during_rental || booking.damagesDuringRental).map(normalizeDamage),
    depositDeduction: safeNumber(booking.deposit_deduction || booking.depositDeduction, undefined),
    damageNotes: booking.damage_notes || booking.damageNotes,
    history: safeArray<any>(booking.history).map(h => ({
      byUserId: safeString(h?.byUserId || h?.by_user_id || 'unknown'),
      timestamp: isValidDateString(h?.timestamp) ? h.timestamp : new Date().toISOString(),
      changes: safeString(h?.changes)
    })),
    takenAt: booking.taken_at || booking.takenAt,
    takenBy: booking.taken_by || booking.takenBy,
    returnedAt: booking.returned_at || booking.returnedAt,
    returnedBy: booking.returned_by || booking.returnedBy,
    paidAt: booking.paid_at || booking.paidAt,
    paidBy: booking.paid_by || booking.paidBy,
    cancelledAt: booking.cancelled_at || booking.cancelledAt,
    invoiceGeneratedAt: booking.invoice_generated_at || booking.invoiceGeneratedAt,
    invoiceGeneratedBy: booking.invoice_generated_by || booking.invoiceGeneratedBy,
    refundAmount: safeNumber(booking.refund_amount || booking.refundAmount, undefined),
    finalized: Boolean(booking.finalized),
    invoicePending: Boolean(booking.invoice_pending || booking.invoicePending),
    whatsappSent: booking.whatsapp_sent || booking.whatsappSent || {}
  };
}

/**
 * Normalize Customer object to ensure all fields are safe for rendering
 */
export function normalizeCustomer(customer: any): Customer {
  if (!customer) {
    throw new Error('Cannot normalize null/undefined customer');
  }

  return {
    id: safeString(customer.id),
    customerNumber: customer.customer_number || customer.customerNumber,
    name: safeString(customer.name || 'Unknown'),
    phone: safeString(customer.phone),
    email: customer.email,
    address: customer.address,
    idType: customer.id_type || customer.idType || 'Aadhaar',
    idPhotos: {
      front: safeString((customer.id_photos || customer.idPhotos)?.front || ''),
      back: (customer.id_photos || customer.idPhotos)?.back
    },
    documents: safeArray<any>(customer.documents).map(doc => ({
      type: safeString(doc?.type),
      url: safeString(doc?.url)
    })),
    status: customer.status || 'Pending',
    dateAdded: isValidDateString(customer.date_added || customer.dateAdded || customer.created_at) 
      ? (customer.date_added || customer.dateAdded || customer.created_at)
      : new Date().toISOString(),
    notes: customer.notes
  };
}

/**
 * Normalize Bike/Vehicle object to ensure all fields are safe for rendering
 */
export function normalizeBike(bike: any): Bike {
  if (!bike) {
    throw new Error('Cannot normalize null/undefined bike');
  }

  return {
    id: safeString(bike.id),
    name: safeString(bike.name || 'Unknown Vehicle'),
    brand: bike.brand,
    model: bike.model,
    regNo: safeString(bike.reg_no || bike.regNo || 'N/A'),
    modelYear: safeString(bike.model_year || bike.modelYear || new Date().getFullYear().toString()),
    fuelType: bike.fuel_type || bike.fuelType || 'Petrol',
    type: bike.type || 'bike',
    pricePerDay: safeNumber(bike.price_per_day || bike.pricePerDay),
    status: bike.status || 'Available',
    image: safeString(bike.image || '/placeholder-bike.jpg'),
    photos: safeArray<string>(bike.photos),
    openingKm: safeNumber(bike.opening_km || bike.openingKm),
    kmDriven: safeNumber(bike.km_driven || bike.kmDriven),
    lastClosingOdometer: safeNumber(bike.last_closing_odometer || bike.lastClosingOdometer, undefined),
    damages: safeArray<any>(bike.damages).map(normalizeDamage)
  };
}

/**
 * Safe format date - returns empty string if date is invalid
 */
export function safeDateFormat(date: unknown, formatStr: string, formatFn: (date: Date, format: string) => string): string {
  const safeD = safeDate(date);
  if (!safeD) return '';
  try {
    return formatFn(safeD, formatStr);
  } catch {
    return '';
  }
}

/**
 * Safe parseISO - returns null if string is invalid
 */
export function safeParseISO(dateString: unknown, parseISOFn: (dateString: string) => Date): Date | null {
  if (!isValidDateString(dateString)) return null;
  try {
    const parsed = parseISOFn(dateString);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}
