-- ============================================
-- FIX: Infinite Recursion in users table RLS
-- ============================================
-- Run this in Supabase SQL Editor to fix the recursion error
-- This script drops ALL old recursive policies and creates clean ones

-- Drop ALL existing policies on users table (including new ones)
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_delete_own" ON public.users;
DROP POLICY IF EXISTS "Users can view staff in their shop" ON public.users;
DROP POLICY IF EXISTS "Shop owners can add staff" ON public.users;
DROP POLICY IF EXISTS "Shop owners can update staff" ON public.users;
DROP POLICY IF EXISTS "Shop owners can delete staff" ON public.users;

-- Drop any remaining policies
DO $$ 
DECLARE r record; 
BEGIN
  FOR r IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname='public' AND tablename='users' 
  LOOP 
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname); 
  END LOOP;
END $$;

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create NON-RECURSIVE policies
-- Users can only access their own user record
-- NO RECURSION: Only uses auth.uid() = auth_id

CREATE POLICY "users_select_own" ON public.users
  FOR SELECT
  USING (auth.uid() = auth_id);

CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = auth_id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE
  USING (auth.uid() = auth_id)
  WITH CHECK (auth.uid() = auth_id);

CREATE POLICY "users_delete_own" ON public.users
  FOR DELETE
  USING (auth.uid() = auth_id);

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- Run this to confirm policies are non-recursive:
-- SELECT * FROM pg_policies WHERE tablename = 'users';
