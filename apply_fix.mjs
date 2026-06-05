import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  'https://vamxwwgjjfqvwcceedyk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhbXh3d2dqamZxdndjY2VlZHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0ODg2MTIsImV4cCI6MjA4MjA2NDYxMn0.DgY51SV0UFogxQ-vnk35w4-otvLuEZUhlSIGuDf2RfY'
);

console.log('=== PHASE 3: Applying Fix ===\n');

// Login
const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email: 'usera@test.com',
  password: 'test@123'
});

if (authError) {
  console.log('❌ Login failed');
  process.exit(1);
}

console.log('✓ Logged in as:', authData.user.email);

// Apply the fix using raw SQL
const fixSQL = `
-- Fix booking status constraint
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check 
  CHECK (status IN ('Booked', 'Confirmed', 'Taken', 'Returned', 'Cancelled'));
`;

console.log('\nApplying fix SQL...');
console.log(fixSQL);

const { data, error } = await supabase.rpc('exec_sql', { sql: fixSQL });

if (error) {
  console.log('\n⚠️  Direct SQL execution not available via RPC');
  console.log('Please apply the fix manually via Supabase Dashboard:');
  console.log('\n1. Go to: https://app.supabase.com/project/vamxwwgjjfqvwcceedyk/editor');
  console.log('2. Open SQL Editor');
  console.log('3. Run this SQL:\n');
  console.log(fixSQL);
  console.log('\n4. Then return here to retest');
} else {
  console.log('\n✓ Fix applied successfully!');
}
