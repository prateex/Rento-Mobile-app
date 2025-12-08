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
  regNo: string;
  modelYear: string;
  fuelType: 'Petrol' | 'Electric';
  pricePerDay: number;
  status: 'Available' | 'Booked' | 'Maintenance';
  image: string; // Main thumbnail
  photos: string[]; // Gallery
  openingKm: number;
  kmDriven: number;
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
  status: 'Verified' | 'Pending';
  dateAdded: string;
  notes?: string;
}

export interface BookingHistory {
  byUserId: string;
  timestamp: string;
  changes: string;
}

export interface Booking {
  id: string;
  bikeIds: string[];
  customerId: string;
  startDate: string;
  endDate: string;
  rent: number;
  deposit: number;
  totalAmount: number;
  status: 'Booked' | 'Active' | 'Completed' | 'Cancelled' | 'Deleted';
  paymentStatus: 'Paid' | 'Partial' | 'Unpaid';
  startImage?: string;
  endImage?: string;
  history: BookingHistory[];
  takenAt?: string;
  takenBy?: string;
  returnedAt?: string;
  returnedBy?: string;
  paidAt?: string;
  paidBy?: string;
  cancelledAt?: string;
  refundAmount?: number;
  finalized?: boolean;
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
  };

  login: (phone: string) => void;
  logout: () => void;
  
  addBike: (bike: Bike) => void;
  updateBike: (id: string, data: Partial<Bike>) => void;
  deleteBike: (id: string) => void;
  
  addCustomer: (customer: Customer) => void;
  updateCustomer: (id: string, data: Partial<Customer>) => void;
  
  addBooking: (booking: Booking) => void;
  updateBooking: (id: string, data: Partial<Booking>) => void;
  deleteBooking: (id: string) => void;
  cancelBooking: (id: string) => void;
  returnBooking: (id: string) => void;
  markBookingAsTaken: (id: string) => void;
  updatePaymentStatus: (id: string, status: 'Paid' | 'Partial' | 'Unpaid') => void;

  addUser: (user: User) => void;
  removeUser: (id: string) => void;

  toggleRevenueVisibility: () => void;
  toggleBackdateOverride: () => void;
}

// Seed Data
const MOCK_BIKES: Bike[] = [
  {
    id: '1',
    name: 'Royal Enfield Classic 350',
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
        allowBackdateOverride: false
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

      markBookingAsTaken: (id) => set((state) => {
        const user = state.user;
        const booking = state.bookings.find(b => b.id === id);
        const existingHistory = booking && Array.isArray(booking.history) ? booking.history : [];
        return {
          bookings: state.bookings.map((b) => (b.id === id ? { 
            ...b, 
            status: 'Active', 
            takenAt: new Date().toISOString(),
            takenBy: user?.id,
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
    }),
    {
      name: 'bike-rental-store',
    }
  )
);
