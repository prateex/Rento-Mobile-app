import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role = 'admin' | 'staff';

export interface User {
  id: string;
  name: string;
  phone: string;
  role: Role;
  email?: string;
}

export type DamageType = 'Scratch' | 'Dent' | 'Broken Mirror' | 'Tyre' | 'Mechanical' | 'Other';

export interface Damage {
  id: string;
  type: DamageType;
  severity: 'minor' | 'major';
  date: string;
  photoUrls: string[];
  notes: string;
  addedBy: string;
  addedAt: string;
}

export interface Bike {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  regNo: string;
  modelYear: string;
  fuelType: 'Petrol' | 'Electric';
  type?: 'bike' | 'car';
  pricePerDay: number;
  status: 'Available' | 'Booked' | 'Maintenance';
  image: string; // Main thumbnail
  photos: string[]; // Gallery
  openingKm: number;
  kmDriven: number;
  lastClosingOdometer?: number; // Last odometer reading when returned
  damages: Damage[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  idType: 'Aadhaar' | 'Voter ID' | 'Passport' | 'Driving License';
  idPhotos: {
    front: string;
    back?: string;
  };
  documents?: { type: string; url: string }[];
  status: 'Verified' | 'Pending';
  dateAdded: string;
  notes?: string;
}

export interface BookingHistory {
  byUserId: string;
  timestamp: string;
  changes: string;
}

export type PaymentMode = 'Cash' | 'UPI' | 'Other';
export type PaymentChoice = 'Booking Only' | 'Advance Paid' | 'Fully Paid';
export type BookingStatus = 'Booked' | 'Advance Paid' | 'Confirmed' | 'Active' | 'Completed' | 'Cancelled' | 'Deleted';

export interface Booking {
  id: string;
  bookingNumber: string; // BK0001, BK0002, etc.
  invoiceNumber?: string; // INV-25260001, assigned after invoice generation
  bikeIds: string[];
  customerId: string;
  startDate: string;
  endDate: string;
  rent: number;
  deposit: number;
  totalAmount: number;
  status: BookingStatus;
  paymentStatus: 'Paid' | 'Partial' | 'Unpaid';
  paymentChoice?: PaymentChoice; // Booking Only, Advance Paid, Fully Paid
  paymentMode?: PaymentMode; // Cash, UPI, Other
  paymentType?: PaymentMode; // explicit type used during mark paid flow
  utrNumber?: string; // For UPI payments
  advanceAmount?: number; // amount collected as advance (part of rent)
  remainingAmount?: number; // totalAmount - advanceAmount when partial
  startImage?: string;
  endImage?: string;
  openingOdometer?: number; // Odometer reading at start (Mark Taken)
  closingOdometer?: number; // Odometer reading at return (Mark Returned)
  damagesDuringRental?: Damage[]; // Damages found during this rental
  depositDeduction?: number; // Amount deducted from deposit (default 0)
  damageNotes?: string; // Summary of damages found
  history: BookingHistory[];
  takenAt?: string;
  takenBy?: string;
  returnedAt?: string;
  returnedBy?: string;
  paidAt?: string;
  paidBy?: string;
  cancelledAt?: string;
  invoiceGeneratedAt?: string;
  invoiceGeneratedBy?: string;
  refundAmount?: number;
  finalized?: boolean;
  invoicePending?: boolean; // Track if invoice needs to be generated
  whatsappSent?: {
    bookingConfirmation?: boolean;
    paymentConfirmation?: boolean;
    invoice?: boolean;
  };
}

interface AppState {
  user: User | null;
  bikes: Bike[];
  customers: Customer[];
  bookings: Booking[];
  users: User[]; // List of staff members
  settings: {
    showRevenueOnDashboard: boolean;
    allowBackdateOverride: boolean;
    gstNumber?: string; // Owner's GST number for invoice calculation
  };
  whatsappTemplates: {
    bookingConfirmation: string;
    paymentConfirmation: string;
    invoiceMessage: string;
  };
  counters: {
    bookingCounter: number;
    invoiceCounterFY: string; // Format: "25-26" for FY2025-26
    invoiceCounter: number;
  };

  login: (phone: string) => void;
  logout: () => void;
  
  addBike: (bike: Bike) => void;
  updateBike: (id: string, data: Partial<Bike>) => void;
  deleteBike: (id: string) => void;
  
