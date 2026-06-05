import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBooking } from '@/hooks/useBookings';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { CheckCircle, Calendar, Download } from 'lucide-react';
import { BookingTimeline } from '@/components/booking/BookingTimeline';
import { formatCurrency, getCancellationPolicyText, getStatusLabel } from '@/utils/format.utils';
import { formatDateTime, getMinutesRemaining } from '@/utils/date.utils';
import { useBookingFlow } from '@/app/BookingFlowContext';
import { bookingService } from '@/services/bookings.service';
import { paymentService } from '@/services/payments.service';

export function BookingSuccess() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { flow } = useBookingFlow();
  const bookingId = id || flow?.bookingId;
  const { booking, loading, error, refetch } = useBooking(bookingId);
  const [minutesRemaining, setMinutesRemaining] = useState<number | null>(null);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [pickupNotes, setPickupNotes] = useState('');
  const [pickupError, setPickupError] = useState<string | null>(null);
  const [pickupProcessing, setPickupProcessing] = useState(false);
  const [showDropModal, setShowDropModal] = useState(false);
  const [dropNotes, setDropNotes] = useState('');
  const [dropError, setDropError] = useState<string | null>(null);
  const [dropProcessing, setDropProcessing] = useState(false);
  const EXPIRY_MINUTES = 15;

  useEffect(() => {
    // Confetti or celebration animation could go here
  }, []);

  useEffect(() => {
    if (!id && bookingId) {
      navigate(`/booking-success/${bookingId}`, { replace: true });
    }
  }, [id, bookingId, navigate]);

  useEffect(() => {
    if (!booking || booking.status !== 'requested') {
      setMinutesRemaining(null);
      return;
    }

    const updateCountdown = () => {
      setMinutesRemaining(getMinutesRemaining(booking.created_at, EXPIRY_MINUTES));
    };

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 30000);

    return () => window.clearInterval(intervalId);
  }, [booking]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <LoadingSpinner text="Loading booking details..." />
      </div>
    );
  }

  if (error || !booking || !bookingId) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="mx-auto max-w-3xl px-4">
          <ErrorMessage message={error || 'Booking not found'} variant="error" />
          <div className="mt-4">
            <Button onClick={() => navigate('/my-bookings')}>
              View My Bookings
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const paymentStatusLabel = booking.payment_status === 'paid'
    ? 'Paid Online'
    : 'Pay at Pickup';
  const amountPaid = booking.payment_status === 'paid' ? booking.total_amount : 0;
  const amountDue = booking.payment_status === 'paid' ? 0 : booking.total_amount;
  const supportPhone = booking.shop?.phone || '+91-90000-00000';
  const payAtPickupAllowed = booking.payment_status === 'unpaid' && booking.payment_gateway === 'manual';
  const canPickup = booking.status === 'confirmed' && (booking.payment_status === 'paid' || payAtPickupAllowed);
  const canDrop = booking.status === 'active';

  const plannedPricing = bookingService.calculatePricing(
    booking.vehicle?.daily_rate || 0,
    booking.start_date,
    booking.end_date,
    booking.security_deposit_amount || 0
  );
  const actualStart = booking.actual_pickup_at || booking.start_date;
  const actualEnd = booking.actual_dropoff_at || booking.end_date;
  const actualPricing = bookingService.calculatePricing(
    booking.vehicle?.daily_rate || 0,
    actualStart,
    actualEnd,
    booking.security_deposit_amount || 0
  );
  const plannedRentalTotal = plannedPricing.total_amount - plannedPricing.security_deposit_amount;
  const actualRentalTotal = actualPricing.total_amount - actualPricing.security_deposit_amount;
  const extraCharges = 0;
  const depositDeduction = 0;
  const finalTotal = booking.final_amount ?? (actualRentalTotal + extraCharges + depositDeduction);
  const amountPaidFinal = booking.payment_status === 'paid' ? booking.total_amount : 0;
  const balanceDue = Math.max(finalTotal - amountPaidFinal, 0);
  const refundDue = Math.max(amountPaidFinal - finalTotal, 0);

  const handlePickupConfirm = async () => {
    if (!booking) return;

    setPickupProcessing(true);
    setPickupError(null);

    const noteSuffix = pickupNotes.trim() ? `\nPickup notes: ${pickupNotes.trim()}` : '';
    const combinedNotes = `${booking.notes || ''}${noteSuffix}`.trim() || null;

    const updated = await bookingService.updateBooking(booking.id, {
      status: 'active',
      actual_pickup_at: new Date().toISOString(),
      notes: combinedNotes || undefined,
    });

    if (!updated) {
      setPickupError('Unable to confirm pickup. Please try again.');
      setPickupProcessing(false);
      return;
    }

    await refetch();
    setPickupProcessing(false);
    setShowPickupModal(false);
    setPickupNotes('');
  };

  const handleDropConfirm = async () => {
    if (!booking) return;

    setDropProcessing(true);
    setDropError(null);

    const noteSuffix = dropNotes.trim() ? `\nReturn notes: ${dropNotes.trim()}` : '';
    const combinedNotes = `${booking.notes || ''}${noteSuffix}`.trim() || null;

    const dropTime = new Date().toISOString();
    const actualPricingAtDrop = bookingService.calculatePricing(
      booking.vehicle?.daily_rate || 0,
      booking.actual_pickup_at || booking.start_date,
      dropTime,
      booking.security_deposit_amount || 0
    );
    const actualRentalAtDrop = actualPricingAtDrop.total_amount - actualPricingAtDrop.security_deposit_amount;
    const finalAmountAtDrop = actualRentalAtDrop + 0;
    const paidAmountAtDrop = booking.payment_status === 'paid' ? booking.total_amount : 0;
    const balanceAtDrop = Math.max(finalAmountAtDrop - paidAmountAtDrop, 0);
    const refundAtDrop = Math.max(paidAmountAtDrop - finalAmountAtDrop, 0);

    const updated = await bookingService.updateBooking(booking.id, {
      status: 'completed',
      actual_dropoff_at: dropTime,
      final_amount: finalAmountAtDrop,
      balance_amount: balanceAtDrop,
      refund_amount: refundAtDrop,
      notes: combinedNotes || undefined,
    });

    if (!updated) {
      setDropError('Unable to confirm return. Please try again.');
      setDropProcessing(false);
      return;
    }

    await refetch();
    setDropProcessing(false);
    setShowDropModal(false);
    setDropNotes('');

    if (!booking.refund_amount && refundAtDrop > 0) {
      await paymentService.recordPendingRefund(booking.id, refundAtDrop);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-3xl px-4">
        {/* Success Message */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            {getStatusLabel(booking.status)}
          </h1>
          <p className="text-gray-600">
            {booking.status === 'requested'
              ? 'Your booking is awaiting owner approval. You will see updates in My Bookings.'
              : booking.status === 'confirmed'
              ? 'Your booking has been confirmed by the owner.'
              : booking.status === 'active'
              ? 'Your bike has been picked up. Ride safely.'
              : booking.status === 'completed'
              ? 'Your ride is completed. Thanks for riding with us.'
              : booking.status === 'cancelled'
              ? 'This booking has been cancelled.'
              : 'This booking has expired.'}
          </p>
        </div>

        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <BookingTimeline status={booking.status} />
          {minutesRemaining !== null && (
            <p className="mt-3 text-sm text-gray-600">
              Owner has {minutesRemaining} minute{minutesRemaining === 1 ? '' : 's'} to confirm
            </p>
          )}
        </div>

        {/* Booking Details Card */}
        <div className="rounded-lg bg-white p-8 shadow-lg">
          {/* Booking ID */}
          <div className="mb-6 border-b border-gray-200 pb-6">
            <p className="text-sm text-gray-600">Booking ID</p>
            <p className="text-2xl font-bold text-gray-900">{booking.booking_number || booking.id}</p>
          </div>

          {/* Vehicle Details */}
          <div className="mb-6 flex items-start space-x-4">
            {booking.vehicle?.image_url && (
              <img
                src={booking.vehicle.image_url}
                alt={booking.vehicle.name}
                className="h-24 w-24 rounded-lg object-cover"
              />
            )}
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {booking.vehicle?.name}
              </h3>
              <p className="text-gray-600">{booking.vehicle?.type}</p>
              {booking.vehicle?.registration_number && (
                <p className="text-sm text-gray-500">Reg: {booking.vehicle.registration_number}</p>
              )}
            </div>
          </div>

          {/* Booking Information */}
          <div className="space-y-4 border-t border-gray-200 pt-6">
            <div className="flex items-start">
              <Calendar className="mr-3 mt-1 h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Pickup</p>
                <p className="text-gray-600">{formatDateTime(booking.start_date)}</p>
                {booking.pickup_location && (
                  <p className="text-sm text-gray-600">
                    {booking.pickup_location.name}, {booking.pickup_location.city}
                  </p>
                )}
                {booking.pickup_location_name && (
                  <p className="text-sm text-gray-600">
                    {booking.pickup_location_name}
                  </p>
                )}
                {booking.pickup_address && (
                  <p className="text-xs text-gray-500">{booking.pickup_address}</p>
                )}
              </div>
            </div>

            <div className="flex items-start">
              <Calendar className="mr-3 mt-1 h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Dropoff</p>
                <p className="text-gray-600">{formatDateTime(booking.end_date)}</p>
                {booking.dropoff_location && (
                  <p className="text-sm text-gray-600">
                    {booking.dropoff_location.name}, {booking.dropoff_location.city}
                  </p>
                )}
                {booking.actual_dropoff_at && (
                  <p className="text-sm text-gray-600">
                    Returned at {formatDateTime(booking.actual_dropoff_at)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Amount */}
          <div className="mt-6 border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between">
              <span className="text-lg font-medium text-gray-900">Total Amount</span>
                <span className="text-2xl font-bold text-secondary">
                {formatCurrency(booking.total_amount)}
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Payment Status</span>
                <span className="font-medium">{paymentStatusLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Amount Paid</span>
                <span className="font-medium">{formatCurrency(amountPaid)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Amount Due</span>
                <span className="font-medium">{formatCurrency(amountDue)}</span>
              </div>
            </div>
          </div>

          {booking.status === 'completed' && (
            <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
              <h4 className="mb-2 text-sm font-semibold text-gray-900">Final Invoice</h4>
              <div className="grid gap-2 text-sm text-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Planned duration</span>
                  <span className="font-medium">{plannedPricing.days} day{plannedPricing.days !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Actual duration</span>
                  <span className="font-medium">{actualPricing.days} day{actualPricing.days !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Planned rental</span>
                  <span className="font-medium">{formatCurrency(plannedRentalTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Actual rental</span>
                  <span className="font-medium">{formatCurrency(actualRentalTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Extras</span>
                  <span className="font-medium">{formatCurrency(extraCharges)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Deposit deductions</span>
                  <span className="font-medium">{formatCurrency(depositDeduction)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 pt-2">
                  <span className="font-semibold text-gray-900">Final total</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(finalTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Amount paid</span>
                  <span className="font-medium">{formatCurrency(amountPaidFinal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Refund due</span>
                  <span className="font-medium">{formatCurrency(refundDue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Balance payable</span>
                  <span className="font-medium">{formatCurrency(balanceDue)}</span>
                </div>
              </div>
              {(refundDue > 0 || balanceDue > 0) && (
                <p className="mt-3 text-xs text-gray-500">
                  {refundDue > 0
                    ? 'Refund is marked as pending. We will notify you once processed.'
                    : 'Balance due is recorded. Please settle with the rental team.'}
                </p>
              )}
            </div>
          )}

          <div className="mt-6 space-y-2 border-t border-gray-200 pt-6 text-sm text-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Shop</span>
              <span className="font-medium">{booking.shop?.name || 'Rental Shop'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Cancellation Policy</span>
              <span className="font-medium">
                {getCancellationPolicyText(booking.vehicle?.cancellation_policy_type || 'standard')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Support</span>
              <span className="font-medium">{supportPhone}</span>
            </div>
          </div>

          {/* Important Notes */}
            <div className="mt-6 rounded-lg bg-primary/20 p-4">
              <h4 className="mb-2 font-semibold text-secondary">Important Information</h4>
              <ul className="space-y-1 text-sm text-secondary">
              <li>• Arrive 15 minutes before your scheduled pickup time</li>
              <li>• Bring a valid ID proof and driver's license</li>
              <li>• Original booking confirmation will be sent to your email</li>
              <li>• Vehicle inspection will be done at pickup and dropoff</li>
            </ul>
          </div>

          <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
            <h4 className="mb-2 text-sm font-semibold text-gray-900">What happens next</h4>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>• We are notifying the rental team about your booking.</li>
              <li>• Bring your driving license and the ID you uploaded.</li>
              <li>• If you chose pay at pickup, keep your payment method ready.</li>
              <li>• Need help? Call us at {supportPhone}.</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col space-y-3 sm:flex-row sm:space-x-3 sm:space-y-0">
            <Button
              variant="primary"
              fullWidth
              onClick={() => navigate('/my-bookings')}
            >
              View Booking Details
            </Button>
            {canPickup && (
              <Button
                variant="outline"
                fullWidth
                onClick={() => setShowPickupModal(true)}
              >
                Confirm Pickup
              </Button>
            )}
            {canDrop && (
              <Button
                variant="outline"
                fullWidth
                onClick={() => setShowDropModal(true)}
              >
                Confirm Return
              </Button>
            )}
            <Button
              variant="outline"
              fullWidth
              onClick={() => navigate('/')}
            >
              Book Another Vehicle
            </Button>
          </div>
        </div>

        {/* Download/Print Option */}
        <div className="mt-6 text-center">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center text-sm text-secondary hover:opacity-80"
            >
            <Download className="mr-1 h-4 w-4" />
            Download Receipt (PDF)
          </button>
        </div>
      </div>

      <Modal
        isOpen={showPickupModal}
        onClose={() => !pickupProcessing && setShowPickupModal(false)}
        title="Confirm Pickup"
        size="md"
      >
        <div className="py-2">
          <p className="text-sm text-gray-600">
            Confirming pickup will mark your booking as picked up. Add any optional notes below.
          </p>
          {pickupError && (
            <div className="mt-4">
              <ErrorMessage message={pickupError} variant="error" />
            </div>
          )}
          <label className="mt-4 block text-sm font-medium text-gray-700">
            Bike condition notes (optional)
          </label>
          <textarea
            value={pickupNotes}
            onChange={(event) => setPickupNotes(event.target.value)}
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            rows={4}
            placeholder="Example: Minor scratch on left panel"
          />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button
              variant="primary"
              fullWidth
              onClick={handlePickupConfirm}
              loading={pickupProcessing}
              disabled={pickupProcessing}
            >
              Mark as Picked Up
            </Button>
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowPickupModal(false)}
              disabled={pickupProcessing}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDropModal}
        onClose={() => !dropProcessing && setShowDropModal(false)}
        title="Confirm Return"
        size="md"
      >
        <div className="py-2">
          <p className="text-sm text-gray-600">
            Confirming return will mark your booking as completed. Add any optional return notes below.
          </p>
          {dropError && (
            <div className="mt-4">
              <ErrorMessage message={dropError} variant="error" />
            </div>
          )}
          <label className="mt-4 block text-sm font-medium text-gray-700">
            Return notes (optional)
          </label>
          <textarea
            value={dropNotes}
            onChange={(event) => setDropNotes(event.target.value)}
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            rows={4}
            placeholder="Example: Full fuel tank, minor scratch on handle"
          />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button
              variant="primary"
              fullWidth
              onClick={handleDropConfirm}
              loading={dropProcessing}
              disabled={dropProcessing}
            >
              Mark as Returned
            </Button>
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowDropModal(false)}
              disabled={dropProcessing}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
