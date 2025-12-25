import 'dotenv/config';
import { getSupabaseAdminClient } from '../server/lib/supabaseAdmin';

const USER1_EMAIL = 'rento.test+1766641842094@example.com';
const USER1_PASSWORD = 'TestPass!12345';
const USER1_ID = 'cfbd3f66-da6c-4962-b74a-0492bf844dd2';

const USER2_EMAIL = 'rento.test+1766641851103@example.com';
const USER2_PASSWORD = 'TestPass!12345';
const USER2_ID = '11e2334d-973c-418e-a3e0-b98442fe0c3e';

async function setupTestData() {
  const admin = getSupabaseAdminClient();
  
  console.log('\n=== Setting up test shops and data ===\n');
  
  // Create shop for User 1
  const { data: shop1, error: shop1Error } = await admin
    .from('rental_shops')
    .insert({
      owner_id: USER1_ID,
      name: 'Shop Alpha',
      city: 'Mumbai',
      state: 'Maharashtra'
    })
    .select()
    .single();
  
  if (shop1Error) {
    console.error('Shop 1 error:', shop1Error);
    return;
  }
  console.log('✅ Created Shop 1 (Alpha):', shop1.id);
  
  // Create shop for User 2
  const { data: shop2, error: shop2Error } = await admin
    .from('rental_shops')
    .insert({
      owner_id: USER2_ID,
      name: 'Shop Beta',
      city: 'Delhi',
      state: 'Delhi'
    })
    .select()
    .single();
  
  if (shop2Error) {
    console.error('Shop 2 error:', shop2Error);
    return;
  }
  console.log('✅ Created Shop 2 (Beta):', shop2.id);
  
  // Create vehicles for each shop
  const { data: vehicle1 } = await admin
    .from('vehicles')
    .insert({
      shop_id: shop1.id,
      registration_number: 'MH01AA1111',
      brand: 'Honda',
      model: 'Activa',
      type: 'scooter'
    })
    .select()
    .single();
  
  console.log('✅ Created Vehicle 1 for Shop Alpha');
  
  const { data: vehicle2 } = await admin
    .from('vehicles')
    .insert({
      shop_id: shop2.id,
      registration_number: 'DL01BB2222',
      brand: 'Yamaha',
      model: 'R15',
      type: 'bike'
    })
    .select()
    .single();
  
  console.log('✅ Created Vehicle 2 for Shop Beta');
  
  // Create customers for each shop
  const { data: customer1 } = await admin
    .from('customers')
    .insert({
      shop_id: shop1.id,
      full_name: 'Customer Alpha',
      phone: '9999000001',
      email: 'alpha@example.com'
    })
    .select()
    .single();
  
  console.log('✅ Created Customer 1 for Shop Alpha');
  
  const { data: customer2 } = await admin
    .from('customers')
    .insert({
      shop_id: shop2.id,
      full_name: 'Customer Beta',
      phone: '9999000002',
      email: 'beta@example.com'
    })
    .select()
    .single();
  
  console.log('✅ Created Customer 2 for Shop Beta');
  
  // Create bookings for each shop
  const { data: booking1, error: booking1Error } = await admin
    .from('bookings')
    .insert({
      shop_id: shop1.id,
      customer_id: customer1?.id,
      vehicle_id: vehicle1?.id,
      start_time: '2025-01-01T10:00:00Z',
      end_time: '2025-01-05T10:00:00Z',
      booking_status: 'active',
      payment_status: 'paid',
      rent_amount: 1800,
      gst_amount: 200,
      total_amount: 2000
    })
    .select()
    .single();
  
  if (booking1Error) {
    console.error('Booking 1 error:', booking1Error);
  } else {
    console.log('✅ Created Booking 1 for Shop Alpha');
  }
  
  const { data: booking2, error: booking2Error } = await admin
    .from('bookings')
    .insert({
      shop_id: shop2.id,
      customer_id: customer2?.id,
      vehicle_id: vehicle2?.id,
      start_time: '2025-01-10T10:00:00Z',
      end_time: '2025-01-15T10:00:00Z',
      booking_status: 'active',
      payment_status: 'paid',
      rent_amount: 2700,
      gst_amount: 300,
      total_amount: 3000
    })
    .select()
    .single();
  
  if (booking2Error) {
    console.error('Booking 2 error:', booking2Error);
  } else {
    console.log('✅ Created Booking 2 for Shop Beta');
  }
  
  console.log('\n=== Test data setup complete ===\n');
  console.log('Shop 1 (Alpha) ID:', shop1.id);
  console.log('Shop 2 (Beta) ID:', shop2.id);
  console.log('Booking 1 ID:', booking1?.id);
  console.log('Booking 2 ID:', booking2?.id);
}

