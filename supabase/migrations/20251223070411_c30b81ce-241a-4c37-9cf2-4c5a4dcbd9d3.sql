-- Hidden user reputation table (never exposed to users)
CREATE TABLE public.user_reputation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  impact_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  thought_quality NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  discretion_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  pull_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  frozen_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  undercurrents_unlocked BOOLEAN DEFAULT FALSE,
  undercurrents_unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS - only service role can access (never exposed to users)
ALTER TABLE public.user_reputation ENABLE ROW LEVEL SECURITY;

-- No policies for regular users - only accessible via edge functions with service role

-- Undercurrents content table
CREATE TABLE public.undercurrents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation TEXT NOT NULL,
  interpretation TEXT NOT NULL,
  uncertainty_clause TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.undercurrents ENABLE ROW LEVEL SECURITY;

-- No user policies - only service role access

-- User undercurrent views and responses
CREATE TABLE public.user_undercurrent_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  undercurrent_id UUID NOT NULL REFERENCES public.undercurrents(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  response_prompt TEXT,
  response_text TEXT,
  responded_at TIMESTAMP WITH TIME ZONE,
  response_evaluated BOOLEAN DEFAULT FALSE,
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, undercurrent_id)
);

ALTER TABLE public.user_undercurrent_interactions ENABLE ROW LEVEL SECURITY;

-- Users can only see and insert their own interactions (but not the underlying data logic)
CREATE POLICY "Users can view own interactions"
ON public.user_undercurrent_interactions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interactions"
ON public.user_undercurrent_interactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interactions"
ON public.user_undercurrent_interactions
FOR UPDATE
USING (auth.uid() = user_id);

-- Function to initialize reputation for new users
CREATE OR REPLACE FUNCTION public.init_user_reputation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_reputation (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger to create reputation on user signup
CREATE TRIGGER on_auth_user_created_reputation
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.init_user_reputation();

-- Updated at trigger for reputation
CREATE TRIGGER update_user_reputation_updated_at
  BEFORE UPDATE ON public.user_reputation
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();