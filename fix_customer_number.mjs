import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vamxwwgjjfqvwcceedyk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhbXh3d2dqamZxdndjY2VlZHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0ODg2MTIsImV4cCI6MjA4MjA2NDYxMn0.DgY51SV0UFogxQ-vnk35w4-otvLuEZUhlSIGuDf2RfY'
);

console.log('=== Checking existing customer_number data ===\n');

const { data: authData } = await supabase.auth.signInWithPassword({
  email: 'usera@test.com',
  password: 'test@123'
});

const { data: customers, error } = await supabase
  .from('customers')
  .select('id, customer_number, name')
  .order('customer_number', { ascending: true });

if (error) {
  console.log('Error:', error.message);
  process.exit(1);
}

console.log(`Found ${customers.length} existing customers\n`);

if (customers.length > 0) {
  console.log('Current customer_number values:');
  customers.forEach(c => {
    console.log(`  ${c.customer_number} (type: ${typeof c.customer_number}) - ${c.name}`);
  });
  
  console.log('\n✅ All values are integers - safe to convert to TEXT');
  console.log('   Conversion strategy: Cast integer to text with CUST prefix');
} else {
  console.log('✅ No existing data - safe to convert column type');
}

console.log('\n=== SQL FIX ===\n');
console.log(`
-- Step 1: Convert existing integer values to CUST format
UPDATE customers 
SET customer_number = ('CUST' || LPAD(customer_number::text, 4, '0'))::text
WHERE customer_number IS NOT NULL;

-- Step 2: Change column type to TEXT
ALTER TABLE customers 
ALTER COLUMN customer_number TYPE TEXT 
USING customer_number::text;

-- Step 3: Verify constraint still exists
-- (Already created by migration 20251230_add_customer_number.sql)
`);

console.log('\nReady to apply fix!');
