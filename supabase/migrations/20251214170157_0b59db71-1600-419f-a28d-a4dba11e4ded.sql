-- Create funnel_events table for tracking user journey
CREATE TABLE public.funnel_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id UUID,
  session_id TEXT,
  source TEXT,
  referral TEXT,
  page_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert events (for anonymous tracking)
CREATE POLICY "Anyone can insert funnel events"
ON public.funnel_events
FOR INSERT
WITH CHECK (true);

-- Only admins can view all events
CREATE POLICY "Admins can view all funnel events"
ON public.funnel_events
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_funnel_events_type ON public.funnel_events(event_type);
CREATE INDEX idx_funnel_events_created_at ON public.funnel_events(created_at DESC);