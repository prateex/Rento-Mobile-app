import 'dotenv/config';
import { supabase } from '../server/supabase';

async function main() {
  const ts = Date.now();
  const email = `rento.test+${ts}@example.com`;
  const password = 'TestPass!12345';
  const full_name = 'Rento Test User';
  const role = 'owner';
  const phone = `99900${(ts % 100000).toString().padStart(5, '0')}`;

  console.log('Creating test user...');
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, phone, role }
  });

  if (authError || !authData?.user) {
    console.error('Auth createUser error:', authError?.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log('Created auth user:', userId);

  // Ensure profile exists and set allowed = true, role
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ allowed: true, role, full_name, phone })
    .eq('id', userId);

  if (updateError) {
    console.error('Profile update error:', updateError.message);
    process.exit(1);
  }

  console.log('Profile updated with allowed=true');
  console.log(JSON.stringify({ email, password, userId }, null, 2));
}

main().catch((e) => {
  console.error('Script error:', e);
  process.exit(1);
});
