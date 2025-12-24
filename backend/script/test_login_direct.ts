import 'dotenv/config';
import { supabase, createUserClient } from '../server/supabase';

async function main() {
  const email = process.env.TEST_EMAIL || 'rento.test+1766571963049@example.com';
  const password = process.env.TEST_PASSWORD || 'TestPass!12345';
  const device_id = process.env.TEST_DEVICE_ID || 'dev-001';

  console.log('Step 1: sign in via Supabase Auth');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError || !authData?.user) {
    console.error('Auth failure:', authError?.message);
    process.exit(1);
  }
  const userId = authData.user.id;
  const token = authData.session!.access_token;
  console.log('AUTH USER ID:', userId);

  const userClient = createUserClient(token);

  console.log('Step 2: fetch profile (RLS)');
  const { data: profile, error: profileError } = await userClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    console.error('Profile missing or RLS-blocked');
    process.exit(1);
  }
  console.log('PROFILE:', profile);

  if (!profile.allowed) {
    console.error('Blocked: user not approved');
    process.exit(1);
  }

  console.log('Step 3: update device fields (using service role)');
  const { error: updErr } = await supabase
    .from('profiles')
    .update({ last_device_id: device_id, last_login_at: new Date().toISOString() })
    .eq('id', userId);
  if (updErr) console.warn('Non-fatal update error:', updErr.message);

  console.log('Step 4: fetch shop (optional)');
  const { data: shop } = await userClient
    .from('rental_shops')
    .select('id, name')
    .eq('owner_id', userId)
    .single();

  const result = {
    success: true,
    token,
    user: {
      id: userId,
      email: authData.user.email,
      full_name: profile.full_name,
      phone: profile.phone,
      role: profile.role,
      shop: shop || null
    }
  };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error('Test error:', e);
  process.exit(1);
});
