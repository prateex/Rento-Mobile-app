


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."booking_status" AS ENUM (
    'Booked',
    'Confirmed',
    'Active',
    'Completed',
    'Cancelled',
    'Taken'
);


ALTER TYPE "public"."booking_status" OWNER TO "postgres";


CREATE TYPE "public"."customer_status" AS ENUM (
    'Verified',
    'Pending'
);


ALTER TYPE "public"."customer_status" OWNER TO "postgres";


CREATE TYPE "public"."damage_severity" AS ENUM (
    'Minor',
    'Moderate',
    'Major'
);


ALTER TYPE "public"."damage_severity" OWNER TO "postgres";


CREATE TYPE "public"."damage_type" AS ENUM (
    'Scratch',
    'Dent',
    'Broken Mirror',
    'Tyre',
    'Mechanical',
    'Other'
);


ALTER TYPE "public"."damage_type" OWNER TO "postgres";


CREATE TYPE "public"."fuel_type" AS ENUM (
    'Petrol',
    'Electric'
);


ALTER TYPE "public"."fuel_type" OWNER TO "postgres";


CREATE TYPE "public"."id_type" AS ENUM (
    'Aadhaar',
    'Voter ID',
    'Passport',
    'Driving License'
);


ALTER TYPE "public"."id_type" OWNER TO "postgres";


CREATE TYPE "public"."payment_choice" AS ENUM (
    'Booking Only',
    'Advance Paid',
    'Fully Paid'
);


ALTER TYPE "public"."payment_choice" OWNER TO "postgres";


CREATE TYPE "public"."payment_mode" AS ENUM (
    'Cash',
    'UPI',
    'Other'
);


ALTER TYPE "public"."payment_mode" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'Paid',
    'Partial',
    'Unpaid'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'staff',
    'owner'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE TYPE "public"."vehicle_status" AS ENUM (
    'Available',
    'Booked',
    'Maintenance',
    'Rented'
);


ALTER TYPE "public"."vehicle_status" OWNER TO "postgres";


CREATE TYPE "public"."vehicle_type" AS ENUM (
    'bike',
    'car'
);


ALTER TYPE "public"."vehicle_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_damage_photos"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- When damage is deleted, soft delete associated photos
  UPDATE vehicle_damage_photos
  SET 
    deleted_at = now(),
    updated_at = now()
  WHERE 
    damage_id = OLD.id 
    AND deleted_at IS NULL;
  
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."cleanup_damage_photos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_id_photos"() RETURNS TABLE("deleted_count" integer, "file_paths" "text"[])
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_file_paths TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Find expired photos
  SELECT 
    COUNT(*)::INTEGER,
    ARRAY_AGG(file_path)
  INTO v_deleted_count, v_file_paths
  FROM customer_id_photos
  WHERE 
    expires_at IS NOT NULL 
    AND expires_at < now() 
    AND deleted_at IS NULL;
  
  -- Soft delete expired photos
  UPDATE customer_id_photos
  SET 
    deleted_at = now(),
    updated_at = now()
  WHERE 
    expires_at IS NOT NULL 
    AND expires_at < now() 
    AND deleted_at IS NULL;
  
  RETURN QUERY SELECT v_deleted_count, v_file_paths;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_id_photos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_owner"("p_auth_user_id" "uuid", "p_shop_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID;
  v_existing_owner_count INTEGER;
BEGIN
  -- Validate inputs
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth user ID is required';
  END IF;
  
  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'Shop ID is required';
  END IF;

  -- Check if shop exists
  IF NOT EXISTS (SELECT 1 FROM rental_shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'Shop does not exist: %', p_shop_id;
  END IF;

  -- Check if auth user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_auth_user_id) THEN
    RAISE EXCEPTION 'Auth user does not exist: %', p_auth_user_id;
  END IF;

  -- Check if user already exists in this shop
  IF EXISTS (SELECT 1 FROM users WHERE auth_id = p_auth_user_id AND shop_id = p_shop_id) THEN
    RAISE EXCEPTION 'User already exists in this shop';
  END IF;

  -- Check if shop already has an owner
  SELECT COUNT(*) INTO v_existing_owner_count
  FROM users
  WHERE shop_id = p_shop_id AND role = 'owner';

  IF v_existing_owner_count > 0 THEN
    RAISE EXCEPTION 'Shop already has an owner. Promote an existing staff member instead.';
  END IF;

  -- Create owner user record
  INSERT INTO users (
    auth_id,
    shop_id,
    name,
    email,
    role,
    is_active
  )
  VALUES (
    p_auth_user_id,
    p_shop_id,
    COALESCE((SELECT email FROM auth.users WHERE id = p_auth_user_id), 'Unknown'),
    (SELECT email FROM auth.users WHERE id = p_auth_user_id),
    'owner',
    true
  )
  RETURNING id INTO v_user_id;

  -- Update rental_shops.owner_id to point to the actual auth user
  UPDATE rental_shops
  SET owner_id = p_auth_user_id
  WHERE id = p_shop_id;

  RETURN v_user_id;
END;
$$;


