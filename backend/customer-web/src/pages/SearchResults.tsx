import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SearchBar } from '@/components/search/SearchBar';
import { FilterPanel } from '@/components/search/FilterPanel';
import { VehicleCard } from '@/components/vehicle/VehicleCard';
import { VehicleCardSkeleton } from '@/components/common/LoadingSpinner';
import { ErrorMessage, EmptyState } from '@/components/common/ErrorMessage';
import { useAvailableVehicles } from '@/hooks/useVehicles';
import { useBookingFlow } from '@/app/BookingFlowContext';
import type { SearchParams } from '@/types';

export function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setSearchParams: setFlowSearchParams } = useBookingFlow();

  // Parse search params
  const [filters, setFilters] = useState<SearchParams | null>(() => {
    const state = searchParams.get('state');
    const city = searchParams.get('city');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!state || !city || !startDate || !endDate) {
      return null;
    }

    return {
      state,
      city,
      startDate,
      endDate,
      vehicleType: searchParams.get('vehicleType')?.split(',') || undefined,
      brand: searchParams.get('brand')?.split(',') || undefined,
      gearType: searchParams.get('gearType')?.split(',') || undefined,
      transmission: searchParams.get('transmission') || undefined,
      minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
      maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
      sortBy: (searchParams.get('sortBy') as 'price_asc' | 'price_desc' | 'rating') || undefined,
    };
  });

  const { vehicles, loading, availabilityChecking, error, refetch } = useAvailableVehicles(filters);
  const availableBrands = useMemo(() => {
    return Array.from(
      new Set(
        vehicles
          .map((vehicle) => (vehicle.brand || '').trim())
          .filter((value) => value.length > 0)
      )
    ).sort();
  }, [vehicles]);

  const availableGearTypes = useMemo(() => {
    return Array.from(
      new Set(
        vehicles
          .map((vehicle) => (vehicle.gear_type || '').trim())
          .filter((value) => value.length > 0)
      )
    ).sort();
  }, [vehicles]);

  const availableTypes = useMemo(() => {
    return Array.from(
      new Set(
        vehicles
          .map((vehicle) => (vehicle.type || '').trim())
          .filter((value) => value.length > 0)
      )
    ).sort();
  }, [vehicles]);

  // Redirect to home if no search params
  useEffect(() => {
    if (!filters) {
      navigate('/');
      return;
    }
    setFlowSearchParams({
      state: filters.state,
      city: filters.city,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });
  }, [filters, navigate, setFlowSearchParams]);

  const handleSearch = (newParams: SearchParams) => {
    setFilters(newParams);
    updateURLParams(newParams);
  };

  const handleFilterChange = (newFilters: Partial<SearchParams>) => {
    const updated = { ...filters, ...newFilters } as SearchParams;
    setFilters(updated);
    updateURLParams(updated);
  };

  const updateURLParams = (params: SearchParams) => {
    const newSearchParams = new URLSearchParams();
    newSearchParams.set('state', params.state);
    newSearchParams.set('city', params.city);
    newSearchParams.set('startDate', params.startDate);
    newSearchParams.set('endDate', params.endDate);

    if (params.vehicleType && params.vehicleType.length > 0) {
      newSearchParams.set('vehicleType', params.vehicleType.join(','));
    }
    if (params.brand && params.brand.length > 0) {
      newSearchParams.set('brand', params.brand.join(','));
    }
    if (params.gearType && params.gearType.length > 0) {
      newSearchParams.set('gearType', params.gearType.join(','));
    }
    if (params.transmission) {
      newSearchParams.set('transmission', params.transmission);
    }
    if (params.minPrice) {
      newSearchParams.set('minPrice', String(params.minPrice));
    }
    if (params.maxPrice) {
      newSearchParams.set('maxPrice', String(params.maxPrice));
    }
    if (params.sortBy) {
      newSearchParams.set('sortBy', params.sortBy);
    }

    setSearchParams(newSearchParams);
  };

  if (!filters) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="mx-auto max-w-3xl px-4">
          <ErrorMessage message="Missing search details. Please start a new search." variant="error" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Search Bar */}
      <div className="border-b border-gray-200 bg-white px-4 py-6">
        <div className="mx-auto max-w-7xl">
          <SearchBar onSearch={handleSearch} initialParams={filters} />
        </div>
      </div>

      {/* Results */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-4">
          {/* Filters */}
          <div className="lg:col-span-1">
            <FilterPanel
              onFilterChange={handleFilterChange}
              currentFilters={filters}
              vehicleTypes={availableTypes}
              brands={availableBrands}
              gearTypes={availableGearTypes}
            />
          </div>

          {/* Vehicle Grid */}
          <div className="lg:col-span-3">
            {/* Results Header */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {loading ? 'Searching...' : `${vehicles.length} vehicles available`}
                </h1>
                <p className="text-sm text-gray-600">
                  {filters.city}, {filters.state} • {new Date(filters.startDate).toLocaleString()} → {new Date(filters.endDate).toLocaleString()}
                </p>
              </div>
              {availabilityChecking && (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                  Checking availability...
                </span>
              )}
            </div>

            {/* Error State */}
            {error && (
              <ErrorMessage message={error} variant="error" onRetry={refetch} />
            )}

            {/* Loading State */}
            {loading && (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <VehicleCardSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && vehicles.length === 0 && (
              <EmptyState
                title="No vehicles found"
                description="Try adjusting your filters or search criteria"
                actionLabel="Clear Filters"
                onAction={() => handleFilterChange({
                  state: filters.state,
                  city: filters.city,
                  startDate: filters.startDate,
                  endDate: filters.endDate,
                })}
              />
            )}

            {/* Results Grid */}
            {!loading && !error && vehicles.length > 0 && (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {vehicles.map((vehicle) => (
                  <VehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    startDate={filters.startDate}
                    endDate={filters.endDate}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
