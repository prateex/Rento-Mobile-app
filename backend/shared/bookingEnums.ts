/**
 * Maps app booking/payment enums (lowercase workflow) ↔ Postgres enums (PascalCase).
 * DB: booking_status = Booked | Confirmed | Active | Completed | Cancelled | Taken
 * App: requested | confirmed | active | completed | cancelled | expired
 */

export type AppBookingStatus =
  | 'requested'
  | 'confirmed'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type DbBookingStatus =
  | 'Booked'
  | 'Confirmed'
  | 'Active'
  | 'Completed'
  | 'Cancelled'
  | 'Taken';

export type AppPaymentStatus = 'paid' | 'partial' | 'unpaid';
export type DbPaymentStatus = 'Paid' | 'Partial' | 'Unpaid';

const APP_STATUS_TO_DB: Record<AppBookingStatus, DbBookingStatus> = {
  requested: 'Booked',
  confirmed: 'Confirmed',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Cancelled',
};

const DB_STATUS_TO_APP: Record<string, AppBookingStatus> = {
  Booked: 'requested',
  Confirmed: 'confirmed',
  Active: 'active',
  Taken: 'active',
  Completed: 'completed',
  Cancelled: 'cancelled',
  // legacy lowercase values if present in old rows
  requested: 'requested',
  confirmed: 'confirmed',
  active: 'active',
  completed: 'completed',
  cancelled: 'cancelled',
  expired: 'expired',
};

const APP_PAYMENT_TO_DB: Record<AppPaymentStatus, DbPaymentStatus> = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
};

const DB_PAYMENT_TO_APP: Record<string, AppPaymentStatus> = {
  Unpaid: 'unpaid',
  Partial: 'partial',
  Paid: 'paid',
  unpaid: 'unpaid',
  partial: 'partial',
  paid: 'paid',
};

export function toDbBookingStatus(status: string): DbBookingStatus {
  if (status in APP_STATUS_TO_DB) {
    return APP_STATUS_TO_DB[status as AppBookingStatus];
  }
  if (['Booked', 'Confirmed', 'Active', 'Completed', 'Cancelled', 'Taken'].includes(status)) {
    return status as DbBookingStatus;
  }
  return 'Booked';
}

export function fromDbBookingStatus(status: string | null | undefined): AppBookingStatus {
  if (!status) return 'requested';
  return DB_STATUS_TO_APP[status] ?? 'requested';
}

export function toDbPaymentStatus(status: string): DbPaymentStatus {
  if (status in APP_PAYMENT_TO_DB) {
    return APP_PAYMENT_TO_DB[status as AppPaymentStatus];
  }
  if (['Unpaid', 'Partial', 'Paid'].includes(status)) {
    return status as DbPaymentStatus;
  }
  return 'Unpaid';
}

export function fromDbPaymentStatus(status: string | null | undefined): AppPaymentStatus {
  if (!status) return 'unpaid';
  return DB_PAYMENT_TO_APP[status] ?? 'unpaid';
}

/** Apply DB enum mapping to a payload before insert/update on bookings. */
export function mapBookingPayloadToDb<T extends Record<string, unknown>>(payload: T): T {
  const mapped = { ...payload } as Record<string, unknown>;
  if (typeof mapped.status === 'string') {
    mapped.status = toDbBookingStatus(mapped.status);
  }
  if (typeof mapped.payment_status === 'string') {
    mapped.payment_status = toDbPaymentStatus(mapped.payment_status);
  }
  return mapped as T;
}
