import { useState, useEffect } from 'react';
import { locationService } from '@/services/locations.service';
import type { Location } from '@/types';

/**
 * Locations hook - fetch from supabase.locations table
 * Single source of truth for available pickup locations
 */

export function useLocations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLocations();
  }, []);

  async function loadLocations() {
    try {
      setLoading(true);
      setError(null);

      const data = await locationService.getAllLocations();
      setLocations(data || []);
    } catch (err: any) {
      console.error('Error loading locations:', err);
      setError(err.message || 'Failed to load locations');
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }

  return {
    locations,
    loading,
    error,
    refetch: loadLocations,
  };
}

/**
 * Get unique states from locations
 */
export function useStates() {
  const { locations, loading, error } = useLocations();
  
  const states = Array.from(
    new Set(
      locations
        .map((loc) => (loc.state || '').trim())
        .filter((state) => state.length > 0)
    )
  ).sort();

  return {
    states,
    loading,
    error,
  };
}

/**
 * Get unique cities filtered by state
 */
export function useCities(selectedState?: string) {
  const { locations, loading, error } = useLocations();

  const [cities, setCities] = useState<string[]>([]);

  useEffect(() => {
    if (!selectedState) {
      setCities([]);
      return;
    }

    const filtered = locations
      .filter((loc) => loc.state === selectedState)
      .map((loc) => (loc.city || '').trim())
      .filter((city) => city.length > 0);

    setCities(Array.from(new Set(filtered)).sort());
  }, [locations, selectedState]);

  return {
    cities,
    loading,
    error,
  };
}

/**
 * Get unique locations filtered by state and city
 */
export function usePickupLocations(selectedState?: string, selectedCity?: string) {
  const { locations, loading, error } = useLocations();
  
  const pickupLocations = selectedState && selectedCity
    ? locations.filter((loc) => loc.state === selectedState && loc.city === selectedCity)
    : [];

  return {
    locations: pickupLocations,
    loading,
    error,
  };
}
