-- Fix bookings RLS: use users.shop_id from auth.uid() (not JWT custom claim)
BEGIN;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bookings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.bookings', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "bookings_select_shop" ON public.bookings FOR SELECT TO authenticated
  USING (
    shop_id = (SELECT shop_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    AND deleted_at IS NULL
  );

CREATE POLICY "bookings_insert_shop" ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (
    shop_id = (SELECT shop_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "bookings_update_shop" ON public.bookings FOR UPDATE TO authenticated
  USING (
    shop_id = (SELECT shop_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    shop_id = (SELECT shop_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "bookings_delete_shop" ON public.bookings FOR DELETE TO authenticated
  USING (
    shop_id = (SELECT shop_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );

-- Online customer bookings (marketplace)
CREATE POLICY "bookings_insert_online_customer" ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (
    is_online_booking = true
    AND customer_auth_id = auth.uid()
  );

CREATE POLICY "bookings_select_online_customer" ON public.bookings FOR SELECT TO authenticated
  USING (
    is_online_booking = true AND customer_auth_id = auth.uid()
  );

COMMIT;
