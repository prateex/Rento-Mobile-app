import 'dotenv/config';
import { getSupabaseAdminClient } from '../server/lib/supabaseAdmin';

const SHOP1_ID = '02556fe9-e83e-4d79-94e3-190bf0c3c5c5'; // Goa bikes
const SHOP2_ID = '2000e9d5-219b-4660-9d9d-5201c8c25850'; // Prateek

async function debugData() {
  const admin = getSupabaseAdminClient();
  
  console.log('\n=== DEBUG: Checking Data in Database ===\n');
  
  // Check bookings
  console.log('📊 ALL BOOKINGS in database:');
  const { data: allBookings } = await admin
    .from('bookings')
    .select('id, shop_id, customer_id, vehicle_id');
  
  console.log(JSON.stringify(allBookings, null, 2));
  
  // Check vehicles
  console.log('\n🏍️  ALL VEHICLES in database:');
  const { data: allVehicles } = await admin
    .from('vehicles')
    .select('id, shop_id, registration_number');
  
  console.log(JSON.stringify(allVehicles, null, 2));
  
  // Check customers
  console.log('\n👥 ALL CUSTOMERS in database:');
  const { data: allCustomers } = await admin
    .from('customers')
    .select('id, shop_id, full_name');
  
  console.log(JSON.stringify(allCustomers, null, 2));
  
  // Check rental_shops
  console.log('\n🏬 RENTAL SHOPS:');
  const { data: shops } = await admin
    .from('rental_shops')
    .select('id, name, owner_id');
  
  console.log(JSON.stringify(shops, null, 2));
  
  console.log('\n=== END DEBUG ===\n');
}

debugData().catch(console.error);
