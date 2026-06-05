-- Verify is_published column exists
SELECT column_name FROM information_schema.columns WHERE table_name='vehicles' AND column_name='is_published';

-- Verify notifications table exists
SELECT table_name FROM information_schema.tables WHERE table_name='notifications';

-- Verify notifications RLS is enabled
SELECT tablename FROM pg_tables WHERE tablename='notifications' AND schemaname='public';
