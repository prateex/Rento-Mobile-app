// Database types matching Phase 1 schema

export interface Location {
  id: string;
  name: string;
  city: string;
  state: string;
  country: string;
  latitude?: number;
  longitude?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  owner_id: string;
  registration_number: string;
  shop_id: string;
  name: string;
  type: string;
  brand?: string;
  model?: string;
  gear_type?: string;
  year?: number;
  color?: string;
  image_url?: string;
  daily_rate: number;
  status: 'Available' | 'Rented' | 'Maintenance';
  current_odometer?: number;

  // Marketplace fields
  location_id?: string;
  free_km_per_day: number;
  extra_km_rate?: number;
  security_deposit?: number;
  cancellation_policy_type: 'strict' | 'moderate' | 'standard' | 'flexible';
  fuel_type?: 'Petrol' | 'Diesel' | 'Electric' | 'CNG';
  transmission_type?: 'Manual' | 'Automatic';
  has_ac: boolean;
  has_gps: boolean;
  has_helmet: boolean;
  features?: Record<string, any>;
  is_listed_marketplace: boolean;
  is_available_for_online_booking: boolean;
  is_published: boolean;
  rating?: number;
  total_bookings: number;
  seating_capacity?: number;

  created_at: string;
  updated_at: string;
}

export interface VehicleImage {
  id: string;
  vehicle_id: string;
  image_url: string;
  alt_text?: string;
  display_order: number;
  is_primary: boolean;
  uploaded_by: string;
  created_at: string;
}

export interface VehicleWithDetails extends Vehicle {
  location?: Location;
  images?: VehicleImage[];
  owner_name?: string;
  owner_terms_and_conditions?: string | null;
  owner_pickup_location_name?: string | null;
  owner_pickup_address?: string | null;
  owner_pickup_lat?: number | null;
  owner_pickup_lng?: number | null;
}

export interface PlatformUser {
  id: string;
  auth_id: string;
  email: string;
  full_name?: string;
  phone_number?: string;
  role: 'customer' | 'owner' | 'admin';
  email_verified: boolean;
  phone_verified: boolean;
  is_active: boolean;
  profile_picture_url?: string;
  address?: string;
  city?: string;
  onboarded_at?: string;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerProfile {
  id: string;
  auth_id: string;
  full_name: string;
  phone: string;
  email: string;
  address: string;
  emergency_contact: string;
  id_type: string;
  driving_license_number?: string | null;
  driving_license_expiry?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerIdDocument {
  id: string;
  customer_profile_id?: string | null;
  customer_auth_id: string;
  document_type: string;
  image_url: string;
  verified: boolean;
  created_at: string;
}

export interface Booking {
  id: string;
  shop_id: string;
  owner_id?: string;
  booking_number: string;
  customer_id?: string;
  customer_auth_id?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  customer_emergency_contact?: string;
  customer_id_type?: string;
  vehicle_id?: string;
  vehicle_ids?: any;
  start_date: string;
  end_date: string;
  status: 'requested' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'expired';
  total_amount: number;
  advance_amount?: number;
  balance_amount: number;
  payment_status: 'paid' | 'partial' | 'unpaid';
  invoice_number?: string;
  notes?: string;
  
  // Online booking fields
  is_online_booking: boolean;
  pickup_location_id?: string;
  dropoff_location_id?: string;
  pickup_location_name?: string;
  pickup_address?: string;
  pickup_lat?: number;
  pickup_lng?: number;
  base_rental_amount?: number;
  km_charge_amount?: number;
  tax_amount?: number;
  security_deposit_amount?: number;
  payment_gateway?: string;
  payment_id?: string;
  actual_pickup_at?: string;
  actual_dropoff_at?: string;
  final_km_reading?: number;
  final_amount?: number;
  refund_amount?: number;
  
  created_by?: string;
  created_at: string;
  updated_at: string;
  taken_at?: string;
  returned_at?: string;
  cancelled_at?: string;
}

export interface BookingWithDetails extends Booking {
  vehicle?: VehicleWithDetails;
  pickup_location?: Location;
  dropoff_location?: Location;
  shop?: {
    name?: string;
    phone?: string;
  };
}

export interface MarketplacePayment {
  id: string;
  booking_id: string;
  amount: number;
  currency: string;
  payment_type: 'booking' | 'security_deposit' | 'refund' | 'damage_deduction';
  payment_method: 'card' | 'upi' | 'netbanking' | 'wallet' | 'manual';
  payment_gateway?: string;
  external_payment_id?: string;
  external_order_id?: string;
  status: 'pending' | 'initiated' | 'authorized' | 'captured' | 'refunded' | 'failed' | 'cancelled';
  status_reason?: string;
  failure_reason?: string;
  transaction_id?: string;
  initiated_at?: string;
  completed_at?: string;
  refunded_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Search and filter types (Frontend naming)
export interface SearchParams {
  state: string;
  city: string;
  startDate: string;
  endDate: string;
  vehicleType?: string[];
  brand?: string[];
  gearType?: string[];
  transmission?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'rating';
}

export interface PricingBreakdown {
  days: number;
  daily_rate: number;
  base_rental_amount: number;
  km_charge_amount: number;
  tax_amount: number;
  security_deposit_amount: number;
  total_amount: number;
}

// API response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface AvailabilityCheckResult {
  is_available: boolean;
  blocking_booking_id?: string;
  block_start?: string;
  block_end?: string;
}

// Auth types
export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
  user_metadata?: any;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}
