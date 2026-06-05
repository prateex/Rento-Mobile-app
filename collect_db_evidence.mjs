import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'http://127.0.0.1:54321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
);

console.log('========== STEP 1A: DAMAGES TABLE ==========');
const { data: damagesData, error: damagesError } = await supabase
  .from('damages')
  .select('id, shop_id, vehicle_id, booking_id, description, photo_urls, reported_by, user_id, reported_at, deleted_at')
  .order('reported_at', { ascending: false });

if (damagesError) {
  console.error('ERROR:', damagesError);
} else {
  console.log('DAMAGES ROWS:', damagesData?.length || 0);
  console.log(JSON.stringify(damagesData, null, 2));
}

console.log('\n========== STEP 1B: BOOKINGS TABLE ==========');
const { data: bookingsData, error: bookingsError } = await supabase
  .from('bookings')
  .select('id, status, returned_at, updated_at')
  .order('updated_at', { ascending: false })
  .limit(5);

if (bookingsError) {
  console.error('ERROR:', bookingsError);
} else {
  console.log('BOOKING ROWS:', bookingsData?.length || 0);
  console.log(JSON.stringify(bookingsData, null, 2));
}

process.exit(0);
