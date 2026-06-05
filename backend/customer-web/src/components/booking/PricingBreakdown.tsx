import { Clock, Calendar, MapPin, Info } from 'lucide-react';
import { formatCurrency } from '@/utils/format.utils';
import { formatDateTime } from '@/utils/date.utils';
import { bookingService } from '@/services/bookings.service';
import type { PricingBreakdown, VehicleWithDetails } from '@/types';

interface PricingBreakdownProps {
  vehicle: VehicleWithDetails;
  startDate: string;
  endDate: string;
  pickupLocation: string;
  dropoffLocation: string;
}

export function PricingBreakdownComponent({
  vehicle,
  startDate,
  endDate,
  pickupLocation,
  dropoffLocation,
}: PricingBreakdownProps) {
  const pricing: PricingBreakdown = bookingService.calculatePricing(
    vehicle.daily_rate,
    startDate,
    endDate,
    vehicle.security_deposit || 0
  );
  const { days } = pricing;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">Booking Summary</h2>

      {/* Vehicle */}
      <div className="mb-6 flex items-start space-x-4">
        <img
          src={vehicle.image_url || vehicle.images?.[0]?.image_url || '/placeholder-vehicle.jpg'}
          alt={vehicle.name}
          className="h-20 w-20 rounded-lg object-cover"
        />
        <div>
          <h3 className="font-semibold text-gray-900">
            {vehicle.name}
          </h3>
          <p className="text-sm text-gray-600">{vehicle.type}</p>
          <p className="text-sm text-gray-600">
            {vehicle.transmission_type} • {vehicle.fuel_type}
          </p>
        </div>
      </div>

      {/* Booking Details */}
      <div className="mb-6 space-y-3 border-t border-gray-200 pt-4">
        <div className="flex items-center text-sm text-gray-700">
          <Calendar className="mr-2 h-4 w-4 text-gray-400" />
          <span className="font-medium">Pickup:</span>
          <span className="ml-2">{formatDateTime(startDate)}</span>
        </div>
        <div className="flex items-center text-sm text-gray-700">
          <Calendar className="mr-2 h-4 w-4 text-gray-400" />
          <span className="font-medium">Dropoff:</span>
          <span className="ml-2">{formatDateTime(endDate)}</span>
        </div>
        <div className="flex items-center text-sm text-gray-700">
          <MapPin className="mr-2 h-4 w-4 text-gray-400" />
          <span className="font-medium">Pickup Location:</span>
          <span className="ml-2">{pickupLocation}</span>
        </div>
        <div className="flex items-center text-sm text-gray-700">
          <MapPin className="mr-2 h-4 w-4 text-gray-400" />
          <span className="font-medium">Dropoff Location:</span>
          <span className="ml-2">{dropoffLocation}</span>
        </div>
        <div className="flex items-center text-sm text-gray-700">
          <Clock className="mr-2 h-4 w-4 text-gray-400" />
          <span className="font-medium">Duration:</span>
          <span className="ml-2">{days} day{days !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Price Breakdown */}
      <div className="space-y-3 border-t border-gray-200 pt-4">
        <div className="flex justify-between text-sm text-gray-700">
          <span>Base Price ({days} day{days !== 1 ? 's' : ''} × {formatCurrency(vehicle.daily_rate)})</span>
          <span className="font-medium">{formatCurrency(pricing.base_rental_amount)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-700">
          <span>GST (18%)</span>
          <span className="font-medium">{formatCurrency(pricing.tax_amount)}</span>
        </div>
        {pricing.security_deposit_amount > 0 && (
          <div className="flex justify-between text-sm text-gray-700">
            <span>Security Deposit (Refundable)</span>
            <span className="font-medium">{formatCurrency(pricing.security_deposit_amount)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-gray-300 pt-3 text-lg font-semibold text-gray-900">
          <span>Total Amount</span>
          <span className="text-secondary">{formatCurrency(pricing.total_amount)}</span>
        </div>
      </div>

      {/* Cancellation Policy */}
      <div className="mt-6 rounded-lg bg-primary/20 p-4">
        <div className="flex items-start">
          <Info className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-secondary" />
          <div className="text-sm text-secondary">
            <p className="font-medium">Cancellation Policy</p>
            <p className="mt-1">
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
  );
}
