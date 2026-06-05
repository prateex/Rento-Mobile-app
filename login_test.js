const { createClient } = require('@supabase/supabase-js');
(async () => {
  const supabase = createClient(
    process.env.SUPABASE_URL || 'https://vamxwwgjjfqvwcceedyk.supabase.co',
    process.env.SUPABASE_ANON_KEY || '<CLOUD_ANON_KEY>'
  );
  const { data, error } = await supabase.auth.signInWithPassword({ email: 'testlocal@rento.com', password: 'Password@123' });
  console.log('data', data);
  console.log('error', error);
})();
