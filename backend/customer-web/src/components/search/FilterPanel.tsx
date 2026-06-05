import { useState } from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '../common/Button';
import type { SearchParams } from '@/types';

interface FilterPanelProps {
  onFilterChange: (filters: Partial<SearchParams>) => void;
  currentFilters: Partial<SearchParams>;
  vehicleTypes?: string[];
  brands?: string[];
  gearTypes?: string[];
}

export function FilterPanel({
  onFilterChange,
  currentFilters,
  vehicleTypes = [],
  brands = [],
  gearTypes = [],
}: FilterPanelProps) {
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const transmissionTypes = ['Manual', 'Automatic'];

  const handleVehicleTypeChange = (type: string) => {
    const current = currentFilters.vehicleType || [];
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    onFilterChange({ ...currentFilters, vehicleType: updated });
  };

  const handleTransmissionChange = (transmission: string) => {
    onFilterChange({
      ...currentFilters,
      transmission: currentFilters.transmission === transmission ? undefined : transmission,
    });
  };

  const handlePriceChange = (min?: number, max?: number) => {
    onFilterChange({ ...currentFilters, minPrice: min, maxPrice: max });
  };

  const handleBrandChange = (brand: string) => {
    const current = currentFilters.brand || [];
    const updated = current.includes(brand)
      ? current.filter((b) => b !== brand)
      : [...current, brand];
    onFilterChange({ ...currentFilters, brand: updated });
  };

  const handleGearTypeChange = (gear: string) => {
    const current = currentFilters.gearType || [];
    const updated = current.includes(gear)
      ? current.filter((g) => g !== gear)
      : [...current, gear];
    onFilterChange({ ...currentFilters, gearType: updated });
  };

  const handleSortChange = (sort: 'price_asc' | 'price_desc' | 'rating') => {
    onFilterChange({ ...currentFilters, sortBy: sort });
  };

  const clearFilters = () => {
    onFilterChange({
      city: currentFilters.city,
      startDate: currentFilters.startDate,
      endDate: currentFilters.endDate,
      state: currentFilters.state,
      brand: undefined,
      gearType: undefined,
    });
  };

  const hasActiveFilters =
    (currentFilters.vehicleType && currentFilters.vehicleType.length > 0) ||
    (currentFilters.brand && currentFilters.brand.length > 0) ||
    (currentFilters.gearType && currentFilters.gearType.length > 0) ||
    currentFilters.transmission ||
    currentFilters.minPrice ||
    currentFilters.maxPrice;

  const FiltersContent = () => (
    <div className="space-y-6">
      {/* Vehicle Type */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Vehicle Type</h3>
        {vehicleTypes.length === 0 ? (
          <p className="text-sm text-gray-500">No vehicle types available.</p>
        ) : (
          <div className="space-y-2">
            {vehicleTypes.map((type) => (
              <label key={type} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={currentFilters.vehicleType?.includes(type) || false}
                  onChange={() => handleVehicleTypeChange(type)}
                  className="h-4 w-4 rounded border-gray-300 text-secondary focus:ring-primary"
                />
                <span className="text-sm text-gray-700">{type}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Brand */}
      {brands.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Brand</h3>
          <div className="space-y-2">
            {brands.map((brand) => (
              <label key={brand} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={currentFilters.brand?.includes(brand) || false}
                  onChange={() => handleBrandChange(brand)}
                  className="h-4 w-4 rounded border-gray-300 text-secondary focus:ring-primary"
                />
                <span className="text-sm text-gray-700">{brand}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Gear Type */}
      {gearTypes.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Gear Type</h3>
          <div className="space-y-2">
            {gearTypes.map((gear) => (
              <label key={gear} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={currentFilters.gearType?.includes(gear) || false}
                  onChange={() => handleGearTypeChange(gear)}
                  className="h-4 w-4 rounded border-gray-300 text-secondary focus:ring-primary"
                />
                <span className="text-sm text-gray-700">{gear}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Transmission */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Transmission</h3>
        <div className="space-y-2">
          {transmissionTypes.map((transmission) => (
            <label key={transmission} className="flex items-center space-x-2">
              <input
                type="radio"
                checked={currentFilters.transmission === transmission}
                onChange={() => handleTransmissionChange(transmission)}
                className="h-4 w-4 border-gray-300 text-secondary focus:ring-primary"
              />
              <span className="text-sm text-gray-700">{transmission}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Price Range (per day)</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-600">Min Price</label>
            <input
              type="number"
              placeholder="₹0"
              value={currentFilters.minPrice || ''}
              onChange={(e) =>
                handlePriceChange(
                  e.target.value ? Number(e.target.value) : undefined,
                  currentFilters.maxPrice
                )
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Max Price</label>
            <input
              type="number"
              placeholder="₹10000"
              value={currentFilters.maxPrice || ''}
              onChange={(e) =>
                handlePriceChange(
                  currentFilters.minPrice,
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Sort */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Sort By</h3>
        <select
          value={currentFilters.sortBy || ''}
          onChange={(e) =>
            handleSortChange(e.target.value as 'price_asc' | 'price_desc' | 'rating')
          }
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Relevance</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="rating">Rating</option>
        </select>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button variant="outline" onClick={clearFilters} fullWidth>
          Clear All Filters
        </Button>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile Filter Button */}
      <div className="mb-4 lg:hidden">
        <Button variant="outline" onClick={() => setShowMobileFilters(true)} fullWidth>
          <Filter className="mr-2 h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-secondary">
              Active
            </span>
          )}
        </Button>
      </div>

      {/* Desktop Filters */}
      <div className="hidden rounded-lg border border-gray-200 bg-white p-6 lg:block">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-secondary hover:opacity-80"
            >
              Clear
            </button>
          )}
        </div>
        <FiltersContent />
      </div>

      {/* Mobile Filter Modal */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 bg-white lg:hidden">
          <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
            <button
              onClick={() => setShowMobileFilters(false)}
              className="rounded-lg p-2 hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="overflow-y-auto p-6">
            <FiltersContent />
          </div>
          <div className="border-t border-gray-200 p-4">
            <Button onClick={() => setShowMobileFilters(false)} fullWidth>
              Apply Filters
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
