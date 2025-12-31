-- ============================================================
-- TABLE 1: raw_inputs (immutable, append-only)
-- ============================================================
CREATE TABLE public.raw_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.chekinn_users(id) ON DELETE CASCADE,
  
  -- Source identification
  source TEXT NOT NULL, -- 'gmail' | 'twitter' | 'linkedin' | 'calendar'
  external_id TEXT NOT NULL, -- message_id, tweet_id, post_urn, event_id
  
  -- Raw content (never modified)
  raw_text TEXT,
  raw_metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Processing state
  processed BOOLEAN DEFAULT FALSE,
  
  -- Temporal
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, source, external_id)
);

CREATE INDEX idx_raw_inputs_user_occurred ON public.raw_inputs(user_id, occurred_at DESC);
CREATE INDEX idx_raw_inputs_source ON public.raw_inputs(source);
CREATE INDEX idx_raw_inputs_unprocessed ON public.raw_inputs(user_id, processed) WHERE processed = FALSE;

-- Enable RLS
ALTER TABLE public.raw_inputs ENABLE ROW LEVEL SECURITY;

-- Service role can manage
CREATE POLICY "Service role can manage raw_inputs"
  ON public.raw_inputs FOR ALL
  USING (auth.role() = 'service_role');

-- Users can view own inputs
CREATE POLICY "Users can view own raw_inputs"
  ON public.raw_inputs FOR SELECT
  USING (user_id IN (
    SELECT id FROM public.chekinn_users 
    WHERE email = (auth.jwt() ->> 'email')
  ));


