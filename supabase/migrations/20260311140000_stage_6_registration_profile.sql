-- Migration: Stage 6 — Registration + Profile Foundation
-- Adds phone, job_title, user_type columns to public.users
-- Adds UPDATE RLS policy for self-profile editing

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS job_title text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS user_type text NOT NULL DEFAULT 'seller';

-- Allow authenticated users to update only their own profile row
CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
