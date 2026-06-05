import { supabase } from './supabase';
import type { Vehicle, VehicleWithDetails, VehicleImage, SearchParams } from '@/types';

/**
 * Vehicle Service
 * Handles all vehicle-related API calls
 */

export const vehicleService = {
  /**
   * Get available vehicles using database function
   * This respects availability blocks and prevents double booking
   */
  async getAvailableVehicles(params: SearchParams): Promise<VehicleWithDetails[]> {
    try {
      const { data: pickupPoints, error: pickupError } = await supabase
        .from('shop_pickup_points')
        .select('id, shop_id, name, city, is_default, latitude, longitude')
        .eq('is_active', true)
        .eq('city', params.city);

      if (pickupError) {
        console.error('Error fetching pickup points:', pickupError);
        throw pickupError;
      }

      const shopIds = Array.from(new Set(
        (pickupPoints || [])
          .map((row: any) => row.shop_id)
          .filter((id: string | null) => Boolean(id)) as string[]
      ));

      if (shopIds.length === 0) {
        return [];
      }

      let query = supabase
        .from('vehicles')
        .select('*')
        .eq('is_published', true)
        .in('shop_id', shopIds);

      if (params.vehicleType && params.vehicleType.length === 1) {
        query = query.eq('type', params.vehicleType[0]);
      }

      if (params.transmission) {
        query = query.eq('transmission_type', params.transmission);
      }

      if (params.minPrice !== undefined) {
        query = query.gte('daily_rate', params.minPrice);
      }

      if (params.maxPrice !== undefined) {
        query = query.lte('daily_rate', params.maxPrice);
      }

      const { data: vehicles, error: vehiclesError } = await query;

      if (vehiclesError) {
        console.error('Error fetching vehicles:', vehiclesError);
        throw vehiclesError;
      }

      const pickupByShop = new Map<string, any>();
      (pickupPoints || []).forEach((point: any) => {
        const existing = pickupByShop.get(point.shop_id);
        if (!existing || point.is_default) {
          pickupByShop.set(point.shop_id, point);
        }
      });

      let merged = (vehicles || []).map((vehicle: any) => {
        const point = pickupByShop.get(vehicle.shop_id);
        return {
          ...vehicle,
          location: point ? {
            id: point.id,
            name: point.name,
            city: point.city,
            state: '',
            country: '',
            latitude: point.latitude ?? undefined,
            longitude: point.longitude ?? undefined,
            is_active: true,
            created_at: '',
            updated_at: '',
          } : undefined,
        } as VehicleWithDetails;
      });

      if (params.vehicleType && params.vehicleType.length > 0) {
        merged = merged.filter((v) => params.vehicleType?.includes(v.type));
      }

      if (params.brand && params.brand.length > 0) {
        const brands = new Set(params.brand.map((b) => b.toLowerCase()));
        merged = merged.filter((v) => (v.brand || '').toLowerCase() && brands.has((v.brand || '').toLowerCase()));
      }

      if (params.gearType && params.gearType.length > 0) {
        const gears = new Set(params.gearType.map((g) => g.toLowerCase()));
        merged = merged.filter((v) => (v.gear_type || '').toLowerCase() && gears.has((v.gear_type || '').toLowerCase()));
      }

      if (params.transmission) {
        merged = merged.filter((v) => v.transmission_type === params.transmission);
      }

      if (params.sortBy === 'price_asc') {
        merged = merged.sort((a, b) => a.daily_rate - b.daily_rate);
      } else if (params.sortBy === 'price_desc') {
        merged = merged.sort((a, b) => b.daily_rate - a.daily_rate);
      } else if (params.sortBy === 'rating') {
        merged = merged.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      }

      return merged;
    } catch (error) {
      console.error('Failed to get available vehicles:', error);
      throw error;
    }
  },

  /**
   * Get vehicle by ID with all details
   */
  async getVehicleById(id: string): Promise<VehicleWithDetails | null> {
    try {
      // Fetch vehicle
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select(`
          *,
          location:marketplace_locations(*),
          owner:rental_shops(name, terms_and_conditions, pickup_location_name, pickup_address, pickup_lat, pickup_lng)
        `)
        .eq('id', id)
        .eq('is_listed_marketplace', true)
        .eq('is_published', true)
        .single();

      if (vehicleError || !vehicle) {
        console.error('Error fetching vehicle:', vehicleError);
        return null;
      }

      // Fetch images
      const { data: images, error: imagesError } = await supabase
        .from('vehicle_images')
        .select('*')
        .eq('vehicle_id', id)
        .order('display_order', { ascending: true });

      if (imagesError) {
        console.error('Error fetching vehicle images:', imagesError);
      }

      return {
        ...vehicle,
        images: images || [],
        owner_name: vehicle?.owner?.name,
        owner_terms_and_conditions: vehicle?.owner?.terms_and_conditions ?? null,
        owner_pickup_location_name: vehicle?.owner?.pickup_location_name ?? null,
        owner_pickup_address: vehicle?.owner?.pickup_address ?? null,
        owner_pickup_lat: vehicle?.owner?.pickup_lat ?? null,
        owner_pickup_lng: vehicle?.owner?.pickup_lng ?? null,
      } as VehicleWithDetails;
    } catch (error) {
      console.error('Failed to get vehicle by ID:', error);
      return null;
    }
  },

  /**
   * Search vehicles with filters
   * Uses the marketplace view with RLS
   */
  async searchVehicles(params: SearchParams): Promise<Vehicle[]> {
    try {
      let query = supabase
        .from('vehicles')
        .select('*')
        .eq('is_listed_marketplace', true)
        .eq('is_published', true)
        .eq('is_available_for_online_booking', true)
        .eq('status', 'Available');

      // Apply filters
      if (params.vehicleType && params.vehicleType.length === 1) {
        query = query.eq('type', params.vehicleType[0]);
      }

      if (params.transmission) {
        query = query.eq('transmission_type', params.transmission);
      }

      if (params.minPrice !== undefined) {
        query = query.gte('daily_rate', params.minPrice);
      }

      if (params.maxPrice !== undefined) {
        query = query.lte('daily_rate', params.maxPrice);
      }

      // Default sorting by rating then price
      query = query.order('rating', { ascending: false, nullsFirst: false });
      query = query.order('daily_rate', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('Error searching vehicles:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Failed to search vehicles:', error);
      throw error;
    }
  },

  /**
   * Get vehicle images
   */
  async getVehicleImages(vehicleId: string): Promise<VehicleImage[]> {
    try {
      const { data, error } = await supabase
        .from('vehicle_images')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching vehicle images:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get vehicle images:', error);
      return [];
    }
  },
};
