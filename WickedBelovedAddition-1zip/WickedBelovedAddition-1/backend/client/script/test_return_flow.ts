// Quick end-to-end simulation for Return Flow
// Run with: npx tsx script/test_return_flow.ts

// @ts-nocheck
// Polyfill localStorage for Zustand persist
(globalThis as any).localStorage = (function () {
  const store: Record<string, string> = {};
  return {
    getItem(key: string) { return store[key] ?? null; },
    setItem(key: string, value: string) { store[key] = String(value); },
    removeItem(key: string) { delete store[key]; },
    clear() { Object.keys(store).forEach(k => delete store[k]); }
  } as Storage;
})();

import { useStore } from "../src/lib/store";

async function run() {
  const s = useStore.getState();

  console.log('Initial bikes count:', s.bikes.length);
  console.log('Initial bookings count:', s.bookings.length);

  // Ensure an admin user
  s.login('9999999999');

  const bike = s.bikes[0];
  const customer = s.customers[0];

  // Create booking
  const bookingId = 'test-ret-' + Date.now();
  const bookingNumber = s.getNextBookingNumber();
  const booking = {
    id: bookingId,
    bookingNumber,
    bikeIds: [bike.id],
    customerId: customer.id,
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
    rent: 1000,
    deposit: 500,
    totalAmount: 1500,
    status: 'Active' as const,
    paymentStatus: 'Unpaid' as const,
    history: [] as any[],
  };

  s.addBooking(booking as any);
  console.log('Created booking', booking.bookingNumber, booking.id);

  // Simulate return flow inputs
  const closingOdometer = 12345;
  const newDamages = [
    {
      id: 'dmg-' + Date.now(),
      type: 'Scratch',
      severity: 'minor',
      date: new Date().toISOString(),
      photoUrls: [],
      notes: 'Small scratch near left panel',
      addedBy: 'test-script',
      addedAt: new Date().toISOString(),
    }
  ];

  const depositDeduction = 200;
  const damageNotes = 'Scratch assessed; minor';

  // Update booking with return details
  s.updateBooking(bookingId, {
    closingOdometer,
    depositDeduction,
    damageNotes,
    returnedAt: new Date().toISOString(),
    status: 'Completed',
    finalized: true,
  });

  // Update bike with damages and last closing
  s.updateBike(bike.id, {
    damages: [...(bike.damages || []), ...newDamages],
    lastClosingOdometer: closingOdometer,
    status: 'Available'
  });

  // Assign invoice number
  s.assignInvoiceNumber(bookingId);

  // Fetch and display result
  const updatedBooking = useStore.getState().bookings.find(b => b.id === bookingId);
  const updatedBike = useStore.getState().bikes.find(b => b.id === bike.id);

  console.log('--- Return Flow Result ---');
  console.log('Booking:', updatedBooking?.id, updatedBooking?.bookingNumber, updatedBooking?.status, 'closingOdo=', updatedBooking?.closingOdometer, 'depositDeduction=', updatedBooking?.depositDeduction, 'invoice=', updatedBooking?.invoiceNumber);
  console.log('Bike:', updatedBike?.id, updatedBike?.name, 'lastClosingOdo=', updatedBike?.lastClosingOdometer, 'damagesCount=', updatedBike?.damages?.length);

  // Verify invoice number present
  if (updatedBooking?.invoiceNumber) {
    console.log('Invoice assigned:', updatedBooking.invoiceNumber);
  } else {
    console.error('Invoice was not assigned');
  }
}

run().catch(e => { console.error(e); process.exit(1); });
