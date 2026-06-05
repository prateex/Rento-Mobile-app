#!/usr/bin/env node

const fs = require('fs');
const https = require('https');

// Read environment
const env = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const supabaseUrl = supabaseUrlMatch ? supabaseUrlMatch[1].trim() : null;

if (!supabaseUrl) {
  console.error('❌ Error: VITE_SUPABASE_URL not found in .env.local');
  process.exit(1);
}

// Extract project reference from URL
const projectRef = supabaseUrl.split('://')[1].split('.')[0];
console.log(`Project: ${projectRef}`);

// Get service role key from environment
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  console.log('Set it before running: $env:SUPABASE_SERVICE_ROLE_KEY = "your_key"');
  process.exit(1);
}

async function executeSql(sqlText) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sqlText });
    
    const options = {
      hostname: `${projectRef}.supabase.co`,
      port: 443,
      path: '/rest/v1/rpc/execute_sql',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  try {
    // 1. Add is_published column
    console.log('\n📝 Executing migration 1: is_published column...');
    const sql1 = `
    BEGIN;
    ALTER TABLE vehicles 
    ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false;
    UPDATE vehicles SET is_published = true WHERE is_published = false;
    COMMIT;
    `;
    await executeSql(sql1);
    console.log('✅ is_published column added');

    // 2. Create notifications table
    console.log('\n📝 Executing migration 2: notifications table...');
    const sql2 = fs.readFileSync('supabase/migrations/20260204163501_create_notifications_table.sql', 'utf-8');
    await executeSql(sql2);
    console.log('✅ notifications table created');

    console.log('\n✅ All migrations applied successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

main();
