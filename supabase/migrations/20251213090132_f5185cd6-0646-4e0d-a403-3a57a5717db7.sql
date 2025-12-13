-- Create waitlist table
CREATE TABLE public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email TEXT,
  phone TEXT,
  waitlist_position INTEGER NOT NULL,
  referral_code TEXT NOT NULL UNIQUE,
  referrals_count INTEGER NOT NULL DEFAULT 0,
  referred_by TEXT,
  access_granted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for referral lookups
CREATE INDEX idx_waitlist_referral_code ON public.waitlist(referral_code);
CREATE INDEX idx_waitlist_position ON public.waitlist(waitlist_position);

-- Enable RLS
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Users can view their own waitlist entry
CREATE POLICY "Users can view own waitlist entry"
ON public.waitlist
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own waitlist entry
CREATE POLICY "Users can insert own waitlist entry"
ON public.waitlist
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own waitlist entry (for referral counts)
CREATE POLICY "Users can update own waitlist entry"
ON public.waitlist
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Create app_role enum for admin
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Function to check if user has role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Admins can view all waitlist entries
CREATE POLICY "Admins can view all waitlist entries"
ON public.waitlist
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update any waitlist entry
CREATE POLICY "Admins can update any waitlist entry"
ON public.waitlist
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Anyone can read waitlist for referral validation (limited)
CREATE POLICY "Anyone can lookup referral codes"
ON public.waitlist
FOR SELECT
TO authenticated
USING (true);

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Function to get next waitlist position
CREATE OR REPLACE FUNCTION public.get_next_waitlist_position()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_position INTEGER;
BEGIN
  SELECT COALESCE(MAX(waitlist_position), 0) INTO max_position FROM public.waitlist;
  RETURN max_position + 1;
END;
$$;

-- Function to process referral and update positions
CREATE OR REPLACE FUNCTION public.process_referral(referrer_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_record RECORD;
  new_position INTEGER;
BEGIN
  -- Get referrer's record
  SELECT * INTO referrer_record FROM public.waitlist WHERE referral_code = referrer_code;
  
  IF referrer_record IS NOT NULL THEN
    -- Increment referral count
    UPDATE public.waitlist 
    SET referrals_count = referrals_count + 1,
        updated_at = now()
    WHERE referral_code = referrer_code;
    
    -- Calculate new position (move up by 10, min 1)
    new_position := GREATEST(1, referrer_record.waitlist_position - 10);
    
    -- Update position
    UPDATE public.waitlist 
    SET waitlist_position = new_position,
        updated_at = now()
    WHERE referral_code = referrer_code;
    
    -- Check if should grant access (position <= 500 or referrals >= 7)
    IF new_position <= 500 OR (referrer_record.referrals_count + 1) >= 7 THEN
      UPDATE public.waitlist 
      SET access_granted = true,
          updated_at = now()
      WHERE referral_code = referrer_code;
    END IF;
  END IF;
END;
$$;

-- Enable realtime for waitlist updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.waitlist;

-- Function to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for auto-updating updated_at
CREATE TRIGGER update_waitlist_updated_at
BEFORE UPDATE ON public.waitlist
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();