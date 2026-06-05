import { format, parseISO, differenceInDays } from 'date-fns';

/**
 * Format date for display
 */
export function formatDate(date: string | Date): string {
  try {
    const parsedDate = typeof date === 'string' ? parseISO(date) : date;
    return format(parsedDate, 'MMM dd, yyyy');
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}

/**
 * Format date and time for display
 */
export function formatDateTime(date: string | Date): string {
  try {
    const parsedDate = typeof date === 'string' ? parseISO(date) : date;
    return format(parsedDate, 'MMM dd, yyyy hh:mm a');
  } catch (error) {
    console.error('Error formatting date time:', error);
    return '';
  }
}

/**
 * Format date for input field
 */
export function formatDateForInput(date: Date): string {
  try {
    return format(date, 'yyyy-MM-dd');
  } catch (error) {
    console.error('Error formatting date for input:', error);
    return '';
  }
}

/**
 * Format time for input field
 */
export function formatTimeForInput(date: Date): string {
  try {
    return format(date, 'HH:mm');
  } catch (error) {
    console.error('Error formatting time for input:', error);
    return '';
  }
}

/**
 * Calculate days between two dates
 */
export function calculateDays(startDate: string | Date, endDate: string | Date): number {
  try {
    const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
    const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
    const days = differenceInDays(end, start);
    return days > 0 ? days : 1;
  } catch (error) {
    console.error('Error calculating days:', error);
    return 1;
  }
}

/**
 * Combine date and time into ISO string
 */
export function combineDateAndTime(date: string, time: string): string {
  try {
    const dateTime = new Date(`${date}T${time}:00`);
    return dateTime.toISOString();
  } catch (error) {
    console.error('Error combining date and time:', error);
    return new Date().toISOString();
  }
}

/**
 * Check if date is in the past
 */
export function isPastDate(date: string | Date): boolean {
  try {
    const checkDate = typeof date === 'string' ? parseISO(date) : date;
    return checkDate < new Date();
  } catch (error) {
    console.error('Error checking past date:', error);
    return false;
  }
}

/**
 * Get minimum date for date picker (today)
 */
export function getMinDate(): string {
  return formatDateForInput(new Date());
}

/**
 * Get remaining minutes before expiry window ends
 */
export function getMinutesRemaining(createdAt: string | Date, expiryMinutes: number): number {
  try {
    const created = typeof createdAt === 'string' ? parseISO(createdAt) : createdAt;
    const expiresAt = created.getTime() + expiryMinutes * 60 * 1000;
    const diffMs = expiresAt - Date.now();
    return Math.max(0, Math.ceil(diffMs / (60 * 1000)));
  } catch (error) {
    console.error('Error calculating expiry countdown:', error);
    return 0;
  }
}
