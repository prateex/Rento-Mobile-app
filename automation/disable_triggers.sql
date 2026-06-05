ALTER TABLE customers DISABLE TRIGGER trg_set_user_id_customers;
ALTER TABLE bookings DISABLE TRIGGER trg_set_user_id_bookings;
ALTER TABLE vehicles DISABLE TRIGGER trg_set_user_id_vehicles;
ALTER TABLE payments DISABLE TRIGGER trg_set_user_id_payments;
ALTER TABLE deposits DISABLE TRIGGER trg_set_user_id_deposits;
ALTER TABLE damages DISABLE TRIGGER trg_set_user_id_damages;