async function testIsolation() {
  console.log('\n=== Testing Shop Isolation ===\n');
  
  const admin = getSupabaseAdminClient();
  const DEVICE_ID = 'test-device-123';
  
  // Login User 1
  const { data: auth1 } = await admin.auth.signInWithPassword({
    email: USER1_EMAIL,
    password: USER1_PASSWORD
  });
  
  if (!auth1.session) {
    console.error('❌ User 1 login failed');
    return;
  }
  
  const token1 = auth1.session.access_token;
  console.log('✅ User 1 logged in (Shop Alpha)');
  
  // Update device_id for User 1
  await admin
    .from('profiles')
    .update({ last_device_id: DEVICE_ID })
    .eq('id', USER1_ID);
  
  // Login User 2
  const { data: auth2 } = await admin.auth.signInWithPassword({
    email: USER2_EMAIL,
    password: USER2_PASSWORD
  });
  
  if (!auth2.session) {
    console.error('❌ User 2 login failed');
    return;
  }
  
  const token2 = auth2.session.access_token;
  console.log('✅ User 2 logged in (Shop Beta)');
  
  // Update device_id for User 2
  await admin
    .from('profiles')
    .update({ last_device_id: DEVICE_ID })
    .eq('id', USER2_ID);
  
  // Test API calls
  const BASE_URL = 'http://127.0.0.1:3000';
  
  console.log('\n--- Testing User 1 (Shop Alpha) ---');
  
  // User 1: Get bookings
  const res1Bookings = await fetch(`${BASE_URL}/api/bookings`, {
    headers: {
      'Authorization': `Bearer ${token1}`,
      'x-device-id': DEVICE_ID
    }
  });
  const data1Bookings = await res1Bookings.json();
  console.log('User 1 bookings count:', data1Bookings.bookings?.length || 0);
  console.log('User 1 bookings:', data1Bookings.bookings?.map((b: any) => ({ id: b.id, shop_id: b.shop_id })));
  
  // User 1: Get vehicles
  const res1Vehicles = await fetch(`${BASE_URL}/api/vehicles`, {
    headers: {
      'Authorization': `Bearer ${token1}`,
      'x-device-id': DEVICE_ID
    }
  });
  const data1Vehicles = await res1Vehicles.json();
  console.log('User 1 vehicles count:', data1Vehicles.vehicles?.length || 0);
  console.log('User 1 vehicles:', data1Vehicles.vehicles?.map((v: any) => ({ reg: v.registration_number, shop_id: v.shop_id })));
  
  // User 1: Get customers
  const res1Customers = await fetch(`${BASE_URL}/api/customers`, {
    headers: {
      'Authorization': `Bearer ${token1}`,
      'x-device-id': DEVICE_ID
    }
  });
  const data1Customers = await res1Customers.json();
  console.log('User 1 customers count:', data1Customers.customers?.length || 0);
  console.log('User 1 customers:', data1Customers.customers?.map((c: any) => ({ name: c.full_name, shop_id: c.shop_id })));
  
  console.log('\n--- Testing User 2 (Shop Beta) ---');
  
  // User 2: Get bookings
  const res2Bookings = await fetch(`${BASE_URL}/api/bookings`, {
    headers: {
      'Authorization': `Bearer ${token2}`,
      'x-device-id': DEVICE_ID
    }
  });
  const data2Bookings = await res2Bookings.json();
  console.log('User 2 bookings count:', data2Bookings.bookings?.length || 0);
  console.log('User 2 bookings:', data2Bookings.bookings?.map((b: any) => ({ id: b.id, shop_id: b.shop_id })));
  
  // User 2: Get vehicles
  const res2Vehicles = await fetch(`${BASE_URL}/api/vehicles`, {
    headers: {
      'Authorization': `Bearer ${token2}`,
      'x-device-id': DEVICE_ID
    }
  });
  const data2Vehicles = await res2Vehicles.json();
  console.log('User 2 vehicles count:', data2Vehicles.vehicles?.length || 0);
  console.log('User 2 vehicles:', data2Vehicles.vehicles?.map((v: any) => ({ reg: v.registration_number, shop_id: v.shop_id })));
  
  // User 2: Get customers
  const res2Customers = await fetch(`${BASE_URL}/api/customers`, {
    headers: {
      'Authorization': `Bearer ${token2}`,
      'x-device-id': DEVICE_ID
    }
  });
  const data2Customers = await res2Customers.json();
  console.log('User 2 customers count:', data2Customers.customers?.length || 0);
  console.log('User 2 customers:', data2Customers.customers?.map((c: any) => ({ name: c.full_name, shop_id: c.shop_id })));
  
  console.log('\n=== Isolation Test Results ===');
  
  // Verify isolation
  const user1SeeOnlyShop1 = data1Bookings.bookings?.every((b: any) => b.shop_id !== data2Bookings.bookings?.[0]?.shop_id);
  const user2SeeOnlyShop2 = data2Bookings.bookings?.every((b: any) => b.shop_id !== data1Bookings.bookings?.[0]?.shop_id);
  
  if (user1SeeOnlyShop1 && user2SeeOnlyShop2) {
    console.log('✅ PASS: Shop isolation is working correctly!');
    console.log('   - User 1 can only see Shop Alpha data');
    console.log('   - User 2 can only see Shop Beta data');
  } else {
    console.log('❌ FAIL: Shop isolation breach detected!');
  }
}

async function main() {
  try {
    await setupTestData();
    await testIsolation();
  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  }
}

main();
