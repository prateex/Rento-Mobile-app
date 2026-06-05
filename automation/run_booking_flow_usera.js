const { createClient } = require('@supabase/supabase-js');

(async () => {
  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vamxwwgjjfqvwcceedyk.supabase.co';
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || '<CLOUD_SERVICE_ROLE>';
  const PUBLISHABLE_KEY = process.env.SUPABASE_ANON_KEY || '<CLOUD_ANON_KEY>';
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Resolve auth user via admin API
  const { data: usersList, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) { console.error('List users failed', listErr.message); process.exit(1); }
  const authRow = (usersList?.users || []).find(u => u.email === 'usera@test.com');
  if (!authRow?.id) { console.error('Auth user missing'); process.exit(1); }

  // Resolve shop/user ids
  const { data: staff } = await admin.from('users').select('*').eq('auth_id', authRow.id).maybeSingle();
  const { data: shop } = await admin.from('rental_shops').select('*').eq('owner_id', authRow.id).maybeSingle();
  const staff_id = staff?.id;
  const shop_id = shop?.id;
  if (!staff_id || !shop_id) { console.error('Staff or shop not found for usera'); process.exit(1); }

  // Authenticate as usera for RLS-triggered inserts
  const userClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
  const { data: signInData, error: signInErr } = await userClient.auth.signInWithPassword({ email: 'usera@test.com', password: 'Password@123' });
  if (signInErr) { console.error('Sign-in failed', signInErr.message); process.exit(1); }
  const { data: userInfo, error: getUserErr } = await userClient.auth.getUser();
  if (getUserErr) { console.error('GetUser failed', getUserErr.message); process.exit(1); }
  if (!userInfo?.user?.id) { console.error('No authenticated user in client'); process.exit(1); }

  // Create customer
  const { data: customer, error: custErr } = await userClient
    .from('customers')
    .insert({
      shop_id,
      user_id: authRow.id,
      name: 'Alice Test',
      phone: '9000000001',
      email: 'alice@test.com',
      address: 'A Street',
      id_type: 'Driving License',
      id_photos: [],
      status: 'Verified',
    })
    .select()
    .single();
  if (custErr) { console.error('Customer create failed', custErr.message); process.exit(1); }

  // Create vehicle
  const { data: vehicle, error: vehErr } = await userClient
    .from('vehicles')
    .insert({
      shop_id,
      user_id: authRow.id,
      name: 'UserA Bike',
      registration_number: 'UA-REG-1',
      type: 'Two-wheeler',
      brand: 'BrandA',
      model: 'ModelA',
      year: 2023,
      color: 'Blue',
      daily_rate: 75.0,
      status: 'Available',
      current_odometer: 500,
    })
    .select()
    .single();
  if (vehErr) { console.error('Vehicle create failed', vehErr.message); process.exit(1); }

  // Create booking
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const { data: booking, error: bookErr } = await userClient
    .from('bookings')
    .insert({
      shop_id,
      user_id: authRow.id,
      customer_id: customer.id,
      vehicle_ids: [vehicle.id],
      booking_number: `BKA-${Date.now()}`,
      status: 'Confirmed',
      start_date: new Date().toISOString(),
      end_date: tomorrow.toISOString(),
      total_amount: 75.0,
      balance_amount: 75.0,
      advance_amount: 0,
      created_by: staff_id,
    })
    .select()
    .single();
  if (bookErr) { console.error('Booking create failed', bookErr.message); process.exit(1); }

  // Payment
  const { error: payErr } = await userClient
    .from('payments')
    .insert({
      shop_id,
      user_id: authRow.id,
      booking_id: booking.id,
      amount: 50.0,
      payment_type: 'Advance',
      payment_method: 'Cash',
      recorded_by: staff_id,
    });
  if (payErr) { console.error('Payment failed', payErr.message); process.exit(1); }

  // Mark taken
  const { error: takenErr } = await userClient
    .from('bookings')
    .update({ status: 'Taken', opening_odometer: 500, taken_at: new Date().toISOString() })
    .eq('id', booking.id);
  if (takenErr) { console.error('Mark taken failed', takenErr.message); process.exit(1); }
  await userClient.from('vehicles').update({ status: 'Rented' }).eq('id', vehicle.id);

  // Mark returned
  const { error: returnErr } = await userClient
    .from('bookings')
    .update({ status: 'Returned', closing_odometer: 550, returned_at: new Date().toISOString() })
    .eq('id', booking.id);
  if (returnErr) { console.error('Mark returned failed', returnErr.message); process.exit(1); }
  await userClient.from('vehicles').update({ status: 'Available' }).eq('id', vehicle.id);

  // Cancellation case
  const { data: booking2, error: bookErr2 } = await userClient
    .from('bookings')
    .insert({
      shop_id,
      user_id: authRow.id,
      customer_id: customer.id,
      vehicle_ids: [vehicle.id],
      booking_number: `BKA-${Date.now()+1}`,
      status: 'Confirmed',
      start_date: new Date().toISOString(),
      end_date: tomorrow.toISOString(),
      total_amount: 75.0,
      balance_amount: 75.0,
      advance_amount: 0,
      created_by: staff_id,
    })
    .select()
    .single();
  if (bookErr2) { console.error('Booking2 create failed', bookErr2.message); process.exit(1); }
  await userClient.from('bookings').update({ status: 'Cancelled', cancelled_at: new Date().toISOString() }).eq('id', booking2.id);
  // Assertions
  const { data: custRows, error: custSelErr } = await userClient
    .from('customers')
    .select('id')
    .eq('email', 'alice@test.com')
    .eq('shop_id', shop_id)
    .eq('user_id', authRow.id);
  if (custSelErr || !custRows || custRows.length < 1) { console.error('Assertion failed: customer not found'); process.exit(1); }

  const { data: vehRows, error: vehSelErr } = await userClient
    .from('vehicles')
    .select('id,status')
    .eq('registration_number', 'UA-REG-1')
    .eq('shop_id', shop_id)
    .eq('user_id', authRow.id);
  if (vehSelErr || !vehRows || vehRows.length < 1) { console.error('Assertion failed: vehicle not found'); process.exit(1); }
  const vehStatusOk = vehRows.some(v => v.status === 'Available');
  if (!vehStatusOk) { console.error('Assertion failed: vehicle status not Available'); process.exit(1); }

  const { data: booking1, error: b1Err } = await userClient
    .from('bookings')
    .select('id,status')
    .eq('id', booking.id)
    .maybeSingle();
  if (b1Err || !booking1 || booking1.status !== 'Returned') { console.error('Assertion failed: booking1 not Returned'); process.exit(1); }

  const { data: booking2Row, error: b2Err } = await userClient
    .from('bookings')
    .select('id,status')
    .eq('id', booking2.id)
    .maybeSingle();
  if (b2Err || !booking2Row || booking2Row.status !== 'Cancelled') { console.error('Assertion failed: booking2 not Cancelled'); process.exit(1); }

  const { data: payRows, error: paySelErr } = await userClient
    .from('payments')
    .select('id,amount,booking_id')
    .eq('booking_id', booking.id)
    .eq('amount', 50.0);
  if (paySelErr || !payRows || payRows.length < 1) { console.error('Assertion failed: payment not recorded'); process.exit(1); }

  console.log('E2E flow complete for usera@test.com');
  console.log('Assertions passed: customers, vehicles, bookings, payments');
})();
