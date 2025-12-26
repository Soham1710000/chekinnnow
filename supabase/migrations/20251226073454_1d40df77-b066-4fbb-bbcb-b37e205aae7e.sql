-- Create users table for ChekInn Gmail integration
CREATE TABLE public.chekinn_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  google_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  consented_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for encrypted OAuth tokens
CREATE TABLE public.oauth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.chekinn_users(id) ON DELETE CASCADE,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expiry TIMESTAMP WITH TIME ZONE NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['https://www.googleapis.com/auth/gmail.readonly'],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create table for processed email signals (NOT raw emails)
CREATE TABLE public.email_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.chekinn_users(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('flight', 'interview', 'offer', 'calendar_invite', 'event', 'exam_confirmation')),
  signal_data JSONB NOT NULL DEFAULT '{}',
  email_date TIMESTAMP WITH TIME ZONE NOT NULL,
  gmail_message_id TEXT NOT NULL,
  extracted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, gmail_message_id)
);

-- Create ingestion job tracking
CREATE TABLE public.ingestion_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.chekinn_users(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  emails_processed INTEGER DEFAULT 0,
  signals_found INTEGER DEFAULT 0,
  error_message TEXT,
  last_history_id TEXT
);

-- Enable RLS
ALTER TABLE public.chekinn_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chekinn_users
CREATE POLICY "Users can view own record" ON public.chekinn_users
  FOR SELECT USING (auth.uid()::text = id::text OR email = auth.jwt() ->> 'email');

CREATE POLICY "Service role can manage users" ON public.chekinn_users
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for oauth_tokens (only service role - tokens are sensitive)
CREATE POLICY "Service role only for tokens" ON public.oauth_tokens
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for email_signals
CREATE POLICY "Users can view own signals" ON public.email_signals
  FOR SELECT USING (user_id IN (SELECT id FROM public.chekinn_users WHERE email = auth.jwt() ->> 'email'));

CREATE POLICY "Service role can manage signals" ON public.email_signals
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for ingestion_jobs
CREATE POLICY "Users can view own jobs" ON public.ingestion_jobs
  FOR SELECT USING (user_id IN (SELECT id FROM public.chekinn_users WHERE email = auth.jwt() ->> 'email'));

CREATE POLICY "Service role can manage jobs" ON public.ingestion_jobs
  FOR ALL USING (auth.role() = 'service_role');

-- Indexes for performance
CREATE INDEX idx_email_signals_user_date ON public.email_signals(user_id, email_date DESC);
CREATE INDEX idx_email_signals_type ON public.email_signals(signal_type);
CREATE INDEX idx_ingestion_jobs_user ON public.ingestion_jobs(user_id, started_at DESC);
CREATE INDEX idx_oauth_tokens_expiry ON public.oauth_tokens(token_expiry);

-- Trigger for updated_at
CREATE TRIGGER update_chekinn_users_updated_at
  BEFORE UPDATE ON public.chekinn_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_oauth_tokens_updated_at
  BEFORE UPDATE ON public.oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();