  addCustomer: (customer: Customer) => void;
  updateCustomer: (id: string, data: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  
  addBooking: (booking: Booking) => void;
  updateBooking: (id: string, data: Partial<Booking>) => void;
  deleteBooking: (id: string) => void;
  cancelBooking: (id: string) => void;
  returnBooking: (id: string) => void;
  markBookingAsTaken: (id: string, openingOdometer?: number) => void;
  updatePaymentStatus: (id: string, status: 'Paid' | 'Partial' | 'Unpaid') => void;
  
  getNextBookingNumber: () => string;
  getNextInvoiceNumber: () => string;
  assignInvoiceNumber: (bookingId: string) => void;

  addUser: (user: User) => void;
  removeUser: (id: string) => void;

  toggleRevenueVisibility: () => void;
  toggleBackdateOverride: () => void;
  updateWhatsappTemplate: (type: 'bookingConfirmation' | 'paymentConfirmation' | 'invoiceMessage', message: string) => void;
  updateSettings: (settings: Partial<AppState['settings']>) => void;
}

// Seed Data
const MOCK_BIKES: Bike[] = [
  {
    id: '1',
    name: 'Royal Enfield Classic 350',
    type: 'bike',
    regNo: 'KA-01-HJ-1234',
    modelYear: '2023',
    fuelType: 'Petrol',
    pricePerDay: 1200,
    status: 'Available',
    image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c3d?auto=format&fit=crop&q=80&w=800',
    photos: ['https://images.unsplash.com/photo-1558981806-ec527fa84c3d?auto=format&fit=crop&q=80&w=800'],
    openingKm: 1500,
    kmDriven: 1500,
    damages: []
  },
  {
    id: '2',
    name: 'Honda Activa 6G',
    type: 'bike',
    regNo: 'KA-05-MN-5678',
    modelYear: '2022',
    fuelType: 'Petrol',
    pricePerDay: 500,
    status: 'Booked',
    image: 'https://images.unsplash.com/photo-1506469717960-4335a42f56ba?auto=format&fit=crop&q=80&w=800',
    photos: ['https://images.unsplash.com/photo-1506469717960-4335a42f56ba?auto=format&fit=crop&q=80&w=800'],
    openingKm: 5000,
    kmDriven: 5200,
    damages: []
  },
  {
    id: '3',
    name: 'Ather 450X',
    type: 'bike',
    regNo: 'KA-53-EV-9012',
    modelYear: '2024',
    fuelType: 'Electric',
    pricePerDay: 800,
    status: 'Available',
    image: 'https://images.unsplash.com/photo-1633856368316-4c3b6f6203d7?auto=format&fit=crop&q=80&w=800',
    photos: ['https://images.unsplash.com/photo-1633856368316-4c3b6f6203d7?auto=format&fit=crop&q=80&w=800'],
    openingKm: 200,
    kmDriven: 200,
    damages: []
  },
  {
    id: '4',
    name: 'Toyota Fortuner',
    type: 'car',
    regNo: 'KA-01-AB-5000',
    modelYear: '2023',
    fuelType: 'Petrol',
    pricePerDay: 3500,
    status: 'Available',
    image: 'https://images.unsplash.com/photo-1605559424843-9e4c3ff86b90?auto=format&fit=crop&q=80&w=800',
    photos: ['https://images.unsplash.com/photo-1605559424843-9e4c3ff86b90?auto=format&fit=crop&q=80&w=800'],
    openingKm: 1000,
    kmDriven: 1200,
    damages: []
  },
  {
    id: '5',
    name: 'Maruti Swift',
    type: 'car',
    regNo: 'KA-02-CD-6789',
    modelYear: '2022',
    fuelType: 'Petrol',
    pricePerDay: 2000,
    status: 'Available',
    image: 'https://images.unsplash.com/photo-1552820728-8ac41f1ce891?auto=format&fit=crop&q=80&w=800',
    photos: ['https://images.unsplash.com/photo-1552820728-8ac41f1ce891?auto=format&fit=crop&q=80&w=800'],
    openingKm: 500,
    kmDriven: 750,
    damages: []
  }
];

const MOCK_CUSTOMERS: Customer[] = [
  {
    id: '1',
    name: 'Rahul Kumar',
    phone: '9876543210',
    status: 'Verified',
    idType: 'Aadhaar',
    idPhotos: { front: 'https://placehold.co/600x400/png' },
    dateAdded: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Priya Sharma',
    phone: '9988776655',
    status: 'Verified',
    idType: 'Driving License',
    idPhotos: { front: 'https://placehold.co/600x400/png' },
    dateAdded: new Date().toISOString()
  }
];

const MOCK_BOOKINGS: Booking[] = [
  {
    id: '1',
    bookingNumber: 'BK0001',
    bikeIds: ['2'],
    customerId: '1',
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days later
    rent: 1000,
    deposit: 2000,
    totalAmount: 3000,
    status: 'Active',
    paymentStatus: 'Paid',
    history: []
  }
];

const MOCK_USERS: User[] = [
  { id: '1', name: 'Vikram M', phone: '9999999999', role: 'admin' },
  { id: '2', name: 'Suresh J', phone: '8888888888', role: 'staff' }
];

/**
 * Gets the current financial year in format "YY-YY" (e.g., "25-26" for FY 2025-26)
 * Financial year starts on April 1
 */
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

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      bikes: MOCK_BIKES,
      customers: MOCK_CUSTOMERS,
      bookings: MOCK_BOOKINGS,
      users: MOCK_USERS,
      settings: {
        showRevenueOnDashboard: true,
        allowBackdateOverride: false,
        gstNumber: undefined
      },
      whatsappTemplates: {
        bookingConfirmation: 'Hi {customerName}, your booking #{bookingNumber} is confirmed!\n\nBike: {bikeName} ({regNo})\nStart Date: {startDate}\nEnd Date: {endDate}\nTotal Amount: ₹{totalAmount}\n\nThank you for choosing us!',
        paymentConfirmation: 'Hi {customerName}, payment of ₹{paidAmount} received for booking #{bookingNumber}.\n\nPayment Mode: {paymentMode}\nRemaining Balance: ₹{remainingBalance}\n\nThank you!',
        invoiceMessage: 'Hi {customerName}, your invoice #{invoiceNumber} for booking #{bookingNumber} is ready.\n\nAmount: ₹{totalAmount}\nDeposit Deducted: ₹{depositDeduction}\nRefund: ₹{refundAmount}\n\nPlease find the attached PDF.'
      },
      counters: {
        bookingCounter: 1,
        invoiceCounterFY: getCurrentFinancialYear(),
        invoiceCounter: 0
      },

