-- Create marketplace location/date index for bookings
CREATE INDEX IF NOT EXISTS idx_bookings_location_dates
  ON bookings(pickup_location_id, start_date, end_date)
  WHERE is_online_booking = true AND status IN ('Confirmed', 'Taken');
