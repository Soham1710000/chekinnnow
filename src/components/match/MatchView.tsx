import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Sparkles, Loader2, Copy, Check, ExternalLink, Zap, Target, Users, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useDeepSearch, UserAsk, Match, UserProfile, ContextData } from "@/hooks/useDeepSearch";

const ASK_TYPES = [
  { id: "fundraising", label: "Fundraising", icon: "💰" },
  { id: "hiring", label: "Hiring", icon: "👥" },
  { id: "sales", label: "Sales/BD", icon: "🤝" },
  { id: "partnerships", label: "Partnerships", icon: "🔗" },
  { id: "peer", label: "Peer Network", icon: "🌐" },
  { id: "mentorship", label: "Mentorship", icon: "🎯" },
  { id: "career", label: "Career Move", icon: "📈" },
];

interface MatchViewProps {
  userProfile?: UserProfile | null;
  onboardingContext?: ContextData | null;
  autoSearch?: boolean;
}

export function MatchView({ userProfile, onboardingContext, autoSearch = false }: MatchViewProps) {
  const { toast } = useToast();
  const { status, progress, result, error, cooldownRemaining, initiateSearch, initiateSearchFromProfile, hasCachedResult, loadCachedResult, reset } = useDeepSearch();
  
  const [formData, setFormData] = useState<UserAsk>({
    askType: "",
    intent: "",
    outcome: "",
    credibility: "",
    constraints: "",
  });
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);
  const [hasTriedLoad, setHasTriedLoad] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);

  // Check if we have enough info for auto-search
  const hasEnoughInfoForSearch = (): boolean => {
    // Check onboarding context first (new flow)
    if (onboardingContext?.lookingFor) return true;
    // Fallback to profile data
    if (userProfile?.looking_for) return true;
    return false;
  };

  // Auto-load cached result or trigger search from profile if enabled
  useEffect(() => {
    if (autoSearch && !hasTriedLoad && status === "idle") {
      setHasTriedLoad(true);
      
      if (hasEnoughInfoForSearch()) {
        // First try to load from cache
        const loaded = loadCachedResult(userProfile || {}, onboardingContext || undefined);
        if (!loaded) {
          // No cache - initiate new search
          initiateSearchFromProfile(userProfile || {}, onboardingContext || undefined);
        }
      } else {
        // Not enough info - show manual form
        setShowManualForm(true);
      }
    }
  }, [autoSearch, userProfile, hasTriedLoad, status, initiateSearchFromProfile, loadCachedResult, onboardingContext]);

  const handleSubmit = async () => {
    if (!formData.askType || !formData.intent) {
      toast({
        title: "Missing information",
        description: "Please select an ask type and describe what you're looking for",
        variant: "destructive",
      });
      return;
    }
    await initiateSearch(formData);
  };

  const handleNewSearch = () => {
    // Force new search (bypasses cooldown check in UI but API still has rate limits)
    if (cooldownRemaining) {
      toast({
        title: "Please wait",
        description: `You can search again in ${cooldownRemaining} hours`,
        variant: "destructive",
      });
      return;
    }
    setShowManualForm(true);
    reset();
  };

  const copyMessage = async (message: string, matchName: string) => {
    await navigator.clipboard.writeText(message);
    setCopiedMessage(matchName);
    toast({ title: "Copied!", description: "Message copied to clipboard" });
    setTimeout(() => setCopiedMessage(null), 2000);
  };

  if ((status === "idle" && (!autoSearch || showManualForm || !hasEnoughInfoForSearch())) || status === "error") {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-6"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Target className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Find Your Perfect Match</h2>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Tell us what you're looking for and we'll find the right people for you
          </p>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-center"
          >
            <p className="text-destructive text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={reset} className="mt-2">
              Try Again
            </Button>
          </motion.div>
        )}

        <div className="space-y-4">
          {/* Ask Type Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">What are you looking for?</label>
            <div className="grid grid-cols-2 gap-2">
              {ASK_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setFormData({ ...formData, askType: type.id })}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    formData.askType === type.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <span className="text-lg mr-2">{type.icon}</span>
                  <span className="text-sm font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Intent */}
          <div>
            <label className="text-sm font-medium mb-2 block">Describe your need</label>
            <Textarea
              placeholder="e.g., Looking for senior engineers with AI/ML experience who've worked at startups..."
              value={formData.intent}
              onChange={(e) => setFormData({ ...formData, intent: e.target.value })}
              className="min-h-[80px]"
            />
          </div>

          {/* Outcome */}
          <div>
            <label className="text-sm font-medium mb-2 block">Desired outcome</label>
            <Input
              placeholder="e.g., Get intro meetings with 3-5 qualified candidates"
              value={formData.outcome}
              onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
            />
          </div>

          {/* Credibility */}
          <div>
            <label className="text-sm font-medium mb-2 block">Your credibility (why should they talk to you?)</label>
            <Input
              placeholder="e.g., Series A startup, backed by top VCs, 10x growth"
              value={formData.credibility}
              onChange={(e) => setFormData({ ...formData, credibility: e.target.value })}
            />
          </div>

          {/* Constraints */}
          <div>
            <label className="text-sm font-medium mb-2 block">Any constraints? (optional)</label>
            <Input
              placeholder="e.g., Must be based in India, no agencies"
              value={formData.constraints}
              onChange={(e) => setFormData({ ...formData, constraints: e.target.value })}
            />
          </div>

          {/* Constraints */}
          <div>
            <label className="text-sm font-medium mb-2 block">Any constraints? (optional)</label>
            <Input
              placeholder="e.g., Must be based in SF, no agencies"
              value={formData.constraints}
              onChange={(e) => setFormData({ ...formData, constraints: e.target.value })}
            />
          </div>

          <Button 
            onClick={handleSubmit} 
            className="w-full" 
            size="lg"
            disabled={!formData.askType || !formData.intent}
          >
            <Search className="w-4 h-4 mr-2" />
            Find Matches
          </Button>
        </div>
      </div>
    );
  }

  if (status === "initiating" || status === "searching" || status === "processing") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative w-20 h-20 mx-auto mb-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              {status === "initiating" && <Search className="w-8 h-8 text-primary" />}
              {status === "searching" && <Users className="w-8 h-8 text-primary" />}
              {status === "processing" && <Sparkles className="w-8 h-8 text-primary" />}
            </div>
          </div>
          
          <h3 className="text-lg font-semibold mb-2">
            {status === "initiating" && "Starting search..."}
            {status === "searching" && "Searching LinkedIn..."}
            {status === "processing" && "Analyzing matches..."}
          </h3>
          
          <p className="text-muted-foreground text-sm mb-4">
            {status === "searching" && "This may take a few minutes"}
            {status === "processing" && "Finding the best connections for you"}
          </p>

          <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">{Math.round(progress)}%</p>
        </motion.div>
      </div>
    );
  }

  // Results view
  if (status === "complete" && result) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* User Context Summary */}
        {result.userContext && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-primary/5 border border-primary/20 rounded-xl p-4"
          >
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Your Profile Context
            </h3>
            <p className="text-sm text-muted-foreground">{result.userContext.userNarrative}</p>
            {result.userContext.extractedThesis && (
              <p className="text-sm mt-2">
                <span className="font-medium">Your thesis:</span> {result.userContext.extractedThesis}
              </p>
            )}
          </motion.div>
        )}

        {/* Note about external matches */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            💡 These are potential connections outside the ChekInn network. 
            We're also matching you with verified ChekInn members — expect that within 24 hours!
          </p>
        </div>

        {/* Matches */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Matches ({result.matches?.length || 0})</h3>
            {!cooldownRemaining ? (
              <Button variant="outline" size="sm" onClick={handleNewSearch}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                New Search
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">
                Next search in {cooldownRemaining}h
              </span>
            )}
          </div>

          <AnimatePresence>
            {result.matches?.map((match, index) => (
              <MatchCard
                key={match.name + index}
                match={match}
                index={index}
                copiedMessage={copiedMessage}
                onCopy={copyMessage}
              />
            ))}
          </AnimatePresence>

          {(!result.matches || result.matches.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No matches found. Try broadening your search criteria.</p>
            </div>
          )}
        </div>

        {result.reasoning && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            <strong>AI Reasoning:</strong> {result.reasoning}
          </div>
        )}
      </div>
    );
  }

  return null;
}

