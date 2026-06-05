import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiRequest } from './queryClient';
import { supabase, isSupabaseEnabledNow } from './supabase';
import { getAuthContext } from './shopIdHelper';
import {
  fromDbBookingStatus,
  fromDbPaymentStatus,
  mapBookingPayloadToDb,
  toDbBookingStatus,
  toDbPaymentStatus,
} from '@shared/bookingEnums';
import { getCustomerIdPhotoUrl } from './photoService';
import { toast } from '@/hooks/use-toast';
import type { Session } from '@supabase/supabase-js';

export type Role = 'admin' | 'staff' | 'owner';

export interface User {
  id: string;
  name: string;
  phone: string;
  role: Role;
  email?: string;
}

export interface Permissions {
  canEditCustomer: boolean;
  canDeleteCustomer: boolean;
  canEditBooking: boolean;
  canDeleteBooking: boolean;
  canEditVehicle: boolean;
  canDeleteVehicle: boolean;
  canManageUsers: boolean;
  canViewAdminPanel: boolean;
}

export function getPermissions(role: Role | null): Permissions {
  // FIXED: Owner must have FULL permissions (same as admin)
  const isOwnerOrAdmin = role === 'admin' || role === 'owner';
  
  // Staff can add/edit/delete customers and vehicles, but not manage users or view admin panel
  const isStaff = role === 'staff';
  
  return {
    canEditCustomer: isOwnerOrAdmin || isStaff,
    canDeleteCustomer: isOwnerOrAdmin || isStaff,
    canEditBooking: isOwnerOrAdmin, // Bookings: handled with status-based checks in component
    canDeleteBooking: isOwnerOrAdmin, // Bookings: handled with status-based checks in component
    canEditVehicle: isOwnerOrAdmin || isStaff,
    canDeleteVehicle: isOwnerOrAdmin || isStaff,
    canManageUsers: isOwnerOrAdmin,
    canViewAdminPanel: isOwnerOrAdmin,
  };
}

export type DamageType = 'Scratch' | 'Dent' | 'Broken Mirror' | 'Tyre' | 'Mechanical' | 'Other';

export interface Damage {
  id: string;
  type: DamageType;
  severity: 'minor' | 'major' | 'moderate';
  date: string;
  notes: string;
  addedBy: string;
  addedAt: string;
  photoUrls?: string[];
  isPersisted?: boolean; // true = DB row, false/undefined = temp/not-yet-saved
}

export interface Bike {
  id: string;
  cc?: string;
  segment?: string;
  gearType?: string;
  category?: string;
  name: string;
  brand?: string;
  model?: string;
  regNo: string;
  modelYear: string;
  fuelType: 'Petrol' | 'Electric';
  type?: 'bike' | 'scooter' | 'car' | 'ev';
  pricePerDay: number;
  status: 'Available' | 'Booked' | 'Maintenance' | 'Rented';
  image: string; // Main thumbnail
  photos: string[]; // Gallery
  openingKm: number;
  kmDriven: number;
  lastClosingOdometer?: number; // Last odometer reading when returned
  damages: Damage[];
  isPublished?: boolean; // Publish on website
}

export interface Customer {
  id: string;
    customerNumber?: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
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

export interface Invoice {
  id: string;
  invoiceNumber: string; // INV-2526-0001 (FY based)
  bookingId: string;
  customerSnapshot: {
    name: string;
    phone: string;
  };
  vehiclesSnapshot: Array<{
    name: string;
    regNo: string;
  }>;
  startDate: string;
  endDate: string;
  rent: number;
  deposit: number;
  depositDeduction: number;
  totalPayable: number; // rent - depositDeduction
  refundAmount: number; // deposit - depositDeduction
  generatedAt: string;
  generatedBy: string; // admin user id
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export type PaymentMode = 'Cash' | 'UPI' | 'Other';
export type PaymentChoice = 'Booking Only' | 'Advance Paid' | 'Fully Paid';
export type BookingStatus = 'requested' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'expired';

export interface Booking {
  id: string;
  bookingNumber: string; // BK0001, BK0002, etc.
  invoiceNumber?: string; // INV-25260001, assigned after invoice generation
  bikeIds: string[];
  customerId: string;
  pickupPointId?: string;
  customerAuthId?: string;
  vehicleId?: string; // online booking vehicle id
  startDate: string;
  endDate: string;
  rent: number;
  deposit: number;
  totalAmount: number;
  status: BookingStatus;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  isOnlineBooking?: boolean; // true = created via customer website, false = manual/offline
  customerName?: string; // online booking customer name
  customerPhone?: string; // online booking customer phone
  pickupAt?: string; // online booking pickup datetime
  dropoffAt?: string; // online booking dropoff datetime
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
  invoice?: Invoice; // Invoice data if generated
  invoiceLocked?: boolean; // Prevents edits after invoice generation
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
  notes?: string;
}

export interface ShopPickupPoint {
  id: string;
  shopId: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  addressText?: string;
  city?: string;
  pincode?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

interface AppState {
  user: User | null;
  authToken: string | null;
  session: Session | null;
  shopId: string | null;
  deviceId?: string;
  bikes: Bike[];
  customers: Customer[];
  bookings: Booking[];
  pickupPoints: ShopPickupPoint[];
  invoices: Invoice[]; // Invoice records
  notifications: AppNotification[];
  invoiceCounter: number; // Counter for invoice numbering (resets on FY change)
  invoiceFiscalYear: string; // Current FY for invoice (e.g., '2526' for 2025-26)
  users: User[]; // List of staff members
  shopDetails: {
    name?: string;
    address?: string;
    email?: string;
    phone?: string;
    gstNumber?: string;
    // Pickup location fields (from rental_shops)
    state?: string; // Goa, Maharashtra, etc.
    city?: string; // Panaji, Mumbai, etc.
    pincode?: string; // 6-digit pincode
    pickupLocationName?: string; // Panjim KTC Bus Stand
    pickupAddress?: string; // Full address of pickup point
    pickupLat?: number; // Set via map picker (15.4909)
    pickupLng?: number; // Set via map picker (73.8278)
    pickupAddressText?: string; // Reverse-geocoded address
    pickupLatitude?: number; // Primary pickup latitude
    pickupLongitude?: number; // Primary pickup longitude
    pickupCity?: string; // Reverse-geocoded city
    pickupPincode?: string; // Reverse-geocoded pincode
    termsAndConditions?: string;
  };
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
    customerCounter: number;
    invoiceCounterFY: string; // Format: "25-26" for FY2025-26
    invoiceCounter: number;
  };

  addBike: (bike: Bike) => void;
  updateBike: (id: string, data: Partial<Bike>) => Promise<void>;
  deleteBike: (id: string) => Promise<void>;
  
