-- Add linkedin_url column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_url text;