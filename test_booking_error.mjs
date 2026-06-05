import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vamxwwgjjfqvwcceedyk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhbXh3d2dqamZxdndjY2VlZHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0ODg2MTIsImV4cCI6MjA4MjA2NDYxMn0.DgY51SV0UFogxQ-vnk35w4-otvLuEZUhlSIGuDf2RfY'
);

console.log('=== PHASE 1: BOOKING ERROR REPRODUCTION ===\n');

// Test login
console.log('Step 1: Testing login...');
const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email: 'usera@test.com',
  password: 'test@123'
});

if (authError) {
  console.log('❌ AUTH ERROR:', JSON.stringify(authError, null, 2));
  process.exit(1);
}

console.log('✓ Login successful');
console.log('  User:', authData.user.email);
console.log('  User ID:', authData.user.id);

// Check for required data
console.log('\nStep 2: Checking for required data...');
const { data: shop } = await supabase.from('shop').select('*').single();
const { data: customers } = await supabase.from('customers').select('id, name').limit(1);
const { data: vehicles } = await supabase.from('vehicles').select('id, reg_number').limit(1);

console.log('  Shop:', shop?.name || '❌ MISSING');
console.log('  Customers:', customers?.length > 0 ? `✓ ${customers[0].name}` : '❌ MISSING');
console.log('  Vehicles:', vehicles?.length > 0 ? `✓ ${vehicles[0].reg_number}` : '❌ MISSING');

if (!shop || !customers?.length || !vehicles?.length) {
  console.log('\n⚠️  Cannot reproduce error - missing seed data');
  console.log('Please seed the database with at least:');
  console.log('  - 1 shop');
  console.log('  - 1 customer');
  console.log('  - 1 vehicle');
  process.exit(1);
}

// Test booking creation with 'Booked' status (should trigger constraint error)
console.log('\n=== Step 3: Attempting to create booking with status="Booked" ===');

const bookingPayload = {
  shop_id: shop.id,
  customer_id: customers[0].id,
  vehicle_id: vehicles[0].id,
  booking_date: new Date().toISOString().split('T')[0],
  start_datetime: new Date().toISOString(),
  end_datetime: new Date(Date.now() + 86400000).toISOString(),
  status: 'Booked',  // This is what the frontend uses
  price: 100,
  created_by: authData.user.id
};

console.log('Payload:', JSON.stringify(bookingPayload, null, 2));

const { data: booking, error: bookingError } = await supabase
  .from('bookings')
  .insert(bookingPayload)
  .select()
  .single();

if (bookingError) {
  console.log('\n🔴 === EXACT ERROR CAPTURED ===');
  console.log(JSON.stringify(bookingError, null, 2));
  console.log('\n✓ Phase 1 Complete: Error reproduced successfully');
  process.exit(0);
} else {
  console.log('✓ Booking created successfully:', booking.id);
  console.log('⚠️  No error occurred - constraint may have already been fixed');
  process.exit(0);
}
