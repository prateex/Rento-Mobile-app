-- Align schema with current customer app codebase
-- Safe, idempotent migration: only adds missing columns/types and creates tables if absent.

-- 1) Ensure booking_status supports codebase values
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    BEGIN
      ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'requested';
      ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'confirmed';
      ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'active';
      ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'completed';
    EXCEPTION WHEN duplicate_object THEN
      -- Ignore if values already exist
      NULL;
    END;
  END IF;
END $$;

-- 2) Bookings: pickup/drop timestamps and invoice fields used by app
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS actual_pickup_at timestamptz,
  ADD COLUMN IF NOT EXISTS actual_dropoff_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS refund_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS balance_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS notes text;

-- 3) Marketplace payments: ensure fields required by payment/refund flows
ALTER TABLE public.marketplace_payments
  ADD COLUMN IF NOT EXISTS payment_type text,
  ADD COLUMN IF NOT EXISTS payment_gateway text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS reference_id text,
  ADD COLUMN IF NOT EXISTS amount numeric(10,2);

-- 4) Customer profiles: add KYC fields for driving license
CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id uuid NOT NULL UNIQUE,
  full_name text,
  phone text,
  email text,
  address text,
  emergency_contact text,
  id_type text,
  driving_license_number text,
  driving_license_expiry date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS driving_license_number text,
  ADD COLUMN IF NOT EXISTS driving_license_expiry date;

-- 5) Customer ID documents: support driving license document types
CREATE TABLE IF NOT EXISTS public.customer_id_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_profile_id uuid,
  customer_auth_id uuid NOT NULL,
  document_type text NOT NULL,
  image_url text NOT NULL,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- No hard constraint on document_type; app uses 'DRIVING_LICENSE_FRONT' among others.
