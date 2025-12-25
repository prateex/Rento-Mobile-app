/**
 * SUPABASE RLS POLICIES REQUIRED FOR MULTI-TENANT ISOLATION
 * 
 * These policies MUST be created in Supabase console for each table
 */

-- BOOKINGS TABLE RLS
-- Allow users to see bookings from their own shop
CREATE POLICY "users_can_read_own_shop_bookings" 
ON bookings 
FOR SELECT 
TO authenticated 
USING (
  shop_id = (
    SELECT id FROM rental_shops 
    WHERE owner_id = auth.uid()
    LIMIT 1
  )
);

-- Allow users to insert bookings to their shop
CREATE POLICY "users_can_insert_own_shop_bookings" 
ON bookings 
FOR INSERT 
TO authenticated 
WITH CHECK (
  shop_id = (
    SELECT id FROM rental_shops 
    WHERE owner_id = auth.uid()
    LIMIT 1
  )
);

-- Allow users to update bookings in their shop
CREATE POLICY "users_can_update_own_shop_bookings" 
ON bookings 
FOR UPDATE 
TO authenticated 
USING (
  shop_id = (
    SELECT id FROM rental_shops 
    WHERE owner_id = auth.uid()
    LIMIT 1
  )
);

-- VEHICLES TABLE RLS
CREATE POLICY "users_can_read_own_shop_vehicles" 
ON vehicles 
FOR SELECT 
TO authenticated 
USING (
  shop_id = (
    SELECT id FROM rental_shops 
    WHERE owner_id = auth.uid()
    LIMIT 1
  )
);

CREATE POLICY "users_can_insert_own_shop_vehicles" 
ON vehicles 
FOR INSERT 
TO authenticated 
WITH CHECK (
  shop_id = (
    SELECT id FROM rental_shops 
    WHERE owner_id = auth.uid()
    LIMIT 1
  )
);

CREATE POLICY "users_can_update_own_shop_vehicles" 
ON vehicles 
FOR UPDATE 
TO authenticated 
USING (
  shop_id = (
    SELECT id FROM rental_shops 
    WHERE owner_id = auth.uid()
    LIMIT 1
  )
);

-- CUSTOMERS TABLE RLS
CREATE POLICY "users_can_read_own_shop_customers" 
ON customers 
FOR SELECT 
TO authenticated 
USING (
  shop_id = (
    SELECT id FROM rental_shops 
    WHERE owner_id = auth.uid()
    LIMIT 1
  )
);

CREATE POLICY "users_can_insert_own_shop_customers" 
ON customers 
FOR INSERT 
TO authenticated 
WITH CHECK (
  shop_id = (
    SELECT id FROM rental_shops 
    WHERE owner_id = auth.uid()
    LIMIT 1
  )
);

CREATE POLICY "users_can_update_own_shop_customers" 
ON customers 
FOR UPDATE 
TO authenticated 
USING (
  shop_id = (
    SELECT id FROM rental_shops 
    WHERE owner_id = auth.uid()
    LIMIT 1
  )
);

-- PAYMENTS TABLE RLS
CREATE POLICY "users_can_read_own_shop_payments" 
ON payments 
FOR SELECT 
TO authenticated 
USING (
  shop_id = (
    SELECT id FROM rental_shops 
    WHERE owner_id = auth.uid()
    LIMIT 1
  )
);

CREATE POLICY "users_can_insert_own_shop_payments" 
ON payments 
FOR INSERT 
TO authenticated 
WITH CHECK (
  shop_id = (
    SELECT id FROM rental_shops 
    WHERE owner_id = auth.uid()
    LIMIT 1
  )
);

-- DEPOSITS TABLE RLS
CREATE POLICY "users_can_read_own_shop_deposits" 
ON deposits 
FOR SELECT 
TO authenticated 
USING (
  shop_id = (
    SELECT id FROM rental_shops 
    WHERE owner_id = auth.uid()
    LIMIT 1
  )
);

CREATE POLICY "users_can_insert_own_shop_deposits" 
ON deposits 
FOR INSERT 
TO authenticated 
WITH CHECK (
  shop_id = (
    SELECT id FROM rental_shops 
    WHERE owner_id = auth.uid()
    LIMIT 1
  )
);

-- DAMAGES TABLE RLS
CREATE POLICY "users_can_read_own_shop_damages" 
ON damages 
FOR SELECT 
TO authenticated 
USING (
  shop_id = (
    SELECT id FROM rental_shops 
    WHERE owner_id = auth.uid()
    LIMIT 1
  )
);

CREATE POLICY "users_can_insert_own_shop_damages" 
ON damages 
FOR INSERT 
TO authenticated 
WITH CHECK (
  shop_id = (
    SELECT id FROM rental_shops 
    WHERE owner_id = auth.uid()
    LIMIT 1
  )
);
