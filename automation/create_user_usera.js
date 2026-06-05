const { createClient } = require('@supabase/supabase-js');
(async () => {
  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vamxwwgjjfqvwcceedyk.supabase.co';
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || '<CLOUD_SERVICE_ROLE>';
  const email = 'usera@test.com';
  const password = 'Password@123';
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  // delete existing by email via admin API (fetch all and delete matches)
  const { data: list } = await supabase.auth.admin.listUsers();
  const existing = (list?.users || []).find(u => u.email === email);
  if (existing) {
    await supabase.auth.admin.deleteUser(existing.id).catch(()=>{});
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {},
    app_metadata: { provider: 'email', providers: ['email'] },
  });
  if (error) {
    console.error('createUser error', error);
    process.exit(1);
  }
  console.log('AUTH_USER_ID', data.user?.id);
})();
