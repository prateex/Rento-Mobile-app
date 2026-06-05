import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vamxwwgjjfqvwcceedyk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhbXh3d2dqamZxdndjY2VlZHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0ODg2MTIsImV4cCI6MjA4MjA2NDYxMn0.DgY51SV0UFogxQ-vnk35w4-otvLuEZUhlSIGuDf2RfY'
);

console.log('=== Seeding minimal test data ===\n');

// Login
const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email: 'usera@test.com',
  password: 'test@123'
});

if (authError) {
  console.log('❌ Login failed:', authError.message);
  process.exit(1);
}

console.log('✓ Logged in as:', authData.user.email);
const userId = authData.user.id;

// Check if shop already exists
const { data: existingShop } = await supabase.from('shop').select('*').single();

if (existingShop) {
  console.log('\n✓ Shop already exists:', existingShop.name);
  console.log('Shop ID:', existingShop.id);
  
  // Check for customer
  const { data: existingCustomer } = await supabase.from('customers').select('*').limit(1).single();
  if (existingCustomer) {
    console.log('✓ Customer already exists:', existingCustomer.name);
  } else {
    console.log('⚠️  No customers found - please add via UI');
  }
  
  // Check for vehicle
  const { data: existingVehicle } = await supabase.from('vehicles').select('*').limit(1).single();
  if (existingVehicle) {
    console.log('✓ Vehicle already exists:', existingVehicle.reg_number);
  } else {
    console.log('⚠️  No vehicles found - please add via UI');
  }
  
} else {
  console.log('\n❌ No shop found');
  console.log('⚠️  Cannot seed without shop ownership');
  console.log('Please create a shop through the UI first');
}

console.log('\n=== Seed check complete ===');