  addCustomer: (customer: Customer) => void;
  updateCustomer: (id: string, data: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  
  addBooking: (booking: Booking) => void;
  updateBooking: (id: string, data: Partial<Booking>) => Promise<void>;
  deleteBooking: (id: string) => Promise<void>;
  cancelBooking: (id: string) => void;
  returnBooking: (id: string) => void;
  markBookingAsTaken: (id: string, openingOdometer?: number) => void;
  updatePaymentStatus: (id: string, status: 'paid' | 'partial' | 'unpaid') => void;
  
  updateShopDetails: (details: Partial<AppState['shopDetails']>) => Promise<void>;
  generateInvoice: (bookingId: string) => Promise<Invoice | null>;
  getInvoiceByBookingId: (bookingId: string) => Invoice | undefined;
  assignInvoiceNumber: (bookingId: string) => Promise<void>;

  addUser: (user: User) => void;
  removeUser: (id: string) => void;

  toggleRevenueVisibility: () => void;
  toggleBackdateOverride: () => void;
  updateWhatsappTemplate: (type: 'bookingConfirmation' | 'paymentConfirmation' | 'invoiceMessage', message: string) => void;
  updateSettings: (settings: Partial<AppState['settings']>) => void;
  
  refreshAllData: () => Promise<void>;
  refreshBikes: () => Promise<void>;
  refreshCustomers: () => Promise<void>;
  refreshBookings: () => Promise<void>;
  fetchPickupPoints: (shopId?: string) => Promise<ShopPickupPoint[]>;
  addPickupPoint: (data: Omit<ShopPickupPoint, 'id' | 'shopId' | 'isActive' | 'createdAt'> & { isActive?: boolean }) => Promise<ShopPickupPoint>;
  updatePickupPoint: (id: string, data: Partial<Omit<ShopPickupPoint, 'id' | 'shopId' | 'createdAt'>>) => Promise<void>;
  setDefaultPickupPoint: (id: string) => Promise<void>;
  disablePickupPoint: (id: string) => Promise<void>;
  refreshUsers: () => Promise<void>;
  refreshShopDetails: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  loadDamagesForVehicle: (vehicleId: string, shopId: string) => Promise<Damage[]>;
  resolveShopId: () => Promise<string>;

  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

// REMOVED: All mock seed data
// App now ONLY works with data from Supabase database
// No mock bikes, customers, bookings, or users

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

const warnSupabaseDisabled = (scope: string) => {
  if (!isSupabaseEnabledNow()) {
    console.warn(`[${scope}] Supabase disabled. Operating in local/Zustand mode only.`);
    return true;
  }
  return false;
};

/**
 * Sanitize vehicle payload to match DB schema EXACTLY
 * GROUND TRUTH: public.vehicles columns (enum vehicle_type = {bike, car})
 * - type (enum vehicle_type)
 * - name (text)
 * - daily_rate (numeric)
 * - opening_km (numeric)
 * - current_odometer (numeric)
 * - image_url (NOT image)
 * NOTE: Frontend may show scooter/ev, but payload MUST normalize to DB enum (bike/car only)
 */
const sanitizeVehiclePayload = (data: Partial<Bike>) => {
  const payload: Record<string, any> = {};

  // Map ONLY real DB columns (public.vehicles)
  if (data.name !== undefined) payload.name = data.name;
  if (data.brand !== undefined) payload.brand = data.brand;
  if (data.model !== undefined) payload.model = data.model;
  if (data.regNo !== undefined) payload.registration_number = data.regNo;
  if (data.type !== undefined) {
    // DB enum vehicle_type = {bike, car}; coerce everything else to bike
    payload.type = data.type === 'car' ? 'car' : 'bike';
  }
  if (data.modelYear !== undefined) payload.year = Number(data.modelYear) || null;
  if (data.image !== undefined) payload.image_url = data.image;
  if (data.pricePerDay !== undefined) payload.daily_rate = Number(data.pricePerDay) || 0;
  if (data.status !== undefined) payload.status = data.status;
  if (data.openingKm !== undefined) payload.opening_km = Number(data.openingKm) || 0;
  if (data.kmDriven !== undefined) payload.current_odometer = Number(data.kmDriven) || 0;
  if (data.cc !== undefined) payload.cc = data.cc;
  if (data.segment !== undefined) payload.segment = data.segment;
  if (data.gearType !== undefined) payload.gear_type = data.gearType;
  if (data.category !== undefined) payload.category = data.category;
  // REMOVED: damages must NOT be written to vehicles table
  // damages table is the single source of truth
  if (data.fuelType !== undefined) payload.fuel_type = data.fuelType;
  if (data.isPublished !== undefined) payload.is_published = data.isPublished;

  // Explicitly drop unsupported frontend-only fields
  delete payload.pricePerDay;
  delete payload.image;
  delete payload.openingKm;
  delete payload.kmDriven;
  delete payload.regNo;
  delete (payload as any).photos;
  delete (payload as any).fuelType;

  return payload;
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      authToken: null,
      session: null,
      shopId: null,
      bikes: [], // Start empty - load from Supabase
      customers: [], // Start empty - load from Supabase
      bookings: [], // Start empty - load from Supabase
      pickupPoints: [],
      invoices: [], // Start empty - load from Supabase
      notifications: [], // Start empty - load from Supabase
      invoiceCounter: 0,
      invoiceFiscalYear: getCurrentFinancialYear(),
      users: [], // Start empty - load from Supabase
      shopDetails: {
        name: undefined,
        address: undefined,
        email: undefined,
        phone: undefined,
        gstNumber: undefined,
        state: undefined,
        city: undefined,
        pincode: undefined,
        pickupLocationName: undefined,
        pickupAddress: undefined,
        pickupLat: undefined,
        pickupLng: undefined,
        pickupAddressText: undefined,
        pickupLatitude: undefined,
        pickupLongitude: undefined,
        pickupCity: undefined,
        pickupPincode: undefined,
        termsAndConditions: undefined
      },
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
        customerCounter: 1,
        invoiceCounterFY: getCurrentFinancialYear(),
        invoiceCounter: 0
      },

      // Ensure a stable device ID stored locally
      getDeviceId: (): string => {
        const existing = localStorage.getItem('device_id');
        if (existing) {
          // Cache in state
          if (!get().deviceId) set({ deviceId: existing });
          return existing;
        }
        const newId = `web-${Math.random().toString(36).slice(2)}-${Date.now()}`;
        localStorage.setItem('device_id', newId);
        set({ deviceId: newId });
        return newId;
      },

      resolveShopId: async () => {
        const existing = get().shopId;
        if (existing) return existing;

        const authContext = await getAuthContext();
        if (!authContext?.shopId) {
          throw new Error('shop_id not resolved – blocking insert');
        }

        set({ shopId: authContext.shopId });
        return authContext.shopId;
      },

      login: async (email: string, password: string): Promise<boolean> => {
        try {
          if (warnSupabaseDisabled('Login')) {
            // Local mode ONLY for testing - must explicitly set owner role
            const offlineUser: User = {
              id: 'offline-user',
              name: email || 'Offline Owner',
              phone: '',
              role: 'owner', // ← EXPLICIT, never implicit
              email: email || 'offline@local.dev',
            };
            set({ user: offlineUser, authToken: 'offline-local', session: null });
            return true;
          }

          console.log('[Login] Attempting Supabase auth...');
          
          // Use Supabase directly for authentication
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            console.error('[Login] Supabase auth error:', error);
            return false;
          }

          if (!data.session || !data.user) {
            console.error('[Login] No session or user returned');
            return false;
          }

          console.log('[Login] Success:', { 
            userId: data.user.id, 
            email: data.user.email,
            hasSession: !!data.session 
          });

          // CRITICAL: Fetch user from database (SOURCE OF TRUTH for role)
          console.log('[Login] Fetching user profile for auth_id:', data.user.id);
          const { data: dbUser, error: dbError } = await supabase
            .from('users')
            .select('id, role, name, phone, email, shop_id')
            .eq('auth_id', data.user.id)
            .single();

          let mappedUser: User;

          if (dbUser && !dbError) {
            // Use database user data (role from users table)
            mappedUser = {
              id: data.user.id,
              name: dbUser.name || data.user.email || 'User',
              phone: dbUser.phone || '',
              role: dbUser.role as Role, // ← FROM DATABASE, NOT user_metadata
              email: dbUser.email || data.user.email || undefined,
            };
            console.log('[Login] ✓ User profile found:', { role: dbUser.role, shop_id: dbUser.shop_id });
          } else {
            // Distinguish between "no row" vs "RLS block"
            console.error('[Login] ✗ DB fetch failed:', {
              error: dbError,
              code: dbError?.code,
              message: dbError?.message,
              hint: dbError?.hint
            });
            
            // If row doesn't exist (PGRST116), show specific error
            if (dbError?.code === 'PGRST116') {
              throw new Error('User profile not found in database. Please contact your administrator.');
            }
            
            // Otherwise it's likely an RLS or permissions issue
            throw new Error(`Database access denied: ${dbError?.message || 'Unknown error'}`);
          }

          const authContext = await getAuthContext();

          set({ 
            user: mappedUser, 
            authToken: data.session.access_token,
            session: data.session,
            shopId: authContext.shopId,
          });
          
          // CRITICAL: Force refresh all data from DB after successful auth
          console.log('[Login] Refreshing all data from database...');
          await get().refreshAllData();
          console.log('[Login] Data refresh complete');
          
          return true;
        } catch (e) {
          console.error('[Login] Exception:', e);
          return false;
        }
      },
      
