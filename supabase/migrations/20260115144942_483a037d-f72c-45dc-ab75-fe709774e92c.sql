-- Add onboarding context fields to profiles table for admin matching
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_context jsonb DEFAULT '{}'::jsonb;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.onboarding_context IS 'Stores onboarding flow context: lookingFor, whyOpportunity, constraint, motivation, motivationExplanation';