-- Drop the overly permissive policy that exposes all data
DROP POLICY IF EXISTS "Anyone can lookup referral codes" ON public.waitlist;

-- Create a security definer function to validate referral codes without exposing data
CREATE OR REPLACE FUNCTION public.validate_referral_code(code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.waitlist
    WHERE referral_code = code
  )
$$;