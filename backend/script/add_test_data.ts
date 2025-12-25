import 'dotenv/config';
import { getSupabaseAdminClient } from '../server/lib/supabaseAdmin';

const SHOP1_ID = '02556fe9-e83e-4d79-94e3-190bf0c3c5c5'; // Goa bikes Rental Shop
const SHOP2_ID = '2000e9d5-219b-4660-9d9d-5201c8c25850'; // Prateek Rental Shop

async function addTestData() {
  const admin = getSupabaseAdminClient();
  
  console.log('Adding test data for Shop 1 (Goa bikes)...');
  
  // Shop 1 vehicle
  const { data: v1 } = await admin
    .from('vehicles')
    .insert({
      shop_id: SHOP1_ID,
      registration_number: 'TEST-MH-01',
      brand: 'Honda',
      model: 'Activa',
      type: 'scooter'
    })
    .select()
    .single();
  
  console.log('✅ Vehicle added for Shop 1');
  
  // Shop 1 customer
  const { data: c1 } = await admin
    .from('customers')
    .insert({
      shop_id: SHOP1_ID,
      full_name: 'Test Customer Shop1',
      phone: '9999111111',
      email: 'test1@shop1.com'
    })
    .select()
    .single();
  
  console.log('✅ Customer added for Shop 1');
  
  // Shop 1 booking
  if (v1 && c1) {
    await admin
      .from('bookings')
      .insert({
        shop_id: SHOP1_ID,
        vehicle_id: v1.id,
        customer_id: c1.id,
        start_time: '2025-01-01T10:00:00Z',
        end_time: '2025-01-05T10:00:00Z',
        rent_amount: 1800,
        gst_amount: 200,
        total_amount: 2000,
        booking_status: 'active',
        payment_status: 'paid'
      });
    console.log('✅ Booking added for Shop 1');
  }
  
  console.log('\nAdding test data for Shop 2 (Prateek)...');
  
  // Shop 2 vehicle
  const { data: v2 } = await admin
    .from('vehicles')
    .insert({
      shop_id: SHOP2_ID,
      registration_number: 'TEST-DL-02',
      brand: 'Yamaha',
      model: 'R15',
      type: 'bike'
    })
    .select()
    .single();
  
  console.log('✅ Vehicle added for Shop 2');
  
  // Shop 2 customer
  const { data: c2 } = await admin
    .from('customers')
    .insert({
      shop_id: SHOP2_ID,
      full_name: 'Test Customer Shop2',
      phone: '9999222222',
      email: 'test2@shop2.com'
    })
    .select()
    .single();
  
  console.log('✅ Customer added for Shop 2');
  
  // Shop 2 booking
  if (v2 && c2) {
    await admin
      .from('bookings')
      .insert({
        shop_id: SHOP2_ID,
        vehicle_id: v2.id,
        customer_id: c2.id,
        start_time: '2025-01-10T10:00:00Z',
        end_time: '2025-01-15T10:00:00Z',
        rent_amount: 2700,
        gst_amount: 300,
        total_amount: 3000,
        booking_status: 'active',
        payment_status: 'paid'
      });
    console.log('✅ Booking added for Shop 2');
  }
  
  console.log('\n✅ Test data setup complete!\n');
}

addTestData().catch(console.error);
