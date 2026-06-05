import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = 'https://vamxwwgjjfqvwcceedyk.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhbXh3d2dqamZxdndjY2VlZHlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQ4ODYxMiwiZXhwIjoyMDgyMDY0NjEyfQ.pwCEl1--nsOqkOj4WMdgxjR2YGkwbZoDPz4RAS_Lcpo';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigrations() {
  console.log('🔄 Applying soft delete fixes...\n');

  try {
    // Read migration files
    const migration1 = readFileSync(
      join(__dirname, 'supabase', 'migrations', '20260114100000_enable_safe_deletes.sql'),
      'utf-8'
    );

    const migration2 = readFileSync(
      join(__dirname, 'supabase', 'migrations', '20260114150000_fix_delete_policies.sql'),
      'utf-8'
    );

    console.log('📄 Migration 1: Enable safe deletes (columns & triggers)');
    const { data: data1, error: error1 } = await supabase.rpc('exec_sql', { sql: migration1 });
    
    if (error1) {
      console.error('❌ Migration 1 failed:', error1.message);
      // Try direct SQL execution as fallback
      console.log('🔄 Attempting direct SQL execution...');
      const conn = await supabase.rpc('exec_raw_sql', { query: migration1 });
      if (conn.error) {
        throw new Error('Failed to execute migration 1: ' + error1.message);
      }
    } else {
      console.log('✅ Migration 1 applied successfully\n');
    }

    console.log('📄 Migration 2: Fix RLS UPDATE policies for soft delete');
    const { data: data2, error: error2 } = await supabase.rpc('exec_sql', { sql: migration2 });
    
    if (error2) {
      console.error('❌ Migration 2 failed:', error2.message);
      console.log('🔄 Attempting direct SQL execution...');
      const conn = await supabase.rpc('exec_raw_sql', { query: migration2 });
      if (conn.error) {
        throw new Error('Failed to execute migration 2: ' + error2.message);
      }
    } else {
      console.log('✅ Migration 2 applied successfully\n');
    }

    console.log('✅ All migrations applied successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Soft delete columns added (deleted_at)');
    console.log('   - RLS UPDATE policies fixed to allow soft deletes');
    console.log('   - Cascade triggers configured');
    console.log('   - SELECT policies filter deleted records');
    console.log('\n✅ Delete operations should now work correctly!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n🔧 Manual fix required:');
    console.error('   1. Open Supabase SQL Editor');
    console.error('   2. Run: supabase/migrations/20260114100000_enable_safe_deletes.sql');
    console.error('   3. Run: supabase/migrations/20260114150000_fix_delete_policies.sql');
    process.exit(1);
  }
}

applyMigrations();
