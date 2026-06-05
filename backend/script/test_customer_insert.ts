/**
 * Diagnose POST /api/customers auth + insert against local Supabase.
 * Usage: npx tsx script/test_customer_insert.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(backendRoot, '.env') });
dotenv.config({ path: path.join(backendRoot, '.env.local'), override: true });

const url = process.env.SUPABASE_URL!;
const anon = process.env.SUPABASE_ANON_KEY!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';

async function main() {
  console.log('Backend SUPABASE_URL:', url);

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: users, error: listErr } = await admin.auth.admin.listUsers({ perPage: 5 });
  if (listErr) {
    console.error('listUsers failed:', listErr.message);
    process.exit(1);
  }

  const user = users.users[0];
  if (!user?.email) {
    console.error('No auth users in local DB. Sign in via the app first.');
    process.exit(1);
  }

  console.log('Using auth user:', user.email, user.id);

  // We need password - try seed / common test passwords
  const passwords = ['Password@123', 'TestPass!12345', 'test@123', 'Password@123'];
  let token: string | undefined;

  for (const pw of passwords) {
    const client = createClient(url, anon);
    const { data, error } = await client.auth.signInWithPassword({
      email: user.email,
      password: pw,
    });
    if (!error && data.session?.access_token) {
      token = data.session.access_token;
      console.log('Signed in with password:', pw);
      break;
    }
  }

  if (!token) {
    console.error('Could not sign in — set TEST_EMAIL and TEST_PASSWORD env vars');
    process.exit(1);
  }

  const { data: validated, error: validateErr } = await admin.auth.getUser(token);
  console.log('admin.auth.getUser:', validateErr?.message || 'OK', validated.user?.id);

  const payload = {
    full_name: 'API Test Customer',
    phone: `9${String(Date.now()).slice(-9)}`,
    email: null,
    address: null,
    id_type: 'Aadhaar',
    id_photos: [],
    documents: null,
    status: 'Verified',
    notes: null,
  };

  const res = await fetch(`${baseUrl}/api/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-device-id': 'test-device-script',
    },
    body: JSON.stringify(payload),
  });

  const body = await res.text();
  console.log('POST /api/customers status:', res.status);
  console.log('Response:', body);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
