import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(backendRoot, '.env') });
dotenv.config({ path: path.join(backendRoot, '.env.local'), override: true });

const url = process.env.SUPABASE_URL!;
const anon = process.env.SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 5 });
  const email = authUsers.users.find((u) => u.email)?.email;
  if (!email) throw new Error('No users');

  const client = createClient(url, anon);
  const { data: auth, error: signErr } = await client.auth.signInWithPassword({
    email,
    password: process.env.TEST_PASSWORD || 'test@123',
  });
  if (signErr) throw signErr;

  const token = auth.session!.access_token;
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: u, error: userErr } = await userClient
    .from('users')
    .select('shop_id, role')
    .single();
  console.log('user row:', u, userErr?.message);

  const shopId = u!.shop_id as string;

  await userClient.from('shop_pickup_points').update({ is_default: false }).eq('shop_id', shopId);

  const payload = {
    shop_id: shopId,
    name: `Test Pickup ${Date.now()}`,
    latitude: 15.49,
    longitude: 73.83,
    address_text: 'Test address',
    city: 'Panaji',
    pincode: '403001',
    is_default: true,
    is_active: true,
  };

  const { data, error } = await userClient
    .from('shop_pickup_points')
    .insert(payload)
    .select('id, name, is_default')
    .single();

  console.log('insert:', error?.code, error?.message || 'OK', data);

  const { data: list, error: listErr } = await userClient
    .from('shop_pickup_points')
    .select('id, name, is_default, is_active')
    .eq('shop_id', shopId);

  console.log('list (RLS):', listErr?.message, list);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