function MatchCard({ 
  match, 
  index, 
  copiedMessage, 
  onCopy 
}: { 
  match: Match; 
  index: number; 
  copiedMessage: string | null;
  onCopy: (message: string, name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="border rounded-xl overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            {match.matchType === "wildcard" ? (
              <Zap className="w-5 h-5 text-amber-500" />
            ) : (
              <Target className="w-5 h-5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold truncate">{match.name}</h4>
              {match.matchType === "wildcard" && (
                <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">
                  Wildcard
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                match.confidence === "high" ? "bg-green-500/10 text-green-600" :
                match.confidence === "medium" ? "bg-yellow-500/10 text-yellow-600" :
                "bg-gray-500/10 text-gray-600"
              }`}>
                {match.confidence}
              </span>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {match.title}{match.company && ` @ ${match.company}`}
            </p>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t pt-4">
              {/* Who they are */}
              <div>
                <h5 className="text-xs font-medium text-muted-foreground mb-1">WHO THEY ARE</h5>
                <p className="text-sm">{match.whoTheyAre}</p>
              </div>

              {/* Why this makes sense */}
              {match.whyThisMakesSense?.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-muted-foreground mb-1">WHY THIS MAKES SENSE</h5>
                  <ul className="text-sm space-y-1">
                    {match.whyThisMakesSense.map((reason, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Why you're relevant */}
              <div>
                <h5 className="text-xs font-medium text-muted-foreground mb-1">WHY YOU'RE RELEVANT TO THEM</h5>
                <p className="text-sm">{match.whyYoureRelevant}</p>
              </div>

              {/* Shared Ground */}
              {match.sharedGround && match.sharedGround.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-muted-foreground mb-1">SHARED GROUND</h5>
                  <div className="flex flex-wrap gap-2">
                    {match.sharedGround.map((item, i) => (
                      <span key={i} className="text-xs bg-muted px-2 py-1 rounded">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Outreach paths */}
              <div className="grid gap-3">
                {match.warmPath && (
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground mb-1">WARM PATH</h5>
                    <p className="text-sm">{match.warmPath}</p>
                  </div>
                )}
                {match.coldPath && (
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground mb-1">COLD OUTREACH ANGLE</h5>
                    <p className="text-sm">{match.coldPath}</p>
                  </div>
                )}
              </div>

              {/* Suggested Message */}
              {match.suggestedMessage && (
                <div>
                  <h5 className="text-xs font-medium text-muted-foreground mb-2">SUGGESTED DM</h5>
                  <div className="bg-muted rounded-lg p-3 text-sm relative">
                    {match.suggestedMessage}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={() => onCopy(match.suggestedMessage, match.name)}
                    >
                      {copiedMessage === match.name ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {match.linkedinUrl && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={match.linkedinUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Profile
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default MatchView;
