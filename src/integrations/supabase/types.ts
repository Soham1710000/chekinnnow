export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_extraction_log: {
        Row: {
          created_at: string | null
          extraction_time_ms: number | null
          id: string
          model_used: string | null
          raw_input_id: string | null
          signals_extracted: number | null
          tokens_used: number | null
        }
        Insert: {
          created_at?: string | null
          extraction_time_ms?: number | null
          id?: string
          model_used?: string | null
          raw_input_id?: string | null
          signals_extracted?: number | null
          tokens_used?: number | null
        }
        Update: {
          created_at?: string | null
          extraction_time_ms?: number | null
          id?: string
          model_used?: string | null
          raw_input_id?: string | null
          signals_extracted?: number | null
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_extraction_log_raw_input_id_fkey"
            columns: ["raw_input_id"]
            isOneToOne: false
            referencedRelation: "raw_inputs"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_debriefs: {
        Row: {
          ai_summary: string | null
          chat_quality: string | null
          created_at: string
          id: string
          introduction_id: string
          key_learnings: string[] | null
          rating: number | null
          updated_at: string
          user_id: string
          what_learned: string | null
          would_chat_again: boolean | null
        }
        Insert: {
          ai_summary?: string | null
          chat_quality?: string | null
          created_at?: string
          id?: string
          introduction_id: string
          key_learnings?: string[] | null
          rating?: number | null
          updated_at?: string
          user_id: string
          what_learned?: string | null
          would_chat_again?: boolean | null
        }
        Update: {
          ai_summary?: string | null
          chat_quality?: string | null
          created_at?: string
          id?: string
          introduction_id?: string
          key_learnings?: string[] | null
          rating?: number | null
          updated_at?: string
          user_id?: string
          what_learned?: string | null
          would_chat_again?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_debriefs_introduction_id_fkey"
            columns: ["introduction_id"]
            isOneToOne: false
            referencedRelation: "introductions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          message_type: string | null
          metadata: Json | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          message_type?: string | null
          metadata?: Json | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          message_type?: string | null
          metadata?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      chekinn_users: {
        Row: {
          consented_at: string | null
          created_at: string
          email: string
          google_id: string | null
          id: string
          processed_email_ids: string[] | null
          status: string
          updated_at: string
        }
        Insert: {
          consented_at?: string | null
          created_at?: string
          email: string
          google_id?: string | null
          id?: string
          processed_email_ids?: string[] | null
          status?: string
          updated_at?: string
        }
        Update: {
          consented_at?: string | null
          created_at?: string
          email?: string
          google_id?: string | null
          id?: string
          processed_email_ids?: string[] | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      decision_log: {
        Row: {
          created_at: string
          decision_state: Database["public"]["Enums"]["decision_state"]
          id: string
          reason: string
          signal_id: string | null
          signal_type: Database["public"]["Enums"]["signal_type"] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          decision_state: Database["public"]["Enums"]["decision_state"]
          id?: string
          reason: string
          signal_id?: string | null
          signal_type?: Database["public"]["Enums"]["signal_type"] | null
          user_id: string
        }
        Update: {
          created_at?: string
          decision_state?: Database["public"]["Enums"]["decision_state"]
          id?: string
          reason?: string
          signal_id?: string | null
          signal_type?: Database["public"]["Enums"]["signal_type"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_log_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "email_signals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chekinn_users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_signals: {
        Row: {
          confidence: number
          domain: string | null
          email_date: string
          evidence: string | null
          expires_at: string | null
          extracted_at: string
          gmail_message_id: string
          id: string
          type: Database["public"]["Enums"]["signal_type"]
          user_id: string
        }
        Insert: {
          confidence?: number
          domain?: string | null
          email_date: string
          evidence?: string | null
          expires_at?: string | null
          extracted_at?: string
          gmail_message_id: string
          id?: string
          type: Database["public"]["Enums"]["signal_type"]
          user_id: string
        }
        Update: {
          confidence?: number
          domain?: string | null
          email_date?: string
          evidence?: string | null
          expires_at?: string | null
          extracted_at?: string
          gmail_message_id?: string
          id?: string
          type?: Database["public"]["Enums"]["signal_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_signals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chekinn_users"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          page_url: string | null
          referral: string | null
          session_id: string | null
          source: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          page_url?: string | null
          referral?: string | null
          session_id?: string | null
          source?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          page_url?: string | null
          referral?: string | null
          session_id?: string | null
          source?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      inferred_social_profiles: {
        Row: {
          confidence: number
          created_at: string
          id: string
          platform: string
          profile_handle: string | null
          profile_url: string
          scrape_status: string | null
          scraped_at: string | null
          source_email_id: string | null
          source_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          id?: string
          platform: string
          profile_handle?: string | null
          profile_url: string
          scrape_status?: string | null
          scraped_at?: string | null
          source_email_id?: string | null
          source_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: string
          platform?: string
          profile_handle?: string | null
          profile_url?: string
          scrape_status?: string | null
          scraped_at?: string | null
          source_email_id?: string | null
          source_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inferred_social_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chekinn_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_jobs: {
        Row: {
          completed_at: string | null
          emails_processed: number | null
          error_message: string | null
          id: string
          last_history_id: string | null
          signals_found: number | null
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          emails_processed?: number | null
          error_message?: string | null
          id?: string
          last_history_id?: string | null
          signals_found?: number | null
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          emails_processed?: number | null
          error_message?: string | null
          id?: string
          last_history_id?: string | null
          signals_found?: number | null
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chekinn_users"
            referencedColumns: ["id"]
          },
        ]
      }
      intent_candidates: {
        Row: {
          confidence: number
          created_at: string
          evidence: string | null
          expires_at: string | null
          freshness_hours: number
          id: string
          processed: boolean | null
          source_signal_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          evidence?: string | null
          expires_at?: string | null
          freshness_hours?: number
          id?: string
          processed?: boolean | null
          source_signal_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          evidence?: string | null
          expires_at?: string | null
          freshness_hours?: number
          id?: string
          processed?: boolean | null
          source_signal_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      interaction_log: {
        Row: {
          created_at: string | null
          id: string
          intent: string | null
          interaction_type: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          intent?: string | null
          interaction_type: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          intent?: string | null
          interaction_type?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interaction_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chekinn_users"
            referencedColumns: ["id"]
          },
        ]
      }
      introductions: {
        Row: {
          created_at: string | null
          created_by: string | null
          end_reason: string | null
          ended_by: string | null
          id: string
          intro_message: string
          status: string | null
          updated_at: string | null
          user_a_accepted: boolean | null
          user_a_id: string
          user_b_accepted: boolean | null
          user_b_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          end_reason?: string | null
          ended_by?: string | null
          id?: string
          intro_message: string
          status?: string | null
          updated_at?: string | null
          user_a_accepted?: boolean | null
          user_a_id: string
          user_b_accepted?: boolean | null
          user_b_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          end_reason?: string | null
          ended_by?: string | null
          id?: string
          intro_message?: string
          status?: string | null
          updated_at?: string | null
          user_a_accepted?: boolean | null
          user_a_id?: string
          user_b_accepted?: boolean | null
          user_b_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          converted_at: string | null
          created_at: string
          extracted_insights: Json | null
          id: string
          messages: Json
          session_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          converted_at?: string | null
          created_at?: string
          extracted_insights?: Json | null
          id?: string
          messages?: Json
          session_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          converted_at?: string | null
          created_at?: string
          extracted_insights?: Json | null
          id?: string
          messages?: Json
          session_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      oauth_tokens: {
        Row: {
          access_token_encrypted: string
          created_at: string
          id: string
          refresh_token_encrypted: string
          scopes: string[]
          token_expiry: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted: string
          created_at?: string
          id?: string
          refresh_token_encrypted: string
          scopes?: string[]
          token_expiry: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string
          created_at?: string
          id?: string
          refresh_token_encrypted?: string
          scopes?: string[]
          token_expiry?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "chekinn_users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ai_insights: Json | null
          avatar_url: string | null
          bio: string | null
          communication_style: string | null
          connection_intent: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          goals: string[] | null
          id: string
          industry: string | null
          interests: string[] | null
          learning_complete: boolean | null
          learning_messages_count: number | null
          linkedin_url: string | null
          looking_for: string | null
          role: string | null
          skills: string[] | null
          updated_at: string | null
        }
        Insert: {
          ai_insights?: Json | null
          avatar_url?: string | null
          bio?: string | null
          communication_style?: string | null
          connection_intent?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          goals?: string[] | null
          id: string
          industry?: string | null
          interests?: string[] | null
          learning_complete?: boolean | null
          learning_messages_count?: number | null
          linkedin_url?: string | null
          looking_for?: string | null
          role?: string | null
          skills?: string[] | null
          updated_at?: string | null
        }
        Update: {
          ai_insights?: Json | null
          avatar_url?: string | null
          bio?: string | null
          communication_style?: string | null
          connection_intent?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          goals?: string[] | null
          id?: string
          industry?: string | null
          interests?: string[] | null
          learning_complete?: boolean | null
          learning_messages_count?: number | null
          linkedin_url?: string | null
          looking_for?: string | null
          role?: string | null
          skills?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      raw_inputs: {
        Row: {
          created_at: string | null
          external_id: string
          id: string
          occurred_at: string
          processed: boolean | null
          raw_metadata: Json | null
          raw_text: string | null
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          external_id: string
          id?: string
          occurred_at: string
          processed?: boolean | null
          raw_metadata?: Json | null
          raw_text?: string | null
          source: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          external_id?: string
          id?: string
          occurred_at?: string
          processed?: boolean | null
          raw_metadata?: Json | null
          raw_text?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_inputs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chekinn_users"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_extraction_rules: {
        Row: {
          active: boolean | null
          ai_fallback: boolean | null
          category: string
          created_at: string | null
          default_confidence: string
          id: string
          pattern_definition: Json
          pattern_type: string
          rule_name: string
          source: string
          subtype: string
          type: string
          user_story: string
          version: number | null
        }
        Insert: {
          active?: boolean | null
          ai_fallback?: boolean | null
          category: string
          created_at?: string | null
          default_confidence: string
          id?: string
          pattern_definition: Json
          pattern_type: string
          rule_name: string
          source: string
          subtype: string
          type: string
          user_story: string
          version?: number | null
        }
        Update: {
          active?: boolean | null
          ai_fallback?: boolean | null
          category?: string
          created_at?: string | null
          default_confidence?: string
          id?: string
          pattern_definition?: Json
          pattern_type?: string
          rule_name?: string
          source?: string
          subtype?: string
          type?: string
          user_story?: string
          version?: number | null
        }
        Relationships: []
      }
      signals_raw: {
        Row: {
          ai_reasoning: string | null
          category: string
          confidence: string
          created_at: string | null
          evidence: string | null
          extraction_method: string | null
          id: string
          metadata: Json | null
          occurred_at: string
          raw_input_id: string | null
          subtype: string
          type: string
          user_id: string
          user_story: string
        }
        Insert: {
          ai_reasoning?: string | null
          category: string
          confidence: string
          created_at?: string | null
          evidence?: string | null
          extraction_method?: string | null
          id?: string
          metadata?: Json | null
          occurred_at: string
          raw_input_id?: string | null
          subtype: string
          type: string
          user_id: string
          user_story: string
        }
        Update: {
          ai_reasoning?: string | null
          category?: string
          confidence?: string
          created_at?: string | null
          evidence?: string | null
          extraction_method?: string | null
          id?: string
          metadata?: Json | null
          occurred_at?: string
          raw_input_id?: string | null
          subtype?: string
          type?: string
          user_id?: string
          user_story?: string
        }
        Relationships: [
          {
            foreignKeyName: "signals_raw_raw_input_id_fkey"
            columns: ["raw_input_id"]
            isOneToOne: false
            referencedRelation: "raw_inputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_raw_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chekinn_users"
            referencedColumns: ["id"]
          },
        ]
      }
      social_signals: {
        Row: {
          confidence: number
          created_at: string
          evidence: string | null
          expires_at: string | null
          id: string
          processed: boolean | null
          profile_id: string | null
          signal_type: string
          signal_value: string
          user_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          evidence?: string | null
          expires_at?: string | null
          id?: string
          processed?: boolean | null
          profile_id?: string | null
          signal_type: string
          signal_value: string
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          evidence?: string | null
          expires_at?: string | null
          id?: string
          processed?: boolean | null
          profile_id?: string | null
          signal_type?: string
          signal_value?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_signals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "inferred_social_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_signals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chekinn_users"
            referencedColumns: ["id"]
          },
        ]
      }
      undercurrents: {
        Row: {
          active: boolean | null
          created_at: string
          id: string
          interpretation: string
          observation: string
          uncertainty_clause: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          id?: string
          interpretation: string
          observation: string
          uncertainty_clause: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          id?: string
          interpretation?: string
          observation?: string
          uncertainty_clause?: string
        }
        Relationships: []
      }
      user_chats: {
        Row: {
          content: string
          created_at: string | null
          id: string
          introduction_id: string
          read: boolean | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          introduction_id: string
          read?: boolean | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          introduction_id?: string
          read?: boolean | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_chats_introduction_id_fkey"
            columns: ["introduction_id"]
            isOneToOne: false
            referencedRelation: "introductions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_messages: {
        Row: {
          created_at: string
          decision_state: Database["public"]["Enums"]["decision_state"]
          id: string
          message_content: string
          responded_at: string | null
          sent_at: string
          signal_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          decision_state: Database["public"]["Enums"]["decision_state"]
          id?: string
          message_content: string
          responded_at?: string | null
          sent_at?: string
          signal_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          decision_state?: Database["public"]["Enums"]["decision_state"]
          id?: string
          message_content?: string
          responded_at?: string | null
          sent_at?: string
          signal_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_messages_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "email_signals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "chekinn_users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_reputation: {
        Row: {
          created_at: string
          discretion_score: number
          frozen_until: string | null
          id: string
          impact_score: number
          last_active_at: string | null
          pull_score: number
          thought_quality: number
          undercurrents_unlocked: boolean | null
          undercurrents_unlocked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discretion_score?: number
          frozen_until?: string | null
          id?: string
          impact_score?: number
          last_active_at?: string | null
          pull_score?: number
          thought_quality?: number
          undercurrents_unlocked?: boolean | null
          undercurrents_unlocked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          discretion_score?: number
          frozen_until?: string | null
          id?: string
          impact_score?: number
          last_active_at?: string | null
          pull_score?: number
          thought_quality?: number
          undercurrents_unlocked?: boolean | null
          undercurrents_unlocked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_state: {
        Row: {
          career_state: string | null
          career_state_since: string | null
          event_state: string | null
          fatigue_score: number | null
          ignored_nudges: number | null
          last_interaction_at: string | null
          next_event_at: string | null
          next_event_name: string | null
          nudges_24h: number | null
          responses_30d: number | null
          travel_arrival_at: string | null
          travel_destination: string | null
          travel_state: string | null
          trust_level: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          career_state?: string | null
          career_state_since?: string | null
          event_state?: string | null
          fatigue_score?: number | null
          ignored_nudges?: number | null
          last_interaction_at?: string | null
          next_event_at?: string | null
          next_event_name?: string | null
          nudges_24h?: number | null
          responses_30d?: number | null
          travel_arrival_at?: string | null
          travel_destination?: string | null
          travel_state?: string | null
          trust_level?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          career_state?: string | null
          career_state_since?: string | null
          event_state?: string | null
          fatigue_score?: number | null
          ignored_nudges?: number | null
          last_interaction_at?: string | null
          next_event_at?: string | null
          next_event_name?: string | null
          nudges_24h?: number | null
          responses_30d?: number | null
          travel_arrival_at?: string | null
          travel_destination?: string | null
          travel_state?: string | null
          trust_level?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "chekinn_users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_undercurrent_interactions: {
        Row: {
          created_at: string
          id: string
          responded_at: string | null
          response_evaluated: boolean | null
          response_prompt: string | null
          response_text: string | null
          undercurrent_id: string
          user_id: string
          viewed_at: string
          week_number: number
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          responded_at?: string | null
          response_evaluated?: boolean | null
          response_prompt?: string | null
          response_text?: string | null
          undercurrent_id: string
          user_id: string
          viewed_at?: string
          week_number: number
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          responded_at?: string | null
          response_evaluated?: boolean | null
          response_prompt?: string | null
          response_text?: string | null
          undercurrent_id?: string
          user_id?: string
          viewed_at?: string
          week_number?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_undercurrent_interactions_undercurrent_id_fkey"
            columns: ["undercurrent_id"]
            isOneToOne: false
            referencedRelation: "undercurrents"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          access_granted: boolean
          created_at: string
          email: string | null
          id: string
          phone: string | null
          referral_code: string
          referrals_count: number
          referred_by: string | null
          updated_at: string
          user_id: string
          waitlist_position: number
        }
        Insert: {
          access_granted?: boolean
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          referral_code: string
          referrals_count?: number
          referred_by?: string | null
          updated_at?: string
          user_id: string
          waitlist_position: number
        }
        Update: {
          access_granted?: boolean
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          referral_code?: string
          referrals_count?: number
          referred_by?: string | null
          updated_at?: string
          user_id?: string
          waitlist_position?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_referral_code: { Args: never; Returns: string }
      get_next_waitlist_position: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      process_referral: { Args: { referrer_code: string }; Returns: undefined }
      validate_referral_code: { Args: { code: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      decision_state: "SILENT" | "NUDGE" | "CHAT_INVITE"
      signal_type: "FLIGHT" | "INTERVIEW" | "EVENT" | "TRANSITION" | "OBSESSION"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      decision_state: ["SILENT", "NUDGE", "CHAT_INVITE"],
      signal_type: ["FLIGHT", "INTERVIEW", "EVENT", "TRANSITION", "OBSESSION"],
    },
  },
} as const
