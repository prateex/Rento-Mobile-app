-- PER-USER ISOLATION POLICIES
CREATE POLICY "bookings_select_owner" ON bookings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "bookings_insert_owner" ON bookings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "bookings_update_owner" ON bookings FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "bookings_delete_owner" ON bookings FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "vehicles_select_owner" ON vehicles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "vehicles_insert_owner" ON vehicles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "vehicles_update_owner" ON vehicles FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "vehicles_delete_owner" ON vehicles FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "customers_select_owner" ON customers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "customers_insert_owner" ON customers FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "customers_update_owner" ON customers FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "customers_delete_owner" ON customers FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "payments_select_owner" ON payments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "payments_insert_owner" ON payments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "payments_update_owner" ON payments FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "payments_delete_owner" ON payments FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "deposits_select_owner" ON deposits FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "deposits_insert_owner" ON deposits FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "deposits_update_owner" ON deposits FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "deposits_delete_owner" ON deposits FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "damages_select_owner" ON damages FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "damages_insert_owner" ON damages FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "damages_update_owner" ON damages FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "damages_delete_owner" ON damages FOR DELETE USING (user_id = auth.uid());
