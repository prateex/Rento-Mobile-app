import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { mapBookingPayloadToDb } from '../shared/bookingEnums.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(backendRoot, '.env') });
dotenv.config({ path: path.join(backendRoot, '.env.local'), override: true });

async function main() {
  const url = process.env.SUPABASE_URL!;
  const anon = process.env.SUPABASE_ANON_KEY!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, service);
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1 });
  const email = authUsers.users[0]?.email!;
  const client = createClient(url, anon);
  const { data: auth } = await client.auth.signInWithPassword({ email, password: 'test@123' });
  const token = auth.session!.access_token;
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userRow } = await userClient.from('users').select('shop_id').single();
  const shopId = userRow!.shop_id as string;

  const { data: customer } = await userClient.from('customers').select('id').eq('shop_id', shopId).limit(1).single();
  const { data: pickup } = await userClient.from('shop_pickup_points').select('id').eq('shop_id', shopId).limit(1).single();
  const { data: vehicle } = await userClient.from('vehicles').select('id').eq('shop_id', shopId).limit(1).single();

  if (!customer?.id || !pickup?.id || !vehicle?.id) {
    console.error('Missing seed data (customer, pickup, vehicle)');
    process.exit(1);
  }

  const now = new Date();
  const end = new Date(now.getTime() + 86400000);
  const payload = mapBookingPayloadToDb({
    shop_id: shopId,
    customer_id: customer.id,
    pickup_point_id: pickup.id,
    vehicle_ids: [vehicle.id],
    start_date: now.toISOString(),
    end_date: end.toISOString(),
    start_datetime: now.toISOString(),
    end_datetime: end.toISOString(),
    status: 'requested',
    rent: 500,
    deposit: 1000,
    total_amount: 1500,
    advance_amount: 0,
    balance_amount: 1500,
    payment_status: 'unpaid',
    notes: null,
  });

  const { data, error } = await userClient
    .from('bookings')
    .insert(payload)
    .select('id, booking_number, status, payment_status')
    .single();

  console.log('insert:', error?.message || 'OK', data);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
