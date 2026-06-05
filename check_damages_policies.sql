SELECT policyname, action, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'damages'
ORDER BY policyname;
