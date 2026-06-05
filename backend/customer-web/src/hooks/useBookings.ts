import { useState, useEffect } from 'react';
import { bookingService } from '@/services/bookings.service';
import { supabase } from '@/services/supabase';
import type { Booking, BookingWithDetails, PricingBreakdown } from '@/types';

/**
 * Bookings hook
 * Manages customer bookings
 */

export function useBookings() {
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBookings();
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) return;

      channel = supabase
        .channel('customer_bookings_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bookings', filter: `customer_auth_id=eq.${userId}` },
          () => {
            loadBookings();
          }
        )
        .subscribe();
    })();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  async function loadBookings() {
    try {
      setLoading(true);
      setError(null);

      const data = await bookingService.getCustomerBookings();
      setBookings(data);
    } catch (err: any) {
      console.error('Error loading bookings:', err);
      setError(err.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }

  async function cancelBooking(id: string) {
    try {
      setError(null);
      const success = await bookingService.cancelBooking(id);
      
      if (success) {
        // Refresh bookings list
        await loadBookings();
      }
      
      return success;
    } catch (err: any) {
      console.error('Error cancelling booking:', err);
      setError(err.message || 'Failed to cancel booking');
      return false;
    }
  }

  return {
    bookings,
    loading,
    error,
    cancelBooking,
    refetch: loadBookings,
  };
}

/**
 * Single booking hook
 */
export function useBooking(bookingId: string | undefined) {
  const [booking, setBooking] = useState<BookingWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (bookingId) {
      loadBooking(bookingId);
    }
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    channel = supabase
      .channel(`customer_booking_${bookingId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `id=eq.${bookingId}` },
        () => {
          loadBooking(bookingId);
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [bookingId]);

  async function loadBooking(id: string) {
    try {
      setLoading(true);
      setError(null);

      const data = await bookingService.getBookingById(id);
      setBooking(data);
    } catch (err: any) {
      console.error('Error loading booking:', err);
      setError(err.message || 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  }

  return {
    booking,
    loading,
    error,
    refetch: () => bookingId && loadBooking(bookingId),
  };
}

/**
 * Create booking hook
 */
export function useCreateBooking() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createBooking(
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
  ): Promise<Booking | null> {
    try {
      setLoading(true);
      setError(null);

      const booking = await bookingService.createBooking(
        vehicleId,
        ownerId,
        shopId,
        pickupLocationId,
        dropoffLocationId,
        startDate,
        endDate,
        pricing,
        snapshot,
        options
      );

      return booking;
    } catch (err: any) {
      console.error('Error creating booking:', err);
      setError(err.message || 'Failed to create booking');
      return null;
    } finally {
      setLoading(false);
    }
  }

  return {
    createBooking,
    loading,
    error,
  };
}
