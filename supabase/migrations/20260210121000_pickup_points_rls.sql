-- RLS policies for shop_pickup_points
BEGIN;

ALTER TABLE shop_pickup_points ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='shop_pickup_points'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON shop_pickup_points', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "pickup_points_select_shop" ON shop_pickup_points FOR SELECT
  USING (
    is_active = true
    AND shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "pickup_points_insert_owner" ON shop_pickup_points FOR INSERT
  WITH CHECK (
    shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    AND (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) IN ('owner', 'admin')
  );

CREATE POLICY "pickup_points_update_owner" ON shop_pickup_points FOR UPDATE
  USING (
    shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    AND (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) IN ('owner', 'admin')
  )
  WITH CHECK (
    shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    AND (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) IN ('owner', 'admin')
  );

CREATE POLICY "pickup_points_delete_owner" ON shop_pickup_points FOR DELETE
  USING (
    shop_id = (SELECT shop_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    AND (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) IN ('owner', 'admin')
  );

COMMIT;
