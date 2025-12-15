-- Create leads table for anonymous chat sessions
CREATE TABLE public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text NOT NULL UNIQUE,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  extracted_insights jsonb DEFAULT NULL,
  user_id uuid DEFAULT NULL,
  converted_at timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Policies: Anyone can insert (anonymous users), admins can view all
CREATE POLICY "Anyone can insert leads"
ON public.leads
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update own session"
ON public.leads
FOR UPDATE
USING (true);

CREATE POLICY "Admins can view all leads"
ON public.leads
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_leads_session_id ON public.leads(session_id);
CREATE INDEX idx_leads_user_id ON public.leads(user_id);