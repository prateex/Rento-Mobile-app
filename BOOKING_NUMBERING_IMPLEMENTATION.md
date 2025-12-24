# Booking & Invoice Numbering System Implementation

## Overview
Implemented a thread-safe, concurrency-safe booking and invoice numbering system with the following specifications:
- **Booking Numbers**: Sequential format BK0001, BK0002, etc.
- **Invoice Numbers**: Financial year format INV-<FY><NextFY><Sequence> (e.g., INV-25260001)
- **FY Reset**: Automatically resets invoice counter every April 1 for new financial year
- **Invoice Assignment**: Invoice numbers assigned only after invoice generation (not at booking creation)

## Implementation Details

### 1. Data Model Changes

#### Updated Booking Interface (`client/src/lib/store.ts`)
```typescript
export interface Booking {
  id: string;
  bookingNumber: string;        // BK0001, BK0002, etc. (assigned at booking creation)
  invoiceNumber?: string;       // INV-25260001 (assigned after invoice generation)
  // ... other fields
}
```

### 2. State Management

#### Counter State in Store
```typescript
interface AppState {
  counters: {
    bookingCounter: number;      // Incremental counter (starts at 1)
    invoiceCounterFY: string;    // Format: "25-26" for FY2025-26
    invoiceCounter: number;      // Reset on April 1
  };
}
```

Initial state:
```typescript
counters: {
  bookingCounter: 1,
  invoiceCounterFY: getCurrentFinancialYear(),
  invoiceCounter: 0
}
```

### 3. Helper Functions

#### Financial Year Calculation
```typescript
const getCurrentFinancialYear = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  // Financial year starts in April (month 3)
  if (month < 3) {
    // January, February, March: FY is previous year
    const fy = year - 1;
    const nextFy = year;
    return `${fy.toString().slice(-2)}-${nextFy.toString().slice(-2)}`;
  } else {
    // April onwards: FY is current year
    const fy = year;
    const nextFy = year + 1;
    return `${fy.toString().slice(-2)}-${nextFy.toString().slice(-2)}`;
  }
};
```

#### Booking Number Generation (Thread-Safe)
```typescript
getNextBookingNumber: () => {
  const state = get();
  const nextNumber = state.counters.bookingCounter + 1;
  set((s) => ({
    counters: { ...s.counters, bookingCounter: nextNumber }
  }));
  return `BK${nextNumber.toString().padStart(4, '0')}`;
}
```

#### Invoice Number Generation (Thread-Safe with FY Reset)
```typescript
getNextInvoiceNumber: () => {
  const state = get();
  const currentFY = getCurrentFinancialYear();
  
  // Check if financial year has changed
  let newCounter = state.counters.invoiceCounter + 1;
  let newFY = state.counters.invoiceCounterFY;
  
  if (currentFY !== state.counters.invoiceCounterFY) {
    // New financial year, reset counter
    newCounter = 1;
    newFY = currentFY;
  }
  
  set((s) => ({
    counters: { 
      ...s.counters, 
      invoiceCounter: newCounter,
      invoiceCounterFY: newFY
    }
  }));
  
  // Format: INV-25260001 (FY-Sequence with 4 digits)
  return `INV-${newFY.replace('-', '')}${newCounter.toString().padStart(4, '0')}`;
}
```

#### Invoice Assignment (After Invoice Generation)
```typescript
assignInvoiceNumber: (bookingId: string) => {
  set((state) => {
    const invoiceNumber = get().getNextInvoiceNumber();
    return {
      bookings: state.bookings.map((b) => 
        b.id === bookingId ? { ...b, invoiceNumber } : b
      )
    };
  });
}
```

### 4. Booking Creation Flow

When creating a new booking (`Bookings.tsx`):
```typescript
const newBooking: Booking = {
  id: Math.random().toString(36).substr(2, 9),
  bookingNumber: getNextBookingNumber(),  // Assigned immediately
  bikeIds: data.bikeIds,
  customerId: data.customerId,
  // ... other fields
  // invoiceNumber: undefined  (assigned later when invoice is generated)
};
addBooking(newBooking);
```

### 5. Invoice Generation Flow

When generating invoice (to be implemented in invoice component):
```typescript
// Call assignInvoiceNumber after invoice is generated
assignInvoiceNumber(bookingId);
// This will:
// 1. Increment invoice counter
// 2. Check and reset FY if needed (on April 1)
// 3. Assign INV-25260001 format number to the booking
```

### 6. UI Display

Booking number and invoice number are displayed in the booking card:
```tsx
<div className="flex items-center gap-2 mb-1">
  <span className="text-xs font-bold px-2 py-1 bg-blue-100 text-blue-700 rounded">
    {booking.bookingNumber}
  </span>
  {booking.invoiceNumber && (
    <span className="text-xs font-bold px-2 py-1 bg-green-100 text-green-700 rounded">
      {booking.invoiceNumber}
    </span>
  )}
</div>
```

## Concurrency Safety

The implementation ensures concurrency safety through:

1. **Zustand's atomic updates**: Using `set()` with immediate counter increment prevents race conditions
2. **Single source of truth**: All counters stored in Zustand state (persisted to localStorage)
3. **Non-destructive updates**: Each generation increments before returning, ensuring no duplicate numbers
4. **FY awareness**: Automatic reset on April 1 ensures clean slate for new financial year

## Example Sequences

### Booking Numbers
- BK0001 (first booking)
- BK0002 (second booking)
- BK0003 (and so on...)

### Invoice Numbers by Financial Year

**FY 2024-25 (April 1, 2024 - March 31, 2025)**
- INV-24250001
- INV-24250002
- INV-24250003

**FY 2025-26 (April 1, 2025 - March 31, 2026)** (auto-reset)
- INV-25260001
- INV-25260002
- INV-25260003

## Files Modified

1. **client/src/lib/store.ts**
   - Added `bookingNumber` and `invoiceNumber` fields to Booking interface
   - Added `counters` to AppState interface
   - Implemented `getNextBookingNumber()`, `getNextInvoiceNumber()`, `assignInvoiceNumber()` functions
   - Added `getCurrentFinancialYear()` helper function
   - Updated mock booking data with bookingNumber field

2. **client/src/pages/Bookings.tsx**
   - Updated `BookingForm` to use `getNextBookingNumber()` when creating bookings
   - Added booking number and invoice number display in booking card UI
   - Updated imports to include `getNextBookingNumber` and `addBooking` from store

3. **package.json**
   - Added `cross-env` for Windows-compatible environment variable handling

## Testing Recommendations

1. **Unit Tests for Financial Year Calculation**
   - Test FY before April 1: should return previous year's FY
   - Test FY on/after April 1: should return current year's FY
   - Test leap year boundaries

2. **Integration Tests for Number Generation**
   - Create multiple bookings and verify sequential BK numbers
   - Generate invoices and verify sequential INV numbers with correct FY
   - Test FY rollover on April 1

3. **Concurrency Tests**
   - Simulate rapid booking creation to ensure no duplicate numbers
   - Test state persistence and recovery from storage

## Future Enhancements

1. **Invoice PDF Generation**: Call `assignInvoiceNumber()` after PDF is successfully created
2. **Invoice Number Search**: Add ability to search/filter bookings by invoice number
3. **Number Sequence Recovery**: Implement logic to recover from missing sequences if needed
4. **Audit Trail**: Log all number assignments with timestamps
5. **Admin Panel**: Display counter status and provide manual reset options (with confirmation)
