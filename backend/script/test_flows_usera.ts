import 'dotenv/config';
import { supabase, createUserClient } from '../server/supabase';

type Json = any;

async function main() {
  const email = 'usera@test.com';
  const password = 'Password@123';

  console.log('STEP 1 — AUTHENTICATE');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError || !authData?.user || !authData.session) {
    console.error('AUTH ERROR:', authError?.message || 'No session');
    process.exit(1);
  }
  const uid = authData.user.id;
  const accessToken = authData.session.access_token;
  console.log('AUTH UID', uid);

  const userClient = createUserClient(accessToken);

  // Resolve shop_id (try as owner via RLS; fallback to service)
  console.log('\nResolve shop_id');
  let shopId: string | null = null;
  {
    const { data: ownedShop, error: rlsErr } = await userClient
      .from('rental_shops')
      .select('*')
      .eq('owner_id', uid)
      .maybeSingle();
    if (ownedShop?.id) shopId = ownedShop.id;
    if (!shopId) {
      const { data: anyShop, error: svcErr } = await supabase
        .from('rental_shops')
        .select('*')
        .eq('owner_id', uid)
        .maybeSingle();
      if (anyShop?.id) shopId = anyShop.id;
    }
  }
  if (!shopId) {
    console.error('NO SHOP FOUND for user. Cannot proceed.');
    process.exit(1);
  }
  console.log('shop_id', shopId);

  // STEP 2 — CREATE CUSTOMER
  console.log('\nSTEP 2 — CREATE CUSTOMER');
  const customerPayload: Json = {
    shop_id: shopId,
    user_id: uid,
    full_name: 'Test User A',
    phone: '9999912345',
    email: 'usera+customer@test.com',
    address: 'Test Address',
    id_type: 'Aadhaar',
    id_photos: { front: null, back: null },
    documents: null,
    status: 'Verified',
    notes: 'Inserted by test_flows_usera'
  };
  console.log('CUSTOMER INSERT PAYLOAD:', JSON.stringify(customerPayload));
  const { data: custIns, error: custErr } = await userClient
    .from('customers')
    .insert(customerPayload)
    .select('id, name');
  if (custErr) {
    console.error('CUSTOMER INSERT ERROR:', custErr.message);
  } else {
    console.log('CUSTOMER INSERT RESULT:', custIns);
  }

  const customerId: string | null = Array.isArray(custIns) && custIns[0]?.id ? custIns[0].id : null;
  if (!customerId) {
    console.error('Customer insert did not return id.');
  }

  // STEP 3 — CREATE VEHICLE
  console.log('\nSTEP 3 — CREATE VEHICLE');
  const vehiclePayload: Json = {
    shop_id: shopId,
    user_id: uid,
    name: 'Test Bike A',
      registration_number: 'TEST-' + Math.floor(Math.random() * 9000 + 1000),
    type: 'bike',
    brand: 'BrandX',
    model: 'ModelY',
    year: 2022,
    image_url: null,
    daily_rate: 500,
    current_odometer: 1000,
    documents: { fuelType: 'Petrol', photos: [] },
    damages: []
  };
  console.log('VEHICLE INSERT PAYLOAD:', JSON.stringify(vehiclePayload));
  const { data: vehIns, error: vehErr } = await userClient
    .from('vehicles')
    .insert(vehiclePayload)
    .select('id, name, registration_number');
  if (vehErr) {
    console.error('VEHICLE INSERT ERROR:', vehErr.message);
  } else {
    console.log('VEHICLE INSERT RESULT:', vehIns);
  }

  const vehicleId: string | null = Array.isArray(vehIns) && vehIns[0]?.id ? vehIns[0].id : null;
  if (!vehicleId) {
    console.error('Vehicle insert did not return id.');
  }

  // Resolve created_by (users.id via auth_id)
  console.log('\nResolve created_by (users.id)');
  let createdBy: string | null = null;
  {
    const { data: userRows, error: userErr } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', uid)
      .limit(1);
    if (!userErr && Array.isArray(userRows) && userRows[0]?.id) {
      createdBy = userRows[0].id;
    }
  }
  if (!createdBy) {
    console.warn('No staff users row found; creating minimal staff user for test...');
    const phone = '999991000' + Math.floor(Math.random() * 9);
    const { data: newUserRows, error: newUserErr } = await supabase
      .from('users')
      .insert({ shop_id: shopId, auth_id: uid, name: 'UserA', phone, role: 'staff', is_active: true })
      .select('id');
    if (newUserErr || !Array.isArray(newUserRows) || !newUserRows[0]?.id) {
      console.error('Failed creating staff user row:', newUserErr?.message);
    } else {
      createdBy = newUserRows[0].id;
      console.log('Created staff user row:', createdBy);
    }
  }

  // STEP 4 — CREATE BOOKING (only if prior inserts succeeded)
  console.log('\nSTEP 4 — CREATE BOOKING');
  const start = new Date();
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  const bookingPayload: Json = {
    shop_id: shopId,
    user_id: uid,
    booking_number: 'BK-' + Math.floor(Math.random() * 1e6),
    customer_id: customerId,
    vehicle_ids: vehicleId ? [vehicleId] : [],
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    status: 'Confirmed',
    rent_amount: 500,
    total_amount: 500,
    advance_amount: 0,
    balance_amount: 500,
    invoice_number: null,
    opening_odometer: null,
    closing_odometer: null,
    notes: 'Inserted by test_flows_usera',
     gst_amount: 0,
     created_by: null
  };
  console.log('BOOKING INSERT PAYLOAD:', JSON.stringify(bookingPayload));
  const { data: bookIns, error: bookErr } = await userClient
    .from('bookings')
    .insert(bookingPayload)
    .select('id, booking_number');
  if (bookErr) {
    console.error('BOOKING INSERT ERROR:', bookErr.message);
  } else {
    console.log('BOOKING INSERT RESULT:', bookIns);
  }

  console.log('\nDONE');
}

main().catch((e) => {
  console.error('Test run failed:', e);
  process.exit(1);
});
