const { createClient } = require('@supabase/supabase-js');
(async () => {
  const supabase = createClient(
    process.env.SUPABASE_URL || 'https://vamxwwgjjfqvwcceedyk.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE || '<CLOUD_SERVICE_ROLE>'
  );
  const email = 'testlocal@rento.com';
  const password = 'Password@123';
  // Delete if exists
  // delete by email via SQL not supported in admin SDK; ignore if missing
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {},
    app_metadata: { provider: 'email', providers: ['email'] },
  });
  console.log('createUser data', data);
  console.log('createUser error', error);
})();
