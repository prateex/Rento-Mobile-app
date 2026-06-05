import { useNavigate } from 'react-router-dom';
import { Star, MapPin, Fuel, Settings } from 'lucide-react';
import { formatCurrency, getVehicleTypeIcon } from '@/utils/format.utils';
import type { VehicleWithDetails } from '@/types';
import { useBookingFlow } from '@/app/BookingFlowContext';

interface VehicleCardProps {
  vehicle: VehicleWithDetails;
  startDate?: string;
  endDate?: string;
}

export function VehicleCard({ vehicle, startDate, endDate }: VehicleCardProps) {
  const navigate = useNavigate();
  const { setVehicleId } = useBookingFlow();

  const handleClick = () => {
    const searchParams = new URLSearchParams();
    if (startDate) searchParams.set('startDate', startDate);
    if (endDate) searchParams.set('endDate', endDate);
    setVehicleId(vehicle.id);
    navigate(`/vehicle/${vehicle.id}?${searchParams.toString()}`);
  };

  const primaryImage = vehicle.image_url || vehicle.images?.[0]?.image_url || '/placeholder-vehicle.jpg';
  const displayName = vehicle.name || `${vehicle.brand || ''} ${vehicle.model || ''}`.trim();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleClick();
        }
      }}
      className="group cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
    >
      {/* Image */}
      <div className="relative aspect-video overflow-hidden bg-gray-200">
        <img
          src={primaryImage}
          alt={displayName}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-medium shadow">
          {getVehicleTypeIcon(vehicle.type)} {vehicle.type}
        </div>
        {vehicle.gear_type && (
          <div className="absolute right-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-medium shadow">
            {vehicle.gear_type}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-secondary">
              {displayName}
            </h3>
            <p className="text-xs text-gray-500">{vehicle.brand || 'Verified vendor'}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-secondary">
              {formatCurrency(vehicle.daily_rate || 0)}
            </p>
            <p className="text-xs text-gray-600">per day</p>
          </div>
        </div>

        {/* Location */}
        {vehicle.location && (
          <div className="mb-3 flex items-center text-sm text-gray-600">
            <MapPin className="mr-1 h-4 w-4" />
            <span>
              {vehicle.location.name}, {vehicle.location.city}
            </span>
          </div>
        )}

        {/* Specs */}
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <div className="flex items-center">
            <Fuel className="mr-1 h-4 w-4" />
            <span>{vehicle.fuel_type || 'Petrol'}</span>
          </div>
          <div className="flex items-center">
            <Settings className="mr-1 h-4 w-4" />
            <span>{vehicle.transmission_type || 'Manual'}</span>
          </div>
          {vehicle.seating_capacity && (
            <div className="text-xs text-gray-500">
              {vehicle.seating_capacity} seats
            </div>
          )}
        </div>

        {/* Rating and Price */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Star className="mr-1 h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium text-gray-900">
              {vehicle.rating?.toFixed(1) || '4.5'}
            </span>
            <span className="ml-1 text-sm text-gray-600">
              ({vehicle.total_bookings || 0} rides)
            </span>
          </div>
          <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
            Available
          </span>
        </div>
      </div>
    </div>
  );
}
