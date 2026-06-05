import { useState, useEffect } from 'react';
import { vehicleService } from '@/services/vehicles.service';
import { availabilityService } from '@/services/availability.service';
import type { Vehicle, VehicleWithDetails, SearchParams } from '@/types';

/**
 * Vehicles hook
 * Manages vehicle data and search
 */

export function useVehicles(searchParams?: SearchParams) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams) {
      searchVehicles(searchParams);
    }
  }, [searchParams]);

  async function searchVehicles(params: SearchParams) {
    try {
      setLoading(true);
      setError(null);

      const results = await vehicleService.searchVehicles(params);
      setVehicles(results);
    } catch (err: any) {
      console.error('Error searching vehicles:', err);
      setError(err.message || 'Failed to search vehicles');
    } finally {
      setLoading(false);
    }
  }

  return {
    vehicles,
    loading,
    error,
    searchVehicles,
  };
}

/**
 * Single vehicle hook
 */
export function useVehicle(vehicleId: string | undefined) {
  const [vehicle, setVehicle] = useState<VehicleWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (vehicleId) {
      loadVehicle(vehicleId);
    }
  }, [vehicleId]);

  async function loadVehicle(id: string) {
    try {
      setLoading(true);
      setError(null);

      const data = await vehicleService.getVehicleById(id);
      if (!data) {
        setVehicle(null);
        setError('This vehicle is unavailable or unpublished.');
        return;
      }
      setVehicle(data);
    } catch (err: any) {
      console.error('Error loading vehicle:', err);
      setError(err.message || 'Failed to load vehicle');
    } finally {
      setLoading(false);
    }
  }

  async function checkAvailability(startDate: string, endDate: string) {
    if (!vehicle) return null;

    try {
      const result = await availabilityService.checkVehicleAvailability(
        vehicle.id,
        startDate,
        endDate
      );
      return { available: result.is_available };
    } catch (err: any) {
      console.error('Error checking availability:', err);
      return null;
    }
  }

  return {
    vehicle,
    loading,
    error,
    checkAvailability,
    refetch: () => vehicleId && loadVehicle(vehicleId),
  };
}

/**
 * Available vehicles hook (uses DB function)
 */
export function useAvailableVehicles(searchParams: SearchParams | null) {
  const [vehicles, setVehicles] = useState<VehicleWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [availabilityChecking, setAvailabilityChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams) {
      loadAvailableVehicles(searchParams);
    }
  }, [searchParams]);

  async function loadAvailableVehicles(params: SearchParams) {
    try {
      setLoading(true);
      setError(null);

      const results = await vehicleService.getAvailableVehicles(params);
      if (!results.length) {
        setVehicles([]);
        return;
      }

      setAvailabilityChecking(true);
      const checks = await Promise.allSettled(
        results.map((vehicle) =>
          availabilityService.checkVehicleAvailability(vehicle.id, params.startDate, params.endDate)
        )
      );

      const availableIds = new Set<string>();
      let hasFailure = false;

      checks.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (result.value.is_available) {
            availableIds.add(results[index].id);
          }
        } else {
          hasFailure = true;
        }
      });

      if (hasFailure) {
        setVehicles([]);
        setError('Unable to verify availability right now. Please retry.');
        return;
      }

      setVehicles(results.filter((vehicle) => availableIds.has(vehicle.id)));
    } catch (err: any) {
      console.error('Error loading available vehicles:', err);
      setError(err.message || 'Failed to load available vehicles');
    } finally {
      setAvailabilityChecking(false);
      setLoading(false);
    }
  }

  return {
    vehicles,
    loading,
    availabilityChecking,
    error,
    refetch: () => searchParams && loadAvailableVehicles(searchParams),
  };
}
