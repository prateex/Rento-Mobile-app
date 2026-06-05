BEGIN;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_self
  ON public.users
  FOR SELECT
  USING (auth_id = auth.uid());

CREATE POLICY users_update_self
  ON public.users
  FOR UPDATE
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

CREATE POLICY users_insert_self
  ON public.users
  FOR INSERT
  WITH CHECK (auth_id = auth.uid());

COMMIT;
