-- Verification Query: Check FK constraints on tracking columns
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name IN ('created_by', 'user_id', 'recorded_by', 'paid_by', 'reported_by', 'uploaded_by')
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
