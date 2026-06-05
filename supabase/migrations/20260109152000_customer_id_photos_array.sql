-- Migrate customers.id_photos to text[] and add upload timestamp

-- Create temporary function for JSONB to text[] conversion
CREATE OR REPLACE FUNCTION jsonb_to_text_array(j jsonb) RETURNS text[] AS $$
BEGIN
  IF j IS NULL THEN
    RETURN '{}'::text[];
  ELSIF jsonb_typeof(j) = 'array' THEN
    RETURN ARRAY(SELECT jsonb_array_elements_text(j));
  ELSIF jsonb_typeof(j) = 'object' THEN
    RETURN ARRAY(SELECT value FROM jsonb_each_text(j));
  ELSIF jsonb_typeof(j) = 'string' THEN
    RETURN ARRAY[j #>> '{}'];
  ELSE
    RETURN '{}'::text[];
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Convert column to text[] only if not already an array
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customers'
      AND column_name = 'id_photos'
      AND data_type <> 'ARRAY'
  ) THEN
    ALTER TABLE public.customers
    ALTER COLUMN id_photos TYPE text[]
    USING jsonb_to_text_array(id_photos);
  END IF;
END $$;

-- Drop temporary function
DROP FUNCTION IF EXISTS jsonb_to_text_array(jsonb);

-- Ensure column exists with default
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS id_photos text[];

ALTER TABLE public.customers
  ALTER COLUMN id_photos SET DEFAULT '{}'::text[];

UPDATE public.customers
SET id_photos = '{}'::text[]
WHERE id_photos IS NULL;

-- Add upload timestamp column
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS id_photos_uploaded_at timestamptz;

UPDATE public.customers
SET id_photos_uploaded_at = COALESCE(id_photos_uploaded_at, created_at)
WHERE id_photos IS NOT NULL AND array_length(id_photos, 1) > 0 AND id_photos_uploaded_at IS NULL;

-- Create private storage bucket for customer IDs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'customer-ids', 'customer-ids', false, 5242880, ARRAY['image/*']
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'customer-ids'
);

-- Storage RLS policies (same-shop access only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'customer_ids_select_same_shop'
  ) THEN
    CREATE POLICY customer_ids_select_same_shop
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'customer-ids'
      AND COALESCE((storage.foldername(name))[1], '') = 'shop'
      AND COALESCE((storage.foldername(name))[2], '') IN (
        SELECT shop_id::text FROM public.users WHERE users.auth_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'customer_ids_insert_same_shop'
  ) THEN
    CREATE POLICY customer_ids_insert_same_shop
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'customer-ids'
      AND COALESCE((storage.foldername(name))[1], '') = 'shop'
      AND COALESCE((storage.foldername(name))[2], '') IN (
        SELECT shop_id::text FROM public.users WHERE users.auth_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'customer_ids_delete_same_shop'
  ) THEN
    CREATE POLICY customer_ids_delete_same_shop
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'customer-ids'
      AND COALESCE((storage.foldername(name))[1], '') = 'shop'
      AND COALESCE((storage.foldername(name))[2], '') IN (
        SELECT shop_id::text FROM public.users WHERE users.auth_id = auth.uid()
      )
    );
  END IF;
END $$;
