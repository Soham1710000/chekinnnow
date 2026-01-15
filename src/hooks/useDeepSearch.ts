import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Cache keys for localStorage
const SEARCH_CACHE_KEY = "chekinn_search_cache";
const SEARCH_COOLDOWN_KEY = "chekinn_search_cooldown";
const COOLDOWN_HOURS = 24; // Minimum hours between searches

interface CachedSearch {
  result: SearchResult;
  timestamp: number;
  queryHash: string;
}

export interface UserAsk {
  askType: string;
  intent: string;
  outcome: string;
  credibility: string;
  constraints: string;
}

// Context data from onboarding flow
export interface ContextData {
  lookingFor?: string;
  whyOpportunity?: string;
  constraint?: string;
  contrarianBelief?: string;
  careerInflection?: string;
  motivation?: string;
  motivationExplanation?: string;
}

// User profile data from DB
export interface UserProfile {
  full_name?: string;
  role?: string;
  industry?: string;
  looking_for?: string;
  skills?: string[];
  interests?: string[];
  ai_insights?: any;
  linkedin_url?: string;
}

export interface Match {
  name: string;
  title: string;
  company?: string;
  matchType?: "obvious" | "wildcard";
  whyUnexpected?: string;
  thesisAlignment?: string;
  whoTheyAre: string;
  whyThisMakesSense: string[];
  whyYoureRelevant: string;
  sharedGround?: string[];
  warmPath: string;
  coldPath: string;
  suggestedMessage: string;
  linkedinUrl?: string;
  confidence: "high" | "medium" | "low";
}

export interface UserContext {
  userNarrative: string;
  extractedThesis?: string;
  problemPatterns?: string[];
  intentSummary: string;
  background?: string;
  strengths?: string[];
  careerPivots?: string[];
  programs?: string[];
  avoidProfiles: string[];
  urgency: "low" | "medium" | "high";
  idealConversationType: string;
}

export interface SearchResult {
  userContext: UserContext;
  matches: Match[];
  reasoning: string;
}

type SearchStatus = "idle" | "initiating" | "searching" | "processing" | "complete" | "error";

// Helper to generate hash for query caching
const generateQueryHash = (profile: UserProfile, context?: ContextData): string => {
  const key = JSON.stringify({
    lookingFor: context?.lookingFor || profile.looking_for || "",
    why: context?.whyOpportunity || "",
    industry: profile.industry || "",
  });
  return btoa(key).slice(0, 32);
};

// Check if user can search (cooldown check)
const canSearch = (): { allowed: boolean; remainingHours?: number } => {
  const lastSearch = localStorage.getItem(SEARCH_COOLDOWN_KEY);
  if (!lastSearch) return { allowed: true };
  
  const lastSearchTime = parseInt(lastSearch, 10);
  const hoursSinceSearch = (Date.now() - lastSearchTime) / (1000 * 60 * 60);
  
  if (hoursSinceSearch >= COOLDOWN_HOURS) {
    return { allowed: true };
  }
  return { allowed: false, remainingHours: Math.ceil(COOLDOWN_HOURS - hoursSinceSearch) };
};

// Get cached search result
const getCachedResult = (queryHash: string): SearchResult | null => {
  try {
    const cached = localStorage.getItem(SEARCH_CACHE_KEY);
    if (!cached) return null;
    
    const parsedCache: CachedSearch = JSON.parse(cached);
    // Cache valid for 7 days
    const cacheAge = (Date.now() - parsedCache.timestamp) / (1000 * 60 * 60 * 24);
    if (cacheAge > 7) {
      localStorage.removeItem(SEARCH_CACHE_KEY);
      return null;
    }
    
    // Return cached result if query matches
    if (parsedCache.queryHash === queryHash) {
      return parsedCache.result;
    }
    return null;
  } catch {
    return null;
  }
};

// Save search result to cache
const cacheSearchResult = (result: SearchResult, queryHash: string): void => {
  const cacheData: CachedSearch = {
    result,
    timestamp: Date.now(),
    queryHash,
  };
  localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(cacheData));
  localStorage.setItem(SEARCH_COOLDOWN_KEY, Date.now().toString());
};

