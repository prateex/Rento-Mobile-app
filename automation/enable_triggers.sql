ALTER TABLE customers ENABLE TRIGGER trg_set_user_id_customers;
ALTER TABLE bookings ENABLE TRIGGER trg_set_user_id_bookings;
ALTER TABLE vehicles ENABLE TRIGGER trg_set_user_id_vehicles;
ALTER TABLE payments ENABLE TRIGGER trg_set_user_id_payments;
ALTER TABLE deposits ENABLE TRIGGER trg_set_user_id_deposits;
ALTER TABLE damages ENABLE TRIGGER trg_set_user_id_damages;