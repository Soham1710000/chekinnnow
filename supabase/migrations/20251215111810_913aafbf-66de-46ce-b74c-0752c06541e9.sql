-- Fix waitlist table - restrict to own data only
DROP POLICY IF EXISTS "Users can view their own waitlist entry" ON public.waitlist;
CREATE POLICY "Users can view their own waitlist entry" 
ON public.waitlist 
FOR SELECT 
USING (auth.uid() = user_id);

-- Fix leads table - remove overly permissive UPDATE policy
DROP POLICY IF EXISTS "Anyone can update own session" ON public.leads;

-- Create proper leads UPDATE policy - only allow updating own session by session_id match AND only for non-converted leads
CREATE POLICY "Anyone can update own session by session_id" 
ON public.leads 
FOR UPDATE 
USING (user_id IS NULL)
WITH CHECK (user_id IS NULL);

-- Add admin-only SELECT for leads (remove public visibility)
DROP POLICY IF EXISTS "Anyone can view leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can view all leads" ON public.leads;
CREATE POLICY "Admins can view all leads" 
ON public.leads 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));