export function useDeepSearch() {
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number | null>(null);

  // Check cooldown on mount
  useEffect(() => {
    const { allowed, remainingHours } = canSearch();
    if (!allowed && remainingHours) {
      setCooldownRemaining(remainingHours);
    }
  }, []);

  // Build search query from manual UserAsk form
  const buildSearchQueryFromAsk = (ask: UserAsk): string => {
    const typeQueries: Record<string, string> = {
      fundraising: `early-stage angel investors seed investors ${ask.intent}`,
      hiring: `engineers developers designers ${ask.intent}`,
      sales: `decision makers buyers ${ask.intent}`,
      partnerships: `startup founders business development ${ask.intent}`,
      peer: `indie hackers founders builders ${ask.intent}`,
      mentorship: `mentors advisors executives ${ask.intent}`,
      career: `recruiters hiring managers ${ask.intent}`,
    };
    return typeQueries[ask.askType] || ask.intent;
  };

  // Build search query from user's profile context (reverse of context earning)
  const buildSearchQueryFromProfile = (profile: UserProfile, context?: ContextData): string => {
    const parts: string[] = [];
    
    // Use lookingFor from onboarding as primary intent (new flow)
    if (context?.lookingFor) {
      parts.push(context.lookingFor);
    }
    // Fallback to profile looking_for
    else if (profile.looking_for) {
      parts.push(profile.looking_for);
    }
    
    // Add why context for better matching
    if (context?.whyOpportunity) {
      parts.push(context.whyOpportunity);
    }
    
    // Add industry context
    if (profile.industry) {
      parts.push(profile.industry);
    }
    
    // Add skills for complementary matches
    if (profile.skills?.length) {
      parts.push(profile.skills.slice(0, 3).join(" "));
    }
    
    // Add context from onboarding motivation if available
    if (context?.motivation) {
      const motivationKeywords: Record<string, string> = {
        building: "founders builders entrepreneurs",
        recognition: "thought leaders influencers",
        financial: "investors startup founders",
        mastery: "experts mentors specialists",
        stability: "established professionals",
        impact: "social entrepreneurs changemakers",
      };
      parts.push(motivationKeywords[context.motivation] || "");
    }
    
    return parts.filter(Boolean).join(" ") || "professionals founders";
  };

  // Convert profile context to UserAsk format for the API
  const profileToUserAsk = (profile: UserProfile, context?: ContextData): UserAsk => {
    const motivationToAskType: Record<string, string> = {
      building: "peer",
      recognition: "mentorship",
      financial: "fundraising",
      mastery: "mentorship",
      stability: "career",
      impact: "partnerships",
    };
    
    return {
      askType: context?.motivation ? (motivationToAskType[context.motivation] || "peer") : "peer",
      intent: context?.lookingFor || profile.looking_for || `Connect with ${profile.industry || "relevant"} professionals`,
      outcome: context?.whyOpportunity || "Find meaningful connections who can provide value",
      credibility: profile.role ? `${profile.role}${profile.industry ? ` in ${profile.industry}` : ""}` : "",
      constraints: context?.constraint || "",
    };
  };

  // Search using profile context (auto-triggered)
  const initiateSearchFromProfile = useCallback(async (profile: UserProfile, context?: ContextData, forceNew = false) => {
    const queryHash = generateQueryHash(profile, context);
    
    // Check for cached result first (unless forcing new search)
    if (!forceNew) {
      const cached = getCachedResult(queryHash);
      if (cached) {
        console.log("Using cached search result");
        setResult(cached);
        setStatus("complete");
        setProgress(100);
        return;
      }
    }
    
    // Check cooldown for new searches
    const { allowed, remainingHours } = canSearch();
    if (!allowed && !forceNew) {
      setError(`You can search again in ${remainingHours} hours. View your existing matches below.`);
      setCooldownRemaining(remainingHours || null);
      // Try to show cached result anyway
      const cached = getCachedResult(queryHash);
      if (cached) {
        setResult(cached);
        setStatus("complete");
        setProgress(100);
        return;
      }
      setStatus("error");
      return;
    }
    
    setStatus("initiating");
    setProgress(10);
    setError(null);
    setResult(null);

    try {
      const query = buildSearchQueryFromProfile(profile, context);
      const userAsk = profileToUserAsk(profile, context);
      
      console.log("Initiating profile-based search:", query);
      
      const { data: initData, error: initError } = await supabase.functions.invoke(
        "initiate-search",
        { body: { query, limit: 30 } }
      );

      if (initError || initData?.error) {
        throw new Error(initData?.error || initError?.message || "Failed to initiate search");
      }

      const jobId = initData.job_id;
      if (!jobId) throw new Error("No job ID returned from search");

      setStatus("searching");
      setProgress(30);

      // Poll for results
      let attempts = 0;
      const maxAttempts = 120;
      let candidates = null;

      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 5000));
        attempts++;
        setProgress(30 + Math.min(attempts * 0.5, 50));

        const { data: statusData, error: statusError } = await supabase.functions.invoke(
          "get-search-status",
          { body: { jobId } }
        );

        if (statusError) {
          console.warn("Status check failed, retrying...", statusError);
          continue;
        }

        if (statusData?.status === "completed") {
          candidates = statusData.results || statusData.profiles || [];
          break;
        } else if (statusData?.status === "failed") {
          throw new Error("Search failed on Clado's end");
        }
      }

      if (!candidates) throw new Error("Search timed out - please try again");

      setStatus("processing");
      setProgress(85);

      // Generate context and matches with AI
      const { data: contextData, error: contextError } = await supabase.functions.invoke(
        "generate-match-context",
        { 
          body: { 
            userAsk, 
            candidates,
            userProfile: profile,
            onboardingContext: context,
          } 
        }
      );

      if (contextError || contextData?.error) {
        throw new Error(contextData?.error || contextError?.message || "Failed to generate matches");
      }

      // Cache the result
      cacheSearchResult(contextData, queryHash);
      setCooldownRemaining(null);
      
      setResult(contextData);
      setStatus("complete");
      setProgress(100);
    } catch (err) {
      console.error("Search error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      setStatus("error");
    }
  }, []);

  // Original manual search
  const initiateSearch = useCallback(async (ask: UserAsk) => {
    setStatus("initiating");
    setProgress(10);
    setError(null);
    setResult(null);

    try {
      const query = buildSearchQueryFromAsk(ask);
      console.log("Initiating search with query:", query);
      
      const { data: initData, error: initError } = await supabase.functions.invoke(
        "initiate-search",
        { body: { query, limit: 30 } }
      );

      if (initError || initData?.error) {
        throw new Error(initData?.error || initError?.message || "Failed to initiate search");
      }

      const jobId = initData.job_id;
      if (!jobId) throw new Error("No job ID returned from search");

      setStatus("searching");
      setProgress(30);

      let attempts = 0;
      const maxAttempts = 120;
      let candidates = null;

      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 5000));
        attempts++;
        setProgress(30 + Math.min(attempts * 0.5, 50));

        const { data: statusData, error: statusError } = await supabase.functions.invoke(
          "get-search-status",
          { body: { jobId } }
        );

        if (statusError) {
          console.warn("Status check failed, retrying...", statusError);
          continue;
        }

        if (statusData?.status === "completed") {
          candidates = statusData.results || statusData.profiles || [];
          break;
        } else if (statusData?.status === "failed") {
          throw new Error("Search failed on Clado's end");
        }
      }

      if (!candidates) throw new Error("Search timed out - please try again");

      setStatus("processing");
      setProgress(85);

      const { data: contextData, error: contextError } = await supabase.functions.invoke(
        "generate-match-context",
        { body: { userAsk: ask, candidates } }
      );

      if (contextError || contextData?.error) {
        throw new Error(contextData?.error || contextError?.message || "Failed to generate matches");
      }

      setResult(contextData);
      setStatus("complete");
      setProgress(100);
    } catch (err) {
      console.error("Search error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      setStatus("error");
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setProgress(0);
    setResult(null);
    setError(null);
  }, []);

  // Check if there's a cached result available
  const hasCachedResult = useCallback((profile: UserProfile, context?: ContextData): boolean => {
    const queryHash = generateQueryHash(profile, context);
    return getCachedResult(queryHash) !== null;
  }, []);

  // Load cached result without triggering new search
  const loadCachedResult = useCallback((profile: UserProfile, context?: ContextData): boolean => {
    const queryHash = generateQueryHash(profile, context);
    const cached = getCachedResult(queryHash);
    if (cached) {
      setResult(cached);
      setStatus("complete");
      setProgress(100);
      return true;
    }
    return false;
  }, []);

  return { 
    status, 
    progress, 
    result, 
    error, 
    cooldownRemaining,
    initiateSearch, 
    initiateSearchFromProfile,
    hasCachedResult,
    loadCachedResult,
    reset 
  };
}
