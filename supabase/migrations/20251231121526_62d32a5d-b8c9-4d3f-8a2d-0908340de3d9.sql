-- LinkedIn connections (from Chrome extension - 1st degree connections)
CREATE TABLE public.linkedin_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  name TEXT NOT NULL,
  headline TEXT,
  profile_url TEXT NOT NULL,
  email TEXT,
  company TEXT,
  
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, profile_url)
);

CREATE INDEX idx_linkedin_connections_user ON public.linkedin_connections(user_id);
CREATE INDEX idx_linkedin_connections_email ON public.linkedin_connections(email);

-- Enable RLS
ALTER TABLE public.linkedin_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connections" ON public.linkedin_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connections" ON public.linkedin_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connections" ON public.linkedin_connections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage connections" ON public.linkedin_connections
  FOR ALL USING (auth.role() = 'service_role');

-- LinkedIn profiles (detailed profiles from extension visits)
CREATE TABLE public.linkedin_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  profile_url TEXT NOT NULL,
  name TEXT NOT NULL,
  headline TEXT,
  location TEXT,
  current_company TEXT,
  role_title TEXT,
  
  past_experiences JSONB,
  education JSONB,
  skills JSONB,
  recent_posts JSONB,
  
  first_fetched TIMESTAMPTZ DEFAULT NOW(),
  last_fetched TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, profile_url)
);

CREATE INDEX idx_linkedin_profiles_user ON public.linkedin_profiles(user_id);
CREATE INDEX idx_linkedin_profiles_url ON public.linkedin_profiles(profile_url);
CREATE INDEX idx_linkedin_profiles_company ON public.linkedin_profiles(current_company);

-- Enable RLS
ALTER TABLE public.linkedin_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profiles" ON public.linkedin_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profiles" ON public.linkedin_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profiles" ON public.linkedin_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage profiles" ON public.linkedin_profiles
  FOR ALL USING (auth.role() = 'service_role');

-- LinkedIn posts (hiring signals from feed)
CREATE TABLE public.linkedin_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  author_name TEXT NOT NULL,
  author_profile_url TEXT,
  author_headline TEXT,
  post_text TEXT NOT NULL,
  post_type TEXT,
  
  posted_at TIMESTAMPTZ,
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  
  UNIQUE(user_id, author_profile_url, post_text)
);

CREATE INDEX idx_linkedin_posts_user ON public.linkedin_posts(user_id);
CREATE INDEX idx_linkedin_posts_type ON public.linkedin_posts(post_type);
CREATE INDEX idx_linkedin_posts_processed ON public.linkedin_posts(processed);

-- Enable RLS
ALTER TABLE public.linkedin_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own posts" ON public.linkedin_posts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own posts" ON public.linkedin_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage posts" ON public.linkedin_posts
  FOR ALL USING (auth.role() = 'service_role');

-- Profile fetch log (track LinkedIn profile fetches)
CREATE TABLE public.profile_fetch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  profile_url TEXT NOT NULL,
  reason TEXT NOT NULL,
  context JSONB,
  
  success BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profile_fetch_log_user ON public.profile_fetch_log(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.profile_fetch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fetch log" ON public.profile_fetch_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage fetch log" ON public.profile_fetch_log
  FOR ALL USING (auth.role() = 'service_role');

-- User's own LinkedIn profile data (synced from extension)
CREATE TABLE public.user_linkedin_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  
  name TEXT,
  headline TEXT,
  location TEXT,
  current_company TEXT,
  role_title TEXT,
  education JSONB,
  skills JSONB,
  profile_url TEXT,
  
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_linkedin_profile_user ON public.user_linkedin_profile(user_id);

-- Enable RLS
ALTER TABLE public.user_linkedin_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own linkedin profile" ON public.user_linkedin_profile
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own linkedin profile" ON public.user_linkedin_profile
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own linkedin profile" ON public.user_linkedin_profile
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage linkedin profiles" ON public.user_linkedin_profile
  FOR ALL USING (auth.role() = 'service_role');