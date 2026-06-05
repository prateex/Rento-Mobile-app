// Simple script to apply SQL migration via Supabase REST API
const https = require('https');
const fs = require('fs');

async function executeSQL(sql) {
  const url = 'https://vamxwwgjjfqvwcceedyk.supabase.co/rest/v1/rpc/execute_sql';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
    process.exit(1);
  }

  return new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✓ Migration executed successfully');
          resolve(data);
        } else {
          console.error(`✗ HTTP ${res.statusCode}: ${data}`);
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify({ sql_query: sql }));
    req.end();
  });
}

async function main() {
  const sql = fs.readFileSync('execute_migration.sql', 'utf-8');
  
  try {
    console.log('Executing migration on Supabase remote database...');
    await executeSQL(sql);
    console.log('✓ is_published column added to vehicles table');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

main();
