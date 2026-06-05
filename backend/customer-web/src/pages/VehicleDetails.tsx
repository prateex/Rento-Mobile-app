import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Star, Fuel, Settings, Users, Calendar, Shield, Check } from 'lucide-react';
import { useVehicle } from '@/hooks/useVehicles';
import { useAuth } from '@/hooks/useAuth';
import { VehicleGallery } from '@/components/vehicle/VehicleGallery';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { Button } from '@/components/common/Button';
import { formatCurrency, getVehicleTypeIcon } from '@/utils/format.utils';
import { formatDate } from '@/utils/date.utils';
import { useBookingFlow } from '@/app/BookingFlowContext';

export function VehicleDetails() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { flow, setVehicleId } = useBookingFlow();

  const startDate = searchParams.get('startDate') || flow?.startDate || null;
  const endDate = searchParams.get('endDate') || flow?.endDate || null;

  const { vehicle, loading, error, checkAvailability } = useVehicle(id);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [availabilityResult, setAvailabilityResult] = useState<{ available: boolean } | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const featureList = vehicle?.features
    ? Object.entries(vehicle.features)
        .filter(([, value]) => Boolean(value))
        .map(([key]) => key.replace(/_/g, ' '))
    : [];

  useEffect(() => {
    if (vehicle && startDate && endDate) {
      checkVehicleAvailability();
    }
  }, [vehicle, startDate, endDate]);

  useEffect(() => {
    if (vehicle?.id) {
      setVehicleId(vehicle.id);
    }
  }, [vehicle?.id, setVehicleId]);

  const checkVehicleAvailability = async () => {
    if (!startDate || !endDate) return;

    setIsCheckingAvailability(true);
    setAvailabilityError(null);
    const result = await checkAvailability(startDate, endDate);
    if (!result) {
      setAvailabilityResult(null);
      setAvailabilityError('Unable to confirm availability. Please try again.');
    } else {
      setAvailabilityResult(result);
    }
    setIsCheckingAvailability(false);
  };

  const handleBookNow = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/vehicle/${id}?startDate=${startDate}&endDate=${endDate}` } });
      return;
    }

    if (vehicle?.owner_terms_and_conditions && !termsAccepted) {
      setActionError('Please accept the Terms & Conditions before booking.');
      return;
    }

    if (!startDate || !endDate) {
      setActionError('Please select pickup and dropoff dates from search.');
      return;
    }

    if (!availabilityResult) {
      setActionError('Please check availability before booking.');
      return;
    }

    if (!availabilityResult.available) {
      setActionError('This vehicle is not available for the selected dates.');
      return;
    }

    setActionError(null);
    const selectedId = id || vehicle?.id;
    if (!selectedId) {
      setActionError('Unable to select this vehicle. Please try again.');
      return;
    }
    setVehicleId(selectedId);

    navigate(`/checkout?vehicleId=${id}&startDate=${startDate}&endDate=${endDate}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <LoadingSpinner text="Loading vehicle details..." />
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="mx-auto max-w-7xl px-4">
          <ErrorMessage message={error || 'This vehicle is unavailable or unpublished.'} variant="error" />
          <div className="mt-4">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          Back to Search
        </button>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column - Images and Details */}
          <div className="lg:col-span-2">
            {/* Gallery */}
            <VehicleGallery
              images={vehicle.images || []}
              vehicleName={vehicle.name}
            />

            {/* Vehicle Info */}
            <div className="mt-8 rounded-lg bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <div className="mb-2 flex items-center text-sm text-gray-600">
                    {getVehicleTypeIcon(vehicle.type)} {vehicle.type}
                  </div>
                  <h1 className="mb-2 text-3xl font-bold text-gray-900">
                    {vehicle.name}
                  </h1>
                  {(vehicle.brand || vehicle.model) && (
                    <p className="text-sm text-gray-600">
                      {[vehicle.brand, vehicle.model].filter(Boolean).join(' ')}
                    </p>
                  )}
                  {vehicle.location && (
                    <div className="flex items-center text-gray-600">
                      <MapPin className="mr-2 h-5 w-5" />
                      <span>
                        {vehicle.location.name}, {vehicle.location.city}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center">
                  <Star className="mr-1 h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <span className="text-lg font-semibold text-gray-900">
                    {vehicle.rating?.toFixed(1) || '4.5'}
                  </span>
                  <span className="ml-1 text-gray-600">
                    ({vehicle.total_bookings || 0} rides)
                  </span>
                </div>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-6 md:grid-cols-4">
                <div className="flex items-center">
                  <Fuel className="mr-2 h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-600">Fuel Type</p>
                    <p className="font-medium text-gray-900">{vehicle.fuel_type || 'Petrol'}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Settings className="mr-2 h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-600">Transmission</p>
                    <p className="font-medium text-gray-900">{vehicle.transmission_type || 'Manual'}</p>
                  </div>
                </div>
                {vehicle.gear_type && (
                  <div className="flex items-center">
                    <Settings className="mr-2 h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-600">Gear Type</p>
                      <p className="font-medium text-gray-900">{vehicle.gear_type}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center">
                  <Users className="mr-2 h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-600">Seating</p>
                    <p className="font-medium text-gray-900">{vehicle.seating_capacity || 2} seats</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Calendar className="mr-2 h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-600">Year</p>
                    <p className="font-medium text-gray-900">{vehicle.year || 2023}</p>
                  </div>
                </div>
                {vehicle.current_odometer !== undefined && (
                  <div className="flex items-center">
                    <Settings className="mr-2 h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-600">Odometer</p>
                      <p className="font-medium text-gray-900">{Math.round(vehicle.current_odometer)} km</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-gray-500">Daily Rate</p>
                  <p className="text-lg font-semibold text-gray-900">{formatCurrency(vehicle.daily_rate)} / day</p>
                </div>
                {vehicle.free_km_per_day !== undefined && (
                  <div>
                    <p className="text-xs text-gray-500">Free KM per day</p>
                    <p className="text-sm font-medium text-gray-900">{vehicle.free_km_per_day} km</p>
                  </div>
                )}
                {vehicle.extra_km_rate && (
                  <div>
                    <p className="text-xs text-gray-500">Extra KM rate</p>
                    <p className="text-sm font-medium text-gray-900">{formatCurrency(vehicle.extra_km_rate)} / km</p>
                  </div>
                )}
                {vehicle.security_deposit && (
                  <div>
                    <p className="text-xs text-gray-500">Security Deposit</p>
                    <p className="text-sm font-medium text-gray-900">{formatCurrency(vehicle.security_deposit)}</p>
                  </div>
                )}
              </div>

              {/* Features */}
              {featureList.length > 0 && (
                <div className="mt-6 border-t border-gray-200 pt-6">
                  <h3 className="mb-3 font-semibold text-gray-900">Features</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {featureList.map((feature, index) => (
                      <div key={index} className="flex items-center text-sm text-gray-700">
                        <Check className="mr-2 h-4 w-4 text-green-600" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cancellation Policy */}
              <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start">
                  <Shield className="mr-2 mt-0.5 h-5 w-5 text-gray-600" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Cancellation Policy: {vehicle.cancellation_policy_type}</h4>
                    <p className="mt-1 text-sm text-gray-600">
                      {vehicle.cancellation_policy_type === 'flexible'
                        ? 'Free cancellation up to 24 hours before pickup. 50% refund after that.'
                        : vehicle.cancellation_policy_type === 'moderate'
                        ? 'Free cancellation up to 48 hours before pickup. No refund after that.'
                        : 'No cancellation allowed once confirmed.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Booking Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
              {actionError && (
                <div className="mb-4">
                  <ErrorMessage message={actionError} variant="error" />
                </div>
              )}
              <div className="mb-4 text-center">
                <p className="text-4xl font-bold text-secondary">{formatCurrency(vehicle.daily_rate)}</p>
                <p className="text-sm text-gray-600">per day</p>
              </div>

              {vehicle.security_deposit ? (
                <div className="mb-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                  Security Deposit (Refundable): <span className="font-semibold">{formatCurrency(vehicle.security_deposit)}</span>
                </div>
              ) : null}

              {startDate && endDate && (
                <div className="mb-4 rounded-lg bg-gray-50 p-4 text-sm">
                  <div className="mb-2 flex justify-between">
                    <span className="text-gray-600">Pickup:</span>
                    <span className="font-medium">{formatDate(startDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Dropoff:</span>
                    <span className="font-medium">{formatDate(endDate)}</span>
                  </div>
                </div>
              )}

              {/* Availability Status */}
              {startDate && endDate && (
                <div className="mb-4">
                  {isCheckingAvailability ? (
                    <LoadingSpinner size="sm" text="Checking availability..." />
                  ) : availabilityResult !== null ? (
                    <div
                      className={`rounded-lg p-3 text-center text-sm font-medium ${
                        availabilityResult.available
                          ? 'bg-green-50 text-green-800'
                          : 'bg-red-50 text-red-800'
                      }`}
                    >
                      {availabilityResult.available ? '✓ Available' : '✗ Not Available'}
                    </div>
                  ) : availabilityError ? (
                    <div className="rounded-lg bg-yellow-50 p-3 text-center text-sm font-medium text-yellow-800">
                      {availabilityError}
                    </div>
                  ) : null}
                </div>
              )}

              {vehicle.owner_terms_and_conditions && (
                <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                  <p className="font-medium text-gray-900">Terms & Conditions</p>
                  <p className="mt-1 text-gray-600 whitespace-pre-line">
                    {vehicle.owner_terms_and_conditions}
                  </p>
                  <label className="mt-2 flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                    />
                    I agree to the Terms & Conditions
                  </label>
                </div>
              )}

              <Button
                onClick={handleBookNow}
                fullWidth
                disabled={
                  !startDate ||
                  !endDate ||
                  isCheckingAvailability ||
                  availabilityResult === null ||
                  (availabilityResult !== null && !availabilityResult.available)
                }
              >
                {isAuthenticated ? 'Book Now' : 'Sign In to Book'}
              </Button>

              {!startDate || !endDate && (
                <p className="mt-3 text-center text-xs text-gray-600">
                  Please search with dates to book
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
