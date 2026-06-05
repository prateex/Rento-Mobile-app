-- Public discovery RLS policies for marketplace
BEGIN;

-- shop_pickup_points: public read of active points
CREATE POLICY "public_pickup_points_select_active" ON shop_pickup_points
  FOR SELECT TO anon
  USING (is_active = true);

-- vehicles: public read of published vehicles
CREATE POLICY "public_vehicles_select_published" ON vehicles
  FOR SELECT TO anon
  USING (is_published = true);

COMMIT;
