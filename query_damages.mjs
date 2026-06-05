import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'http://127.0.0.1:54321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
);

const { data, error } = await supabase
  .from('damages')
  .select('id, vehicle_id, booking_id, description, photo_urls, reported_at, deleted_at')
  .order('reported_at', { ascending: false });

if (error) {
  console.error('ERROR:', error);
} else {
  console.log('========== RAW DB DAMAGES ==========');
  console.log(JSON.stringify(data, null, 2));
  console.log('====================================');
}

process.exit(0);