-- ============================================================
-- TABLE 2: signals_raw (facts only, immutable)
-- ============================================================
CREATE TABLE public.signals_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.chekinn_users(id) ON DELETE CASCADE,
  
  -- Traceability
  raw_input_id UUID REFERENCES public.raw_inputs(id) ON DELETE SET NULL,
  
  -- Classification
  user_story TEXT NOT NULL,
  category TEXT NOT NULL, -- CAREER | TRAVEL | EVENTS | MEETINGS | SOCIAL | LIFE_OPS | LIFESTYLE | PEOPLE
  type TEXT NOT NULL,
  subtype TEXT NOT NULL,
  
  -- Confidence
  confidence TEXT NOT NULL CHECK (confidence IN ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH')),
  
  -- Evidence
  evidence TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Extraction tracking
  extraction_method TEXT, -- 'rule_based' | 'ai_extracted' | 'ai_boosted'
  ai_reasoning TEXT,
  
  -- Temporal
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_signals_raw_user_occurred ON public.signals_raw(user_id, occurred_at DESC);
CREATE INDEX idx_signals_raw_category ON public.signals_raw(category);
CREATE INDEX idx_signals_raw_type ON public.signals_raw(type);

-- Enable RLS
ALTER TABLE public.signals_raw ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage signals_raw"
  ON public.signals_raw FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own signals_raw"
  ON public.signals_raw FOR SELECT
  USING (user_id IN (
    SELECT id FROM public.chekinn_users 
    WHERE email = (auth.jwt() ->> 'email')
  ));


-- ============================================================
-- TABLE 3: user_state (stable summaries)
-- ============================================================
CREATE TABLE public.user_state (
  user_id UUID PRIMARY KEY REFERENCES public.chekinn_users(id) ON DELETE CASCADE,
  
  -- Career state
  career_state TEXT DEFAULT 'IDLE', -- IDLE | ACTIVE_SEARCH | ACCELERATING | DECIDING
  career_state_since TIMESTAMPTZ,
  
  -- Travel state
  travel_state TEXT DEFAULT 'NONE', -- NONE | PLANNED | IMMINENT | IN_CITY
  travel_destination TEXT,
  travel_arrival_at TIMESTAMPTZ,
  
  -- Event state
  event_state TEXT DEFAULT 'NONE', -- NONE | AWARE | ATTENDING | IMMINENT
  next_event_at TIMESTAMPTZ,
  next_event_name TEXT,
  
  -- Trust & fatigue
  trust_level INT DEFAULT 0 CHECK (trust_level >= 0 AND trust_level <= 2),
  fatigue_score INT DEFAULT 0,
  
  -- Interaction history
  responses_30d INT DEFAULT 0,
  nudges_24h INT DEFAULT 0,
  ignored_nudges INT DEFAULT 0,
  last_interaction_at TIMESTAMPTZ,
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage user_state"
  ON public.user_state FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own state"
  ON public.user_state FOR SELECT
  USING (user_id IN (
    SELECT id FROM public.chekinn_users 
    WHERE email = (auth.jwt() ->> 'email')
  ));


-- ============================================================
-- TABLE 4: interaction_log (for trust/fatigue calculation)
-- ============================================================
CREATE TABLE public.interaction_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.chekinn_users(id) ON DELETE CASCADE,
  
  interaction_type TEXT NOT NULL, -- 'nudge_sent' | 'user_responded' | 'user_ignored'
  intent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_interaction_log_user_created ON public.interaction_log(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.interaction_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage interaction_log"
  ON public.interaction_log FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================
-- TABLE 5: signal_extraction_rules (version-controlled patterns)
-- ============================================================
CREATE TABLE public.signal_extraction_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Rule identity
  rule_name TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL, -- gmail | twitter | linkedin | calendar
  
  -- Output classification
  user_story TEXT NOT NULL,
  category TEXT NOT NULL,
  type TEXT NOT NULL,
  subtype TEXT NOT NULL,
  
  -- Pattern matching
  pattern_type TEXT NOT NULL, -- 'regex' | 'keyword' | 'composite'
  pattern_definition JSONB NOT NULL,
  
  -- Defaults
  default_confidence TEXT NOT NULL CHECK (default_confidence IN ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH')),
  ai_fallback BOOLEAN DEFAULT FALSE,
  
  -- Versioning
  active BOOLEAN DEFAULT TRUE,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.signal_extraction_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage extraction_rules"
  ON public.signal_extraction_rules FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins can manage extraction_rules"
  ON public.signal_extraction_rules FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));


-- ============================================================
-- TABLE 6: ai_extraction_log (tracking)
-- ============================================================
CREATE TABLE public.ai_extraction_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_input_id UUID REFERENCES public.raw_inputs(id) ON DELETE SET NULL,
  model_used TEXT,
  tokens_used INT,
  extraction_time_ms INT,
  signals_extracted INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ai_extraction_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage ai_extraction_log"
  ON public.ai_extraction_log FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================
-- Insert default extraction rules
-- ============================================================
INSERT INTO public.signal_extraction_rules (rule_name, source, user_story, category, type, subtype, pattern_type, pattern_definition, default_confidence, ai_fallback) VALUES

-- Flight booking confirmations
('flight_booking_confirmation', 'gmail', 'Landing in city', 'TRAVEL', 'TRAVEL_CONFIRMED', 'UPCOMING_TRIP', 'composite', 
 '{"conditions": [{"field": "raw_metadata.from", "operator": "regex", "value": "(indigo|airindia|spicejet|vistara|goair|akasa|airline|emirates|lufthansa|british airways|air france|booking\\.com|makemytrip|yatra|cleartrip)"}], "logic": "AND"}',
 'VERY_HIGH', true),

-- Job application confirmations
('job_application_confirmation', 'gmail', 'Hiring in network', 'CAREER', 'CAREER_SWITCH_INTENT', 'ROLE_APPLICATION', 'keyword',
 '{"keywords": ["thank you for applying", "application received", "we have received your application", "application submitted", "your application for"]}',
 'HIGH', true),

-- Interview scheduling
('interview_scheduled', 'gmail', 'Hiring in network', 'CAREER', 'CAREER_EVENT', 'INTERVIEW_CONFIRMED', 'keyword',
 '{"keywords": ["interview scheduled", "interview confirmation", "interview invite", "meet with our team", "schedule an interview", "video interview"]}',
 'VERY_HIGH', true),

-- Hotel bookings
('hotel_booking_confirmation', 'gmail', 'Landing in city', 'TRAVEL', 'STAY_CONTEXT', 'HOTEL_BOOKED', 'composite',
 '{"conditions": [{"field": "raw_metadata.from", "operator": "regex", "value": "(hotel|oyo|treebo|fab|taj|marriott|hilton|hyatt|ihg|booking\\.com|airbnb|goibibo)"}], "logic": "AND"}',
 'HIGH', true),

-- Event tickets
('event_ticket', 'gmail', 'Attending events', 'EVENTS', 'EVENT_ATTENDANCE', 'TICKET_CONFIRMED', 'keyword',
 '{"keywords": ["your ticket", "event confirmation", "booking confirmed", "registration confirmed", "entry pass", "e-ticket"]}',
 'HIGH', true),

-- Meeting invites
('calendar_meeting', 'gmail', 'Meeting scheduled', 'MEETINGS', 'UPCOMING_MEETING', 'CALENDAR_EVENT', 'keyword',
 '{"keywords": ["has invited you to", "meeting invitation", "calendar event", "you have been invited", "join meeting"]}',
 'MEDIUM', true),

-- Recruiter outreach
('recruiter_outreach', 'gmail', 'Hiring in network', 'CAREER', 'CAREER_INTENSITY', 'RECRUITER_INTEREST', 'keyword',
 '{"keywords": ["opportunity at", "interested in your profile", "recruiting for", "open position", "hiring for", "would love to connect about a role"]}',
 'MEDIUM', true),

-- Offer letter
('offer_letter', 'gmail', 'Hiring in network', 'CAREER', 'CAREER_EVENT', 'OFFER_STAGE', 'keyword',
 '{"keywords": ["offer letter", "compensation package", "we are pleased to offer", "offer of employment", "salary offer"]}',
 'VERY_HIGH', true);


-- ============================================================
-- Function to update user_state.updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_user_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_update_user_state_timestamp
  BEFORE UPDATE ON public.user_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_state_timestamp();