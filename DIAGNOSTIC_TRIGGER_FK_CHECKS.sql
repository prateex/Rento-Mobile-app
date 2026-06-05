-- STEP 2: TRIGGER CASCADE CHECK
SELECT 
  tgname,
  tgrelid::regclass,
  pg_get_triggerdef(oid) as trigger_def
FROM pg_trigger
WHERE tgrelid::regclass::text IN ('customers','bookings','vehicles')
AND tgname LIKE '%soft_delete%';

-- STEP 3: FOREIGN KEY BEHAVIOR CHECK
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column,
  rc.delete_rule
FROM information_schema.referential_constraints rc
JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
WHERE ccu.table_name = 'vehicles' OR tc.table_name = 'vehicles';

-- Check all triggers on bookings to see if they touch vehicles
SELECT 
  tgname,
  tgrelid::regclass,
  pg_get_triggerdef(oid) as trigger_def
FROM pg_trigger
WHERE tgrelid::regclass::text = 'bookings';

-- Check if there are any views that join vehicles with bookings/customers
SELECT 
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE definition ILIKE '%vehicles%' 
  AND (definition ILIKE '%bookings%' OR definition ILIKE '%customers%');
