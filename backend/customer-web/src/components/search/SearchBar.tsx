import { useEffect, useMemo, useState } from 'react';
import { Search, MapPin, Calendar } from 'lucide-react';
import { useLocations } from '@/hooks/useLocations';
import { Button } from '../common/Button';
import type { SearchParams } from '@/types';
import { useBookingFlow } from '@/app/BookingFlowContext';
import { ErrorMessage } from '../common/ErrorMessage';

interface SearchBarProps {
  onSearch: (params: SearchParams) => void;
  initialParams?: Partial<SearchParams>;
}

export function SearchBar({ onSearch, initialParams }: SearchBarProps) {
  const { flow, setSearchParams: setFlowSearchParams } = useBookingFlow();
  const { locations, loading: locationsLoading, error: locationsError, refetch } = useLocations();
  const initialState = initialParams?.state || flow?.state || '';
  const initialCity = initialParams?.city || flow?.city || '';
  const [state, setState] = useState(initialState);
  const [city, setCity] = useState(initialCity);
  
  const [pickupDateTime, setPickupDateTime] = useState(
    initialParams?.startDate
      ? new Date(initialParams.startDate).toISOString().slice(0, 16)
      : flow?.startDate
      ? new Date(flow.startDate).toISOString().slice(0, 16)
      : ''
  );
  const [dropoffDateTime, setDropoffDateTime] = useState(
    initialParams?.endDate
      ? new Date(initialParams.endDate).toISOString().slice(0, 16)
      : flow?.endDate
      ? new Date(flow.endDate).toISOString().slice(0, 16)
      : ''
  );
  const [formError, setFormError] = useState<string | null>(null);
  const minBookingHours = Number(import.meta.env.VITE_MIN_BOOKING_HOURS || 0);

  useEffect(() => {
    if (initialParams) return;
    if (!flow) return;
    if (!state) setState(flow.state);
    if (!city) setCity(flow.city);
    if (!pickupDateTime && flow.startDate) {
      setPickupDateTime(new Date(flow.startDate).toISOString().slice(0, 16));
    }
    if (!dropoffDateTime && flow.endDate) {
      setDropoffDateTime(new Date(flow.endDate).toISOString().slice(0, 16));
    }
  }, [flow, initialParams, state, city, pickupDateTime, dropoffDateTime]);

  useEffect(() => {
    if (!pickupDateTime && !dropoffDateTime && !state && !city) return;
    setFlowSearchParams({
      state,
      city,
      startDate: pickupDateTime ? new Date(pickupDateTime).toISOString() : '',
      endDate: dropoffDateTime ? new Date(dropoffDateTime).toISOString() : '',
    });
  }, [state, city, pickupDateTime, dropoffDateTime, setFlowSearchParams]);

  const states = useMemo(() => {
    return Array.from(
      new Set(
        locations
          .map((loc) => (loc.state || '').trim())
          .filter((value) => value.length > 0)
      )
    ).sort();
  }, [locations]);

  const cities = useMemo(() => {
    if (!state) return [];
    return Array.from(
      new Set(
        locations
          .filter((loc) => loc.state === state)
          .map((loc) => (loc.city || '').trim())
          .filter((value) => value.length > 0)
      )
    ).sort();
  }, [locations, state]);

  const dateValidationMessage = useMemo(() => {
    if (!pickupDateTime && !dropoffDateTime) return null;

    const start = pickupDateTime ? new Date(pickupDateTime) : null;
    const end = dropoffDateTime ? new Date(dropoffDateTime) : null;
    const now = new Date();

    if (start && start < now) {
      return 'Pickup time must be in the future.';
    }

    if (start && end && start >= end) {
      return 'Drop-off time must be after pickup time.';
    }

    if (start && end && minBookingHours > 0) {
      const durationMs = end.getTime() - start.getTime();
      const minMs = minBookingHours * 60 * 60 * 1000;
      if (durationMs < minMs) {
        return `Minimum booking duration is ${minBookingHours} hour${minBookingHours === 1 ? '' : 's'}.`;
      }
    }

    return null;
  }, [pickupDateTime, dropoffDateTime, minBookingHours]);

  const handleSearch = () => {
    if (!state || !city || !pickupDateTime || !dropoffDateTime) {
      setFormError('Please select state, city, and both dates.');
      return;
    }

    const startDate = new Date(pickupDateTime);
    const endDate = new Date(dropoffDateTime);

    if (dateValidationMessage) {
      setFormError(dateValidationMessage);
      return;
    }

    setFormError(null);

    setFlowSearchParams({
      state,
      city,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    onSearch({
      state,
      city,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
  };

  const now = new Date();
  const minDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  const isDateReady = Boolean(pickupDateTime && dropoffDateTime) && !dateValidationMessage;
  const canSearch = Boolean(state && city && pickupDateTime && dropoffDateTime) && !locationsLoading && !locationsError && !dateValidationMessage;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-lg sm:p-8">
      <div className="mb-6 flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Plan your ride</p>
        <h2 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Choose location and time</h2>
        <p className="text-sm text-gray-600">Select a state first to unlock available cities.</p>
      </div>
      {locationsError && (
        <div className="mb-4">
          <ErrorMessage
            message="We could not load locations. Please try again."
            onRetry={refetch}
          />
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-4">
        {/* State */}
        <div className="md:col-span-1">
          <label className="mb-2 flex items-center text-sm font-medium text-gray-700" htmlFor="state-select">
            <MapPin className="mr-1 h-4 w-4" />
            State
          </label>
          <select
            id="state-select"
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setCity('');
            }}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={locationsLoading}
            aria-required="true"
          >
            <option value="">Select state</option>
            {locationsLoading && <option value="">Loading states...</option>}
            {!locationsLoading && states.length === 0 && (
              <option value="">No states available</option>
            )}
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* City */}
        <div className="md:col-span-1">
          <label className="mb-2 flex items-center text-sm font-medium text-gray-700" htmlFor="city-select">
            <MapPin className="mr-1 h-4 w-4" />
            City
          </label>
          <select
            id="city-select"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={locationsLoading || !state}
            aria-required="true"
          >
            {!state && <option value="">Select state first</option>}
            {state && <option value="">Select city</option>}
            {locationsLoading && state && <option value="">Loading cities...</option>}
            {!locationsLoading && state && cities.length === 0 && (
              <option value="">No cities available</option>
            )}
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Pickup Date & Time */}
        <div className="md:col-span-1">
          <label className="mb-2 flex items-center text-sm font-medium text-gray-700" htmlFor="pickup-datetime">
            <Calendar className="mr-1 h-4 w-4" />
            Pickup Date & Time
          </label>
          <input
            id="pickup-datetime"
            type="datetime-local"
            value={pickupDateTime}
            onChange={(e) => setPickupDateTime(e.target.value)}
            min={minDateTime}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-primary"
            aria-required="true"
          />
        </div>

        {/* Drop-off Date & Time */}
        <div className="md:col-span-1">
          <label className="mb-2 flex items-center text-sm font-medium text-gray-700" htmlFor="dropoff-datetime">
            <Calendar className="mr-1 h-4 w-4" />
            Drop-off Date & Time
          </label>
          <input
            id="dropoff-datetime"
            type="datetime-local"
            value={dropoffDateTime}
            onChange={(e) => setDropoffDateTime(e.target.value)}
            min={pickupDateTime || minDateTime}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-primary"
            aria-required="true"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="rounded-full bg-gray-100 px-2 py-1">
          {isDateReady ? 'Availability check ready' : 'Select dates to enable availability'}
        </span>
        {minBookingHours > 0 && (
          <span className="rounded-full bg-gray-100 px-2 py-1">
            Minimum {minBookingHours}h booking
          </span>
        )}
      </div>

      <div className="mt-4">
        <Button onClick={handleSearch} fullWidth disabled={!canSearch}>
          <Search className="mr-2 h-5 w-5" />
          Search Vehicles
        </Button>
        {formError && (
          <p className="mt-2 text-sm text-red-600" role="alert">{formError}</p>
        )}
        {!formError && dateValidationMessage && (
          <p className="mt-2 text-sm text-red-600" role="alert">{dateValidationMessage}</p>
        )}
        {!formError && !canSearch && (
          <p className="mt-2 text-sm text-gray-500">Complete state, city, and dates to continue.</p>
        )}
      </div>
    </div>
  );
}