      logout: async () => {
        try {
          if (!warnSupabaseDisabled('Logout')) {
            await supabase.auth.signOut();
          }
        } catch (e) {
          console.error('[Logout] Error:', e);
        }
        try {
          // Clear all client-side state and caches
          sessionStorage.clear();
          localStorage.clear();
        } catch {}
        set({ user: null, authToken: null, session: null, shopId: null, bikes: [], customers: [], bookings: [], users: [], notifications: [] });
      },

      addBike: (bike) => set((state) => ({ bikes: [...state.bikes, bike] })),
      updateBike: async (id, data) => {
        try {
          if (warnSupabaseDisabled('updateBike')) {
            throw new Error('Supabase disabled');
          }

          console.log('[updateBike] Payload before sanitization:', data);

          // Validate vehicle type against current DB enum {bike, car}; frontend may have scooter/ev but DB cannot accept them yet
          if (data.type !== undefined) {
            const allowedTypes = ['bike', 'car'] as const;
            if (!allowedTypes.includes((data.type === 'car' ? 'car' : 'bike') as any)) {
              throw new Error(`Invalid vehicle type: ${data.type}. Must be one of: ${allowedTypes.join(', ')}`);
            }
            data = { ...data, type: data.type === 'car' ? 'car' : 'bike' };
          }

          // Update via Supabase with proper authentication
          const { data: sessionData } = await supabase.auth.getSession();
          const uid = sessionData.session?.user?.id;
          if (!uid) throw new Error('Not authenticated');

          const { data: userData } = await supabase.from('users').select('shop_id').eq('auth_id', uid).single();
          const shopId = userData?.shop_id;
          if (!shopId) throw new Error('No shop found');

          const updatePayload = sanitizeVehiclePayload(data);

          console.log('[updateBike] Sanitized payload to DB:', updatePayload);

          const { data: updatedRow, error } = await supabase
            .from('vehicles')
            .update(updatePayload)
            .eq('id', id)
            .eq('shop_id', shopId)
            .select('*')
            .single();

          console.log('[updateBike] Supabase response:', { data: updatedRow, error });

          if (error) {
            console.error('[updateBike] Supabase error:', error);
            throw error;
          }

          console.log('[updateBike] Update successful — refreshing bikes');

          await get().refreshBikes();
        } catch (error) {
          console.error('[updateBike] Exception:', error);
          throw error;
        }
      },
      deleteBike: async (id) => {
        try {
          if (warnSupabaseDisabled('deleteBike')) {
            set((state) => ({ bikes: state.bikes.filter((b) => b.id !== id) }));
            return;
          }

          console.log('[deleteBike] Starting delete for bike:', id);
          const { error } = await supabase
            .from('vehicles')
            .delete()
            .eq('id', id);

          if (error) {
            console.error('[deleteBike] Supabase delete error:', error);
            throw error;
          }

          console.log('[deleteBike] Supabase delete successful. Updating local state.');
          set((state) => ({
            ...state,
            bikes: state.bikes.filter((b) => b.id !== id)
          }));
          console.log('[deleteBike] Local state updated.');
        } catch (error: any) {
          console.error('[deleteBike] Error deleting vehicle:', error);
          const message = error?.message || 'Failed to delete vehicle';
          throw new Error(message);
        }
      },

      addCustomer: (customer) => set((state) => ({ customers: [...state.customers, customer] })),
      updateCustomer: async (id, data) => {
        try {
          if (warnSupabaseDisabled('updateCustomer')) {
            throw new Error('Supabase disabled');
          }

          console.log('[updateCustomer] Input data:', data);
          console.log('[updateCustomer] Record ID:', id);

          const { data: sessionData } = await supabase.auth.getSession();
          const uid = sessionData.session?.user?.id;
          if (!uid) throw new Error('Not authenticated');

          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('shop_id')
            .eq('auth_id', uid)
            .single();
          if (userError) throw userError;

          const shopId = userData?.shop_id;
          console.log('[updateCustomer] Shop ID:', shopId);
          if (!shopId) throw new Error('No shop found');

          const updatePayload: Record<string, any> = {};
          if (data.name !== undefined) updatePayload.full_name = data.name;
          if (data.phone !== undefined) updatePayload.phone = data.phone;
          if (data.email !== undefined) updatePayload.email = data.email;
          if (data.address !== undefined) updatePayload.address = data.address;
          if (data.city !== undefined) updatePayload.city = data.city;
          if (data.state !== undefined) updatePayload.state = data.state;
          if (data.pincode !== undefined) updatePayload.pincode = data.pincode;
          if (data.idType !== undefined) updatePayload.id_type = data.idType;
          if (data.documents !== undefined) updatePayload.documents = data.documents;
          if (data.status !== undefined) updatePayload.status = data.status;
          if (data.notes !== undefined) updatePayload.notes = data.notes;

          console.log('[updateCustomer] Update payload:', updatePayload);

          const { data: updatedRow, error } = await supabase
            .from('customers')
            .update(updatePayload)
            .eq('id', id)
            .eq('shop_id', shopId)
            .select('*')
            .single();

          console.log('[updateCustomer] Supabase response:', { data: updatedRow, error });

          if (error) {
            console.error('[updateCustomer] Supabase error:', error);
            throw error;
          }

          console.log('[updateCustomer] Update successful — refreshing customers');

          await get().refreshCustomers();
        } catch (error) {
          console.error('Error updating customer:', error);
          throw error;
        }
      },
      deleteCustomer: async (id) => {
        try {
          if (warnSupabaseDisabled('deleteCustomer')) {
            set((state) => ({
              customers: state.customers.filter((c) => c.id !== id),
            }));
            return;
          }

          console.log('[deleteCustomer] Starting delete for customer:', id);

          // STEP 1: BLOCK DELETE IF CUSTOMER HAS ACTIVE BOOKINGS
          const { count, error: countError } = await supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .eq('customer_id', id)
            .is('deleted_at', null);

          console.log('[deleteCustomer] Active booking count:', count);

          if (countError) throw countError;

          if ((count || 0) > 0) {
            throw new Error('Customer has existing bookings and cannot be deleted');
          }

          // STEP 2: SOFT DELETE CUSTOMER (trigger handles deleted_at)
          console.log('[deleteCustomer] Executing DELETE on customers table');
          const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', id);

          if (error) {
            throw error;
          }

          console.log('[deleteCustomer] Customer deleted successfully. Now deleting associated photos.');

          // STEP 3: SOFT DELETE CUSTOMER ID PHOTOS (trigger handles deleted_at)
          const { error: photoError } = await supabase
            .from('customer_id_photos')
            .delete()
            .eq('customer_id', id);

          if (photoError) throw photoError;

          console.log('[deleteCustomer] Associated photos deleted. Updating local state.');

          // STEP 4: UPDATE LOCAL STATE
          set((state) => ({
            ...state,
            customers: state.customers.filter((c) => c.id !== id),
          }));

          console.log('[deleteCustomer] Local state updated. Delete complete.');
        } catch (error: any) {
          console.error('Error deleting customer:', error);
          throw new Error(error?.message || 'Failed to delete customer');
        }
      },

