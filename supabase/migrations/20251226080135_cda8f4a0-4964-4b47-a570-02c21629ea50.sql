-- Create enum for signal types
CREATE TYPE signal_type AS ENUM ('FLIGHT', 'INTERVIEW', 'EVENT', 'TRANSITION', 'OBSESSION');

-- Create enum for decision states
CREATE TYPE decision_state AS ENUM ('SILENT', 'NUDGE', 'CHAT_INVITE');

-- Drop old signal_data column and add structured columns to email_signals
ALTER TABLE public.email_signals 
DROP COLUMN signal_data,
DROP COLUMN signal_type,
ADD COLUMN type signal_type NOT NULL,
ADD COLUMN domain text,
ADD COLUMN confidence numeric(3,2) NOT NULL DEFAULT 0.0,
ADD COLUMN evidence text,
ADD COLUMN expires_at timestamp with time zone;

-- Create indexes (without time-based predicates)
CREATE INDEX idx_email_signals_user_type ON public.email_signals (user_id, type);
CREATE INDEX idx_email_signals_expires ON public.email_signals (expires_at);
CREATE INDEX idx_email_signals_high_confidence ON public.email_signals (user_id) WHERE confidence >= 0.6;

-- Create decision log table
CREATE TABLE public.decision_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.chekinn_users(id) ON DELETE CASCADE,
  signal_id uuid REFERENCES public.email_signals(id) ON DELETE SET NULL,
  decision_state decision_state NOT NULL,
  signal_type signal_type,
  reason text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.decision_log ENABLE ROW LEVEL SECURITY;

-- Only service role can access decision logs
CREATE POLICY "Service role can manage decision logs"
ON public.decision_log FOR ALL
USING (auth.role() = 'service_role');

-- Create user messages table
CREATE TABLE public.user_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.chekinn_users(id) ON DELETE CASCADE,
  signal_id uuid REFERENCES public.email_signals(id) ON DELETE SET NULL,
  decision_state decision_state NOT NULL,
  message_content text NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  responded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_messages ENABLE ROW LEVEL SECURITY;

-- Service role manages messages
CREATE POLICY "Service role can manage messages"
ON public.user_messages FOR ALL
USING (auth.role() = 'service_role');

-- Users can view own messages
CREATE POLICY "Users can view own messages"
ON public.user_messages FOR SELECT
USING (user_id IN (
  SELECT id FROM chekinn_users WHERE email = (auth.jwt() ->> 'email')
));

-- Add index for message frequency check (max 1 per day)
CREATE INDEX idx_user_messages_daily ON public.user_messages (user_id, sent_at);

-- Add index for checking duplicate signal nudges
CREATE INDEX idx_user_messages_signal ON public.user_messages (signal_id) WHERE signal_id IS NOT NULL;