      login: (phone) => {
        // Mock Login Logic
        if (phone === '9999999999') {
          set({ user: { id: 'admin', name: 'Shop Owner', phone, role: 'admin' } });
        } else {
          set({ user: { id: 'staff', name: 'Staff Member', phone, role: 'staff' } });
        }
      },
      logout: () => set({ user: null }),

      addBike: (bike) => set((state) => ({ bikes: [...state.bikes, bike] })),
      updateBike: (id, data) => set((state) => ({
        bikes: state.bikes.map((b) => (b.id === id ? { ...b, ...data } : b))
      })),
      deleteBike: (id) => set((state) => ({
        bikes: state.bikes.filter((b) => b.id !== id)
      })),

      addCustomer: (customer) => set((state) => ({ customers: [...state.customers, customer] })),
      updateCustomer: (id, data) => set((state) => ({
        customers: state.customers.map((c) => (c.id === id ? { ...c, ...data } : c))
      })),
      deleteCustomer: (id) => set((state) => ({
        customers: state.customers.filter((c) => c.id !== id)
      })),

      addBooking: (booking) => set((state) => {
        // Update bike status if booking is active/booked
        const newBikes = state.bikes.map(b => {
          if (booking.bikeIds.includes(b.id) && booking.status === 'Active') {
             // Simplistic status update - in real app would depend on dates
             // For MVP, if it starts today, mark as Booked/Unavailable
             return b; 
          }
          return b;
        });
        return { bookings: [...state.bookings, booking], bikes: newBikes };
      }),
      updateBooking: (id, data) => set((state) => ({
        bookings: state.bookings.map((b) => (b.id === id ? { ...b, ...data } : b))
      })),
      deleteBooking: (id) => set((state) => ({
        bookings: state.bookings.map((b) => (b.id === id ? { ...b, status: 'Deleted' } : b))
      })),
      cancelBooking: (id) => set((state) => ({
        bookings: state.bookings.map((b) => (b.id === id ? { ...b, status: 'Cancelled', cancelledAt: new Date().toISOString() } : b))
      })),
      returnBooking: (id) => set((state) => {
        const booking = state.bookings.find(b => b.id === id);
        const user = state.user;
        if (!booking) return {};

        const newBikes = state.bikes.map(bike => {
          if (booking.bikeIds.includes(bike.id)) {
            return { ...bike, status: 'Available' };
          }
          return bike;
        });

        const existingHistory = Array.isArray(booking.history) ? booking.history : [];
        return {
          bookings: state.bookings.map((b) => (b.id === id ? { 
            ...b, 
            status: 'Completed', 
            returnedAt: new Date().toISOString(),
            returnedBy: user?.id,
            finalized: true,
            history: [...existingHistory, { byUserId: user?.id || 'unknown', timestamp: new Date().toISOString(), changes: 'Marked as Returned' }]
          } : b)),
          bikes: newBikes as Bike[]
        };
      }),

