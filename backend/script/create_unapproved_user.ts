import 'dotenv/config';
import { supabase } from '../server/supabase';

async function main() {
  const ts = Date.now();
  const email = `rento.test.denied+${ts}@example.com`;
  const password = 'TestPass!12345';

  console.log('Creating UNAPPROVED test user...');
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData?.user) {
    console.error('Auth createUser error:', authError?.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log('Created auth user:', userId);

  // Set allowed = false (unapproved)
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ allowed: false, role: 'staff' })
    .eq('id', userId);

  if (updateError) {
    console.error('Profile update error:', updateError.message);
    process.exit(1);
  }

  console.log('Profile updated with allowed=false (UNAPPROVED)');
  console.log(JSON.stringify({ email, password, userId, allowed: false }, null, 2));
}

main().catch((e) => {
  console.error('Script error:', e);
  process.exit(1);
});
