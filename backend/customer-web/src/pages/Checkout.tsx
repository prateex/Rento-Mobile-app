import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useVehicle } from '@/hooks/useVehicles';
import { useLocations } from '@/hooks/useLocations';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { bookingService } from '@/services/bookings.service';
import { paymentService } from '@/services/payments.service';
import { availabilityService } from '@/services/availability.service';
import { PricingBreakdownComponent } from '@/components/booking/PricingBreakdown';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { Button } from '@/components/common/Button';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { useBookingFlow } from '@/app/BookingFlowContext';
import { AvailabilityError, BookingCreationError, PaymentError, getUserFacingMessage } from '@/utils/error.utils';

export function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuth();
  const { flow, setVehicleId, setBookingId } = useBookingFlow();

  const vehicleId = searchParams.get('vehicleId') || flow?.vehicleId || null;
  const startDate = searchParams.get('startDate') || flow?.startDate || null;
  const endDate = searchParams.get('endDate') || flow?.endDate || null;

  const { vehicle, loading: vehicleLoading } = useVehicle(vehicleId || undefined);
  const { locations, loading: locationsLoading } = useLocations();
  const {
    profile,
    documents,
    isComplete: isProfileComplete,
    isLicenseValid,
  } = useCustomerProfile();

  const [pickupLocationId, setPickupLocationId] = useState('');
  const [dropoffLocationId, setDropoffLocationId] = useState('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [confirmationMode, setConfirmationMode] = useState<'pay_now' | 'pay_later' | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'failed' | 'success'>('idle');
  const [paymentErrorMessage, setPaymentErrorMessage] = useState<string | null>(null);
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(flow?.bookingId || null);
  const payAtPickupEnabled = (import.meta.env.VITE_ENABLE_PAY_AT_PICKUP ?? 'true') === 'true';

  useEffect(() => {
    if (flow?.bookingId) {
      setPendingBookingId(flow.bookingId);
    }
  }, [flow?.bookingId]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/checkout?vehicleId=${vehicleId}&startDate=${startDate}&endDate=${endDate}` } });
    }
  }, [isAuthenticated, navigate, vehicleId, startDate, endDate]);

  useEffect(() => {
    if (vehicleId) {
      setVehicleId(vehicleId);
    }
  }, [vehicleId, setVehicleId]);

  // Redirect if missing params
  useEffect(() => {
    if (!vehicleId || !startDate || !endDate) {
      navigate('/');
    }
  }, [vehicleId, startDate, endDate, navigate]);

  // Filter locations by vehicle's city
  const filteredLocations = locations.filter(
    (loc) => loc.city === vehicle?.location?.city
  );

  // Set default locations
  useEffect(() => {
    if (vehicle && filteredLocations.length > 0 && !pickupLocationId) {
      const defaultLocation = filteredLocations[0];
      setPickupLocationId(defaultLocation.id);
      setDropoffLocationId(defaultLocation.id);
    }
  }, [vehicle, filteredLocations]);

  const hasFrontId = documents.some((d) => d.document_type === 'ID_FRONT');
  const hasBackId = documents.some((d) => d.document_type === 'ID_BACK');
  const hasIdDocuments = hasFrontId && hasBackId;
  const hasLocations = Boolean(pickupLocationId && dropoffLocationId);
  const requiresTerms = Boolean(vehicle?.owner_terms_and_conditions);
  const isReadyToConfirm = Boolean(
    vehicle &&
    startDate &&
    endDate &&
    hasLocations &&
    isProfileComplete &&
    isLicenseValid &&
    hasIdDocuments &&
    (!requiresTerms || termsAccepted)
  );

  const buildSnapshot = () => ({
    customerName: profile?.full_name || user?.email || '',
    customerPhone: profile?.phone || '',
    customerEmail: profile?.email || user?.email || '',
    customerAddress: profile?.address || '',
    customerEmergencyContact: profile?.emergency_contact || '',
    customerIdType: profile?.id_type || '',
    pickupLocationName: vehicle?.owner_pickup_location_name || pickupLocation?.name || null,
    pickupAddress: vehicle?.owner_pickup_address || null,
    pickupLat: vehicle?.owner_pickup_lat ?? null,
    pickupLng: vehicle?.owner_pickup_lng ?? null,
  });

  const resolveExistingBooking = async (mode: 'pay_now' | 'pay_later') => {
    if (!pendingBookingId) return null;
    const existing = await bookingService.getBookingById(pendingBookingId);

    if (!existing) {
      return null;
    }

    if (existing.vehicle_id !== vehicle?.id || existing.start_date !== startDate || existing.end_date !== endDate) {
      return null;
    }

    if (existing.payment_status === 'paid') {
      return existing;
    }

    if (mode === 'pay_later' && existing.status === 'confirmed') {
      return existing;
    }

    return existing;
  };

  const createPendingBooking = async (mode: 'pay_now' | 'pay_later') => {
    if (!vehicle || !startDate || !endDate) {
      throw new BookingCreationError('Missing booking data', 'Booking details are incomplete.');
    }

    const pricing = bookingService.calculatePricing(
      vehicle.daily_rate,
      startDate,
      endDate,
      vehicle.security_deposit || 0
    );

    const paymentGateway = mode === 'pay_now'
      ? paymentService.getPaymentGateway()
      : 'manual';

    const bookingStatus = mode === 'pay_later' ? 'confirmed' : 'requested';

    const booking = await bookingService.createBooking(
      vehicle.id,
      vehicle.owner_id!,
      vehicle.shop_id!,
      pickupLocationId,
      dropoffLocationId,
      startDate,
      endDate,
      pricing,
      buildSnapshot(),
      {
        status: bookingStatus,
        paymentStatus: 'unpaid',
        paymentGateway,
        paymentChoice: mode === 'pay_later' ? 'Booking Only' : null,
        paymentMode: mode === 'pay_later' ? 'Other' : null,
      }
    );

    setPendingBookingId(booking.id);
    setBookingId(booking.id);
    return booking;
  };

  const handleConfirm = async (mode: 'pay_now' | 'pay_later') => {
    if (!isProfileComplete) {
      navigate('/profile', { state: { from: `/checkout?vehicleId=${vehicleId}&startDate=${startDate}&endDate=${endDate}` } });
      return;
    }

    if (!isLicenseValid) {
      navigate('/kyc', { state: { from: `/checkout?vehicleId=${vehicleId}&startDate=${startDate}&endDate=${endDate}` } });
      return;
    }

    if (!hasIdDocuments) {
      navigate('/profile', { state: { from: `/checkout?vehicleId=${vehicleId}&startDate=${startDate}&endDate=${endDate}` } });
      return;
    }

    if (vehicle?.owner_terms_and_conditions && !termsAccepted) {
      setCheckoutError('Please accept the Terms & Conditions before proceeding.');
      return;
    }

    if (!pickupLocationId || !dropoffLocationId) {
      setCheckoutError('Pickup and dropoff details are missing. Please restart your booking.');
      return;
    }
    setCheckoutError(null);
    setPaymentErrorMessage(null);
    setPaymentStatus('processing');
    setConfirmationMode(mode);
    setIsProcessing(true);

    try {
      if (!vehicle || !startDate || !endDate) {
        throw new BookingCreationError('Missing booking data', 'Booking details are incomplete.');
      }

      const availability = await availabilityService.checkVehicleAvailability(
        vehicle.id,
        startDate,
        endDate
      );

      if (!availability.is_available) {
        throw new AvailabilityError(
          'Vehicle not available for selected time',
          'This bike is no longer available for the selected time.'
        );
      }

      const existingBooking = await resolveExistingBooking(mode);
      const booking = existingBooking ?? await createPendingBooking(mode);

      if (booking.payment_status === 'paid') {
        setPaymentStatus('success');
        navigate(`/booking-success/${booking.id}`);
        return;
      }

      if (mode === 'pay_later') {
        if (booking.status !== 'confirmed') {
          await bookingService.updateBooking(booking.id, {
            status: 'confirmed',
            payment_status: 'unpaid',
            payment_gateway: 'manual',
          });
        }

        const existingPayment = await paymentService.getPaymentByBookingId(booking.id);
        if (!existingPayment) {
          await paymentService.recordPayAtPickup(booking.id, booking.total_amount);
        }

        setPaymentStatus('success');
        navigate(`/booking-success/${booking.id}`);
        return;
      }

      const payment = await paymentService.initiatePayment(
        booking.id,
        booking.total_amount,
        paymentService.getPaymentMethod()
      );

      await bookingService.updateBooking(booking.id, {
        status: 'confirmed',
        payment_status: 'paid',
        payment_gateway: paymentService.getPaymentGateway(),
        payment_id: payment.external_payment_id || payment.transaction_id || booking.payment_id,
      });

      setPaymentStatus('success');
      navigate(`/booking-success/${booking.id}`);
    } catch (error) {
      console.error('Payment failed:', error);
      setPaymentStatus('failed');
      setPaymentErrorMessage(
        getUserFacingMessage(error, 'Payment failed. Please try again or choose pay at pickup.')
      );

      if (error instanceof PaymentError || error instanceof AvailabilityError || error instanceof BookingCreationError) {
        setCheckoutError(getUserFacingMessage(error, 'Something went wrong. Please try again.'));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (vehicleLoading || locationsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <LoadingSpinner text="Loading..." />
      </div>
    );
  }

  if (!vehicle || !startDate || !endDate) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="mx-auto max-w-7xl px-4">
          <ErrorMessage message="Invalid booking details. Please start your search again." variant="error" />
          <div className="mt-4">
            <Button variant="outline" onClick={() => navigate('/')}>Back to Search</Button>
          </div>
        </div>
      </div>
    );
  }

  const pickupLocation = filteredLocations.find((loc) => loc.id === pickupLocationId);
  const dropoffLocation = filteredLocations.find((loc) => loc.id === dropoffLocationId);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          Back
        </button>

        <h1 className="mb-8 text-3xl font-bold text-gray-900">Booking Confirmation</h1>

        {!isProfileComplete && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Please complete your profile and upload ID documents before booking.
            <button
              onClick={() => navigate('/profile', { state: { from: `/checkout?vehicleId=${vehicleId}&startDate=${startDate}&endDate=${endDate}` } })}
              className="ml-2 font-semibold underline"
            >
              Complete Profile
            </button>
          </div>
        )}

        {!isLicenseValid && (
          <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            Driving license verification is required before booking.
            <button
              onClick={() => navigate('/kyc', { state: { from: `/checkout?vehicleId=${vehicleId}&startDate=${startDate}&endDate=${endDate}` } })}
              className="ml-2 font-semibold underline"
            >
              Upload License
            </button>
          </div>
        )}

        {checkoutError && (
          <div className="mb-6">
            <ErrorMessage message={checkoutError} variant="error" />
          </div>
        )}

        {paymentStatus === 'processing' && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            Processing your booking. Please keep this window open.
          </div>
        )}

        {paymentStatus === 'failed' && paymentErrorMessage && (
          <div className="mb-6">
            <ErrorMessage message={paymentErrorMessage} variant="error" />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Summary Column */}
          <div className="lg:col-span-1 lg:order-2">
            <PricingBreakdownComponent
              vehicle={vehicle}
              startDate={startDate}
              endDate={endDate}
              pickupLocation={pickupLocation?.name || 'Pickup location pending'}
              dropoffLocation={dropoffLocation?.name || 'Dropoff location pending'}
            />

            <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Confirm & Pay</h3>
              <p className="mt-2 text-sm text-gray-600">
                Your booking details are locked. Review the summary and choose how you want to pay.
              </p>

              <div className="mt-4 space-y-3">
                <Button
                  onClick={() => handleConfirm('pay_now')}
                  fullWidth
                  disabled={!isReadyToConfirm || isProcessing}
                  loading={isProcessing && confirmationMode === 'pay_now'}
                >
                  <CreditCard className="mr-2 h-5 w-5" />
                  Confirm & Pay
                </Button>
                {payAtPickupEnabled && (
                  <Button
                    variant="outline"
                    onClick={() => handleConfirm('pay_later')}
                    fullWidth
                    disabled={!isReadyToConfirm || isProcessing}
                    loading={isProcessing && confirmationMode === 'pay_later'}
                  >
                    Pay at Pickup
                  </Button>
                )}
              </div>

              {!isReadyToConfirm && (
                <p className="mt-3 text-xs text-gray-500">
                  Complete the required steps before confirming.
                </p>
              )}

              {confirmationMode && paymentStatus !== 'processing' && (
                <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                  {confirmationMode === 'pay_now'
                    ? 'We are preparing your payment. You will see a receipt after confirmation.'
                    : 'You chose to pay at pickup. We will finalize payment at the rental counter.'}
                  <button
                    onClick={() => setConfirmationMode(null)}
                    className="ml-2 font-semibold underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Details Column */}
          <div className="lg:col-span-2 lg:order-1">
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Final Review</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                  Locked
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Double-check your booking summary. To make changes, use the back button.
              </p>

              {!filteredLocations.length && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  Pickup locations are not available for this city. Please restart your booking.
                </div>
              )}

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pickup Location</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {pickupLocation?.name || 'Pending'}
                  </p>
                  {(pickupLocation?.city || pickupLocation?.state) && (
                    <p className="mt-1 text-xs text-gray-600">
                      {pickupLocation?.city}{pickupLocation?.state ? `, ${pickupLocation.state}` : ''}
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Dropoff Location</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {dropoffLocation?.name || 'Pending'}
                  </p>
                  {(dropoffLocation?.city || dropoffLocation?.state) && (
                    <p className="mt-1 text-xs text-gray-600">
                      {dropoffLocation?.city}{dropoffLocation?.state ? `, ${dropoffLocation.state}` : ''}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Pickup reminder:</strong> Arrive 15 minutes early and bring your driving license and ID.
                </p>
              </div>

              {vehicle?.owner_pickup_location_name && (
                <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-700">
                    <strong>Owner Pickup Location:</strong> {vehicle.owner_pickup_location_name}
                  </p>
                  {vehicle.owner_pickup_address && (
                    <p className="mt-1 text-sm text-gray-600">{vehicle.owner_pickup_address}</p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Booking Requirements</h3>
              <div className="mt-4 grid gap-3 text-sm text-gray-700">
                <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                  <span>Profile completed</span>
                  <span className={isProfileComplete ? 'text-green-600' : 'text-red-600'}>
                    {isProfileComplete ? 'Done' : 'Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                  <span>License verified</span>
                  <span className={isLicenseValid ? 'text-green-600' : 'text-red-600'}>
                    {isLicenseValid ? 'Done' : 'Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                  <span>ID documents uploaded</span>
                  <span className={hasIdDocuments ? 'text-green-600' : 'text-red-600'}>
                    {hasIdDocuments ? 'Done' : 'Missing'}
                  </span>
                </div>
              </div>
            </div>

            {vehicle?.owner_terms_and_conditions && (
              <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-2 text-sm font-semibold text-gray-900">Terms & Conditions</h3>
                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {vehicle.owner_terms_and_conditions}
                </p>
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                  />
                  I agree to the Terms & Conditions
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