      markBookingAsTaken: (id, openingOdometer) => set((state) => {
        const user = state.user;
        const booking = state.bookings.find(b => b.id === id);
        const existingHistory = booking && Array.isArray(booking.history) ? booking.history : [];
        if (!booking || booking.status !== 'Confirmed') {
          return { bookings: state.bookings };
        }
        return {
          bookings: state.bookings.map((b) => (b.id === id ? { 
            ...b, 
            status: 'Active', 
            takenAt: new Date().toISOString(),
            takenBy: user?.id,
            openingOdometer,
            history: [...existingHistory, { byUserId: user?.id || 'unknown', timestamp: new Date().toISOString(), changes: 'Marked as Taken' }]
          } : b))
        };
      }),

      updatePaymentStatus: (id, status) => set((state) => {
        const user = state.user;
        const now = new Date().toISOString();
        const booking = state.bookings.find(b => b.id === id);
        const existingHistory = booking && Array.isArray(booking.history) ? booking.history : [];
        return {
          bookings: state.bookings.map((b) => (b.id === id ? { 
            ...b, 
            paymentStatus: status,
            paidAt: status === 'Paid' ? now : b.paidAt,
            paidBy: status === 'Paid' ? user?.id : b.paidBy,
            history: [...existingHistory, { byUserId: user?.id || 'unknown', timestamp: now, changes: `Payment status changed to ${status}` }]
          } : b))
        };
      }),

      addUser: (user) => set((state) => ({ users: [...state.users, user] })),
      removeUser: (id) => set((state) => ({ users: state.users.filter(u => u.id !== id) })),

      toggleRevenueVisibility: () => set((state) => ({
        settings: { ...state.settings, showRevenueOnDashboard: !state.settings.showRevenueOnDashboard }
      })),

      toggleBackdateOverride: () => set((state) => ({
        settings: { ...state.settings, allowBackdateOverride: !state.settings.allowBackdateOverride }
      })),

      updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings }
      })),

      /**
       * Thread-safe booking number generation
       * Returns BK0001, BK0002, etc.
       */
      getNextBookingNumber: () => {
        const state = get();
        const nextNumber = state.counters.bookingCounter + 1;
        set((s) => ({
          counters: { ...s.counters, bookingCounter: nextNumber }
        }));
        return `BK${nextNumber.toString().padStart(4, '0')}`;
      },

      /**
       * Thread-safe invoice number generation
       * Returns INV-<FY><NextFY><Sequence> (e.g., INV-25260001)
       * Resets counter on April 1 for new financial year
       */
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
      },

      /**
       * Assign invoice number to a booking after invoice generation
       * This ensures invoice number is only assigned when invoice is actually generated
       */
      assignInvoiceNumber: (bookingId: string) => {
        set((state) => {
          const invoiceNumber = get().getNextInvoiceNumber();
          return {
            bookings: state.bookings.map((b) => 
              b.id === bookingId ? { ...b, invoiceNumber } : b
            )
          };
        });
      },

      updateWhatsappTemplate: (type, message) => set((state) => ({
        whatsappTemplates: { ...state.whatsappTemplates, [type]: message }
      })),
    }),
    {
      name: 'bike-rental-store',
    }
  )
);