      addBooking: (booking) => set((state) => {
        // Update bike status if booking is active/booked
        const newBikes = state.bikes.map(b => {
          if (booking.bikeIds.includes(b.id) && booking.status === 'active') {
             // Simplistic status update - in real app would depend on dates
             // For MVP, if it starts today, mark as Booked/Unavailable
             return b; 
          }
          return b;
        });
        return { bookings: [...state.bookings, booking], bikes: newBikes };
      }),
      updateBooking: async (id, data) => {
        try {
          if (warnSupabaseDisabled('updateBooking')) {
            throw new Error('Supabase disabled');
          }

          console.log('[updateBooking] Input data:', data);
          console.log('[updateBooking] Record ID:', id);

          // Update via Supabase with proper authentication
          const { data: sessionData } = await supabase.auth.getSession();
          const uid = sessionData.session?.user?.id;
          if (!uid) throw new Error('Not authenticated');

          const { data: userData } = await supabase.from('users').select('shop_id').eq('auth_id', uid).single();
          const shopId = userData?.shop_id;
          console.log('[updateBooking] Shop ID:', shopId);
          if (!shopId) throw new Error('No shop found');

          const updatePayload: any = {};
          if (data.bikeIds !== undefined) updatePayload.vehicle_ids = data.bikeIds;
          if (data.customerId !== undefined) updatePayload.customer_id = data.customerId;
          if (data.pickupPointId !== undefined) updatePayload.pickup_point_id = data.pickupPointId;
          if (data.startDate !== undefined) {
            updatePayload.start_date = data.startDate;
            updatePayload.start_datetime = data.startDate;
          }
          if (data.endDate !== undefined) {
            updatePayload.end_date = data.endDate;
            updatePayload.end_datetime = data.endDate;
          }
          if (data.rent !== undefined) updatePayload.rent = data.rent;
          if (data.deposit !== undefined) updatePayload.deposit = data.deposit;
          if (data.totalAmount !== undefined) updatePayload.total_amount = data.totalAmount;
          if (data.advanceAmount !== undefined) updatePayload.advance_amount = data.advanceAmount;
          if (data.remainingAmount !== undefined) updatePayload.balance_amount = data.remainingAmount;
          if (data.paymentStatus !== undefined) updatePayload.payment_status = toDbPaymentStatus(data.paymentStatus);
          if (data.paymentChoice !== undefined) updatePayload.payment_choice = data.paymentChoice;
          if (data.paymentMode !== undefined) updatePayload.payment_mode = data.paymentMode;
          if (data.paymentType !== undefined) updatePayload.payment_type = data.paymentType;
          if (data.utrNumber !== undefined) updatePayload.utr_number = data.utrNumber;
          if (data.status !== undefined) {
            updatePayload.status = toDbBookingStatus(data.status);
          }
          if (data.openingOdometer !== undefined) updatePayload.opening_odometer = data.openingOdometer;
          if (data.closingOdometer !== undefined) updatePayload.closing_odometer = data.closingOdometer;
          if (data.takenAt !== undefined) updatePayload.taken_at = data.takenAt;
          if (data.returnedAt !== undefined) updatePayload.returned_at = data.returnedAt;
          if (data.cancelledAt !== undefined) updatePayload.cancelled_at = data.cancelledAt;
          if (data.invoiceNumber !== undefined) updatePayload.invoice_number = data.invoiceNumber;
          if (data.damagesDuringRental !== undefined) updatePayload.damages_during_rental = data.damagesDuringRental;
          if (data.damageNotes !== undefined) updatePayload.damage_notes = data.damageNotes;
          if (data.depositDeduction !== undefined) updatePayload.deposit_deduction = data.depositDeduction;
          if (data.refundAmount !== undefined) updatePayload.refund_amount = data.refundAmount;
          if (data.history !== undefined) updatePayload.history = data.history;
          if (data.finalized !== undefined) updatePayload.finalized = data.finalized;
          if (data.invoicePending !== undefined) updatePayload.invoice_pending = data.invoicePending;
          if (data.whatsappSent !== undefined) updatePayload.whatsapp_sent = data.whatsappSent;
          if (data.notes !== undefined) updatePayload.notes = data.notes;

          console.log('[updateBooking] Update payload:', updatePayload);

          const { data: updatedRow, error } = await supabase
            .from('bookings')
            .update(updatePayload)
            .eq('id', id)
            .eq('shop_id', shopId)
            .select('*')
            .single();

          console.log('[updateBooking] Supabase response:', { data: updatedRow, error });

          if (error) {
            console.error('[updateBooking] Supabase error:', error);
            throw error;
          }

          console.log('[updateBooking] Update successful — refreshing bookings');

          await get().refreshBookings();
        } catch (error) {
          console.error('Error updating booking:', error);
          throw error;
        }
      },
      deleteBooking: async (id) => {
        try {
          if (warnSupabaseDisabled('deleteBooking')) {
            set((state) => ({ bookings: state.bookings.filter((b) => b.id !== id) }));
            return;
          }

          const { error } = await supabase
            .from('bookings')
            .delete()
            .eq('id', id);

          if (error) {
            throw error;
          }

          set((state) => ({
            ...state,
            bookings: state.bookings.filter((b) => b.id !== id)
          }));
        } catch (error: any) {
          console.error('Error deleting booking:', error);
          const message = error?.message || 'Failed to delete booking';
          throw new Error(message);
        }
      },
      cancelBooking: (id) => set((state) => ({
        bookings: state.bookings.map((b) => (b.id === id ? { ...b, status: 'cancelled', cancelledAt: new Date().toISOString() } : b))
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
            status: 'completed', 
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
        if (!booking || booking.status !== 'confirmed') {
          return { bookings: state.bookings };
        }
        return {
          bookings: state.bookings.map((b) => (b.id === id ? { 
            ...b, 
            status: 'active', 
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
            paidAt: status === 'paid' ? now : b.paidAt,
            paidBy: status === 'paid' ? user?.id : b.paidBy,
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
       * Generate invoice for a completed booking
       * Invoice number is DB-generated via trigger
       */
      generateInvoice: async (bookingId: string) => {
        const state = get();
        const booking = state.bookings.find(b => b.id === bookingId);
        
        if (!booking) {
          console.error('Booking not found');
          return null;
        }
        
        if (booking.status !== 'completed') {
          console.error('Only completed bookings can have invoices generated');
          return null;
        }

        // Guard: If invoice already exists, STOP
        if (booking.invoice || booking.invoiceNumber) {
          console.warn('Invoice already exists:', booking.invoiceNumber);
          return booking.invoice || null;
        }
        
        // Get customer and bike details
        const customer = state.customers.find(c => c.id === booking.customerId);
        const vehicles = booking.bikeIds.map(bikeId => {
          const bike = state.bikes.find(b => b.id === bikeId);
          return bike ? { name: bike.name, regNo: bike.regNo } : null;
        }).filter(v => v !== null) as Array<{ name: string; regNo: string }>;
        
        if (!customer || vehicles.length === 0) {
          console.error('Customer or vehicles not found');
          return null;
        }
        
        // Calculate amounts
        const depositDeduction = booking.depositDeduction || 0;
        const totalPayable = booking.rent - depositDeduction;
        const refundAmount = booking.deposit - depositDeduction;
        
        // Update DB: set status=Completed, invoice_pending=false
        // DB trigger will generate invoice_number automatically
        if (isSupabaseEnabledNow()) {
          try {
            const { data, error } = await supabase
              .from('bookings')
              .update({ 
                status: 'completed',
                invoice_pending: false,
                finalized: true,
              })
              .eq('id', bookingId)
              .select('invoice_number, invoice_generated_at')
              .single();
            
            if (error) throw error;
            
            if (!data?.invoice_number) {
              console.error('DB did not generate invoice_number');
              return null;
            }

            // Create invoice object with DB-generated number
            const invoice: Invoice = {
              id: `inv-${Date.now()}`,
              invoiceNumber: data.invoice_number,
              bookingId: booking.id,
              customerSnapshot: {
                name: customer.name,
                phone: customer.phone
              },
              vehiclesSnapshot: vehicles,
              startDate: booking.startDate,
              endDate: booking.endDate,
              rent: booking.rent,
              deposit: booking.deposit,
              depositDeduction,
              totalPayable,
              refundAmount,
              generatedAt: data.invoice_generated_at || new Date().toISOString(),
              generatedBy: state.user?.id || 'unknown'
            };
            
            // Update local state
            set((s) => ({
              invoices: [...s.invoices, invoice],
              bookings: s.bookings.map((b) => 
                b.id === bookingId 
                  ? { 
                      ...b, 
                      invoice, 
                      invoiceNumber: data.invoice_number,
                      invoiceLocked: true,
                      invoiceGeneratedAt: data.invoice_generated_at,
                      invoiceGeneratedBy: state.user?.id,
                      refundAmount,
                      finalized: true,
                      invoicePending: false,
                    } 
                  : b
              )
            }));
            
            return invoice;
          } catch (error) {
            console.error('[generateInvoice] Error:', error);
            return null;
          }
        }
        
        return null;
      },

      /**
       * Get invoice by booking ID
       */
      getInvoiceByBookingId: (bookingId: string) => {
        const state = get();
        return state.invoices.find(inv => inv.bookingId === bookingId);
      },

      /**
       * Assign invoice number to a booking
       * DB trigger handles invoice number generation when status=Completed and invoice_pending=FALSE
       */
      assignInvoiceNumber: async (bookingId: string) => {
        try {
          const current = get().bookings.find(b => b.id === bookingId);
          if (current?.invoiceNumber) {
            console.warn('Invoice already assigned:', current.invoiceNumber);
            return;
          }

          // Update DB: trigger will assign invoice number
          if (isSupabaseEnabledNow()) {
            const { data, error } = await supabase
              .from('bookings')
              .update({ 
                status: 'completed',
                invoice_pending: false,
                finalized: true,
              })
              .eq('id', bookingId)
              .select('invoice_number')
              .single();
            
            if (error) throw error;
            
            // Update local state
            if (data?.invoice_number) {
              set((state) => ({
                bookings: state.bookings.map((b) => 
                  b.id === bookingId 
                    ? { ...b, invoiceNumber: data.invoice_number, invoicePending: false, finalized: true } 
                    : b
                )
              }));
            }
          }
        } catch (error) {
          console.error('[assignInvoiceNumber] Exception:', error);
        }
      },

      updateWhatsappTemplate: (type, message) => set((state) => ({
        whatsappTemplates: { ...state.whatsappTemplates, [type]: message }
      })),

      updateShopDetails: async (details) => {
        if (warnSupabaseDisabled('updateShopDetails')) {
          throw new Error('Supabase disabled');
        }
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const uid = sessionData.session?.user?.id;
          if (!uid) throw new Error('Not authenticated');

          const { data: userRow } = await supabase
            .from('users')
            .select('shop_id')
            .eq('auth_id', uid)
            .single();

          const shopId = userRow?.shop_id;
          if (!shopId) throw new Error('No shop found');

          const { data: updatedRow, error } = await supabase
            .from('rental_shops')
            .update({
              name: details.name ?? null,
              address: details.address ?? null,
              email: details.email ?? null,
              phone: details.phone ?? null,
              gst_number: details.gstNumber ?? null,
              state: details.state ?? null,
              city: details.city ?? null,
              pincode: details.pincode ?? null,
              pickup_location_name: details.pickupLocationName ?? null,
              pickup_address: details.pickupAddress ?? details.pickupAddressText ?? null,
              // DB columns use pickup_lat / pickup_lng; map UI latitude/longitude into these
              pickup_lat: details.pickupLat ?? details.pickupLatitude ?? null,
              pickup_lng: details.pickupLng ?? details.pickupLongitude ?? null,
              pickup_address_text: details.pickupAddressText ?? details.pickupAddress ?? null,
              pickup_city: details.pickupCity ?? details.city ?? null,
              pickup_pincode: details.pickupPincode ?? details.pincode ?? null,
              terms_and_conditions: details.termsAndConditions ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', shopId)
            .select('*')
            .single();

          if (error) throw error;

          set((state) => ({
            shopDetails: {
              ...state.shopDetails,
              name: updatedRow?.name || undefined,
              address: updatedRow?.address || undefined,
              email: updatedRow?.email || undefined,
              phone: updatedRow?.phone || undefined,
              gstNumber: updatedRow?.gst_number || undefined,
              state: updatedRow?.state || undefined,
              city: updatedRow?.city || undefined,
              pincode: updatedRow?.pincode || undefined,
              pickupLocationName: updatedRow?.pickup_location_name || undefined,
              pickupAddress: updatedRow?.pickup_address || undefined,
              pickupLat: updatedRow?.pickup_lat ?? undefined,
              pickupLng: updatedRow?.pickup_lng ?? undefined,
              pickupAddressText: updatedRow?.pickup_address_text || updatedRow?.pickup_address || undefined,
              // UI latitude/longitude derived from pickup_lat / pickup_lng DB columns
              pickupLatitude: updatedRow?.pickup_lat ?? undefined,
              pickupLongitude: updatedRow?.pickup_lng ?? undefined,
              pickupCity: updatedRow?.pickup_city || updatedRow?.city || undefined,
              pickupPincode: updatedRow?.pickup_pincode || updatedRow?.pincode || undefined,
              termsAndConditions: updatedRow?.terms_and_conditions || undefined,
            },
          }));
        } catch (e) {
          console.error('[updateShopDetails] Error persisting shop details:', e);
          throw e;
        }
      },

      /**
       * Refresh all data from Supabase
       */
      refreshAllData: async () => {
        if (warnSupabaseDisabled('refreshAllData')) {
          throw new Error('Supabase disabled');
        }

        const { shopId } = get();
        if (!shopId) {
          throw new Error('shop_id is required before refreshAllData');
        }

        console.log('[refreshAllData] Starting refresh at', new Date().toISOString());
        const results = await Promise.allSettled([
          get().refreshBikes(),
          get().refreshCustomers(),
          get().refreshBookings(),
          get().fetchPickupPoints(),
          get().refreshUsers(),
          get().refreshShopDetails(),
          get().refreshNotifications(),
        ]);

        const labels = ['bikes', 'customers', 'bookings', 'pickup points', 'users', 'shop details', 'notifications'];
        const failures = results
          .map((res, idx) => (res.status === 'rejected' ? { idx, reason: res.reason } : null))
          .filter((r): r is { idx: number; reason: any } => Boolean(r));

        if (failures.length > 0) {
          const message = failures
            .map((f) => `${labels[f.idx]}: ${f.reason?.message || String(f.reason)}`)
            .join('; ');
          console.error('[refreshAllData] Failure(s):', message);
          toast({ title: 'Refresh failed', description: message, variant: 'destructive' });
          throw new Error(message);
        }

        console.log('[refreshAllData] Completed at', new Date().toISOString());
      },

      /**
       * Load damages for a single vehicle from public.damages table
       * INTERNAL: Only called by refreshBikes() during store initialization
       */
      loadDamagesForVehicle: async (vehicleId: string, shopId: string): Promise<Damage[]> => {
        try {
          const { data, error } = await supabase
            .from('damages')
            .select('id, description, photo_urls, type, severity, reported_at, deleted_at')
            .eq('vehicle_id', vehicleId)
            .eq('shop_id', shopId)
            .is('deleted_at', null)
            .order('reported_at', { ascending: false });

          if (error) throw error;

          const mapped: Damage[] = (data || []).map((row: any) => ({
            id: row.id,
            type: (row.type as DamageType) || 'Scratch',
            severity: (row.severity || 'minor') as 'minor' | 'moderate' | 'major',
            date: row.reported_at || new Date().toISOString(),
            photoUrls: Array.isArray(row.photo_urls) ? row.photo_urls : [],
            notes: row.description || '',
            addedBy: 'system',
            addedAt: row.reported_at || new Date().toISOString(),
            isPersisted: true,
          }));

          return mapped;
        } catch (err) {
          console.error('[loadDamagesForVehicle] Error loading damages for', vehicleId, err);
          return [];
        }
      },

      /**
       * Refresh bikes from Supabase
       * 
       * SOURCE OF TRUTH: public.damages table (NOT vehicles.damages JSONB column)
       * CRITICAL: This is the ONLY source of truth for the vehicles list.
       * ⚠️ GUARDRAIL: All vehicle list queries MUST include `.is('deleted_at', null)`.
       * ❌ PROHIBITED: Component-level vehicle fetches (outside this store).
       * ✅ REQUIRED: Every `.from('vehicles')` SELECT for lists must be here only.
       */
      refreshBikes: async () => {
        if (warnSupabaseDisabled('refreshBikes')) throw new Error('Supabase disabled');
        try {
          console.log('[refreshBikes] Starting refresh at', new Date().toISOString());
          
          const { data: sessionData } = await supabase.auth.getSession();
          const uid = sessionData.session?.user?.id;
          console.log('[refreshBikes] Auth UID:', uid);
          if (!uid) throw new Error('Not authenticated');

          const { data: userData } = await supabase.from('users').select('shop_id').eq('auth_id', uid).single();
          const shopId = userData?.shop_id;
          console.log('[refreshBikes] Shop ID:', shopId);
          if (!shopId) throw new Error('No shop found');

          const { data: rows, error } = await supabase
            .from('vehicles')
            .select('*')
            .eq('shop_id', shopId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

          console.log('[refreshBikes] Query returned', rows?.length || 0, 'bikes. Error:', error);
          
          if (error) throw error;
          
          if (Array.isArray(rows)) {
            const bikes: Bike[] = await Promise.all(rows.map(async (row) => {
              // CRITICAL: Load damages from public.damages table (single source of truth)
              const damages = await get().loadDamagesForVehicle(row.id, shopId);
              
              const bike: Bike = {
                id: row.id,
                name: row.name || '',
                brand: row.brand ?? undefined,
                model: row.model ?? undefined,
                cc: row.cc ?? undefined,
                segment: row.segment ?? undefined,
                gearType: row.gear_type ?? undefined,
                category: row.category ?? undefined,
                regNo: row.registration_number || '',
                modelYear: row.year !== null && row.year !== undefined ? String(row.year) : '',
                fuelType: (['Petrol', 'Electric'].includes(row.fuel_type)
                  ? row.fuel_type
                  : 'Petrol') as any,
                type: (row.type === 'car' ? 'car' : 'bike') as any,
                pricePerDay: Number(row.daily_rate ?? 0),
                status: row.status as Bike['status'],
                image: row.image_url || '',
                photos: Array.isArray((row.documents as any)?.photos) ? (row.documents as any).photos : [],
                openingKm: Number(row.opening_km ?? 0),
                kmDriven: Number(row.current_odometer ?? 0),
                lastClosingOdometer: row.last_closing_odometer ?? undefined,
                damages, // SOURCE: public.damages table, NOT vehicles.damages column
                isPublished: row.is_published ?? false,
              };
              (bike as any).documents = row.documents ?? [];
              return bike;
            }));
            console.log('[refreshBikes] Setting', bikes.length, 'bikes to state with damages from public.damages table');
            set({ bikes });
            console.log('[refreshBikes] State updated successfully');
          }
        } catch (e) {
          console.error('[refreshBikes] Error:', e);
          throw e;
        }
      },

      /**
       * Refresh customers from Supabase
       */
      refreshCustomers: async () => {
        if (warnSupabaseDisabled('refreshCustomers')) throw new Error('Supabase disabled');
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const uid = sessionData.session?.user?.id;
          if (!uid) throw new Error('Not authenticated');

          const { data: userData } = await supabase.from('users').select('shop_id').eq('auth_id', uid).single();
          const shopId = userData?.shop_id;
          if (!shopId) throw new Error('No shop found');

          const { data: rows, error } = await supabase
            .from('customers')
            .select('*')
            .eq('shop_id', shopId)
            .is('deleted_at', null);

          if (error) {
            console.error('[refreshCustomers] Query error:', error);
            throw error;
          }

          if (Array.isArray(rows)) {
            // Generate signed URLs so UI can render photos reliably
            const customers: Customer[] = await Promise.all(rows.map(async (row: any) => {
              const frontPath: string | null = row.id_photo_front_path || null;
              const backPath: string | null = row.id_photo_back_path || null;
              const frontUrl = frontPath ? await getCustomerIdPhotoUrl(frontPath, 3600) : '';
              const backUrl = backPath ? await getCustomerIdPhotoUrl(backPath, 3600) : undefined;

              return {
                id: row.id,
                customerNumber: row.customer_number,
                name: row.full_name || '',
                phone: row.phone || '',
                email: row.email,
                address: row.address,
                city: row.city,
                state: row.state,
                pincode: row.pincode,
                idType: row.id_type as Customer['idType'],
                idPhotos: {
                  front: frontUrl || '',
                  back: backUrl || undefined,
                },
                documents: row.documents,
                status: row.status as Customer['status'],
                dateAdded: row.created_at || new Date().toISOString(),
                notes: row.notes,
              } as Customer;
            }));
            set({ customers });
          }
        } catch (e) {
          console.error('[refreshCustomers] Error:', e);
          throw e;
        }
      },

      /**
       * Refresh bookings from Supabase
       */
      refreshBookings: async () => {
        if (warnSupabaseDisabled('refreshBookings')) throw new Error('Supabase disabled');
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const uid = sessionData.session?.user?.id;
          if (!uid) throw new Error('Not authenticated');

          const { data: userData } = await supabase.from('users').select('shop_id').eq('auth_id', uid).single();
          const shopId = userData?.shop_id;
          if (!shopId) throw new Error('No shop found');

          const { data: rows, error } = await supabase
            .from('bookings')
            .select('*')
            .eq('shop_id', shopId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

          if (error) {
            console.error('[refreshBookings] Query error:', error);
            throw error;
          }

          if (Array.isArray(rows)) {
            const bookings: Booking[] = rows.map(row => ({
              id: row.id,
              bookingNumber: row.booking_number || '',
              invoiceNumber: row.invoice_number,
              bikeIds: row.vehicle_ids || [],
              customerId: row.customer_id || '',
              pickupPointId: row.pickup_point_id ?? undefined,
              startDate: row.start_date || '',
              endDate: row.end_date || '',
              rent: row.rent || 0,
              deposit: row.deposit || 0,
              totalAmount: row.total_amount || 0,
              status: fromDbBookingStatus(row.status) as BookingStatus,
              paymentStatus: fromDbPaymentStatus(row.payment_status),
              paymentChoice: row.payment_choice as PaymentChoice,
              paymentMode: row.payment_mode as PaymentMode,
              paymentType: row.payment_type as PaymentMode,
              utrNumber: row.utr_number,
              advanceAmount: row.advance_amount,
              remainingAmount: row.remaining_amount,
              startImage: row.start_image,
              endImage: row.end_image,
              openingOdometer: row.opening_odometer,
              closingOdometer: row.closing_odometer,
              damagesDuringRental: row.damages_during_rental,
              depositDeduction: row.deposit_deduction,
              damageNotes: row.damage_notes,
              history: row.history || [],
              takenAt: row.taken_at,
              takenBy: row.taken_by,
              returnedAt: row.returned_at,
              returnedBy: row.returned_by,
              paidAt: row.paid_at,
              paidBy: row.paid_by,
              cancelledAt: row.cancelled_at,
              invoiceGeneratedAt: row.invoice_generated_at,
              invoiceGeneratedBy: row.invoice_generated_by,
              refundAmount: row.refund_amount,
              finalized: row.finalized,
              invoicePending: row.invoice_pending,
              whatsappSent: row.whatsapp_sent,
              notes: row.notes,
            }));
            set({ bookings });
          }
        } catch (e) {
          console.error('[refreshBookings] Error:', e);
          throw e;
        }
      },

      fetchPickupPoints: async (shopId) => {
        if (warnSupabaseDisabled('fetchPickupPoints')) return [];
        try {
          const resolvedShopId = shopId || await get().resolveShopId();
          const { data, error } = await supabase
            .from('shop_pickup_points')
            .select('id, shop_id, name, latitude, longitude, address_text, city, pincode, is_default, is_active, created_at')
            .eq('shop_id', resolvedShopId)
            .eq('is_active', true)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: true });

          if (error) throw error;

          const points: ShopPickupPoint[] = (data || []).map((row: any) => ({
            id: row.id,
            shopId: row.shop_id,
            name: row.name,
            latitude: row.latitude === null ? null : Number(row.latitude),
            longitude: row.longitude === null ? null : Number(row.longitude),
            addressText: row.address_text || undefined,
            city: row.city || undefined,
            pincode: row.pincode || undefined,
            isDefault: Boolean(row.is_default),
            isActive: Boolean(row.is_active),
            createdAt: row.created_at,
          }));

          if (points.length === 1 && !points[0].isDefault) {
            const { error: defaultError } = await supabase
              .from('shop_pickup_points')
              .update({ is_default: true })
              .eq('id', points[0].id)
              .eq('shop_id', resolvedShopId);
            if (!defaultError) {
              points[0] = { ...points[0], isDefault: true };
            }
          }

          set({ pickupPoints: points });
          return points;
        } catch (error) {
          console.error('[fetchPickupPoints] Error:', error);
          return [];
        }
      },

      addPickupPoint: async (data) => {
        if (warnSupabaseDisabled('addPickupPoint')) {
          throw new Error('Database is not connected');
        }
        const shopId = await get().resolveShopId();
        const shouldSetDefault = data.isDefault ?? get().pickupPoints.length === 0;

        if (data.latitude === null || data.longitude === null) {
          throw new Error('Latitude and longitude are required');
        }

        if (shouldSetDefault) {
          const { error: clearError } = await supabase
            .from('shop_pickup_points')
            .update({ is_default: false })
            .eq('shop_id', shopId);
          if (clearError) {
            throw new Error(clearError.message || 'Failed to clear existing default pickup point');
          }
        }

        const payload = {
          shop_id: shopId,
          name: data.name.trim(),
          latitude: data.latitude,
          longitude: data.longitude,
          address_text: data.addressText?.trim() || null,
          city: data.city?.trim() || null,
          pincode: data.pincode?.trim() || null,
          is_default: shouldSetDefault,
          is_active: data.isActive ?? true,
        };

        const { data: inserted, error } = await supabase
          .from('shop_pickup_points')
          .insert(payload)
          .select('id, shop_id, name, latitude, longitude, address_text, city, pincode, is_default, is_active, created_at')
          .single();

        if (error) {
          console.error('[addPickupPoint] Error:', error);
          if (error.code === '23505') {
            throw new Error('Only one default pickup point is allowed per shop. Try again or edit the existing default.');
          }
          throw new Error(error.message || 'Failed to add pickup point');
        }

        const point: ShopPickupPoint = {
          id: inserted.id,
          shopId: inserted.shop_id,
          name: inserted.name,
          latitude: inserted.latitude === null ? null : Number(inserted.latitude),
          longitude: inserted.longitude === null ? null : Number(inserted.longitude),
          addressText: inserted.address_text || undefined,
          city: inserted.city || undefined,
          pincode: inserted.pincode || undefined,
          isDefault: Boolean(inserted.is_default),
          isActive: Boolean(inserted.is_active),
          createdAt: inserted.created_at,
        };

        set((state) => ({
          pickupPoints: point.isDefault
            ? [point, ...state.pickupPoints.map((p) => ({ ...p, isDefault: false }))]
            : [point, ...state.pickupPoints],
        }));

        return point;
      },

      updatePickupPoint: async (id, data) => {
        if (warnSupabaseDisabled('updatePickupPoint')) {
          throw new Error('Database is not connected');
        }
        const shopId = await get().resolveShopId();
        const payload: Record<string, any> = {};
        if (data.name !== undefined) payload.name = data.name.trim();
        if (data.latitude !== undefined) payload.latitude = data.latitude;
        if (data.longitude !== undefined) payload.longitude = data.longitude;
        if (data.addressText !== undefined) payload.address_text = data.addressText?.trim() || null;
        if (data.city !== undefined) payload.city = data.city?.trim() || null;
        if (data.pincode !== undefined) payload.pincode = data.pincode?.trim() || null;
        if (data.isDefault !== undefined) payload.is_default = data.isDefault;
        if (data.isActive !== undefined) payload.is_active = data.isActive;

        if (payload.is_default) {
          const { error: clearError } = await supabase
            .from('shop_pickup_points')
            .update({ is_default: false })
            .eq('shop_id', shopId);
          if (clearError) {
            throw new Error(clearError.message || 'Failed to clear existing default pickup point');
          }
        }

        const { data: updated, error } = await supabase
          .from('shop_pickup_points')
          .update(payload)
          .eq('id', id)
          .eq('shop_id', shopId)
          .select('id, shop_id, name, latitude, longitude, address_text, city, pincode, is_default, is_active, created_at')
          .single();

        if (error) {
          console.error('[updatePickupPoint] Error:', error);
          if (error.code === '23505') {
            throw new Error('Only one default pickup point is allowed per shop.');
          }
          throw new Error(error.message || 'Failed to update pickup point');
        }

        set((state) => ({
          pickupPoints: state.pickupPoints
            .map((point) => {
              if (point.id !== id) {
                return payload.is_default ? { ...point, isDefault: false } : point;
              }
              return {
                ...point,
                name: updated.name,
                latitude: updated.latitude === null ? null : Number(updated.latitude),
                longitude: updated.longitude === null ? null : Number(updated.longitude),
                addressText: updated.address_text || undefined,
                city: updated.city || undefined,
                pincode: updated.pincode || undefined,
                isDefault: Boolean(updated.is_default),
                isActive: Boolean(updated.is_active),
              };
            })
            .filter((point) => point.isActive),
        }));
      },

      setDefaultPickupPoint: async (id) => {
        if (warnSupabaseDisabled('setDefaultPickupPoint')) {
          throw new Error('Database is not connected');
        }
        const shopId = await get().resolveShopId();
        const { error: clearError } = await supabase
          .from('shop_pickup_points')
          .update({ is_default: false })
          .eq('shop_id', shopId);
        if (clearError) {
          throw new Error(clearError.message || 'Failed to update default pickup point');
        }

        const { error } = await supabase
          .from('shop_pickup_points')
          .update({ is_default: true })
          .eq('id', id)
          .eq('shop_id', shopId);

        if (error) {
          console.error('[setDefaultPickupPoint] Error:', error);
          throw new Error(error.message || 'Failed to set default pickup point');
        }

        set((state) => ({
          pickupPoints: state.pickupPoints.map((point) => ({
            ...point,
            isDefault: point.id === id,
          })),
        }));
      },

      disablePickupPoint: async (id) => {
        if (warnSupabaseDisabled('disablePickupPoint')) {
          throw new Error('Database is not connected');
        }
        if (get().pickupPoints.length <= 1) {
          throw new Error('At least one active pickup point is required.');
        }
        const shopId = await get().resolveShopId();
        const wasDefault = get().pickupPoints.find((p) => p.id === id)?.isDefault;
        const { data: updated, error } = await supabase
          .from('shop_pickup_points')
          .update({ is_active: false, is_default: false })
          .eq('id', id)
          .eq('shop_id', shopId)
          .select('id')
          .single();

        if (error) {
          console.error('[disablePickupPoint] Error:', error);
          throw new Error(error.message || 'Failed to disable pickup point');
        }

        set((state) => ({
          pickupPoints: state.pickupPoints.filter((point) => point.id !== updated.id),
        }));

        if (wasDefault) {
          const remaining = get().pickupPoints;
          if (remaining[0]) {
            await get().setDefaultPickupPoint(remaining[0].id);
          }
        }
      },

      refreshUsers: async () => {
        if (warnSupabaseDisabled('refreshUsers')) return;
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const uid = sessionData.session?.user?.id;
          if (!uid) return;

          const { data: userData } = await supabase.from('users').select('shop_id').eq('auth_id', uid).single();
          const shopId = userData?.shop_id;
          if (!shopId) return;

          const { data: rows, error } = await supabase
            .from('users')
            .select('id, name, phone, email, role, auth_id')
            .eq('shop_id', shopId);

          if (!error && Array.isArray(rows)) {
            const users: User[] = rows.map((row) => ({
              id: row.id || row.auth_id,
              name: row.name || 'User',
              phone: row.phone || '',
              role: row.role as Role,
              email: row.email || undefined,
            }));
            set({ users });
          }
        } catch (e) {
          console.error('[refreshUsers] Error:', e);
        }
      },

      refreshShopDetails: async () => {
        if (warnSupabaseDisabled('refreshShopDetails')) return;
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const uid = sessionData.session?.user?.id;
          if (!uid) return;

          const { data: userData } = await supabase.from('users').select('shop_id').eq('auth_id', uid).single();
          const shopId = userData?.shop_id;
          if (!shopId) return;

          const { data: shopRow } = await supabase
            .from('rental_shops')
            .select('*')
            .eq('id', shopId)
            .single();

          if (shopRow) {
            set({
              shopDetails: {
                name: shopRow.name || undefined,
                address: shopRow.address || undefined,
                email: shopRow.email || undefined,
                phone: shopRow.phone || undefined,
                gstNumber: shopRow.gst_number || undefined,
                state: shopRow.state || undefined,
                city: shopRow.city || undefined,
                pincode: shopRow.pincode || undefined,
                pickupLocationName: shopRow.pickup_location_name || undefined,
                pickupAddress: shopRow.pickup_address || undefined,
                pickupLat: shopRow.pickup_lat ?? undefined,
                pickupLng: shopRow.pickup_lng ?? undefined,
                pickupAddressText: shopRow.pickup_address_text || shopRow.pickup_address || undefined,
                // UI latitude/longitude derived from pickup_lat / pickup_lng DB columns
                pickupLatitude: shopRow.pickup_lat ?? undefined,
                pickupLongitude: shopRow.pickup_lng ?? undefined,
                pickupCity: shopRow.pickup_city || shopRow.city || undefined,
                pickupPincode: shopRow.pickup_pincode || shopRow.pincode || undefined,
                termsAndConditions: shopRow.terms_and_conditions || undefined,
              },
            });
          }
        } catch (e) {
          console.error('[refreshShopDetails] Error:', e);
        }
      },

      refreshNotifications: async () => {
        if (warnSupabaseDisabled('refreshNotifications')) return;
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const uid = sessionData.session?.user?.id;
          if (!uid) return;

          const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', uid)
            .order('created_at', { ascending: false });

          // Runtime guard: Check if notifications table doesn't exist
          if (error && error.message && error.message.includes('does not exist')) {
            console.warn('[refreshNotifications] Notifications table not yet created. Skipping notification fetch.');
            set({ notifications: [] });
            return;
          }

          if (error) {
            console.error('[refreshNotifications] Error:', error);
            return;
          }

          set({ notifications: data || [] });
        } catch (e) {
          // Additional guard for runtime errors
          const errorStr = String(e);
          if (errorStr.includes('does not exist')) {
            console.warn('[refreshNotifications] Notifications table not yet created. Skipping notification fetch.');
            set({ notifications: [] });
            return;
          }
          console.error('[refreshNotifications] Error:', e);
        }
      },

      markNotificationRead: async (id: string) => {
        if (warnSupabaseDisabled('markNotificationRead')) return;
        try {
          const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);

          if (error) throw error;

          set((state) => ({
            notifications: state.notifications.map((n) =>
              n.id === id ? { ...n, is_read: true } : n
            ),
          }));
        } catch (e) {
          console.error('[markNotificationRead] Error:', e);
        }
      },

      markAllNotificationsRead: async () => {
        if (warnSupabaseDisabled('markAllNotificationsRead')) return;
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const uid = sessionData.session?.user?.id;
          if (!uid) return;

          const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', uid)
            .eq('is_read', false);

          if (error) throw error;

          set((state) => ({
            notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
          }));
        } catch (e) {
          console.error('[markAllNotificationsRead] Error:', e);
        }
      },
    }),
    {
      name: 'bike-rental-store',
      version: 2, // Bump version to clear old corrupted state
      partialize: (state: AppState) => ({
        // CRITICAL: NEVER persist bikes, customers, bookings arrays
        // Always load fresh from database on app start and after auth
        user: state.user,
        authToken: state.authToken,
        session: state.session,
        invoiceCounter: state.invoiceCounter,
        invoiceFiscalYear: state.invoiceFiscalYear,
        shopDetails: state.shopDetails,
        settings: state.settings,
        counters: state.counters,
        whatsappTemplates: state.whatsappTemplates,
      })
    }
  )
);
