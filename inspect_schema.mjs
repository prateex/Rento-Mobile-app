import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vamxwwgjjfqvwcceedyk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhbXh3d2dqamZxdndjY2VlZHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0ODg2MTIsImV4cCI6MjA4MjA2NDYxMn0.DgY51SV0UFogxQ-vnk35w4-otvLuEZUhlSIGuDf2RfY'
);

console.log('=== Inspecting customers table schema ===\n');

// Login
const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email: 'usera@test.com',
  password: 'test@123'
});

if (authError) {
  console.log('❌ Login failed');
  process.exit(1);
}

// Query information_schema to get column types
const query = `
  SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'customers'
    AND column_name = 'customer_number'
`;

console.log('Querying schema for customer_number column...\n');

// Use RPC or direct query
const { data, error } = await supabase.rpc('exec_sql', { query });

if (error) {
  console.log('⚠️  Cannot query via RPC, checking sample data instead...\n');
  
  // Try to get existing customers to see data type
  const { data: customers, error: custError } = await supabase
    .from('customers')
    .select('customer_number')
    .limit(5);
  
  if (custError) {
    console.log('Error:', custError.message);
  } else {
    console.log('Sample customer_number values:');
    console.log(customers);
    
    if (customers.length > 0) {
      const sampleValue = customers[0].customer_number;
      console.log('\nSample value type:', typeof sampleValue);
      console.log('Sample value:', sampleValue);
      
      if (typeof sampleValue === 'number') {
        console.log('\n🔴 CONFIRMED: customer_number is INTEGER in database');
        console.log('   But frontend sends strings like "CUST0004"');
      } else {
        console.log('\n✓ customer_number is already TEXT');
      }
    } else {
      console.log('\n⚠️  No customers exist yet to check data type');
    }
  }
} else {
  console.log('Schema info:', data);
}
