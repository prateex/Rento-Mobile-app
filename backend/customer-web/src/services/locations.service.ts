import { supabase } from './supabase';
import type { Location } from '@/types';

/**
 * Location Service
 * Handles location/city data via pickup points and marketplace locations
 */

export const locationService = {
  /**
   * Get all active locations
   */
  async getAllLocations(): Promise<Location[]> {
    const { data, error } = await supabase
      .from('marketplace_locations')
      .select('id, name, city, state, country, latitude, longitude, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('city, name');

    if (error) {
      console.error('Error fetching marketplace locations:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Get location by ID
   */
  async getLocationById(id: string): Promise<Location | null> {
    const { data, error } = await supabase
      .from('marketplace_locations')
      .select('id, name, city, state, country, latitude, longitude, is_active, created_at, updated_at')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error fetching marketplace location:', error);
      return null;
    }

    return data;
  },

  /**
   * Get locations by city
   */
  async getLocationsByCity(city: string): Promise<Location[]> {
    const { data, error } = await supabase
      .from('marketplace_locations')
      .select('id, name, city, state, country, latitude, longitude, is_active, created_at, updated_at')
      .eq('city', city)
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching marketplace locations by city:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Get available cities from active pickup points with published vehicles
   */
  async getAvailableCities(): Promise<string[]> {
    const { data: pickupPoints, error: pickupError } = await supabase
      .from('shop_pickup_points')
      .select('city')
      .eq('is_active', true)
      .not('city', 'is', null);

    if (pickupError) {
      console.error('Error fetching pickup points:', pickupError);
      throw pickupError;
    }

    const citySet = new Set(
      (pickupPoints || [])
        .map((row: any) => (row.city || '').trim())
        .filter((city: string) => city.length > 0)
    );

    return Array.from(citySet).sort();
  },
};
