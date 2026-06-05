import { supabase } from './supabase';
import type { Booking, BookingWithDetails, PricingBreakdown } from '@/types';
import { BookingCreationError } from '@/utils/error.utils';

/**
 * Booking Service
 * Handles all booking-related operations
 */

export const bookingService = {
  /**
   * Generate a unique booking number
   */
  generateBookingNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `BK${year}${month}${day}${random}`;
  },

  /**
   * Calculate pricing breakdown
   */
  calculatePricing(
    dailyRate: number,
    startDate: string,
    endDate: string,
    securityDeposit: number = 0
  ): PricingBreakdown {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const baseRentalAmount = dailyRate * days;
    const kmChargeAmount = 0;
    const taxAmount = baseRentalAmount * 0.18; // 18% GST
    const securityDepositAmount = securityDeposit;
    const totalAmount = baseRentalAmount + kmChargeAmount + taxAmount + securityDepositAmount;

    return {
      days,
      daily_rate: dailyRate,
      base_rental_amount: baseRentalAmount,
      km_charge_amount: kmChargeAmount,
      tax_amount: taxAmount,
      security_deposit_amount: securityDepositAmount,
      total_amount: totalAmount,
    };
  },

  /**
   * Create a new online booking
   * This is wrapped in a transaction by the database triggers
   */
  async createBooking(
    vehicleId: string,
    ownerId: string,
    shopId: string,
    pickupLocationId: string,
    dropoffLocationId: string,
    startDate: string,
    endDate: string,
    pricing: PricingBreakdown,
    snapshot?: {
      customerName?: string;
      customerPhone?: string;
      customerEmail?: string;
      customerAddress?: string;
      customerEmergencyContact?: string;
      customerIdType?: string;
      pickupLocationName?: string | null;
      pickupAddress?: string | null;
      pickupLat?: number | null;
      pickupLng?: number | null;
    },
    options?: {
      status?: Booking['status'];
      paymentStatus?: Booking['payment_status'];
      paymentGateway?: string | null;
      paymentChoice?: string | null;
      paymentMode?: string | null;
      notes?: string | null;
    }
  ): Promise<Booking> {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const bookingNumber = this.generateBookingNumber();
      const bookingStatus = options?.status ?? 'requested';
      const paymentStatus = options?.paymentStatus ?? 'unpaid';
      const paymentGateway = options?.paymentGateway ?? 'manual';
      const notes = options?.notes ?? 'Online booking from customer website';

      // Create booking record
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          booking_number: bookingNumber,
          shop_id: shopId,
          owner_id: ownerId,
          vehicle_id: vehicleId,
          customer_auth_id: user.id,
          start_date: startDate,
          end_date: endDate,
          status: bookingStatus,
          payment_status: paymentStatus,
          payment_choice: options?.paymentChoice ?? null,
          payment_mode: options?.paymentMode ?? null,
          is_online_booking: true,
          pickup_location_id: pickupLocationId,
          dropoff_location_id: dropoffLocationId,
          customer_name: snapshot?.customerName || null,
          customer_phone: snapshot?.customerPhone || null,
          customer_email: snapshot?.customerEmail || null,
          customer_address: snapshot?.customerAddress || null,
          customer_emergency_contact: snapshot?.customerEmergencyContact || null,
          customer_id_type: snapshot?.customerIdType || null,
          pickup_location_name: snapshot?.pickupLocationName || null,
          pickup_address: snapshot?.pickupAddress || null,
          pickup_lat: snapshot?.pickupLat || null,
          pickup_lng: snapshot?.pickupLng || null,
          base_rental_amount: pricing.base_rental_amount,
          km_charge_amount: pricing.km_charge_amount,
          tax_amount: pricing.tax_amount,
          security_deposit_amount: pricing.security_deposit_amount,
          total_amount: pricing.total_amount - pricing.security_deposit_amount,
          advance_amount: 0,
          balance_amount: pricing.total_amount - pricing.security_deposit_amount,
          payment_gateway: paymentGateway,
          notes,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating booking:', error);
        throw new BookingCreationError(
          'Booking creation failed',
          'Could not create your booking. Please try again.'
        );
      }

      // Database trigger will automatically create availability block
      return data;
    } catch (error) {
      console.error('Failed to create booking:', error);
      if (error instanceof BookingCreationError) {
        throw error;
      }
      throw new BookingCreationError(
        'Booking creation failed',
        'Could not create your booking. Please try again.'
      );
    }
  },

  /**
   * Get customer's bookings
   */
  async getCustomerBookings(): Promise<BookingWithDetails[]> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          vehicle:vehicles(*),
          pickup_location:marketplace_locations!bookings_pickup_location_id_fkey(*),
          dropoff_location:marketplace_locations!bookings_dropoff_location_id_fkey(*),
          shop:rental_shops(name, phone)
        `)
        .eq('customer_auth_id', user.id)
        .eq('is_online_booking', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching customer bookings:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get customer bookings:', error);
      throw error;
    }
  },

  /**
   * Get booking by ID
   */
  async getBookingById(id: string): Promise<BookingWithDetails | null> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          vehicle:vehicles(*),
          pickup_location:marketplace_locations!bookings_pickup_location_id_fkey(*),
          dropoff_location:marketplace_locations!bookings_dropoff_location_id_fkey(*),
          shop:rental_shops(name, phone)
        `)
        .eq('id', id)
        .eq('customer_auth_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching booking:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Failed to get booking by ID:', error);
      return null;
    }
  },

  /**
   * Cancel booking
   */
  async cancelBooking(id: string): Promise<boolean> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'requested')
        .eq('customer_auth_id', user.id);

      if (error) {
        console.error('Error cancelling booking:', error);
        throw error;
      }

      // Database trigger will automatically remove availability block
      return true;
    } catch (error) {
      console.error('Failed to cancel booking:', error);
      return false;
    }
  },

  /**
   * Update booking status or payment fields
   */
  async updateBooking(id: string, updates: Partial<Pick<Booking, 'status' | 'payment_status' | 'payment_gateway' | 'payment_id' | 'notes' | 'actual_pickup_at' | 'actual_dropoff_at' | 'final_amount' | 'balance_amount' | 'refund_amount'>>): Promise<Booking | null> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('bookings')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('customer_auth_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating booking:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Failed to update booking:', error);
      return null;
    }
  },
};
