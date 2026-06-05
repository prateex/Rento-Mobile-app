// Test script to verify vehicle insert with new metadata
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testVehicleInsert() {
  console.log('1. Testing vehicle insert with metadata...\n');
  
  // Mock test data
  const testPayload = {
    shop_id: '00000000-0000-0000-0000-000000000001', // Will need actual shop_id
    registration_number: 'TEST-123',
    vehicle_type: 'bike',
    type: 'bike',
    brand: 'Honda',
    model: 'Shine',
    cc: '125cc',
    segment: 'Commuter',
    gear_type: 'Manual',
    category: 'Standard',
    year: 2024,
    daily_rate: 500,
    status: 'Available',
    current_odometer: 0,
    fuel_type: 'Petrol',
    documents: { fuelType: 'Petrol', photos: [] },
    damages: []
  };
  
  console.log('Payload:', JSON.stringify(testPayload, null, 2));
  
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .insert(testPayload)
      .select('*')
      .single();
    
    if (error) {
      console.error('❌ INSERT FAILED:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    } else {
      console.log('✅ INSERT SUCCESS!');
      console.log('Data:', JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.error('❌ EXCEPTION:', e);
  }
  
  console.log('\n2. Checking existing vehicles...\n');
  const { data: vehicles, error: fetchError } = await supabase
    .from('vehicles')
    .select('id, brand, model, cc, segment, gear_type, category')
    .limit(5);
  
  if (fetchError) {
    console.error('Fetch error:', fetchError);
  } else {
    console.log('Vehicles:', vehicles);
  }
}

testVehicleInsert().catch(console.error);
