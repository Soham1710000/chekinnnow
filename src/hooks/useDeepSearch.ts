import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserAsk {
  askType: string;
  intent: string;
  outcome: string;
  credibility: string;
  constraints: string;
  linkedinUrl?: string;
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

export function useDeepSearch() {
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buildSearchQuery = (ask: UserAsk): string => {
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

  const initiateSearch = useCallback(async (ask: UserAsk) => {
    setStatus("initiating");
    setProgress(10);
    setError(null);
    setResult(null);

    try {
      // Step 1: Initiate Clado deep research
      const query = buildSearchQuery(ask);
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

      // Step 2: Poll for results
      let attempts = 0;
      const maxAttempts = 120; // 10 minutes max
      let candidates = null;

      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 5000)); // Poll every 5 seconds
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

        console.log("Search status:", statusData?.status);

        if (statusData?.status === "completed") {
          candidates = statusData.results || statusData.profiles || [];
          break;
        } else if (statusData?.status === "failed") {
          throw new Error("Search failed on Clado's end");
        }
      }

      if (!candidates) throw new Error("Search timed out - please try again");

      console.log("Found candidates:", candidates.length);

      setStatus("processing");
      setProgress(85);

      // Step 3: Generate context and matches with AI
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

  return { status, progress, result, error, initiateSearch, reset };
}
