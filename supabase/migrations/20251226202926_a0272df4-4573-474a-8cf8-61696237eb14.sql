-- Add composite unique constraint for social profile upserts
ALTER TABLE public.inferred_social_profiles 
ADD CONSTRAINT inferred_social_profiles_user_platform_url_key 
UNIQUE (user_id, platform, profile_url);