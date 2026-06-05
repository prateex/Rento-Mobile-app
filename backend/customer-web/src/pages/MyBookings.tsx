import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBookings } from '@/hooks/useBookings';
import { BookingSummaryCard } from '@/components/booking/BookingSummaryCard';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage, EmptyState } from '@/components/common/ErrorMessage';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Calendar, AlertCircle } from 'lucide-react';

export function MyBookings() {
  const navigate = useNavigate();
  const { bookings, loading, error, cancelBooking, refetch } = useBookings();
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'active' | 'past' | 'cancelled'>('active');

  const handleCancelClick = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedBookingId) return;

    setCancellingBookingId(selectedBookingId);
    const success = await cancelBooking(selectedBookingId);
    
    if (success) {
      setShowCancelModal(false);
      setSelectedBookingId(null);
    }
    
    setCancellingBookingId(null);
  };

  const handleViewDetails = (bookingId: string) => {
    navigate(`/booking-success/${bookingId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <LoadingSpinner text="Loading your bookings..." />
      </div>
    );
  }

  const filteredBookings = bookings
    .filter((booking) => {
      if (filter === 'active') {
        return ['requested', 'confirmed', 'active'].includes(booking.status);
      }
      if (filter === 'past') {
        return ['completed', 'expired'].includes(booking.status);
      }
      return booking.status === 'cancelled';
    })
    .sort((a, b) => {
      const aDate = new Date(a.start_date || a.created_at).getTime();
      const bDate = new Date(b.start_date || b.created_at).getTime();
      return bDate - aDate;
    });

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Bookings</h1>
            <p className="mt-2 text-gray-600">View and manage your vehicle bookings</p>
          </div>
          <Button onClick={() => navigate('/')}>
            <Calendar className="mr-2 h-4 w-4" />
            Book New Vehicle
          </Button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <Button
            variant={filter === 'active' ? 'primary' : 'outline'}
            onClick={() => setFilter('active')}
          >
            Active
          </Button>
          <Button
            variant={filter === 'past' ? 'primary' : 'outline'}
            onClick={() => setFilter('past')}
          >
            Past
          </Button>
          <Button
            variant={filter === 'cancelled' ? 'primary' : 'outline'}
            onClick={() => setFilter('cancelled')}
          >
            Cancelled
          </Button>
        </div>

        {/* Error State */}
        {error && (
          <ErrorMessage message={error} variant="error" onRetry={refetch} />
        )}

        {/* Empty State */}
        {!loading && !error && filteredBookings.length === 0 && (
          <EmptyState
            title={
              filter === 'active'
                ? 'No active bookings'
                : filter === 'past'
                ? 'No past bookings'
                : 'No cancelled bookings'
            }
            description={
              filter === 'active'
                ? 'Start exploring and book your first vehicle'
                : 'Try switching filters to see other bookings'
            }
            actionLabel="Browse Vehicles"
            onAction={() => navigate('/')}
          />
        )}

        {/* Bookings Grid */}
        {!loading && !error && filteredBookings.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredBookings.map((booking) => (
              <BookingSummaryCard
                key={booking.id}
                booking={booking}
                onCancel={handleCancelClick}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => !cancellingBookingId && setShowCancelModal(false)}
        title="Cancel Booking"
        size="md"
      >
        <div className="py-4">
          <div className="mb-6 flex items-start space-x-3">
            <AlertCircle className="h-6 w-6 flex-shrink-0 text-red-600" />
            <div>
              <p className="font-medium text-gray-900">Are you sure you want to cancel this booking?</p>
              <p className="mt-2 text-sm text-gray-600">
                Refund will be processed according to the cancellation policy.
              </p>
            </div>
          </div>

          <div className="flex space-x-3">
            <Button
              variant="danger"
              onClick={handleConfirmCancel}
              loading={!!cancellingBookingId}
              disabled={!!cancellingBookingId}
              fullWidth
            >
              Yes, Cancel Booking
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowCancelModal(false)}
              disabled={!!cancellingBookingId}
              fullWidth
            >
              Keep Booking
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
