import { supabase } from './supabase';
import type { AvailabilityCheckResult } from '@/types';

/**
 * Availability Service
 * Handles vehicle availability checks using database functions
 */

export const availabilityService = {
  /**
   * Check if a specific vehicle is available for date range
   * Uses database function to check availability_blocks
   */
  async checkVehicleAvailability(
    vehicleId: string,
    startDate: string,
    endDate: string
  ): Promise<AvailabilityCheckResult> {
    try {
      const { data, error } = await supabase.rpc('check_vehicle_available', {
        p_vehicle_id: vehicleId,
        p_start_date: startDate,
        p_end_date: endDate,
      });

      if (error) {
        console.error('Error checking vehicle availability:', error);
        throw error;
      }

      // Parse the result
      if (data && data.length > 0) {
        const result = data[0];
        return {
          is_available: result.is_available || false,
          blocking_booking_id: result.blocking_booking_id,
          block_start: result.block_start,
          block_end: result.block_end,
        };
      }

      // If no blocking found, vehicle is available
      return {
        is_available: true,
      };
    } catch (error) {
      console.error('Failed to check vehicle availability:', error);
      throw error;
    }
  },

  /**
   * Get all availability blocks for a vehicle (for debugging/display)
   */
  async getVehicleBlocks(vehicleId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('booking_availability_blocks')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .gte('end_date', new Date().toISOString())
        .order('start_date', { ascending: true });

      if (error) {
        console.error('Error fetching vehicle blocks:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get vehicle blocks:', error);
      return [];
    }
  },
};