ALTER FUNCTION "public"."create_owner"("p_auth_user_id" "uuid", "p_shop_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_rental_shop"("p_owner_id" "uuid", "p_name" "text", "p_phone" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_address" "text" DEFAULT NULL::"text", "p_city" "text" DEFAULT NULL::"text", "p_state" "text" DEFAULT NULL::"text", "p_pincode" "text" DEFAULT NULL::"text", "p_gst_number" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_shop_id UUID;
BEGIN
  -- Validate required inputs
  IF p_owner_id IS NULL THEN
    RAISE EXCEPTION 'Owner ID is required';
  END IF;

  IF p_name IS NULL OR TRIM(p_name) = '' THEN
    RAISE EXCEPTION 'Shop name is required and cannot be empty';
  END IF;

  -- Check if owner (auth user) exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_owner_id) THEN
    RAISE EXCEPTION 'Owner (auth user) does not exist: %', p_owner_id;
  END IF;

  -- Create shop
  INSERT INTO rental_shops (
    owner_id,
    name,
    phone,
    email,
    address,
    city,
    state,
    pincode,
    gst_number
  )
  VALUES (
    p_owner_id,
    TRIM(p_name),
    TRIM(p_phone),
    TRIM(p_email),
    TRIM(p_address),
    TRIM(p_city),
    TRIM(p_state),
    TRIM(p_pincode),
    TRIM(p_gst_number)
  )
  RETURNING id INTO v_shop_id;

  RETURN v_shop_id;
END;
$$;


ALTER FUNCTION "public"."create_rental_shop"("p_owner_id" "uuid", "p_name" "text", "p_phone" "text", "p_email" "text", "p_address" "text", "p_city" "text", "p_state" "text", "p_pincode" "text", "p_gst_number" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_staff"("p_auth_user_id" "uuid", "p_shop_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Validate inputs
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth user ID is required';
  END IF;
  
  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'Shop ID is required';
  END IF;

  -- Check if shop exists
  IF NOT EXISTS (SELECT 1 FROM rental_shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'Shop does not exist: %', p_shop_id;
  END IF;

  -- Check if auth user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_auth_user_id) THEN
    RAISE EXCEPTION 'Auth user does not exist: %', p_auth_user_id;
  END IF;

  -- Check if user already exists in this shop (any role)
  IF EXISTS (SELECT 1 FROM users WHERE auth_id = p_auth_user_id AND shop_id = p_shop_id) THEN
    RAISE EXCEPTION 'User already exists in this shop';
  END IF;

  -- Create staff user record
  INSERT INTO users (
    auth_id,
    shop_id,
    name,
    email,
    role,
    is_active
  )
  VALUES (
    p_auth_user_id,
    p_shop_id,
    COALESCE((SELECT email FROM auth.users WHERE id = p_auth_user_id), 'Unknown'),
    (SELECT email FROM auth.users WHERE id = p_auth_user_id),
    'staff',
    true
  )
  RETURNING id INTO v_user_id;

  RETURN v_user_id;
END;
$$;


ALTER FUNCTION "public"."create_staff"("p_auth_user_id" "uuid", "p_shop_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."days_until_expiry"("p_expires_at" timestamp with time zone) RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  IF p_expires_at IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN GREATEST(0, EXTRACT(DAY FROM (p_expires_at - now()))::INTEGER);
END;
$$;


ALTER FUNCTION "public"."days_until_expiry"("p_expires_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deactivate_user"("p_auth_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_rows_affected INTEGER;
BEGIN
  -- Validate input
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth user ID is required';
  END IF;

  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE auth_id = p_auth_user_id) THEN
    RAISE EXCEPTION 'User does not exist: %', p_auth_user_id;
  END IF;

  -- Deactivate user (soft delete)
  UPDATE users
  SET is_active = false, updated_at = now()
  WHERE auth_id = p_auth_user_id;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  RETURN 'User deactivated successfully. ' || v_rows_affected || ' record(s) updated.';
END;
$$;


ALTER FUNCTION "public"."deactivate_user"("p_auth_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fy_label"("ts" timestamp with time zone) RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  start_year INT;
  next_year INT;
BEGIN
  IF EXTRACT(MONTH FROM ts) < 4 THEN
    start_year := EXTRACT(YEAR FROM ts)::INT - 1;
  ELSE
    start_year := EXTRACT(YEAR FROM ts)::INT;
  END IF;
  next_year := start_year + 1;
  
  -- Return format: 25-26 (for FY 2025-26)
  RETURN SUBSTRING(start_year::TEXT, 3, 2) || '-' || SUBSTRING(next_year::TEXT, 3, 2);
END;
$$;


ALTER FUNCTION "public"."fy_label"("ts" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_booking_number"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  next_num INT;
BEGIN
  next_num := nextval('public.booking_number_seq');
  RETURN 'BK' || LPAD(next_num::TEXT, 4, '0');
END;
$$;


ALTER FUNCTION "public"."generate_booking_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_booking_number"("p_shop_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_val INT;
BEGIN
  INSERT INTO booking_number_counters (shop_id, next_booking_number)
  VALUES (p_shop_id, 1)
  ON CONFLICT (shop_id) DO NOTHING;

  UPDATE booking_number_counters
  SET next_booking_number = next_booking_number + 1, updated_at = now()
  WHERE shop_id = p_shop_id
  RETURNING next_booking_number - 1 INTO current_val;

  RETURN 'BK' || LPAD(current_val::TEXT, 4, '0');
END;
$$;


ALTER FUNCTION "public"."generate_booking_number"("p_shop_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_customer_number"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  next_num INT;
BEGIN
  next_num := nextval('public.customer_number_seq');
  RETURN 'CUST' || LPAD(next_num::TEXT, 4, '0');
END;
$$;


ALTER FUNCTION "public"."generate_customer_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_customer_number"("p_shop_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_val INT;
BEGIN
  INSERT INTO customer_sequences (shop_id, sequence_number)
  VALUES (p_shop_id, 1)
  ON CONFLICT (shop_id) DO NOTHING;

  UPDATE customer_sequences
  SET sequence_number = sequence_number + 1, updated_at = now()
  WHERE shop_id = p_shop_id
  RETURNING sequence_number - 1 INTO current_val;

  RETURN 'CUST' || LPAD(current_val::TEXT, 4, '0');
END;
$$;


ALTER FUNCTION "public"."generate_customer_number"("p_shop_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invoice_number"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  next_num INT;
BEGIN
  next_num := nextval('public.invoice_number_seq');
  RETURN 'INV' || LPAD(next_num::TEXT, 4, '0');
END;
$$;


ALTER FUNCTION "public"."generate_invoice_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invoice_number"("p_shop_id" "uuid", "p_ts" timestamp with time zone DEFAULT "now"()) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  fy TEXT;
  current_val INT;
BEGIN
  fy := fy_label(p_ts);

  -- Ensure counter exists
  INSERT INTO invoice_number_counters (shop_id, financial_year, next_invoice_number)
  VALUES (p_shop_id, fy, 1)
  ON CONFLICT (shop_id, financial_year) DO NOTHING;

  -- Increment and get current value
  UPDATE invoice_number_counters
  SET next_invoice_number = next_invoice_number + 1, updated_at = now()
  WHERE shop_id = p_shop_id AND financial_year = fy
  RETURNING next_invoice_number - 1 INTO current_val;

  -- Return format: INV-25-26-0001
  RETURN 'INV-' || fy || '-' || LPAD(current_val::TEXT, 4, '0');
END;
$$;


ALTER FUNCTION "public"."generate_invoice_number"("p_shop_id" "uuid", "p_ts" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_user_context"() RETURNS TABLE("user_id" "uuid", "shop_id" "uuid", "role" "public"."user_role", "is_active" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    users.id,
    users.shop_id,
    users.role,
    users.is_active
  FROM users
  WHERE users.auth_id = auth.uid()
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_current_user_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_shop_id"() RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT shop_id
  FROM users
  WHERE auth_id = auth.uid()
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_my_shop_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM platform_users
  WHERE auth_id = auth.uid()
  LIMIT 1;

  IF v_role IS NULL THEN
    SELECT role INTO v_role
    FROM users
    WHERE auth_id = auth.uid()
    LIMIT 1;
  END IF;

  RETURN COALESCE(v_role, 'customer');
END;
$$;


ALTER FUNCTION "public"."get_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  RETURN get_user_role() = 'admin';
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_owner_of_shop"("p_shop_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM rental_shops
    WHERE id = p_shop_id AND owner_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."is_owner_of_shop"("p_shop_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_payment_completed"("p_payment_id" "uuid", "p_external_payment_id" "text" DEFAULT NULL::"text", "p_transaction_id" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  UPDATE marketplace_payments
  SET
    status = 'captured',
    external_payment_id = COALESCE(p_external_payment_id, external_payment_id),
    transaction_id = COALESCE(p_transaction_id, transaction_id),
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_payment_id;

  UPDATE bookings
  SET
    payment_status = 'Paid',
    status = 'Confirmed',
    updated_at = NOW()
  WHERE id = (SELECT booking_id FROM marketplace_payments WHERE id = p_payment_id);
END;
$$;


ALTER FUNCTION "public"."mark_payment_completed"("p_payment_id" "uuid", "p_external_payment_id" "text", "p_transaction_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_payment_failed"("p_payment_id" "uuid", "p_failure_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  UPDATE marketplace_payments
  SET
    status = 'failed',
    failure_reason = p_failure_reason,
    updated_at = NOW()
  WHERE id = p_payment_id;

  UPDATE bookings
  SET
    payment_status = 'Unpaid',
    status = 'Cancelled',
    updated_at = NOW()
  WHERE id = (SELECT booking_id FROM marketplace_payments WHERE id = p_payment_id);
END;
$$;


ALTER FUNCTION "public"."mark_payment_failed"("p_payment_id" "uuid", "p_failure_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."promote_staff_to_owner"("p_auth_user_id" "uuid", "p_shop_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_current_owner_auth_id UUID;
  v_user_role user_role;
BEGIN
  -- Validate inputs
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Auth user ID is required';
  END IF;
  
  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'Shop ID is required';
  END IF;

  -- Check if shop exists
  IF NOT EXISTS (SELECT 1 FROM rental_shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'Shop does not exist: %', p_shop_id;
  END IF;

  -- Check if user exists in this shop
  IF NOT EXISTS (SELECT 1 FROM users WHERE auth_id = p_auth_user_id AND shop_id = p_shop_id) THEN
    RAISE EXCEPTION 'User does not exist in this shop: %', p_auth_user_id;
  END IF;

  -- Check if user is already owner
  SELECT role INTO v_user_role
  FROM users
  WHERE auth_id = p_auth_user_id AND shop_id = p_shop_id;

  IF v_user_role = 'owner' THEN
    RETURN 'User is already the owner of this shop';
  END IF;

  -- Find current owner (if any)
  SELECT auth_id INTO v_current_owner_auth_id
  FROM users
  WHERE shop_id = p_shop_id AND role = 'owner'
  LIMIT 1;

  -- If there's a current owner, demote them to staff
  IF v_current_owner_auth_id IS NOT NULL THEN
    UPDATE users
    SET role = 'staff'
    WHERE auth_id = v_current_owner_auth_id AND shop_id = p_shop_id;
  END IF;

  -- Promote the staff member to owner
  UPDATE users
  SET role = 'owner'
  WHERE auth_id = p_auth_user_id AND shop_id = p_shop_id;

  -- Update rental_shops.owner_id to the new owner
  UPDATE rental_shops
  SET owner_id = p_auth_user_id
  WHERE id = p_shop_id;

  RETURN 'User promoted to owner successfully';
END;
$$;


ALTER FUNCTION "public"."promote_staff_to_owner"("p_auth_user_id" "uuid", "p_shop_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refund_payment"("p_payment_id" "uuid", "p_refund_amount" numeric, "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_booking_id UUID;
BEGIN
  UPDATE marketplace_payments
  SET
    status = 'refunded',
    refunded_at = NOW(),
    status_reason = p_reason,
    amount = amount - p_refund_amount,
    updated_at = NOW()
  WHERE id = p_payment_id
  RETURNING booking_id INTO v_booking_id;

  INSERT INTO marketplace_payments (
    booking_id, amount, payment_type, status,
    status_reason, created_by
  ) VALUES (
    v_booking_id, p_refund_amount, 'refund', 'captured',
    'Refund: ' || p_reason, auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."refund_payment"("p_payment_id" "uuid", "p_refund_amount" numeric, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_bookings_created_by"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  user_rec UUID;
BEGIN
  SELECT id INTO user_rec FROM users WHERE auth_id = auth.uid() LIMIT 1;
  IF user_rec IS NOT NULL THEN
    NEW.created_by := auth.uid();
    NEW.user_id := user_rec;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_bookings_created_by"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_customers_created_by"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  user_rec UUID;
BEGIN
  SELECT id INTO user_rec FROM users WHERE auth_id = auth.uid() LIMIT 1;
  IF user_rec IS NOT NULL THEN
    NEW.created_by := auth.uid();
    NEW.user_id := user_rec;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_customers_created_by"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_payments_recorded_by"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_rec UUID;
BEGIN
  SELECT id INTO user_rec FROM users WHERE auth_id = auth.uid() LIMIT 1;
  IF user_rec IS NOT NULL THEN
    NEW.recorded_by := user_rec;
    NEW.user_id := user_rec;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_payments_recorded_by"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_vehicles_created_by"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  user_rec UUID;
BEGIN
  SELECT id INTO user_rec FROM users WHERE auth_id = auth.uid() LIMIT 1;
  IF user_rec IS NOT NULL THEN
    NEW.created_by := auth.uid();
    NEW.user_id := user_rec;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_vehicles_created_by"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_prevent_delete_if_invoiced"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.invoice_number IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot delete booking with invoice number.' USING ERRCODE = '23503';
  END IF;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."trigger_prevent_delete_if_invoiced"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_set_booking_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.booking_number IS NULL OR NEW.booking_number = '' THEN
    NEW.booking_number := public.generate_booking_number(NEW.shop_id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_set_booking_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_set_customer_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.customer_number IS NULL OR NEW.customer_number = '' THEN
    NEW.customer_number := public.generate_customer_number(NEW.shop_id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_set_customer_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_set_invoice_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.invoice_number IS NOT NULL AND NEW.invoice_number IS DISTINCT FROM OLD.invoice_number THEN
      RAISE EXCEPTION 'Invoice already exists; cannot regenerate number.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.invoice_number IS NULL AND NEW.shop_id IS NOT NULL AND NEW.status = 'Completed' AND COALESCE(NEW.invoice_pending, FALSE) = FALSE THEN
    NEW.invoice_number := public.generate_invoice_number(NEW.shop_id, COALESCE(NEW.invoice_generated_at, now()));
    NEW.invoice_generated_at := COALESCE(NEW.invoice_generated_at, now());
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_set_invoice_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_soft_delete_bookings"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
BEGIN
  UPDATE public.bookings SET deleted_at = now() WHERE id = OLD.id;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."trigger_soft_delete_bookings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_soft_delete_customer_id_photos"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Convert DELETE to UPDATE deleted_at = now()
  UPDATE customer_id_photos SET deleted_at = now() WHERE id = OLD.id;
  -- Return NULL to prevent actual deletion
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."trigger_soft_delete_customer_id_photos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_soft_delete_customers"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
BEGIN
  UPDATE public.customers SET deleted_at = now() WHERE id = OLD.id;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."trigger_soft_delete_customers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_soft_delete_damages"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
BEGIN
  UPDATE public.damages SET deleted_at = now() WHERE id = OLD.id;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."trigger_soft_delete_damages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_soft_delete_documents"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Convert DELETE to UPDATE deleted_at = now()
  UPDATE documents SET deleted_at = now() WHERE id = OLD.id;
  -- Return NULL to prevent actual deletion
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."trigger_soft_delete_documents"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_soft_delete_vehicle_damage_photos"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Convert DELETE to UPDATE deleted_at = now()
  UPDATE vehicle_damage_photos SET deleted_at = now() WHERE id = OLD.id;
  -- Return NULL to prevent actual deletion
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."trigger_soft_delete_vehicle_damage_photos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_soft_delete_vehicles"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
BEGIN
  UPDATE public.vehicles SET deleted_at = now() WHERE id = OLD.id;
  RETURN NULL; -- cancel hard delete
END;
$$;


ALTER FUNCTION "public"."trigger_soft_delete_vehicles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."booking_number_counters" (
    "shop_id" "uuid" NOT NULL,
    "next_booking_number" integer DEFAULT 1 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."booking_number_counters" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."booking_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."booking_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "booking_number" "text" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "vehicle_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "start_date" timestamp with time zone NOT NULL,
    "start_datetime" timestamp with time zone,
    "end_date" timestamp with time zone NOT NULL,
    "end_datetime" timestamp with time zone,
    "rent" numeric(10,2) DEFAULT 0 NOT NULL,
    "deposit" numeric(10,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "advance_amount" numeric(10,2),
    "balance_amount" numeric(10,2),
    "status" "public"."booking_status" DEFAULT 'Booked'::"public"."booking_status" NOT NULL,
    "payment_status" "public"."payment_status" DEFAULT 'Unpaid'::"public"."payment_status" NOT NULL,
    "payment_choice" "public"."payment_choice",
    "payment_mode" "public"."payment_mode",
    "payment_type" "public"."payment_mode",
    "utr_number" "text",
    "start_image" "text",
    "end_image" "text",
    "opening_odometer" numeric(10,2),
    "closing_odometer" numeric(10,2),
    "damages_during_rental" "jsonb",
    "deposit_deduction" numeric(10,2) DEFAULT 0,
    "damage_notes" "text",
    "invoice_number" "text",
    "invoice_generated_at" timestamp with time zone,
    "invoice_generated_by" "uuid",
    "refund_amount" numeric(10,2),
    "history" "jsonb" DEFAULT '[]'::"jsonb",
    "taken_at" timestamp with time zone,
    "taken_by" "uuid",
    "returned_at" timestamp with time zone,
    "returned_by" "uuid",
    "paid_at" timestamp with time zone,
    "paid_by" "uuid",
    "cancelled_at" timestamp with time zone,
    "finalized" boolean DEFAULT false,
    "invoice_pending" boolean DEFAULT false,
    "invoice_locked" boolean DEFAULT false,
    "whatsapp_sent" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "user_id" "uuid",
    "created_by" "uuid",
    "notes" "text",
    "payment_date" timestamp with time zone,
    "invoice_id" "uuid",
    "pickup_point_id" "uuid",
    "is_online_booking" boolean DEFAULT false NOT NULL,
    "vehicle_id" "uuid",
    "owner_id" "uuid",
    "customer_auth_id" "uuid",
    "pickup_location_id" "uuid",
    "dropoff_location_id" "uuid",
    "base_rental_amount" numeric(10,2),
    "km_charge_amount" numeric(10,2),
    "tax_amount" numeric(10,2),
    "security_deposit_amount" numeric(10,2),
    "payment_gateway" "text",
    "payment_id" "text",
    "actual_pickup_at" timestamp with time zone,
    "actual_dropoff_at" timestamp with time zone,
    "final_km_reading" integer,
    "final_amount" numeric(10,2),
    CONSTRAINT "bookings_payment_gateway_check" CHECK ((("payment_gateway" IS NULL) OR ("payment_gateway" = ANY (ARRAY['razorpay'::"text", 'stripe'::"text", 'paypal'::"text", 'manual'::"text"]))))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."bookings"."notes" IS 'General notes about the booking (separate from damage_notes)';



COMMENT ON COLUMN "public"."bookings"."payment_date" IS 'Date when payment was received';



CREATE TABLE IF NOT EXISTS "public"."cities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "state_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_id_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "booking_id" "uuid",
    "photo_type" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "storage_bucket" "text" DEFAULT 'customer-id-photos'::"text",
    "file_size_bytes" integer,
    "mime_type" "text",
    "uploaded_by" "uuid",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "side" "text",
    CONSTRAINT "customer_id_photos_photo_type_check" CHECK (("photo_type" = ANY (ARRAY['front'::"text", 'back'::"text"]))),
    CONSTRAINT "customer_id_photos_side_check" CHECK (("side" = ANY (ARRAY['front'::"text", 'back'::"text"])))
);


ALTER TABLE "public"."customer_id_photos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."customer_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."customer_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_sequences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "sequence_number" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."customer_sequences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "customer_number" "text",
    "full_name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "email" "text",
    "address" "text",
    "city" "text",
    "state" "text",
    "pincode" "text",
    "id_type" "public"."id_type" NOT NULL,
    "id_photos" "text"[] DEFAULT '{}'::"text"[],
    "documents" "jsonb",
    "status" "public"."customer_status" DEFAULT 'Pending'::"public"."customer_status" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "user_id" "uuid",
    "created_by" "uuid",
    "id_photos_uploaded_at" timestamp with time zone
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."damages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "vehicle_id" "uuid" NOT NULL,
    "booking_id" "uuid",
    "user_id" "uuid",
    "type" "public"."damage_type" DEFAULT 'Other'::"public"."damage_type" NOT NULL,
    "severity" "public"."damage_severity" DEFAULT 'Minor'::"public"."damage_severity" NOT NULL,
    "description" "text",
    "photo_urls" "text"[] DEFAULT '{}'::"text"[],
    "reported_by" "uuid",
    "reported_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    CONSTRAINT "damages_severity_check" CHECK (("severity" = ANY (ARRAY['Minor'::"public"."damage_severity", 'Moderate'::"public"."damage_severity", 'Major'::"public"."damage_severity"]))),
    CONSTRAINT "damages_type_check" CHECK (("type" = ANY (ARRAY['Scratch'::"public"."damage_type", 'Dent'::"public"."damage_type", 'Broken Mirror'::"public"."damage_type", 'Tyre'::"public"."damage_type", 'Mechanical'::"public"."damage_type", 'Other'::"public"."damage_type"])))
);


ALTER TABLE "public"."damages" OWNER TO "postgres";


COMMENT ON TABLE "public"."damages" IS 'Single source of truth for vehicle damages. The vehicles.damages JSONB column is deprecated and should not be written to.';



CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "url" "text" NOT NULL,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_number_counters" (
    "shop_id" "uuid" NOT NULL,
    "financial_year" "text" NOT NULL,
    "next_invoice_number" integer DEFAULT 1 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invoice_number_counters" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."invoice_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."invoice_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_sequences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "fiscal_year" "text" NOT NULL,
    "sequence_number" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."invoice_sequences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "state" "text" NOT NULL,
    "city" "text" NOT NULL,
    "location_name" "text" NOT NULL,
    "location_address" "text",
    "latitude" numeric,
    "longitude" numeric,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "locations_latitude_check" CHECK ((("latitude" >= ('-90'::integer)::numeric) AND ("latitude" <= (90)::numeric))),
    CONSTRAINT "locations_longitude_check" CHECK ((("longitude" >= ('-180'::integer)::numeric) AND ("longitude" <= (180)::numeric)))
);


ALTER TABLE "public"."locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "city" "text" NOT NULL,
    "state" "text" NOT NULL,
    "country" "text" DEFAULT 'India'::"text" NOT NULL,
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketplace_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_payment_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_source" "text" NOT NULL,
    "webhook_payload" "jsonb" NOT NULL,
    "processed" boolean DEFAULT false NOT NULL,
    "processing_error" "text",
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    CONSTRAINT "marketplace_payment_events_event_source_check" CHECK (("event_source" = ANY (ARRAY['razorpay'::"text", 'stripe'::"text", 'paypal'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."marketplace_payment_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_payment_reconciliation" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reconciliation_date" "date" NOT NULL,
    "payment_gateway" "text" NOT NULL,
    "total_payments" integer DEFAULT 0 NOT NULL,
    "total_amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "successful_payments" integer DEFAULT 0 NOT NULL,
    "failed_payments" integer DEFAULT 0 NOT NULL,
    "pending_refunds" numeric(14,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expected_amount" numeric(14,2),
    "actual_amount" numeric(14,2),
    "variance" numeric(14,2),
    "notes" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "created_by" "uuid",
    CONSTRAINT "marketplace_payment_reconciliation_payment_gateway_check" CHECK (("payment_gateway" = ANY (ARRAY['razorpay'::"text", 'stripe'::"text", 'paypal'::"text"]))),
    CONSTRAINT "marketplace_payment_reconciliation_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text", 'mismatch'::"text"])))
);


ALTER TABLE "public"."marketplace_payment_reconciliation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'INR'::"text" NOT NULL,
    "payment_type" "text" DEFAULT 'booking'::"text" NOT NULL,
    "payment_method" "text" NOT NULL,
    "payment_gateway" "text",
    "external_payment_id" "text",
    "external_order_id" "text",
    "external_customer_id" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "status_reason" "text",
    "failure_reason" "text",
    "transaction_id" "text",
    "merchant_reference_id" "text",
    "initiated_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "refunded_at" timestamp with time zone,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_payment_amount_positive" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "chk_payment_external_id" CHECK (((("payment_gateway" IS NULL) AND ("external_payment_id" IS NULL)) OR (("payment_gateway" IS NOT NULL) AND ("external_payment_id" IS NOT NULL)))),
    CONSTRAINT "marketplace_payments_payment_gateway_check" CHECK ((("payment_gateway" IS NULL) OR ("payment_gateway" = ANY (ARRAY['razorpay'::"text", 'stripe'::"text", 'paypal'::"text", 'manual'::"text"])))),
    CONSTRAINT "marketplace_payments_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['card'::"text", 'upi'::"text", 'netbanking'::"text", 'wallet'::"text", 'manual'::"text"]))),
    CONSTRAINT "marketplace_payments_payment_type_check" CHECK (("payment_type" = ANY (ARRAY['booking'::"text", 'security_deposit'::"text", 'refund'::"text", 'damage_deduction'::"text"]))),
    CONSTRAINT "marketplace_payments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'initiated'::"text", 'authorized'::"text", 'captured'::"text", 'refunded'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."marketplace_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "payment_mode" "public"."payment_mode" NOT NULL,
    "utr_number" "text",
    "paid_by" "uuid",
    "paid_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "recorded_by" "uuid",
    "payment_date" timestamp with time zone
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pincodes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "city_id" "uuid" NOT NULL,
    "pincode" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pincodes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "phone_number" "text",
    "role" "text" DEFAULT 'customer'::"text" NOT NULL,
    "email_verified" boolean DEFAULT false NOT NULL,
    "phone_verified" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "profile_picture_url" "text",
    "address" "text",
    "city" "text",
    "onboarded_at" timestamp with time zone,
    "last_login_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_users_role_check" CHECK (("role" = ANY (ARRAY['customer'::"text", 'owner'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."platform_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rental_shops" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "city" "text",
    "state" "text",
    "pincode" "text",
    "phone" "text",
    "email" "text",
    "gst_number" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "pickup_location_name" "text" DEFAULT 'Panjim KTC Bus Stand'::"text" NOT NULL,
    "pickup_address" "text",
    "pickup_lat" numeric,
    "pickup_lng" numeric,
    "terms_and_conditions" "text",
    CONSTRAINT "rental_shops_pickup_lat_check" CHECK ((("pickup_lat" >= ('-90'::integer)::numeric) AND ("pickup_lat" <= (90)::numeric))),
    CONSTRAINT "rental_shops_pickup_lng_check" CHECK ((("pickup_lng" >= ('-180'::integer)::numeric) AND ("pickup_lng" <= (180)::numeric)))
);


ALTER TABLE "public"."rental_shops" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_pickup_points" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "address_text" "text",
    "city" "text",
    "pincode" "text",
    "latitude" numeric,
    "longitude" numeric,
    "is_default" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "shop_pickup_points_latitude_check" CHECK ((("latitude" >= ('-90'::integer)::numeric) AND ("latitude" <= (90)::numeric))),
    CONSTRAINT "shop_pickup_points_longitude_check" CHECK ((("longitude" >= ('-180'::integer)::numeric) AND ("longitude" <= (180)::numeric)))
);


ALTER TABLE "public"."shop_pickup_points" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."states" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_id" "uuid" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "role" "public"."user_role" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_customer_id_photos" WITH ("security_invoker"='true') AS
 SELECT "cip"."id",
    "cip"."shop_id",
    "cip"."customer_id",
    "cip"."booking_id",
    "cip"."photo_type",
    "cip"."file_path",
    "cip"."storage_bucket",
    "cip"."file_size_bytes",
    "cip"."mime_type",
    "cip"."uploaded_by",
    "cip"."uploaded_at",
    "cip"."expires_at",
    "cip"."deleted_at",
    "cip"."created_at",
    "cip"."updated_at",
    "cip"."side",
    "c"."full_name" AS "customer_name",
    "c"."phone" AS "customer_phone"
   FROM ("public"."customer_id_photos" "cip"
     LEFT JOIN "public"."customers" "c" ON (("cip"."customer_id" = "c"."id")))
  WHERE ("cip"."deleted_at" IS NULL);


ALTER VIEW "public"."v_customer_id_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicle_damage_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "vehicle_id" "uuid" NOT NULL,
    "damage_id" "uuid",
    "booking_id" "uuid",
    "file_path" "text" NOT NULL,
    "storage_bucket" "text" DEFAULT 'vehicle-damage-photos'::"text" NOT NULL,
    "file_size_bytes" integer,
    "mime_type" "text",
    "uploaded_by" "uuid",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vehicle_damage_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "name" "text",
    "brand" "text",
    "model" "text",
    "registration_number" "text" NOT NULL,
    "type" "public"."vehicle_type" DEFAULT 'bike'::"public"."vehicle_type" NOT NULL,
    "fuel_type" "public"."fuel_type" DEFAULT 'Petrol'::"public"."fuel_type" NOT NULL,
    "year" integer,
    "image_url" "text",
    "daily_rate" numeric(10,2) DEFAULT 0 NOT NULL,
    "status" "public"."vehicle_status" DEFAULT 'Available'::"public"."vehicle_status" NOT NULL,
    "opening_km" numeric(10,2) DEFAULT 0,
    "current_odometer" numeric(10,2) DEFAULT 0,
    "last_closing_odometer" numeric(10,2),
    "documents" "jsonb",
    "damages" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "user_id" "uuid",
    "created_by" "uuid",
    "cc" "text",
    "segment" "text",
    "gear_type" "text",
    "category" "text",
    "is_published" boolean DEFAULT false NOT NULL,
    "location_id" "uuid",
    "free_km_per_day" integer DEFAULT 100,
    "extra_km_rate" numeric(10,2),
    "security_deposit" numeric(10,2),
    "cancellation_policy_type" "text" DEFAULT 'standard'::"text",
    "transmission_type" "text",
    "has_ac" boolean DEFAULT false,
    "has_gps" boolean DEFAULT false,
    "has_helmet" boolean DEFAULT true,
    "features" "jsonb" DEFAULT '{}'::"jsonb",
    "is_listed_marketplace" boolean DEFAULT true,
    "is_available_for_online_booking" boolean DEFAULT true,
    "rating" numeric(3,2),
    "total_bookings" integer DEFAULT 0,
    "target_odometer_service" integer,
    "last_service_at" timestamp with time zone,
    "next_service_at" timestamp with time zone,
    "seating_capacity" integer,
    "vehicle_number" "text",
    "owner_id" "uuid" NOT NULL,
    "status_reason" "text",
    CONSTRAINT "chk_vehicles_extra_km_rate_positive" CHECK ((("extra_km_rate" IS NULL) OR ("extra_km_rate" > (0)::numeric))),
    CONSTRAINT "chk_vehicles_free_km_positive" CHECK (("free_km_per_day" >= 0)),
    CONSTRAINT "chk_vehicles_rating_range" CHECK ((("rating" IS NULL) OR (("rating" >= 1.0) AND ("rating" <= 5.0)))),
    CONSTRAINT "chk_vehicles_seating_capacity" CHECK ((("seating_capacity" IS NULL) OR (("seating_capacity" > 0) AND ("seating_capacity" <= 10)))),
    CONSTRAINT "chk_vehicles_security_deposit_positive" CHECK ((("security_deposit" IS NULL) OR ("security_deposit" > (0)::numeric))),
    CONSTRAINT "vehicles_cancellation_policy_type_check" CHECK (("cancellation_policy_type" = ANY (ARRAY['strict'::"text", 'moderate'::"text", 'standard'::"text", 'flexible'::"text"]))),
    CONSTRAINT "vehicles_transmission_type_check" CHECK ((("transmission_type" IS NULL) OR ("transmission_type" = ANY (ARRAY['Manual'::"text", 'Automatic'::"text"]))))
);


ALTER TABLE "public"."vehicles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."vehicles"."damages" IS 'DEPRECATED: Do not write to this column. Read damages from the damages table instead. This column may be removed in a future migration.';



CREATE OR REPLACE VIEW "public"."v_vehicle_damage_photos" WITH ("security_invoker"='true') AS
 SELECT "vdp"."id",
    "vdp"."shop_id",
    "vdp"."vehicle_id",
    "vdp"."damage_id",
    "vdp"."booking_id",
    "vdp"."file_path",
    "vdp"."storage_bucket",
    "vdp"."file_size_bytes",
    "vdp"."mime_type",
    "vdp"."uploaded_by",
    "vdp"."uploaded_at",
    "vdp"."deleted_at",
    "vdp"."created_at",
    "vdp"."updated_at",
    "v"."name" AS "vehicle_name",
    "v"."registration_number" AS "vehicle_reg",
    "d"."type" AS "damage_type",
    "d"."severity" AS "damage_severity",
    "b"."booking_number"
   FROM ((("public"."vehicle_damage_photos" "vdp"
     LEFT JOIN "public"."vehicles" "v" ON (("vdp"."vehicle_id" = "v"."id")))
     LEFT JOIN "public"."damages" "d" ON (("vdp"."damage_id" = "d"."id")))
     LEFT JOIN "public"."bookings" "b" ON (("vdp"."booking_id" = "b"."id")))
  WHERE ("vdp"."deleted_at" IS NULL);


ALTER VIEW "public"."v_vehicle_damage_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicle_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vehicle_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "alt_text" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "uploaded_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vehicle_images" OWNER TO "postgres";


ALTER TABLE ONLY "public"."booking_number_counters"
    ADD CONSTRAINT "booking_number_counters_pkey" PRIMARY KEY ("shop_id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_state_id_name_key" UNIQUE ("state_id", "name");



ALTER TABLE ONLY "public"."customer_id_photos"
    ADD CONSTRAINT "customer_id_photos_customer_id_photo_type_deleted_at_key" UNIQUE ("customer_id", "photo_type", "deleted_at");



ALTER TABLE ONLY "public"."customer_id_photos"
    ADD CONSTRAINT "customer_id_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_sequences"
    ADD CONSTRAINT "customer_sequences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_sequences"
    ADD CONSTRAINT "customer_sequences_shop_id_key" UNIQUE ("shop_id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_shop_id_phone_unique" UNIQUE ("shop_id", "phone");



ALTER TABLE ONLY "public"."damages"
    ADD CONSTRAINT "damages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_number_counters"
    ADD CONSTRAINT "invoice_number_counters_shop_id_financial_year_key" UNIQUE ("shop_id", "financial_year");



ALTER TABLE ONLY "public"."invoice_sequences"
    ADD CONSTRAINT "invoice_sequences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_sequences"
    ADD CONSTRAINT "invoice_sequences_shop_id_fiscal_year_key" UNIQUE ("shop_id", "fiscal_year");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_state_city_location_name_key" UNIQUE ("state", "city", "location_name");



ALTER TABLE ONLY "public"."marketplace_locations"
    ADD CONSTRAINT "marketplace_locations_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."marketplace_locations"
    ADD CONSTRAINT "marketplace_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_payment_events"
    ADD CONSTRAINT "marketplace_payment_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_payment_reconciliation"
    ADD CONSTRAINT "marketplace_payment_reconciliation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_payments"
    ADD CONSTRAINT "marketplace_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_payments"
    ADD CONSTRAINT "marketplace_payments_transaction_id_key" UNIQUE ("transaction_id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pincodes"
    ADD CONSTRAINT "pincodes_city_id_pincode_key" UNIQUE ("city_id", "pincode");



ALTER TABLE ONLY "public"."pincodes"
    ADD CONSTRAINT "pincodes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_users"
    ADD CONSTRAINT "platform_users_auth_id_key" UNIQUE ("auth_id");



ALTER TABLE ONLY "public"."platform_users"
    ADD CONSTRAINT "platform_users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."platform_users"
    ADD CONSTRAINT "platform_users_phone_number_key" UNIQUE ("phone_number");



ALTER TABLE ONLY "public"."platform_users"
    ADD CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rental_shops"
    ADD CONSTRAINT "rental_shops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_pickup_points"
    ADD CONSTRAINT "shop_pickup_points_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."states"
    ADD CONSTRAINT "states_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."states"
    ADD CONSTRAINT "states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_id_key" UNIQUE ("auth_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicle_damage_photos"
    ADD CONSTRAINT "vehicle_damage_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicle_images"
    ADD CONSTRAINT "vehicle_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_vehicle_number_key" UNIQUE ("vehicle_number");



CREATE UNIQUE INDEX "bookings_invoice_guard_unique" ON "public"."bookings" USING "btree" ("id") WHERE ("invoice_number" IS NOT NULL);



CREATE UNIQUE INDEX "bookings_shop_booking_number_unique" ON "public"."bookings" USING "btree" ("shop_id", "booking_number");



CREATE UNIQUE INDEX "bookings_shop_invoice_number_unique" ON "public"."bookings" USING "btree" ("shop_id", "invoice_number") WHERE ("invoice_number" IS NOT NULL);



CREATE INDEX "idx_bookings_booking_number" ON "public"."bookings" USING "btree" ("booking_number");



CREATE INDEX "idx_bookings_created_by" ON "public"."bookings" USING "btree" ("created_by");



CREATE INDEX "idx_bookings_customer_auth_id" ON "public"."bookings" USING "btree" ("customer_auth_id");



CREATE INDEX "idx_bookings_customer_id" ON "public"."bookings" USING "btree" ("customer_id");



CREATE INDEX "idx_bookings_deleted_at" ON "public"."bookings" USING "btree" ("deleted_at");



CREATE INDEX "idx_bookings_dropoff_location" ON "public"."bookings" USING "btree" ("dropoff_location_id");



CREATE INDEX "idx_bookings_end_date" ON "public"."bookings" USING "btree" ("end_date");



CREATE INDEX "idx_bookings_invoice_number" ON "public"."bookings" USING "btree" ("invoice_number");



CREATE INDEX "idx_bookings_is_online_booking" ON "public"."bookings" USING "btree" ("is_online_booking");



CREATE INDEX "idx_bookings_location_dates" ON "public"."bookings" USING "btree" ("pickup_location_id", "start_date", "end_date") WHERE (("is_online_booking" = true) AND ("status" = ANY (ARRAY['Confirmed'::"public"."booking_status", 'Taken'::"public"."booking_status"])));



CREATE INDEX "idx_bookings_owner_id" ON "public"."bookings" USING "btree" ("owner_id");



CREATE INDEX "idx_bookings_owner_status" ON "public"."bookings" USING "btree" ("owner_id", "status");



CREATE INDEX "idx_bookings_payment_id" ON "public"."bookings" USING "btree" ("payment_id");



CREATE INDEX "idx_bookings_pickup_location" ON "public"."bookings" USING "btree" ("pickup_location_id");



CREATE INDEX "idx_bookings_pickup_point_id" ON "public"."bookings" USING "btree" ("pickup_point_id");



CREATE INDEX "idx_bookings_shop_id" ON "public"."bookings" USING "btree" ("shop_id");



CREATE INDEX "idx_bookings_start_date" ON "public"."bookings" USING "btree" ("start_date");



CREATE INDEX "idx_bookings_status" ON "public"."bookings" USING "btree" ("status");



CREATE INDEX "idx_bookings_user_id" ON "public"."bookings" USING "btree" ("user_id");



CREATE INDEX "idx_bookings_vehicle_dates" ON "public"."bookings" USING "btree" ("vehicle_id", "start_date", "end_date") WHERE (("is_online_booking" = true) AND ("status" <> 'Cancelled'::"public"."booking_status"));



CREATE INDEX "idx_cities_state_id" ON "public"."cities" USING "btree" ("state_id");



CREATE INDEX "idx_customer_id_photos_active" ON "public"."customer_id_photos" USING "btree" ("customer_id", "deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_customer_id_photos_booking_id" ON "public"."customer_id_photos" USING "btree" ("booking_id");



CREATE INDEX "idx_customer_id_photos_customer_id" ON "public"."customer_id_photos" USING "btree" ("customer_id");



CREATE INDEX "idx_customer_id_photos_deleted_at" ON "public"."customer_id_photos" USING "btree" ("deleted_at");



CREATE INDEX "idx_customer_id_photos_expires_at" ON "public"."customer_id_photos" USING "btree" ("expires_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_customer_id_photos_shop_id" ON "public"."customer_id_photos" USING "btree" ("shop_id");



CREATE INDEX "idx_customer_sequences_shop_id" ON "public"."customer_sequences" USING "btree" ("shop_id");



CREATE INDEX "idx_customers_created_by" ON "public"."customers" USING "btree" ("created_by");



CREATE INDEX "idx_customers_customer_number" ON "public"."customers" USING "btree" ("customer_number");



CREATE INDEX "idx_customers_deleted_at" ON "public"."customers" USING "btree" ("deleted_at");



CREATE INDEX "idx_customers_phone" ON "public"."customers" USING "btree" ("phone");



CREATE INDEX "idx_customers_shop_id" ON "public"."customers" USING "btree" ("shop_id");



CREATE INDEX "idx_customers_status" ON "public"."customers" USING "btree" ("status");



CREATE INDEX "idx_customers_user_id" ON "public"."customers" USING "btree" ("user_id");



CREATE INDEX "idx_damages_booking_id" ON "public"."damages" USING "btree" ("booking_id");



CREATE INDEX "idx_damages_deleted_at" ON "public"."damages" USING "btree" ("deleted_at");



CREATE INDEX "idx_damages_shop_id" ON "public"."damages" USING "btree" ("shop_id");



CREATE INDEX "idx_damages_vehicle_id" ON "public"."damages" USING "btree" ("vehicle_id");



CREATE INDEX "idx_documents_entity" ON "public"."documents" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_documents_shop_id" ON "public"."documents" USING "btree" ("shop_id");



CREATE INDEX "idx_invoice_sequences_shop_id" ON "public"."invoice_sequences" USING "btree" ("shop_id");



CREATE INDEX "idx_locations_active" ON "public"."locations" USING "btree" ("is_active");



CREATE INDEX "idx_locations_state_city" ON "public"."locations" USING "btree" ("state", "city");



CREATE INDEX "idx_marketplace_locations_city" ON "public"."marketplace_locations" USING "btree" ("city");



CREATE INDEX "idx_marketplace_locations_is_active" ON "public"."marketplace_locations" USING "btree" ("is_active");



CREATE INDEX "idx_marketplace_payments_booking_id" ON "public"."marketplace_payments" USING "btree" ("booking_id");



CREATE INDEX "idx_marketplace_payments_created_at" ON "public"."marketplace_payments" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_marketplace_payments_external_id" ON "public"."marketplace_payments" USING "btree" ("external_payment_id");



CREATE INDEX "idx_marketplace_payments_gateway_status" ON "public"."marketplace_payments" USING "btree" ("payment_gateway", "status");



CREATE INDEX "idx_marketplace_payments_order_id" ON "public"."marketplace_payments" USING "btree" ("external_order_id");



CREATE INDEX "idx_marketplace_payments_status" ON "public"."marketplace_payments" USING "btree" ("status");



CREATE INDEX "idx_marketplace_payments_transaction_id" ON "public"."marketplace_payments" USING "btree" ("transaction_id");



CREATE INDEX "idx_notifications_is_read" ON "public"."notifications" USING "btree" ("is_read");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_payment_events_payment_id" ON "public"."marketplace_payment_events" USING "btree" ("payment_id");



CREATE INDEX "idx_payment_events_processed" ON "public"."marketplace_payment_events" USING "btree" ("processed");



CREATE INDEX "idx_payment_events_received_at" ON "public"."marketplace_payment_events" USING "btree" ("received_at" DESC);



CREATE INDEX "idx_payment_reconciliation_date_gateway" ON "public"."marketplace_payment_reconciliation" USING "btree" ("reconciliation_date", "payment_gateway");



CREATE INDEX "idx_payment_reconciliation_status" ON "public"."marketplace_payment_reconciliation" USING "btree" ("status");



CREATE INDEX "idx_payments_booking_id" ON "public"."payments" USING "btree" ("booking_id");



CREATE INDEX "idx_payments_paid_by" ON "public"."payments" USING "btree" ("paid_by");



CREATE INDEX "idx_payments_recorded_by" ON "public"."payments" USING "btree" ("recorded_by");



CREATE INDEX "idx_payments_shop_id" ON "public"."payments" USING "btree" ("shop_id");



CREATE INDEX "idx_payments_user_id" ON "public"."payments" USING "btree" ("user_id");



CREATE INDEX "idx_pincodes_city_id" ON "public"."pincodes" USING "btree" ("city_id");



CREATE INDEX "idx_platform_users_auth_id" ON "public"."platform_users" USING "btree" ("auth_id");



CREATE INDEX "idx_platform_users_email" ON "public"."platform_users" USING "btree" ("email");



CREATE INDEX "idx_platform_users_is_active" ON "public"."platform_users" USING "btree" ("is_active");



CREATE INDEX "idx_platform_users_phone_number" ON "public"."platform_users" USING "btree" ("phone_number");



CREATE INDEX "idx_platform_users_role" ON "public"."platform_users" USING "btree" ("role");



CREATE INDEX "idx_platform_users_role_active" ON "public"."platform_users" USING "btree" ("role", "is_active");



CREATE INDEX "idx_rental_shops_owner_id" ON "public"."rental_shops" USING "btree" ("owner_id");



CREATE INDEX "idx_rental_shops_state_city" ON "public"."rental_shops" USING "btree" ("state", "city");



CREATE INDEX "idx_shop_pickup_points_active" ON "public"."shop_pickup_points" USING "btree" ("is_active");



CREATE UNIQUE INDEX "idx_shop_pickup_points_default" ON "public"."shop_pickup_points" USING "btree" ("shop_id") WHERE ("is_default" = true);



CREATE INDEX "idx_shop_pickup_points_shop_id" ON "public"."shop_pickup_points" USING "btree" ("shop_id");



CREATE INDEX "idx_states_name" ON "public"."states" USING "btree" ("name");



CREATE UNIQUE INDEX "idx_unique_owner_per_shop" ON "public"."users" USING "btree" ("shop_id", "role") WHERE ("role" = 'owner'::"public"."user_role");



CREATE INDEX "idx_users_auth_id" ON "public"."users" USING "btree" ("auth_id");



CREATE INDEX "idx_users_role" ON "public"."users" USING "btree" ("role");



CREATE INDEX "idx_users_shop_id" ON "public"."users" USING "btree" ("shop_id");



CREATE INDEX "idx_vehicle_damage_photos_active" ON "public"."vehicle_damage_photos" USING "btree" ("vehicle_id", "deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_vehicle_damage_photos_damage_id" ON "public"."vehicle_damage_photos" USING "btree" ("damage_id");



CREATE INDEX "idx_vehicle_damage_photos_shop_id" ON "public"."vehicle_damage_photos" USING "btree" ("shop_id");



CREATE INDEX "idx_vehicle_damage_photos_vehicle_id" ON "public"."vehicle_damage_photos" USING "btree" ("vehicle_id");



CREATE UNIQUE INDEX "idx_vehicle_images_order_per_vehicle" ON "public"."vehicle_images" USING "btree" ("vehicle_id", "display_order");



CREATE UNIQUE INDEX "idx_vehicle_images_primary_per_vehicle" ON "public"."vehicle_images" USING "btree" ("vehicle_id") WHERE ("is_primary" = true);



CREATE INDEX "idx_vehicle_images_vehicle_id" ON "public"."vehicle_images" USING "btree" ("vehicle_id");



CREATE INDEX "idx_vehicle_images_vehicle_primary" ON "public"."vehicle_images" USING "btree" ("vehicle_id", "is_primary");



CREATE INDEX "idx_vehicles_created_by" ON "public"."vehicles" USING "btree" ("created_by");



CREATE INDEX "idx_vehicles_daily_rate" ON "public"."vehicles" USING "btree" ("daily_rate") WHERE (("is_listed_marketplace" = true) AND ("status" = 'Available'::"public"."vehicle_status"));



CREATE INDEX "idx_vehicles_deleted_at" ON "public"."vehicles" USING "btree" ("deleted_at");



CREATE INDEX "idx_vehicles_fuel_transmission" ON "public"."vehicles" USING "btree" ("fuel_type", "transmission_type") WHERE ("is_listed_marketplace" = true);



CREATE INDEX "idx_vehicles_listed_marketplace" ON "public"."vehicles" USING "btree" ("is_listed_marketplace");



CREATE INDEX "idx_vehicles_location_id" ON "public"."vehicles" USING "btree" ("location_id");



CREATE INDEX "idx_vehicles_marketplace_active" ON "public"."vehicles" USING "btree" ("is_listed_marketplace", "is_available_for_online_booking", "location_id") WHERE ("status" = 'Available'::"public"."vehicle_status");



CREATE INDEX "idx_vehicles_online_booking" ON "public"."vehicles" USING "btree" ("is_available_for_online_booking");



CREATE INDEX "idx_vehicles_owner_id" ON "public"."vehicles" USING "btree" ("owner_id");



CREATE INDEX "idx_vehicles_rating" ON "public"."vehicles" USING "btree" ("rating" DESC) WHERE (("is_listed_marketplace" = true) AND ("status" = 'Available'::"public"."vehicle_status"));



CREATE INDEX "idx_vehicles_registration_number" ON "public"."vehicles" USING "btree" ("registration_number");



CREATE INDEX "idx_vehicles_shop_id" ON "public"."vehicles" USING "btree" ("shop_id");



CREATE INDEX "idx_vehicles_status" ON "public"."vehicles" USING "btree" ("status");



CREATE INDEX "idx_vehicles_type_location" ON "public"."vehicles" USING "btree" ("type", "location_id") WHERE (("is_listed_marketplace" = true) AND ("status" = 'Available'::"public"."vehicle_status"));



CREATE INDEX "idx_vehicles_user_id" ON "public"."vehicles" USING "btree" ("user_id");



CREATE UNIQUE INDEX "uq_bookings_shop_booking_number" ON "public"."bookings" USING "btree" ("shop_id", "booking_number");



CREATE UNIQUE INDEX "uq_bookings_shop_invoice_number" ON "public"."bookings" USING "btree" ("shop_id", "invoice_number") WHERE ("invoice_number" IS NOT NULL);



CREATE UNIQUE INDEX "uq_customer_id_photos_customer_side" ON "public"."customer_id_photos" USING "btree" ("customer_id", "side") WHERE ("deleted_at" IS NULL);



CREATE UNIQUE INDEX "uq_customers_shop_customer_number" ON "public"."customers" USING "btree" ("shop_id", "customer_number") WHERE ("customer_number" IS NOT NULL);



CREATE UNIQUE INDEX "uq_customers_shop_phone_active" ON "public"."customers" USING "btree" ("shop_id", "phone") WHERE ("deleted_at" IS NULL);



CREATE OR REPLACE TRIGGER "bookings_prevent_delete_if_invoiced" BEFORE DELETE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_prevent_delete_if_invoiced"();



CREATE OR REPLACE TRIGGER "bookings_set_booking_number" BEFORE INSERT ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_booking_number"();



CREATE OR REPLACE TRIGGER "bookings_set_invoice_number" BEFORE INSERT OR UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_invoice_number"();



CREATE OR REPLACE TRIGGER "customers_set_customer_number" BEFORE INSERT ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_customer_number"();



CREATE OR REPLACE TRIGGER "trigger_bookings_set_created_by" BEFORE INSERT ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."set_bookings_created_by"();



CREATE OR REPLACE TRIGGER "trigger_bookings_updated_at" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_cleanup_damage_photos" BEFORE DELETE ON "public"."damages" FOR EACH ROW EXECUTE FUNCTION "public"."cleanup_damage_photos"();



CREATE OR REPLACE TRIGGER "trigger_customer_id_photos_updated_at" BEFORE UPDATE ON "public"."customer_id_photos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_customer_sequences_updated_at" BEFORE UPDATE ON "public"."customer_sequences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_customers_set_created_by" BEFORE INSERT ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."set_customers_created_by"();



CREATE OR REPLACE TRIGGER "trigger_customers_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_damages_updated_at" BEFORE UPDATE ON "public"."damages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_documents_updated_at" BEFORE UPDATE ON "public"."documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_invoice_sequences_updated_at" BEFORE UPDATE ON "public"."invoice_sequences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_payments_set_recorded_by" BEFORE INSERT ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_payments_recorded_by"();



CREATE OR REPLACE TRIGGER "trigger_payments_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_rental_shops_updated_at" BEFORE UPDATE ON "public"."rental_shops" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_soft_delete_bookings" BEFORE DELETE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_soft_delete_bookings"();



CREATE OR REPLACE TRIGGER "trigger_soft_delete_customer_id_photos" BEFORE DELETE ON "public"."customer_id_photos" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_soft_delete_customer_id_photos"();



CREATE OR REPLACE TRIGGER "trigger_soft_delete_customers" BEFORE DELETE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_soft_delete_customers"();



CREATE OR REPLACE TRIGGER "trigger_soft_delete_damages" BEFORE DELETE ON "public"."damages" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_soft_delete_damages"();



CREATE OR REPLACE TRIGGER "trigger_soft_delete_documents" BEFORE DELETE ON "public"."documents" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_soft_delete_documents"();



CREATE OR REPLACE TRIGGER "trigger_soft_delete_vehicle_damage_photos" BEFORE DELETE ON "public"."vehicle_damage_photos" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_soft_delete_vehicle_damage_photos"();



CREATE OR REPLACE TRIGGER "trigger_soft_delete_vehicles" BEFORE DELETE ON "public"."vehicles" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_soft_delete_vehicles"();



CREATE OR REPLACE TRIGGER "trigger_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_vehicle_damage_photos_updated_at" BEFORE UPDATE ON "public"."vehicle_damage_photos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_vehicles_set_created_by" BEFORE INSERT ON "public"."vehicles" FOR EACH ROW EXECUTE FUNCTION "public"."set_vehicles_created_by"();



CREATE OR REPLACE TRIGGER "trigger_vehicles_updated_at" BEFORE UPDATE ON "public"."vehicles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_marketplace_locations_updated_at" BEFORE UPDATE ON "public"."marketplace_locations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_marketplace_payments_updated_at" BEFORE UPDATE ON "public"."marketplace_payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_platform_users_updated_at" BEFORE UPDATE ON "public"."platform_users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."booking_number_counters"
    ADD CONSTRAINT "booking_number_counters_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."rental_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_customer_auth_id_fkey" FOREIGN KEY ("customer_auth_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_dropoff_location_id_fkey" FOREIGN KEY ("dropoff_location_id") REFERENCES "public"."marketplace_locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."rental_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pickup_location_id_fkey" FOREIGN KEY ("pickup_location_id") REFERENCES "public"."marketplace_locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pickup_point_id_fkey" FOREIGN KEY ("pickup_point_id") REFERENCES "public"."shop_pickup_points"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."rental_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "public"."states"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_id_photos"
    ADD CONSTRAINT "customer_id_photos_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_id_photos"
    ADD CONSTRAINT "customer_id_photos_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."customer_id_photos"
    ADD CONSTRAINT "customer_id_photos_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."rental_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_sequences"
    ADD CONSTRAINT "customer_sequences_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."rental_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."rental_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."damages"
    ADD CONSTRAINT "damages_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."damages"
    ADD CONSTRAINT "damages_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."rental_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."damages"
    ADD CONSTRAINT "damages_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."rental_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_number_counters"
    ADD CONSTRAINT "invoice_number_counters_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."rental_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_sequences"
    ADD CONSTRAINT "invoice_sequences_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."rental_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_payment_events"
    ADD CONSTRAINT "marketplace_payment_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."marketplace_payments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_payment_reconciliation"
    ADD CONSTRAINT "marketplace_payment_reconciliation_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketplace_payments"
    ADD CONSTRAINT "marketplace_payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_payments"
    ADD CONSTRAINT "marketplace_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."rental_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pincodes"
    ADD CONSTRAINT "pincodes_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_users"
    ADD CONSTRAINT "platform_users_auth_id_fkey" FOREIGN KEY ("auth_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rental_shops"
    ADD CONSTRAINT "rental_shops_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_pickup_points"
    ADD CONSTRAINT "shop_pickup_points_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."rental_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_id_fkey" FOREIGN KEY ("auth_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."rental_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicle_damage_photos"
    ADD CONSTRAINT "vehicle_damage_photos_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vehicle_damage_photos"
    ADD CONSTRAINT "vehicle_damage_photos_damage_id_fkey" FOREIGN KEY ("damage_id") REFERENCES "public"."damages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicle_damage_photos"
    ADD CONSTRAINT "vehicle_damage_photos_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."rental_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicle_damage_photos"
    ADD CONSTRAINT "vehicle_damage_photos_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."vehicle_images"
    ADD CONSTRAINT "vehicle_images_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vehicle_images"
    ADD CONSTRAINT "vehicle_images_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."marketplace_locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."rental_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."rental_shops"("id") ON DELETE CASCADE;



CREATE POLICY "Customers can create online bookings" ON "public"."bookings" FOR INSERT WITH CHECK ((("is_online_booking" = true) AND ("customer_auth_id" = "auth"."uid"()) AND ("public"."get_user_role"() = 'customer'::"text")));



CREATE POLICY "Customers can update own bookings" ON "public"."bookings" FOR UPDATE USING (((("is_online_booking" = true) AND ("customer_auth_id" = "auth"."uid"())) OR ("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))) OR "public"."is_admin"())) WITH CHECK (((("is_online_booking" = true) AND ("customer_auth_id" = "auth"."uid"())) OR ("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))) OR "public"."is_admin"()));



CREATE POLICY "Customers view own bookings" ON "public"."bookings" FOR SELECT USING (((("is_online_booking" = true) AND ("customer_auth_id" = "auth"."uid"())) OR (("is_online_booking" = false) AND ("customer_id" IN ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."user_id" = "auth"."uid"())))) OR ("owner_id" IN ( SELECT "rental_shops"."id"
   FROM "public"."rental_shops"
  WHERE ("rental_shops"."owner_id" = "auth"."uid"()))) OR ("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))) OR "public"."is_admin"()));



CREATE POLICY "Customers view own payments" ON "public"."marketplace_payments" FOR SELECT USING (((( SELECT "bookings"."customer_auth_id"
   FROM "public"."bookings"
  WHERE ("bookings"."id" = "marketplace_payments"."booking_id")) = "auth"."uid"()) OR (( SELECT "bookings"."owner_id"
   FROM "public"."bookings"
  WHERE ("bookings"."id" = "marketplace_payments"."booking_id")) IN ( SELECT "rental_shops"."id"
   FROM "public"."rental_shops"
  WHERE ("rental_shops"."owner_id" = "auth"."uid"()))) OR "public"."is_admin"()));



CREATE POLICY "Only system can create users" ON "public"."platform_users" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Only system can modify payments" ON "public"."marketplace_payments" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Owners can delete own images" ON "public"."vehicle_images" FOR DELETE USING ((( SELECT "vehicles"."owner_id"
   FROM "public"."vehicles"
  WHERE ("vehicles"."id" = "vehicle_images"."vehicle_id")) IN ( SELECT "rental_shops"."id"
   FROM "public"."rental_shops"
  WHERE ("rental_shops"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Owners can insert vehicles" ON "public"."vehicles" FOR INSERT WITH CHECK (("owner_id" IN ( SELECT "rental_shops"."id"
   FROM "public"."rental_shops"
  WHERE ("rental_shops"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Owners can manage vehicle images" ON "public"."vehicle_images" FOR INSERT WITH CHECK ((( SELECT "vehicles"."owner_id"
   FROM "public"."vehicles"
  WHERE ("vehicles"."id" = "vehicle_images"."vehicle_id")) IN ( SELECT "rental_shops"."id"
   FROM "public"."rental_shops"
  WHERE ("rental_shops"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Owners can update own vehicles" ON "public"."vehicles" FOR UPDATE USING ((("owner_id" IN ( SELECT "rental_shops"."id"
   FROM "public"."rental_shops"
  WHERE ("rental_shops"."owner_id" = "auth"."uid"()))) OR "public"."is_admin"())) WITH CHECK ((("owner_id" IN ( SELECT "rental_shops"."id"
   FROM "public"."rental_shops"
  WHERE ("rental_shops"."owner_id" = "auth"."uid"()))) OR "public"."is_admin"()));



CREATE POLICY "Staff can insert payments in their shop" ON "public"."payments" FOR INSERT WITH CHECK (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "Staff can manage customers" ON "public"."customers" FOR UPDATE USING ((("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))) OR "public"."is_admin"())) WITH CHECK ((("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))) OR "public"."is_admin"()));



CREATE POLICY "Staff can update customer sequences in their shop" ON "public"."customer_sequences" FOR UPDATE USING (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())))) WITH CHECK (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "Staff can update invoice sequences in their shop" ON "public"."invoice_sequences" FOR UPDATE USING (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())))) WITH CHECK (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "Staff can update payments in their shop" ON "public"."payments" FOR UPDATE USING (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())))) WITH CHECK (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "Staff can view customer sequences in their shop" ON "public"."customer_sequences" FOR SELECT USING (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "Staff can view invoice sequences in their shop" ON "public"."invoice_sequences" FOR SELECT USING (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "Staff can view payments in their shop" ON "public"."payments" FOR SELECT USING (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "Staff delete payments" ON "public"."payments" FOR DELETE USING (("shop_id" = "public"."get_my_shop_id"()));



CREATE POLICY "Staff insert booking counters" ON "public"."booking_number_counters" FOR INSERT WITH CHECK (("shop_id" = "public"."get_my_shop_id"()));



CREATE POLICY "Staff insert customer sequences" ON "public"."customer_sequences" FOR INSERT WITH CHECK (("shop_id" = "public"."get_my_shop_id"()));



CREATE POLICY "Staff insert invoice counters" ON "public"."invoice_number_counters" FOR INSERT WITH CHECK (("shop_id" = "public"."get_my_shop_id"()));



CREATE POLICY "Staff insert invoice sequences" ON "public"."invoice_sequences" FOR INSERT WITH CHECK (("shop_id" = "public"."get_my_shop_id"()));



CREATE POLICY "Staff insert payments" ON "public"."payments" FOR INSERT WITH CHECK (("shop_id" = "public"."get_my_shop_id"()));



CREATE POLICY "Staff update booking counters" ON "public"."booking_number_counters" FOR UPDATE USING (("shop_id" = "public"."get_my_shop_id"())) WITH CHECK (("shop_id" = "public"."get_my_shop_id"()));



CREATE POLICY "Staff update customer sequences" ON "public"."customer_sequences" FOR UPDATE USING (("shop_id" = "public"."get_my_shop_id"())) WITH CHECK (("shop_id" = "public"."get_my_shop_id"()));



CREATE POLICY "Staff update invoice counters" ON "public"."invoice_number_counters" FOR UPDATE USING (("shop_id" = "public"."get_my_shop_id"())) WITH CHECK (("shop_id" = "public"."get_my_shop_id"()));



CREATE POLICY "Staff update invoice sequences" ON "public"."invoice_sequences" FOR UPDATE USING (("shop_id" = "public"."get_my_shop_id"())) WITH CHECK (("shop_id" = "public"."get_my_shop_id"()));



CREATE POLICY "Staff update payments" ON "public"."payments" FOR UPDATE USING (("shop_id" = "public"."get_my_shop_id"())) WITH CHECK (("shop_id" = "public"."get_my_shop_id"()));



CREATE POLICY "Staff view booking counters" ON "public"."booking_number_counters" FOR SELECT USING (("shop_id" = "public"."get_my_shop_id"()));



CREATE POLICY "Staff view customer sequences" ON "public"."customer_sequences" FOR SELECT USING (("shop_id" = "public"."get_my_shop_id"()));



CREATE POLICY "Staff view invoice counters" ON "public"."invoice_number_counters" FOR SELECT USING (("shop_id" = "public"."get_my_shop_id"()));



CREATE POLICY "Staff view invoice sequences" ON "public"."invoice_sequences" FOR SELECT USING (("shop_id" = "public"."get_my_shop_id"()));



CREATE POLICY "Staff view payments" ON "public"."payments" FOR SELECT USING (("shop_id" = "public"."get_my_shop_id"()));



CREATE POLICY "Users can update own profile" ON "public"."platform_users" FOR UPDATE USING (("auth_id" = "auth"."uid"())) WITH CHECK (("auth_id" = "auth"."uid"()));



CREATE POLICY "Users can view own profile" ON "public"."platform_users" FOR SELECT USING ((("auth_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "View customers in accessible shops" ON "public"."customers" FOR SELECT USING ((("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))) OR "public"."is_admin"()));



CREATE POLICY "View images for visible vehicles" ON "public"."vehicle_images" FOR SELECT USING (((( SELECT "vehicles"."owner_id"
   FROM "public"."vehicles"
  WHERE ("vehicles"."id" = "vehicle_images"."vehicle_id")) = ( SELECT "rental_shops"."id"
   FROM "public"."rental_shops"
  WHERE ("rental_shops"."owner_id" = "auth"."uid"()))) OR (( SELECT "vehicles"."is_listed_marketplace"
   FROM "public"."vehicles"
  WHERE ("vehicles"."id" = "vehicle_images"."vehicle_id")) = true)));



CREATE POLICY "View public marketplace vehicles" ON "public"."vehicles" FOR SELECT USING (((("is_listed_marketplace" = true) AND ("status" = 'Available'::"public"."vehicle_status")) OR ("owner_id" IN ( SELECT "rental_shops"."id"
   FROM "public"."rental_shops"
  WHERE ("rental_shops"."owner_id" = "auth"."uid"()))) OR ("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))) OR "public"."is_admin"()));



ALTER TABLE "public"."booking_number_counters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bookings_delete" ON "public"."bookings" FOR DELETE USING (("shop_id" = (("auth"."jwt"() ->> 'shop_id'::"text"))::"uuid"));



CREATE POLICY "bookings_insert" ON "public"."bookings" FOR INSERT WITH CHECK (("shop_id" = (("auth"."jwt"() ->> 'shop_id'::"text"))::"uuid"));



CREATE POLICY "bookings_select" ON "public"."bookings" FOR SELECT USING (("shop_id" = (("auth"."jwt"() ->> 'shop_id'::"text"))::"uuid"));



CREATE POLICY "bookings_update" ON "public"."bookings" FOR UPDATE USING (("shop_id" = (("auth"."jwt"() ->> 'shop_id'::"text"))::"uuid")) WITH CHECK (("shop_id" = (("auth"."jwt"() ->> 'shop_id'::"text"))::"uuid"));



ALTER TABLE "public"."cities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cities_select_all" ON "public"."cities" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."customer_id_photos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_id_photos_delete" ON "public"."customer_id_photos" FOR DELETE USING (("shop_id" = (("auth"."jwt"() ->> 'shop_id'::"text"))::"uuid"));



CREATE POLICY "customer_id_photos_insert" ON "public"."customer_id_photos" FOR INSERT WITH CHECK (("shop_id" = (("auth"."jwt"() ->> 'shop_id'::"text"))::"uuid"));



CREATE POLICY "customer_id_photos_select" ON "public"."customer_id_photos" FOR SELECT USING (("shop_id" = (("auth"."jwt"() ->> 'shop_id'::"text"))::"uuid"));



CREATE POLICY "customer_id_photos_update" ON "public"."customer_id_photos" FOR UPDATE USING (("shop_id" = (("auth"."jwt"() ->> 'shop_id'::"text"))::"uuid")) WITH CHECK (("shop_id" = (("auth"."jwt"() ->> 'shop_id'::"text"))::"uuid"));



ALTER TABLE "public"."customer_sequences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customers_delete_own_shop" ON "public"."customers" FOR DELETE USING (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "customers_insert_own_shop" ON "public"."customers" FOR INSERT WITH CHECK (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "customers_select_own_shop" ON "public"."customers" FOR SELECT USING (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "customers_update_own_shop" ON "public"."customers" FOR UPDATE USING (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())))) WITH CHECK (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



ALTER TABLE "public"."damages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "damages_delete" ON "public"."damages" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."shop_id" = "damages"."shop_id")))));



CREATE POLICY "damages_insert" ON "public"."damages" FOR INSERT WITH CHECK ((("shop_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."shop_id" = "damages"."shop_id"))))));



CREATE POLICY "damages_select" ON "public"."damages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."shop_id" = "damages"."shop_id")))));



CREATE POLICY "damages_update" ON "public"."damages" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."shop_id" = "damages"."shop_id"))))) WITH CHECK ((("shop_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."auth_id" = "auth"."uid"()) AND ("users"."shop_id" = "damages"."shop_id"))))));



ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documents_delete" ON "public"."documents" FOR DELETE USING (("shop_id" = (("auth"."jwt"() ->> 'shop_id'::"text"))::"uuid"));



CREATE POLICY "documents_insert" ON "public"."documents" FOR INSERT WITH CHECK (("shop_id" = (("auth"."jwt"() ->> 'shop_id'::"text"))::"uuid"));



CREATE POLICY "documents_select" ON "public"."documents" FOR SELECT USING (("shop_id" = (("auth"."jwt"() ->> 'shop_id'::"text"))::"uuid"));



CREATE POLICY "documents_update" ON "public"."documents" FOR UPDATE USING (("shop_id" = (("auth"."jwt"() ->> 'shop_id'::"text"))::"uuid")) WITH CHECK (("shop_id" = (("auth"."jwt"() ->> 'shop_id'::"text"))::"uuid"));



ALTER TABLE "public"."invoice_number_counters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_sequences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "locations_select_public" ON "public"."locations" FOR SELECT USING (true);



ALTER TABLE "public"."marketplace_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_insert_system" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "notifications_select_own" ON "public"."notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "notifications_update_own" ON "public"."notifications" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pickup_points_delete_owner" ON "public"."shop_pickup_points" FOR DELETE USING ((("shop_id" = ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())
 LIMIT 1)) AND (( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())
 LIMIT 1) = ANY (ARRAY['owner'::"public"."user_role", 'admin'::"public"."user_role"]))));



CREATE POLICY "pickup_points_insert_owner" ON "public"."shop_pickup_points" FOR INSERT WITH CHECK ((("shop_id" = ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())
 LIMIT 1)) AND (( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())
 LIMIT 1) = ANY (ARRAY['owner'::"public"."user_role", 'admin'::"public"."user_role"]))));



CREATE POLICY "pickup_points_select_shop" ON "public"."shop_pickup_points" FOR SELECT USING ((("is_active" = true) AND ("shop_id" = ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())
 LIMIT 1))));



CREATE POLICY "pickup_points_update_owner" ON "public"."shop_pickup_points" FOR UPDATE USING ((("shop_id" = ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())
 LIMIT 1)) AND (( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())
 LIMIT 1) = ANY (ARRAY['owner'::"public"."user_role", 'admin'::"public"."user_role"])))) WITH CHECK ((("shop_id" = ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())
 LIMIT 1)) AND (( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())
 LIMIT 1) = ANY (ARRAY['owner'::"public"."user_role", 'admin'::"public"."user_role"]))));



ALTER TABLE "public"."pincodes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pincodes_select_all" ON "public"."pincodes" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."platform_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_pickup_points_select_active" ON "public"."shop_pickup_points" FOR SELECT TO "anon" USING (("is_active" = true));



CREATE POLICY "public_vehicles_select_published" ON "public"."vehicles" FOR SELECT TO "anon" USING (("is_published" = true));



ALTER TABLE "public"."rental_shops" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rental_shops_insert_owner" ON "public"."rental_shops" FOR INSERT WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "rental_shops_select_own" ON "public"."rental_shops" FOR SELECT USING ((("owner_id" = "auth"."uid"()) OR ("id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())))));



CREATE POLICY "rental_shops_update_owner" ON "public"."rental_shops" FOR UPDATE USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "shop_access_all" ON "public"."booking_number_counters" USING (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())))) WITH CHECK (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "shop_access_all" ON "public"."customer_sequences" USING (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())))) WITH CHECK (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "shop_access_all" ON "public"."invoice_number_counters" USING (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())))) WITH CHECK (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "shop_access_all" ON "public"."invoice_sequences" USING (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())))) WITH CHECK (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "shop_access_all" ON "public"."payments" USING (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())))) WITH CHECK (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



ALTER TABLE "public"."shop_pickup_points" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."states" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "states_select_all" ON "public"."states" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_insert_self" ON "public"."users" FOR INSERT WITH CHECK (("auth_id" = "auth"."uid"()));



CREATE POLICY "users_select_self" ON "public"."users" FOR SELECT USING (("auth_id" = "auth"."uid"()));



CREATE POLICY "users_update_self" ON "public"."users" FOR UPDATE USING (("auth_id" = "auth"."uid"())) WITH CHECK (("auth_id" = "auth"."uid"()));



ALTER TABLE "public"."vehicle_damage_photos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vehicle_damage_photos_delete" ON "public"."vehicle_damage_photos" FOR DELETE USING (("shop_id" = (("auth"."jwt"() ->> 'shop_id'::"text"))::"uuid"));



CREATE POLICY "vehicle_damage_photos_insert" ON "public"."vehicle_damage_photos" FOR INSERT WITH CHECK (("shop_id" = (("auth"."jwt"() ->> 'shop_id'::"text"))::"uuid"));



CREATE POLICY "vehicle_damage_photos_select" ON "public"."vehicle_damage_photos" FOR SELECT USING (("shop_id" = (("auth"."jwt"() ->> 'shop_id'::"text"))::"uuid"));



CREATE POLICY "vehicle_damage_photos_update" ON "public"."vehicle_damage_photos" FOR UPDATE USING (("shop_id" = (("auth"."jwt"() ->> 'shop_id'::"text"))::"uuid")) WITH CHECK (("shop_id" = (("auth"."jwt"() ->> 'shop_id'::"text"))::"uuid"));



ALTER TABLE "public"."vehicle_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vehicles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vehicles_delete_own_shop" ON "public"."vehicles" FOR DELETE USING (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "vehicles_insert_own_shop" ON "public"."vehicles" FOR INSERT WITH CHECK (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "vehicles_select_own_shop" ON "public"."vehicles" FOR SELECT USING (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "vehicles_update_own_shop" ON "public"."vehicles" FOR UPDATE USING (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())))) WITH CHECK (("shop_id" IN ( SELECT "users"."shop_id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_damage_photos"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_damage_photos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_damage_photos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_id_photos"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_id_photos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_id_photos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_owner"("p_auth_user_id" "uuid", "p_shop_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_owner"("p_auth_user_id" "uuid", "p_shop_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_owner"("p_auth_user_id" "uuid", "p_shop_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_rental_shop"("p_owner_id" "uuid", "p_name" "text", "p_phone" "text", "p_email" "text", "p_address" "text", "p_city" "text", "p_state" "text", "p_pincode" "text", "p_gst_number" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_rental_shop"("p_owner_id" "uuid", "p_name" "text", "p_phone" "text", "p_email" "text", "p_address" "text", "p_city" "text", "p_state" "text", "p_pincode" "text", "p_gst_number" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_rental_shop"("p_owner_id" "uuid", "p_name" "text", "p_phone" "text", "p_email" "text", "p_address" "text", "p_city" "text", "p_state" "text", "p_pincode" "text", "p_gst_number" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_staff"("p_auth_user_id" "uuid", "p_shop_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_staff"("p_auth_user_id" "uuid", "p_shop_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_staff"("p_auth_user_id" "uuid", "p_shop_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."days_until_expiry"("p_expires_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."days_until_expiry"("p_expires_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."days_until_expiry"("p_expires_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."deactivate_user"("p_auth_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."deactivate_user"("p_auth_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."deactivate_user"("p_auth_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fy_label"("ts" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."fy_label"("ts" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fy_label"("ts" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_booking_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_booking_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_booking_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_booking_number"("p_shop_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_booking_number"("p_shop_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_booking_number"("p_shop_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_customer_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_customer_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_customer_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_customer_number"("p_shop_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_customer_number"("p_shop_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_customer_number"("p_shop_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invoice_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invoice_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invoice_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invoice_number"("p_shop_id" "uuid", "p_ts" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invoice_number"("p_shop_id" "uuid", "p_ts" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invoice_number"("p_shop_id" "uuid", "p_ts" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_user_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_user_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_user_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_shop_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_shop_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_shop_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_owner_of_shop"("p_shop_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_owner_of_shop"("p_shop_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_owner_of_shop"("p_shop_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_payment_completed"("p_payment_id" "uuid", "p_external_payment_id" "text", "p_transaction_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_payment_completed"("p_payment_id" "uuid", "p_external_payment_id" "text", "p_transaction_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_payment_completed"("p_payment_id" "uuid", "p_external_payment_id" "text", "p_transaction_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_payment_failed"("p_payment_id" "uuid", "p_failure_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_payment_failed"("p_payment_id" "uuid", "p_failure_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_payment_failed"("p_payment_id" "uuid", "p_failure_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."promote_staff_to_owner"("p_auth_user_id" "uuid", "p_shop_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."promote_staff_to_owner"("p_auth_user_id" "uuid", "p_shop_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."promote_staff_to_owner"("p_auth_user_id" "uuid", "p_shop_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."refund_payment"("p_payment_id" "uuid", "p_refund_amount" numeric, "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."refund_payment"("p_payment_id" "uuid", "p_refund_amount" numeric, "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refund_payment"("p_payment_id" "uuid", "p_refund_amount" numeric, "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_bookings_created_by"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_bookings_created_by"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_bookings_created_by"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_customers_created_by"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_customers_created_by"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_customers_created_by"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_payments_recorded_by"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_payments_recorded_by"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_payments_recorded_by"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_vehicles_created_by"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_vehicles_created_by"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_vehicles_created_by"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_prevent_delete_if_invoiced"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_prevent_delete_if_invoiced"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_prevent_delete_if_invoiced"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_set_booking_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_booking_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_booking_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_set_customer_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_customer_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_customer_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_set_invoice_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_invoice_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_invoice_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_soft_delete_bookings"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_soft_delete_bookings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_soft_delete_bookings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_soft_delete_customer_id_photos"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_soft_delete_customer_id_photos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_soft_delete_customer_id_photos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_soft_delete_customers"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_soft_delete_customers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_soft_delete_customers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_soft_delete_damages"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_soft_delete_damages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_soft_delete_damages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_soft_delete_documents"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_soft_delete_documents"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_soft_delete_documents"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_soft_delete_vehicle_damage_photos"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_soft_delete_vehicle_damage_photos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_soft_delete_vehicle_damage_photos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_soft_delete_vehicles"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_soft_delete_vehicles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_soft_delete_vehicles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."booking_number_counters" TO "anon";
GRANT ALL ON TABLE "public"."booking_number_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_number_counters" TO "service_role";



GRANT ALL ON SEQUENCE "public"."booking_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."booking_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."booking_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."cities" TO "anon";
GRANT ALL ON TABLE "public"."cities" TO "authenticated";
GRANT ALL ON TABLE "public"."cities" TO "service_role";



GRANT ALL ON TABLE "public"."customer_id_photos" TO "anon";
GRANT ALL ON TABLE "public"."customer_id_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_id_photos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."customer_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."customer_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."customer_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."customer_sequences" TO "anon";
GRANT ALL ON TABLE "public"."customer_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_sequences" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."damages" TO "anon";
GRANT ALL ON TABLE "public"."damages" TO "authenticated";
GRANT ALL ON TABLE "public"."damages" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_number_counters" TO "anon";
GRANT ALL ON TABLE "public"."invoice_number_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_number_counters" TO "service_role";



GRANT ALL ON SEQUENCE "public"."invoice_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."invoice_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."invoice_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_sequences" TO "anon";
GRANT ALL ON TABLE "public"."invoice_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_sequences" TO "service_role";



GRANT ALL ON TABLE "public"."locations" TO "anon";
GRANT ALL ON TABLE "public"."locations" TO "authenticated";
GRANT ALL ON TABLE "public"."locations" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_locations" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_locations" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_payment_events" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_payment_events" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_payment_events" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_payment_reconciliation" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_payment_reconciliation" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_payment_reconciliation" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_payments" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_payments" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."pincodes" TO "anon";
GRANT ALL ON TABLE "public"."pincodes" TO "authenticated";
GRANT ALL ON TABLE "public"."pincodes" TO "service_role";



GRANT ALL ON TABLE "public"."platform_users" TO "anon";
GRANT ALL ON TABLE "public"."platform_users" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_users" TO "service_role";



GRANT ALL ON TABLE "public"."rental_shops" TO "anon";
GRANT ALL ON TABLE "public"."rental_shops" TO "authenticated";
GRANT ALL ON TABLE "public"."rental_shops" TO "service_role";



GRANT ALL ON TABLE "public"."shop_pickup_points" TO "anon";
GRANT ALL ON TABLE "public"."shop_pickup_points" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_pickup_points" TO "service_role";



GRANT ALL ON TABLE "public"."states" TO "anon";
GRANT ALL ON TABLE "public"."states" TO "authenticated";
GRANT ALL ON TABLE "public"."states" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."v_customer_id_photos" TO "anon";
GRANT ALL ON TABLE "public"."v_customer_id_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."v_customer_id_photos" TO "service_role";



GRANT ALL ON TABLE "public"."vehicle_damage_photos" TO "anon";
GRANT ALL ON TABLE "public"."vehicle_damage_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicle_damage_photos" TO "service_role";



GRANT ALL ON TABLE "public"."vehicles" TO "anon";
GRANT ALL ON TABLE "public"."vehicles" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicles" TO "service_role";



GRANT ALL ON TABLE "public"."v_vehicle_damage_photos" TO "anon";
GRANT ALL ON TABLE "public"."v_vehicle_damage_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."v_vehicle_damage_photos" TO "service_role";



GRANT ALL ON TABLE "public"."vehicle_images" TO "anon";
GRANT ALL ON TABLE "public"."vehicle_images" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicle_images" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







