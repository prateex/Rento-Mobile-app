/**
 * Error handling utilities
 */

export type BookingErrorCode =
  | 'AVAILABILITY_UNAVAILABLE'
  | 'AVAILABILITY_CHECK_FAILED'
  | 'BOOKING_CREATE_FAILED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_DISABLED';

export class BookingError extends Error {
  code: BookingErrorCode;
  userMessage: string;

  constructor(code: BookingErrorCode, message: string, userMessage: string) {
    super(message);
    this.name = 'BookingError';
    this.code = code;
    this.userMessage = userMessage;
  }
}

export class AvailabilityError extends BookingError {
  constructor(message: string, userMessage: string) {
    super('AVAILABILITY_CHECK_FAILED', message, userMessage);
    this.name = 'AvailabilityError';
  }
}

export class BookingCreationError extends BookingError {
  constructor(message: string, userMessage: string) {
    super('BOOKING_CREATE_FAILED', message, userMessage);
    this.name = 'BookingCreationError';
  }
}

export class PaymentError extends BookingError {
  constructor(code: BookingErrorCode, message: string, userMessage: string) {
    super(code, message, userMessage);
    this.name = 'PaymentError';
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'An unexpected error occurred';
}

export function getUserFacingMessage(error: unknown, fallback: string): string {
  if (error instanceof BookingError) {
    return error.userMessage;
  }
  return fallback;
}

export function isAuthError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return message.toLowerCase().includes('auth') || 
         message.toLowerCase().includes('unauthorized') ||
         message.toLowerCase().includes('not authenticated');
}

export function isNetworkError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return message.toLowerCase().includes('network') || 
         message.toLowerCase().includes('fetch') ||
         message.toLowerCase().includes('connection');
}
