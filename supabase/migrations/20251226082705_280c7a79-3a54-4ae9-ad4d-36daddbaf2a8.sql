-- Create table for inferred social profiles
CREATE TABLE public.inferred_social_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.chekinn_users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'twitter')),
  profile_url TEXT NOT NULL,
  profile_handle TEXT,
  confidence NUMERIC NOT NULL DEFAULT 0.0,
  source_type TEXT NOT NULL, -- 'email_signature', 'newsletter', 'calendar', 'recruiter', 'event'
  source_email_id TEXT,
  scraped_at TIMESTAMP WITH TIME ZONE,
  scrape_status TEXT DEFAULT 'pending', -- 'pending', 'scraped', 'failed', 'skipped'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform, profile_url)
);

-- Create table for social signals extracted from scraped profiles
CREATE TABLE public.social_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.chekinn_users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.inferred_social_profiles(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL, -- 'topic', 'theme', 'obsession', 'transition'
  signal_value TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0.0,
  evidence TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  processed BOOLEAN DEFAULT false
);

-- Add indexes
CREATE INDEX idx_inferred_profiles_user_status ON public.inferred_social_profiles(user_id, scrape_status);
CREATE INDEX idx_inferred_profiles_platform ON public.inferred_social_profiles(platform, confidence);
CREATE INDEX idx_social_signals_user ON public.social_signals(user_id, processed);
CREATE INDEX idx_social_signals_type ON public.social_signals(signal_type);

-- Enable RLS
ALTER TABLE public.inferred_social_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_signals ENABLE ROW LEVEL SECURITY;

-- RLS policies for inferred_social_profiles (service role only - no direct user access)
CREATE POLICY "Service role can manage inferred profiles"
  ON public.inferred_social_profiles FOR ALL
  USING (auth.role() = 'service_role');

-- RLS policies for social_signals (service role only)
CREATE POLICY "Service role can manage social signals"
  ON public.social_signals FOR ALL
  USING (auth.role() = 'service_role');

-- Add processed_email_ids column to track which emails have been processed for social inference
ALTER TABLE public.chekinn_users ADD COLUMN IF NOT EXISTS processed_email_ids TEXT[] DEFAULT '{}';

-- Create trigger for updated_at
CREATE TRIGGER update_inferred_profiles_updated_at
  BEFORE UPDATE ON public.inferred_social_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();