-- Create table for chat debriefs and learning summaries
CREATE TABLE public.chat_debriefs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  introduction_id UUID NOT NULL REFERENCES public.introductions(id) ON DELETE CASCADE,
  -- Debrief feedback
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  what_learned TEXT,
  chat_quality TEXT CHECK (chat_quality IN ('great', 'okay', 'not_helpful')),
  would_chat_again BOOLEAN,
  -- AI-generated summary
  ai_summary TEXT,
  key_learnings TEXT[],
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, introduction_id)
);

-- Enable RLS
ALTER TABLE public.chat_debriefs ENABLE ROW LEVEL SECURITY;

-- Users can view their own debriefs
CREATE POLICY "Users can view own debriefs"
ON public.chat_debriefs
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own debriefs
CREATE POLICY "Users can insert own debriefs"
ON public.chat_debriefs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own debriefs
CREATE POLICY "Users can update own debriefs"
ON public.chat_debriefs
FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can view all debriefs
CREATE POLICY "Admins can view all debriefs"
ON public.chat_debriefs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_chat_debriefs_updated_at
BEFORE UPDATE ON public.chat_debriefs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();