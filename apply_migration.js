const fs = require('fs');
const { Client } = require('pg');

async function applyMigration() {
  // SQL to execute
  const sql = fs.readFileSync('execute_migration.sql', 'utf-8');

  // Connect to remote Supabase
  const client = new Client({
    host: 'vamxwwgjjfqvwcceedyk.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: process.env.SUPABASE_DB_PASSWORD || 'your_password_here',
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✓ Connected to Supabase database');

    // Execute the migration
    await client.query(sql);
    console.log('✓ Migration executed successfully');
    console.log('✓ is_published column added to vehicles table');

    // Verify the column exists
    const result = await client.query(
      `SELECT column_name, data_type, is_nullable, column_default 
       FROM information_schema.columns 
       WHERE table_name='vehicles' AND column_name='is_published'`
    );

    if (result.rows.length > 0) {
      console.log('\n✓ Column verification:');
      console.log(result.rows[0]);
    } else {
      console.log('\n⚠ Column not found after migration');
    }
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
