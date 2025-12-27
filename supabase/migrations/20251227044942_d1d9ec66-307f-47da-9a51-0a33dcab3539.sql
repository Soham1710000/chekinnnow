-- Create intent_candidates table for background signal loop
CREATE TABLE public.intent_candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('missed_followup', 'social_drift', 'important_reminder')),
  confidence NUMERIC NOT NULL DEFAULT 0.0 CHECK (confidence >= 0 AND confidence <= 1),
  freshness_hours NUMERIC NOT NULL DEFAULT 0,
  evidence TEXT,
  source_signal_id UUID,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '48 hours')
);

-- Enable RLS
ALTER TABLE public.intent_candidates ENABLE ROW LEVEL SECURITY;

-- Service role can manage all
CREATE POLICY "Service role can manage intent candidates"
  ON public.intent_candidates FOR ALL
  USING (auth.role() = 'service_role');

-- Users can view own candidates (for debugging)
CREATE POLICY "Users can view own intent candidates"
  ON public.intent_candidates FOR SELECT
  USING (user_id IN (
    SELECT id FROM auth.users WHERE auth.uid() = id
  ));

-- Add index for fast lookups
CREATE INDEX idx_intent_candidates_user_processed ON public.intent_candidates(user_id, processed);
CREATE INDEX idx_intent_candidates_confidence ON public.intent_candidates(confidence DESC);
CREATE INDEX idx_intent_candidates_expires ON public.intent_candidates(expires_at);