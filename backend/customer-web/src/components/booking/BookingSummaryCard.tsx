import { useEffect, useState } from 'react';
import { Calendar, MapPin } from 'lucide-react';
import { formatCurrency, getCancellationPolicyText, getStatusColor, getStatusLabel } from '@/utils/format.utils';
import { formatDateTime, getMinutesRemaining } from '@/utils/date.utils';
import type { BookingWithDetails } from '@/types';
import { Button } from '../common/Button';
import { BookingTimeline } from './BookingTimeline';

interface BookingSummaryCardProps {
  booking: BookingWithDetails;
  onCancel?: (id: string) => void;
  onViewDetails?: (id: string) => void;
}

export function BookingSummaryCard({ booking, onCancel, onViewDetails }: BookingSummaryCardProps) {
  const canCancel = booking.status === 'requested';
  const statusColor = getStatusColor(booking.status);
  const statusLabel = getStatusLabel(booking.status);
  const [minutesRemaining, setMinutesRemaining] = useState<number | null>(null);
  const EXPIRY_MINUTES = 15;

  useEffect(() => {
    if (booking.status !== 'requested') {
      setMinutesRemaining(null);
      return;
    }

    const updateCountdown = () => {
      setMinutesRemaining(getMinutesRemaining(booking.created_at, EXPIRY_MINUTES));
    };

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 30000);

    return () => window.clearInterval(intervalId);
  }, [booking.status, booking.created_at]);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header with Status */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
        <div>
          <p className="text-sm text-gray-600">Booking ID</p>
          <p className="font-semibold text-gray-900">{booking.booking_number || booking.id}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="border-b border-gray-200 px-6 py-4">
        <BookingTimeline status={booking.status} />
        {minutesRemaining !== null && (
          <p className="mt-3 text-xs text-gray-600">
            Owner has {minutesRemaining} minute{minutesRemaining === 1 ? '' : 's'} to confirm
          </p>
        )}
      </div>

      <div className="p-6">
        {/* Vehicle Info */}
        <div className="mb-4 flex items-start space-x-4">
          {booking.vehicle?.image_url && (
            <img
              src={booking.vehicle.image_url}
              alt={booking.vehicle.name}
              className="h-20 w-20 rounded-lg object-cover"
            />
          )}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {booking.vehicle?.name}
            </h3>
            <p className="text-sm text-gray-600">{booking.vehicle?.type}</p>
          </div>
        </div>

        {/* Booking Details */}
        <div className="mb-4 space-y-2 border-t border-gray-200 pt-4">
          <div className="flex items-center text-sm text-gray-700">
            <Calendar className="mr-2 h-4 w-4 text-gray-400" />
            <span className="font-medium">Pickup:</span>
            <span className="ml-2">{formatDateTime(booking.start_date)}</span>
          </div>
          {booking.actual_pickup_at && (
            <div className="flex items-center text-sm text-gray-700">
              <Calendar className="mr-2 h-4 w-4 text-gray-400" />
              <span className="font-medium">Picked up:</span>
              <span className="ml-2">{formatDateTime(booking.actual_pickup_at)}</span>
            </div>
          )}
          <div className="flex items-center text-sm text-gray-700">
            <Calendar className="mr-2 h-4 w-4 text-gray-400" />
            <span className="font-medium">Dropoff:</span>
            <span className="ml-2">{formatDateTime(booking.end_date)}</span>
          </div>
          {booking.actual_dropoff_at && (
            <div className="flex items-center text-sm text-gray-700">
              <Calendar className="mr-2 h-4 w-4 text-gray-400" />
              <span className="font-medium">Returned:</span>
              <span className="ml-2">{formatDateTime(booking.actual_dropoff_at)}</span>
            </div>
          )}
          {(booking.pickup_location || booking.pickup_location_name) && (
            <div className="flex items-center text-sm text-gray-700">
              <MapPin className="mr-2 h-4 w-4 text-gray-400" />
              <span>
                {booking.pickup_location
                  ? `${booking.pickup_location.name}, ${booking.pickup_location.city}`
                  : booking.pickup_location_name}
              </span>
            </div>
          )}
        </div>

        {/* Trust Details */}
        <div className="space-y-2 border-t border-gray-200 pt-4 text-sm text-gray-700">
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
            <span className="font-medium">+91-90000-00000</span>
          </div>
        </div>

        {/* Price */}
        <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
          <div>
            <p className="text-sm text-gray-600">Total Amount</p>
            <p className="text-2xl font-bold text-secondary">{formatCurrency(booking.total_amount)}</p>
          </div>
          <div className="flex space-x-2">
            {onViewDetails && (
              <Button size="sm" variant="outline" onClick={() => onViewDetails(booking.id)}>
                View Details
              </Button>
            )}
            {canCancel && onCancel && (
              <Button size="sm" variant="danger" onClick={() => onCancel(booking.id)}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
