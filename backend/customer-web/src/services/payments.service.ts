import { supabase } from './supabase';
import type { MarketplacePayment } from '@/types';
import { PaymentError } from '@/utils/error.utils';

/**
 * Payment Service
 * Handles payment simulation and tracking
 * TODO: Integrate with actual payment gateway (Razorpay/Stripe)
 */

export const paymentService = {
  getPaymentGateway(): 'razorpay' | 'stripe' | 'paypal' | 'manual' {
    const rawGateway = (import.meta.env.VITE_PAYMENT_GATEWAY || 'manual').toLowerCase();
    const allowed = ['razorpay', 'stripe', 'paypal', 'manual'] as const;
    return (allowed.includes(rawGateway as any) ? rawGateway : 'manual') as 'razorpay' | 'stripe' | 'paypal' | 'manual';
  },

  getPaymentMethod(): 'card' | 'upi' | 'netbanking' | 'wallet' | 'manual' {
    const rawMethod = (import.meta.env.VITE_PAYMENT_METHOD || 'card').toLowerCase();
    const allowed = ['card', 'upi', 'netbanking', 'wallet', 'manual'] as const;
    return (allowed.includes(rawMethod as any) ? rawMethod : 'card') as 'card' | 'upi' | 'netbanking' | 'wallet' | 'manual';
  },

  async initiatePayment(
    bookingId: string,
    amount: number,
    paymentMethod: 'card' | 'upi' | 'netbanking' | 'wallet' | 'manual'
  ): Promise<MarketplacePayment> {
    const gateway = this.getPaymentGateway();
    const simulate = (import.meta.env.VITE_PAYMENT_SIMULATION || (!import.meta.env.PROD ? 'true' : 'false')) === 'true';

    if (simulate) {
      return this.simulatePayment(bookingId, amount, paymentMethod, gateway);
    }

    throw new PaymentError(
      'PAYMENT_DISABLED',
      'Payment gateway not enabled',
      'Payments are not enabled yet. Please try again later.'
    );
  },

  /**
   * Simulate payment for booking
   * In production, this would call Razorpay/Stripe API
   */
  async simulatePayment(
    bookingId: string,
    amount: number,
    paymentMethod: 'card' | 'upi' | 'netbanking' | 'wallet' | 'manual',
    paymentGateway: 'razorpay' | 'stripe' | 'paypal' | 'manual' = 'manual'
  ): Promise<MarketplacePayment> {
    try {
      if (import.meta.env.PROD && paymentGateway === 'manual') {
        throw new PaymentError(
          'PAYMENT_DISABLED',
          'Payment simulation disabled in production',
          'Payments are not enabled yet. Your booking will be requested without payment.'
        );
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Simulate delay (payment processing)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simulate 95% success rate
      const isSuccess = Math.random() > 0.05;

      if (!isSuccess) {
        throw new PaymentError(
          'PAYMENT_FAILED',
          'Payment failed: Card declined',
          'Payment failed. Please try again or use another method.'
        );
      }

      // Generate mock transaction ID
      const transactionId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;

      // Create payment record
      const { data, error } = await supabase
        .from('marketplace_payments')
        .insert({
          booking_id: bookingId,
          amount: amount,
          currency: 'INR',
          payment_type: 'booking',
          payment_method: paymentMethod,
          payment_gateway: paymentGateway,
          external_payment_id: transactionId,
          transaction_id: transactionId,
          status: 'captured',
          completed_at: new Date().toISOString(),
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating payment record:', error);
        throw new PaymentError(
          'PAYMENT_FAILED',
          'Payment record creation failed',
          'Payment failed. Please try again or use another method.'
        );
      }

      // Update booking payment status
      await supabase
        .from('bookings')
        .update({
          payment_status: 'paid',
          payment_id: transactionId,
          payment_gateway: paymentGateway,
        })
        .eq('id', bookingId);

      return data;
    } catch (error) {
      console.error('Failed to process payment:', error);
      if (error instanceof PaymentError) {
        throw error;
      }
      throw new PaymentError(
        'PAYMENT_FAILED',
        'Payment failed',
        'Payment failed. Please try again or use another method.'
      );
    }
  },

  /**
   * Get payment by booking ID
   */
  async getPaymentByBookingId(bookingId: string): Promise<MarketplacePayment | null> {
    try {
      const { data, error } = await supabase
        .from('marketplace_payments')
        .select('*')
        .eq('booking_id', bookingId)
        .eq('payment_type', 'booking')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Error fetching payment:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Failed to get payment by booking ID:', error);
      return null;
    }
  },

  /**
   * Record a pay-at-pickup placeholder payment
   */
  async recordPayAtPickup(bookingId: string, amount: number): Promise<MarketplacePayment | null> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('marketplace_payments')
        .insert({
          booking_id: bookingId,
          amount: amount,
          currency: 'INR',
          payment_type: 'booking',
          payment_method: 'manual',
          payment_gateway: null,
          status: 'pending',
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error recording pay-at-pickup payment:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Failed to record pay-at-pickup payment:', error);
      return null;
    }
  },

  /**
   * Record a pending refund placeholder
   */
  async recordPendingRefund(bookingId: string, amount: number): Promise<MarketplacePayment | null> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('marketplace_payments')
        .insert({
          booking_id: bookingId,
          amount: amount,
          currency: 'INR',
          payment_type: 'refund',
          payment_method: 'manual',
          payment_gateway: null,
          status: 'pending',
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error recording pending refund:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Failed to record pending refund:', error);
      return null;
    }
  },

  /**
   * TODO: Integrate Razorpay
   * Steps:
   * 1. Create order on Razorpay
   * 2. Open Razorpay checkout modal
   * 3. Handle payment callback
   * 4. Verify payment signature
   * 5. Update booking and payment records
   */

  /**
   * TODO: Integrate Stripe
   * Steps:
   * 1. Create payment intent
   * 2. Confirm payment with Stripe Elements
   * 3. Handle webhook events
   * 4. Update booking and payment records
   */
};
