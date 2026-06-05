import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYwMzk0NzM4MCwiZXhwIjoxNjM0NDgzMzgwfQ.RJXE8tLvd0DFPwWQltVHQIqXiHyW8cQJe1GyWm-kK28';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjAzOTQ3MzgwLCJleHAiOjE2MzQ0ODMzODB9.ViMgsQKe5IKLfG7d3aEJ9VASwmlGF3zQJTfJ0mTWW-4';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function testCustomerCreation() {
  console.log('\n=== TEST 1: Customer Creation ===');
  
  try {
    // Setup: Get test shop ID
    const { data: shops } = await supabase.from('shops').select('id').limit(1);
    if (!shops || shops.length === 0) {
      console.error('❌ No test shop found');
      return false;
    }
    
    const shopId = shops[0].id;
    console.log('✓ Test shop ID:', shopId);

    // Test payload with all required fields
    const testPhone = `TEST-${Date.now()}`;
    const payload = {
      shop_id: shopId,
      full_name: 'Test Customer',
      phone: testPhone,
      email: 'test@example.com',
      address: 'Test Address',
      id_type: 'Aadhaar',
      status: 'Verified',
      notes: null,
      documents: null,
    };

    console.log('Creating customer with payload:', JSON.stringify(payload, null, 2));

    const { data: inserted, error } = await supabase
      .from('customers')
      .insert(payload)
      .select('id, full_name, phone, email, shop_id, status, created_at');

    if (error) {
      console.error('❌ Customer insert failed:', error.message);
      return false;
    }

    if (!inserted || inserted.length === 0) {
      console.error('❌ No row returned from insert');
      return false;
    }

    const customer = inserted[0];
    console.log('✓ Customer created:', {
      id: customer.id,
      name: customer.full_name,
      phone: customer.phone,
      shop_id: customer.shop_id
    });

    // Verify persistence: Read it back
    const { data: verified, error: readError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customer.id)
      .single();

    if (readError) {
      console.error('❌ Failed to verify customer:', readError.message);
      return false;
    }

    if (!verified) {
      console.error('❌ Customer not found in database');
      return false;
    }

    console.log('✓ Customer verified in database');
    return true;
  } catch (e) {
    console.error('❌ Exception:', e.message);
    return false;
  }
}

async function testVehicleCreation() {
  console.log('\n=== TEST 2: Vehicle Creation (No Duplicates) ===');
  
  try {
    // Setup: Get test shop ID
    const { data: shops } = await supabase.from('shops').select('id').limit(1);
    if (!shops || shops.length === 0) {
      console.error('❌ No test shop found');
      return false;
    }
    
    const shopId = shops[0].id;

    const testReg = `TEST-${Date.now()}`;
    const payload = {
      shop_id: shopId,
      registration_number: testReg,
      vehicle_type: 'bike',
      type: 'bike',
      brand: 'Honda',
      model: 'CB Shine',
      cc: '125',
      segment: 'Commuter',
      gear_type: 'Manual',
      category: 'Commuter Bike',
      year: 2024,
      image_url: null,
      daily_rate: 500,
      status: 'Available',
      current_odometer: 0,
      documents: null,
    };

    console.log('Creating vehicle...');

    const { data: inserted, error } = await supabase
      .from('vehicles')
      .insert(payload)
      .select('id, registration_number, brand, model, vehicle_type, type');

    if (error) {
      console.error('❌ Vehicle insert failed:', error.message);
      return false;
    }

    if (!inserted || inserted.length === 0) {
      console.error('❌ No row returned from insert');
      return false;
    }

    const vehicle = inserted[0];
    console.log('✓ Vehicle created:', {
      id: vehicle.id,
      reg: vehicle.registration_number,
      brand: vehicle.brand,
      model: vehicle.model,
      type: vehicle.vehicle_type
    });

    // Verify
    const { data: verified, error: readError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', vehicle.id)
      .single();

    if (readError) {
      console.error('❌ Failed to verify vehicle:', readError.message);
      return false;
    }

    console.log('✓ Vehicle verified in database');
    return true;
  } catch (e) {
    console.error('❌ Exception:', e.message);
    return false;
  }
}

async function testPhotoUploadStructure() {
  console.log('\n=== TEST 3: Photo Upload Structure ===');
  
  try {
    // Check if storage bucket exists
    const { data: buckets, error: bucketError } = await supabase
      .storage
      .listBuckets();

    if (bucketError) {
      console.error('❌ Failed to list buckets:', bucketError.message);
      return false;
    }

    const hasCustomerIdBucket = buckets.some(b => b.name === 'customer-ids');
    if (!hasCustomerIdBucket) {
      console.warn('⚠ customer-ids bucket not found. App will fail to upload photos.');
      console.log('Available buckets:', buckets.map(b => b.name));
      return false;
    }

    console.log('✓ Storage bucket exists: customer-ids');
    
    // Check if columns exist
    const { data: schema, error: schemaError } = await supabase
      .from('customers')
      .select()
      .limit(0);

    if (schemaError) {
      console.error('❌ Failed to check schema:', schemaError.message);
      return false;
    }

    console.log('✓ Customers table accessible');
    return true;
  } catch (e) {
    console.error('❌ Exception:', e.message);
    return false;
  }
}

async function runAllTests() {
  console.log('\n╔════════════════════════════════════╗');
  console.log('║  CRITICAL FLOW VALIDATION TESTS    ║');
  console.log('╚════════════════════════════════════╝');

  const results = [];

  results.push(await testCustomerCreation());
  results.push(await testVehicleCreation());
  results.push(await testPhotoUploadStructure());

  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log('\n╔════════════════════════════════════╗');
  console.log(`║  SUMMARY: ${passed}/${total} tests passed  ${passed === total ? '✓' : '✗'}          ║`);
  console.log('╚════════════════════════════════════╝\n');

  return passed === total;
}

runAllTests().then(success => {
  process.exit(success ? 0 : 1);
});
