import { useState, useEffect, useRef, lazy, Suspense, memo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ArrowLeft, MessageCircle, Users, Clock, Sparkles, Mic, Keyboard, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

// Core components loaded eagerly for initial render
import IntroCard from "@/components/chat/IntroCard";
import LearningProgress from "@/components/chat/LearningProgress";

// Lazy load heavy components that aren't needed immediately
const UserChatView = lazy(() => import("@/components/chat/UserChatView"));
const OnboardingOverlay = lazy(() => import("@/components/chat/OnboardingOverlay"));
const UserProfileCard = lazy(() => import("@/components/chat/UserProfileCard"));
const SaveProgressNudge = lazy(() => import("@/components/chat/SaveProgressNudge"));
const WhatsAppCommunityNudge = lazy(() => import("@/components/chat/WhatsAppCommunityNudge"));
const VoiceInput = lazy(() => import("@/components/chat/VoiceInput"));

// Lazy load undercurrents - only needed for authenticated users with access
const UndercurrentCard = lazy(() => import("@/components/undercurrents/UndercurrentCard").then(m => ({ default: m.UndercurrentCard })));
const UndercurrentsFirstAccess = lazy(() => import("@/components/undercurrents/UndercurrentCard").then(m => ({ default: m.UndercurrentsFirstAccess })));
const UndercurrentsIndicator = lazy(() => import("@/components/undercurrents/UndercurrentCard").then(m => ({ default: m.UndercurrentsIndicator })));

import { useFunnelTracking } from "@/hooks/useFunnelTracking";
import { useVoiceInput, InputMode } from "@/hooks/useVoiceExperiment";
import { useUndercurrents } from "@/hooks/useUndercurrents";
import { trackReputationAction, evaluateP2PChat } from "@/lib/undercurrents";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  message_type: string;
  metadata: any;
  created_at: string;
}

interface Introduction {
  id: string;
  user_a_id: string;
  user_b_id: string;
  intro_message: string;
  status: string;
  user_a_accepted: boolean;
  user_b_accepted: boolean;
  created_at: string;
  other_user?: {
    full_name: string;
    avatar_url: string;
    bio: string;
    role: string;
  };
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-ai`;

// Nudge thresholds - adjusted for exam prep users who have faster AI transitions
const getLoginNudgeThreshold = () => isUPSCSource() || isCATSource() ? 3 : 5;
const getSaveProgressThreshold = () => isUPSCSource() || isCATSource() ? 2 : 3;

// Generate or get session ID for anonymous users
const getSessionId = () => {
  let sessionId = sessionStorage.getItem("chekinn_session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem("chekinn_session_id", sessionId);
  }
  return sessionId;
};

// Get source for cohort-specific experience
const getSource = () => sessionStorage.getItem("chekinn_source") || "";
const isUPSCSource = () => getSource() === "upsc";
const isCATSource = () => getSource() === "cat";

// UPSC-specific templates
const UPSC_TEMPLATES = [
  "Where do I even start?",
  "How to pick my optional?",
  "Stuck with answer writing",
  "Need mentor guidance",
  "Prelims anxiety",
  "Interview prep help",
];

// CAT/MBA-specific templates
const CAT_TEMPLATES = [
  "CAT didn't go well",
  "Gap year concerns",
  "Which IIMs to target?",
  "Need mock interview",
  "Profile evaluation",
  "Career track anxiety",
];

// General templates
const GENERAL_TEMPLATES = [
  "Prep for an interview",
  "Explore a career",
  "Break into tech",
  "Get some advice",
  "Find co-builder",
  "Get me referral in job",
];

const Chat = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { trackEvent } = useFunnelTracking();
  
  // Voice input
  const voiceExperiment = useVoiceInput();
  
  // Undercurrents (reputation-gated feature)
  const undercurrents = useUndercurrents();
  const [showUndercurrent, setShowUndercurrent] = useState(false);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [source] = useState(() => getSource());
  const isUPSC = source === "upsc";
  const isCAT = source === "cat";
  
  const [localMessages, setLocalMessages] = useState<Message[]>(() => [{
    id: `local-${Date.now()}`,
    role: "assistant" as const,
    content: isUPSCSource() 
      ? "Hey! I know the UPSC journey can feel overwhelming. Tell me what you're struggling with — I'll connect you with someone who's been through it."
      : isCATSource()
      ? "Hey! CAT prep can be intense. Tell me what's on your mind — I'll connect you with someone who's been through it."
      : "Hey! A few quick questions and I'll find you the right person. What brings you here?",
    message_type: "text",
    metadata: {},
    created_at: new Date().toISOString(),
  }]); // Pre-populate for instant load
  const [introductions, setIntroductions] = useState<Introduction[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false); // Start false for instant render
  const [sending, setSending] = useState(false);
  const [activeChat, setActiveChat] = useState<Introduction | null>(null);
  const [view, setView] = useState<"chekinn" | "connections">("chekinn");
  const [learningComplete, setLearningComplete] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showLoginNudge, setShowLoginNudge] = useState(false);
  const [showSaveProgress, setShowSaveProgress] = useState(false);
  const [sessionId] = useState(() => getSessionId());
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWACommunity, setShowWACommunity] = useState(false);
  const evaluatedIntros = useRef<Set<string>>(new Set());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasTrackedPageLoad = useRef(false);
  const hasSentInitialMessage = useRef(false);
  const hasShownSaveProgress = useRef(false);
  const chatMessageCounts = useRef<Record<string, number>>({}); // Track message counts per intro

  const handleOnboardingComplete = () => {
    sessionStorage.setItem("chekinn_onboarding_seen", "true");
    setShowOnboarding(false);
  };

  // Track chat page loaded
  useEffect(() => {
    if (!hasTrackedPageLoad.current && !authLoading) {
      hasTrackedPageLoad.current = true;
      trackEvent("chat_page_loaded" as any, { isAuthenticated: !!user });
    }
  }, [authLoading, user, trackEvent]);

  // Auto-send initial message from variant C landing page
  useEffect(() => {
    if (!hasSentInitialMessage.current && !authLoading) {
      const initialMessage = sessionStorage.getItem("chekinn_initial_message");
      if (initialMessage) {
        hasSentInitialMessage.current = true;
        sessionStorage.removeItem("chekinn_initial_message");
        // Small delay to ensure chat is ready
        setTimeout(() => {
          handleSend(initialMessage);
        }, 500);
      }
    }
  }, [authLoading]);

  // Get the active messages list based on auth state
  const activeMessages = user ? messages : localMessages;

  // Anonymous user: already has message pre-populated, no action needed
  // Authenticated user loading is handled separately

  // Authenticated user: load from DB
  useEffect(() => {
    if (user) {
      loadMessages();
      loadIntroductions();
      subscribeToMessages();
      checkLearningStatus();
      loadUnreadCounts();
      subscribeToUserChats();
      loadEvaluatedStatus();
    }
  }, [user]);

  // Load evaluated intro status for returning users
  const loadEvaluatedStatus = async () => {
    if (!user) return;
    
    // Mark already-evaluated intros so we don't evaluate again
    const { data, error } = await supabase
      .from("chat_debriefs")
      .select("id, introduction_id")
      .eq("user_id", user.id);
    
    if (!error && data && data.length > 0) {
      data.forEach((d) => evaluatedIntros.current.add(d.introduction_id));
    }
  };

  // Load unread message counts for each introduction
  const loadUnreadCounts = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("user_chats")
      .select("introduction_id")
      .eq("receiver_id", user.id)
      .eq("read", false);
    
    if (error) {
      console.error("Error loading unread counts:", error);
      return;
    }
    
    const counts: Record<string, number> = {};
    data?.forEach(msg => {
      counts[msg.introduction_id] = (counts[msg.introduction_id] || 0) + 1;
    });
    setUnreadCounts(counts);
  };

  // Subscribe to new messages in user chats
  const subscribeToUserChats = () => {
    if (!user) return;
    
    const channel = supabase
      .channel("user-chats-unread")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_chats",
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          const introId = payload.new.introduction_id;
          // Only increment if not in active chat for that intro
          if (!activeChat || activeChat.id !== introId) {
            setUnreadCounts(prev => ({
              ...prev,
              [introId]: (prev[introId] || 0) + 1
            }));
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  };

  // Clear unread count when opening a chat and track message count
  const handleOpenChat = async (intro: Introduction) => {
    // Store current message count before entering chat
    const { count } = await supabase
      .from("user_chats")
      .select("id", { count: "exact", head: true })
      .eq("introduction_id", intro.id);
    
    chatMessageCounts.current[intro.id] = count || 0;
    
    setActiveChat(intro);
    
    // Mark messages as read
    if (user) {
      await supabase
        .from("user_chats")
        .update({ read: true })
        .eq("introduction_id", intro.id)
        .eq("receiver_id", user.id)
        .eq("read", false);
      
      setUnreadCounts(prev => ({
        ...prev,
        [intro.id]: 0
      }));
    }
  };

  // Trigger P2P evaluation silently when closing a chat (no user feedback)
  const prevActiveChat = useRef<Introduction | null>(null);
  useEffect(() => {
    // If user just closed a user-to-user chat (activeChat went from something to null)
    if (prevActiveChat.current && !activeChat && user && introductions.length > 0) {
      const closedIntro = prevActiveChat.current;
      
      // Silently evaluate P2P chat for reputation (no user feedback needed)
      const triggerEvaluation = async () => {
        // Check current message count
        const { count: msgCount } = await supabase
          .from("user_chats")
          .select("id", { count: "exact", head: true })
          .eq("introduction_id", closedIntro.id);
        
        const hasEnoughMessages = (msgCount || 0) >= 5; // At least 5 messages for meaningful evaluation
        
        // Only evaluate if: has enough messages and hasn't been evaluated yet
        if (hasEnoughMessages && !evaluatedIntros.current.has(closedIntro.id)) {
          evaluatedIntros.current.add(closedIntro.id);
          // Trigger P2P reputation evaluation silently in background
          evaluateP2PChat(closedIntro.id, 'chat_end');
        }
        
        // Do the regular check-in
        setTimeout(() => {
          checkInOnActiveIntros();
        }, 500);
      };
      
      triggerEvaluation();
    }
    prevActiveChat.current = activeChat;
  }, [activeChat, user, introductions]);

  // Check if we should show save progress nudge or login nudge (thresholds adjust for UPSC/CAT)
  const variant = sessionStorage.getItem("ab_variant");
  useEffect(() => {
    if (!user && variant !== "C") {
      const userMsgCount = localMessages.filter(m => m.role === "user").length;
      const saveThreshold = getSaveProgressThreshold();
      const loginThreshold = getLoginNudgeThreshold();
      
      // Show save progress nudge (mid-conversation)
      if (userMsgCount >= saveThreshold && !hasShownSaveProgress.current) {
        hasShownSaveProgress.current = true;
        setShowSaveProgress(true);
        trackEvent("save_progress_shown" as any);
      }
      
      // Show login nudge (blocks further input)
      if (userMsgCount >= loginThreshold) {
        setShowLoginNudge(true);
      }
    }
  }, [localMessages, user, variant, trackEvent]);

  // Save anonymous chat to leads table
  const saveLeadToDb = async (msgs: Message[]) => {
    try {
      const messagesForDb = msgs.map(m => ({
        role: m.role,
        content: m.content,
        created_at: m.created_at,
      }));

      // Check if lead already exists
      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .eq("session_id", sessionId)
        .maybeSingle();

      if (existing) {
        // Update existing lead
        await supabase
          .from("leads")
          .update({ messages: messagesForDb })
          .eq("session_id", sessionId);
      } else {
        // Insert new lead
        await supabase
          .from("leads")
          .insert({
            session_id: sessionId,
            messages: messagesForDb,
          });
      }
    } catch (error) {
      console.error("Error saving lead:", error);
    }
  };


  const checkLearningStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("learning_complete, full_name, role, industry, looking_for, skills, interests, ai_insights")
      .eq("id", user.id)
      .maybeSingle();
    
    if (data?.learning_complete) {
      setLearningComplete(true);
      setUserProfile(data);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages]);

  const loadMessages = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading messages:", error);
      return;
    }

    if (data.length === 0) {
      // Check if we have local messages to migrate
      if (localMessages.length > 0) {
        await migrateLocalMessages();
      } else {
        // Send welcome message for new authenticated users
        await sendBotMessage("Hey! A few quick questions and I'll find you the right person. What brings you here?");
      }
    } else {
      setMessages(data as Message[]);
    }
    setLoading(false);
  };

  const migrateLocalMessages = async () => {
    if (!user || localMessages.length === 0) return;
    
    // Save all local messages to DB
    for (const msg of localMessages) {
      await supabase.from("chat_messages").insert({
        user_id: user.id,
        role: msg.role,
        content: msg.content,
        message_type: msg.message_type,
        metadata: msg.metadata,
      });
    }

    // Link lead to user (mark as converted)
    await supabase
      .from("leads")
      .update({ 
        user_id: user.id, 
        converted_at: new Date().toISOString() 
      })
      .eq("session_id", sessionId);
    
    // Reload from DB
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    
    if (data) {
      setMessages(data as Message[]);
    }
    setLocalMessages([]);
    setShowLoginNudge(false);
  };

  const loadIntroductions = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("introductions")
      .select("*")
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading introductions:", error);
      return;
    }

    // Fetch other user profiles
    const introsWithProfiles = await Promise.all(
      (data || []).map(async (intro) => {
        const otherUserId = intro.user_a_id === user.id ? intro.user_b_id : intro.user_a_id;
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, avatar_url, bio, role")
          .eq("id", otherUserId)
          .maybeSingle();
        
        return { ...intro, other_user: profile };
      })
    );

    setIntroductions(introsWithProfiles as Introduction[]);
  };

  // Check in on active intros when user comes back to ChekInn chat
  const checkInOnActiveIntros = async () => {
    if (!user) return;
    
    // Find active intros we haven't checked in on
    const activeIntrosToCheckIn = introductions.filter(
      intro => intro.status === "active" && !evaluatedIntros.current.has(intro.id)
    );
    
    if (activeIntrosToCheckIn.length > 0) {
      const intro = activeIntrosToCheckIn[0];
      evaluatedIntros.current.add(intro.id);
      const otherName = intro.other_user?.full_name || "them";
      
      const checkInMessages = [
        `Hey! How's it going with ${otherName}? 👀`,
        `So... how's the chat with ${otherName} going?`,
        `Quick check-in — how's ${otherName}? Getting good vibes?`,
      ];
      const randomMessage = checkInMessages[Math.floor(Math.random() * checkInMessages.length)];
      
      await sendBotMessage(randomMessage);
    }
  };

  const subscribeToMessages = () => {
    if (!user) return;

    const channel = supabase
      .channel("chat-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === payload.new.id);
            if (exists) return prev;
            return [...prev, payload.new as Message];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "introductions",
        },
        () => {
          loadIntroductions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendBotMessage = async (content: string, messageType = "text", metadata = {}) => {
    if (!user) return;

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        user_id: user.id,
        role: "assistant",
        content,
        message_type: messageType,
        metadata,
      })
      .select()
      .single();

    if (error) {
      console.error("Error sending bot message:", error);
      return;
    }

    setMessages((prev) => [...prev, data as Message]);
  };

  // Track if this is first message of current session
  const isFirstMessageOfSessionRef = useRef(true);
  
  const getAIResponseStreaming = async (
    conversationHistory: { role: string; content: string }[],
    onDelta: (text: string) => void
  ): Promise<string | null> => {
    // Check if user is returning (has existing messages in DB)
    const isReturningUser = user && messages.length > 0;
    // Check if they have pending or active intros
    const hasPendingIntros = introductions.some(i => 
      i.status === "pending" || 
      i.status === "accepted_a" || 
      i.status === "accepted_b" ||
      i.status === "active"
    );
    const isFirstMessageOfSession = isFirstMessageOfSessionRef.current;
    
    // Mark that we've sent first message
    if (isFirstMessageOfSession) {
      isFirstMessageOfSessionRef.current = false;
    }
    
    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: conversationHistory,
          userId: user?.id || null,
          isAuthenticated: !!user,
          source: sessionStorage.getItem("chekinn_source") || undefined,
          isReturningUser,
          isFirstMessageOfSession,
          hasPendingIntros,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast({
            title: "Please wait",
            description: "Too many messages. Try again in a moment.",
            variant: "destructive",
          });
          return null;
        }
        throw new Error("AI request failed");
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullMessage = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullMessage += content;
              onDelta(content);
            }
          } catch {
            // Incomplete JSON, skip
          }
        }
      }

      return fullMessage || null;
    } catch (error) {
      console.error("AI error:", error);
      toast({
        title: "Connection issue",
        description: "Couldn't reach ChekInn AI. Please try again.",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleSend = async (messageOverride?: string) => {
    const messageToSend = messageOverride || input.trim();
    if (!messageToSend || sending) return;

    // If showing login nudge, don't allow more messages
    if (showLoginNudge && !user) {
      toast({
        title: "Quick step needed",
        description: "Sign up to continue and get your introductions!",
      });
      return;
    }

    setSending(true);
    if (!messageOverride) setInput("");
    const userMessage = messageToSend;

    if (user) {
      // Authenticated: save to DB
      const { data: newMsg, error } = await supabase
        .from("chat_messages")
        .insert({
          user_id: user.id,
          role: "user",
          content: userMessage,
          message_type: "text",
        })
        .select()
        .single();

      if (error) {
        console.error("Error sending message:", error);
        setSending(false);
        return;
      }

      setMessages((prev) => [...prev, newMsg as Message]);

      const conversationHistory = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userMessage },
      ];

      // Stream the AI response
      let streamingContent = "";
      const streamingMsgId = `streaming-${Date.now()}`;
      
      const aiResponse = await getAIResponseStreaming(conversationHistory, (delta) => {
        streamingContent += delta;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.id === streamingMsgId) {
            return prev.map((m, i) => 
              i === prev.length - 1 ? { ...m, content: streamingContent } : m
            );
          }
          return [...prev, {
            id: streamingMsgId,
            role: "assistant" as const,
            content: streamingContent,
            message_type: "text",
            metadata: {},
            created_at: new Date().toISOString(),
          }];
        });
      });
      
      if (aiResponse) {
        // Save final message to DB (replace streaming placeholder)
        setMessages((prev) => prev.filter(m => m.id !== streamingMsgId));
        await sendBotMessage(aiResponse);
        
        // Track reputation silently
        trackReputationAction('message_sent');
      }
    } else {
      // Anonymous: store locally
      const newMsg: Message = {
        id: `local-${Date.now()}`,
        role: "user",
        content: userMessage,
        message_type: "text",
        metadata: {},
        created_at: new Date().toISOString(),
      };

      // Show user message immediately
      setLocalMessages((prev) => [...prev, newMsg]);

      const conversationHistory = [
        ...localMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userMessage },
      ];

      // Stream the AI response for anonymous users
      let streamingContent = "";
      const streamingMsgId = `local-streaming-${Date.now()}`;
      
      const aiResponse = await getAIResponseStreaming(conversationHistory, (delta) => {
        streamingContent += delta;
        setLocalMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.id === streamingMsgId) {
            return prev.map((m, i) => 
              i === prev.length - 1 ? { ...m, content: streamingContent } : m
            );
          }
          return [...prev, {
            id: streamingMsgId,
            role: "assistant" as const,
            content: streamingContent,
            message_type: "text",
            metadata: {},
            created_at: new Date().toISOString(),
          }];
        });
      });
      
      if (aiResponse) {
        // Replace streaming message with final
        setLocalMessages((prev) => {
          const filtered = prev.filter(m => m.id !== streamingMsgId);
          const botMsg: Message = {
            id: `local-${Date.now() + 1}`,
            role: "assistant",
            content: aiResponse,
            message_type: "text",
            metadata: {},
            created_at: new Date().toISOString(),
          };
          return [...filtered, botMsg];
        });
        // Save to leads table after every message exchange
        saveLeadToDb([...localMessages, newMsg, { id: '', role: 'assistant', content: aiResponse, message_type: 'text', metadata: {}, created_at: new Date().toISOString() }]);
      } else {
        // Still save even if AI fails
        saveLeadToDb([...localMessages, newMsg]);
      }
    }
    
    setSending(false);
  };

  const handleAcceptIntro = async (intro: Introduction) => {
    if (!user) return;

    const isUserA = intro.user_a_id === user.id;
    const bothAccepted = isUserA ? intro.user_b_accepted : intro.user_a_accepted;

    const updates: Record<string, any> = isUserA 
      ? { user_a_accepted: true } 
      : { user_b_accepted: true };

    if (bothAccepted) {
      updates.status = "active";
    } else {
      updates.status = isUserA ? "accepted_a" : "accepted_b";
    }

    await supabase
      .from("introductions")
      .update(updates)
      .eq("id", intro.id);

    loadIntroductions();
  };

  const handleDeclineIntro = async (intro: Introduction) => {
    await supabase
      .from("introductions")
      .update({ status: "declined" })
      .eq("id", intro.id);

    loadIntroductions();
  };

  const pendingIntros = introductions.filter(
    (i) => i.status === "pending" || 
    (i.status === "accepted_a" && i.user_b_id === user?.id) ||
    (i.status === "accepted_b" && i.user_a_id === user?.id)
  );

  const waitingIntros = introductions.filter(
    (i) => (i.status === "accepted_a" && i.user_a_id === user?.id) ||
           (i.status === "accepted_b" && i.user_b_id === user?.id)
  );

  const activeIntros = introductions.filter((i) => i.status === "active");

  // Only show loading for authenticated users who are still loading data
  if (user && loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (activeChat) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <UserChatView 
          introduction={activeChat} 
          onBack={() => setActiveChat(null)} 
        />
      </Suspense>
    );
  }


  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      {/* Undercurrents - Reputation-gated feature (lazy loaded) */}
      <Suspense fallback={null}>
        <AnimatePresence>
          {undercurrents.isFirstAccess && (
            <UndercurrentsFirstAccess onDismiss={undercurrents.dismissFirstAccess} />
          )}
        </AnimatePresence>
        
        <AnimatePresence>
          {showUndercurrent && undercurrents.currentUndercurrent && (
            <UndercurrentCard
              undercurrent={undercurrents.currentUndercurrent}
              prompt={undercurrents.currentPrompt}
              onSubmitResponse={undercurrents.submitResponse}
              onDismiss={() => setShowUndercurrent(false)}
            />
          )}
        </AnimatePresence>
        
        {undercurrents.hasAccess && undercurrents.canReceiveNew && !showUndercurrent && (
          <UndercurrentsIndicator
            canReceiveNew={undercurrents.canReceiveNew}
            onClick={() => {
              undercurrents.fetchNewUndercurrent();
              setShowUndercurrent(true);
            }}
          />
        )}
      </Suspense>


      {/* Onboarding overlay for new users (lazy loaded) */}
      <Suspense fallback={null}>
        <AnimatePresence>
          {showOnboarding && (
            <OnboardingOverlay onStart={handleOnboardingComplete} />
          )}
        </AnimatePresence>
      </Suspense>

      {/* Login nudge banner for non-authenticated users */}
      {!user && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary text-primary-foreground px-4 py-2.5 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4" />
            <span className="font-medium">Sign up to get matched with the right person</span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate("/auth")}
            className="text-xs font-semibold px-4 h-7"
          >
            Sign up
          </Button>
        </motion.div>
      )}

      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-lg">ChekInn</h1>
          {user ? (
            <motion.button
              onClick={() => navigate("/reputation")}
              className="relative text-primary/80 hover:text-primary transition-colors"
              title="Reputation & Access"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              {/* Shimmer ring */}
              <motion.div
                className="absolute inset-0 rounded-full bg-primary/20"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 0, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-full bg-primary/10 blur-sm" />
              <Shield className="w-5 h-5 relative z-10" />
            </motion.button>
          ) : (
            <div className="w-5" />
          )}
        </div>
        
        {/* Tabs - only show for authenticated users */}
        {user && (
          <div className="flex border-t border-border">
            <button
              onClick={() => setView("chekinn")}
              className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                view === "chekinn" 
                  ? "text-primary border-b-2 border-primary" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              Chat with ChekInn
            </button>
            <button
              onClick={() => setView("connections")}
              className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                view === "connections" 
                  ? "text-primary border-b-2 border-primary" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="w-4 h-4" />
              Connections
              {activeIntros.length > 0 && (
                <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                  {activeIntros.length}
                </span>
              )}
            </button>
          </div>
        )}
      </header>

      {view === "chekinn" || !user ? (
        <>
          {/* Learning Progress or Profile Card */}
          {learningComplete && userProfile ? (
            <Suspense fallback={<div className="h-20" />}>
              <UserProfileCard profile={userProfile} />
            </Suspense>
          ) : (
            <LearningProgress 
              messageCount={activeMessages.filter(m => m.role === "user").length}
              learningComplete={learningComplete}
            />
          )}
          
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            <AnimatePresence mode="popLayout">
              {activeMessages.map((msg, index) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.content}
                  </div>
                  
                  {/* Inline Sign Up button when AI prompts to create account */}
                  {msg.role === "assistant" && !user && msg.content.toLowerCase().includes("create account") && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2"
                    >
                      <Button
                        onClick={() => navigate("/auth")}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 py-2 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
                      >
                        Create Account (30 sec) →
                      </Button>
                    </motion.div>
                  )}
                  
                  {/* Template buttons after first AI message */}
                  {index === 0 && msg.role === "assistant" && activeMessages.length === 1 && (
                    <div className="mt-3 animate-fade-in">
                      {/* Template buttons - different for UPSC/CAT */}
                      <div className="flex flex-wrap gap-1.5 max-w-[300px]">
                        {(isUPSC ? UPSC_TEMPLATES : isCAT ? CAT_TEMPLATES : GENERAL_TEMPLATES).map((template) => (
                          <button
                            key={template}
                            onClick={() => handleSend(template)}
                            disabled={sending}
                            className="text-xs px-3 py-1.5 rounded-full border border-primary/40 bg-primary/10 hover:bg-primary/20 transition-all text-primary font-medium hover:scale-105 hover:shadow-sm disabled:opacity-50"
                          >
                            {template}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Progress Indicator - DISABLED for now */}

              {/* Save Progress Nudge - shown after 3 messages (mid-conversation) */}
              {showSaveProgress && !user && !showLoginNudge && (
                <SaveProgressNudge
                  onDismiss={() => {
                    setShowSaveProgress(false);
                    // Show WA community nudge after dismissing save progress (for UPSC/CAT users)
                    if (isUPSC || isCAT) {
                      setTimeout(() => setShowWACommunity(true), 500);
                    }
                  }}
                />
              )}

              {/* WhatsApp Community Nudge - shown after save progress is dismissed */}
              {showWACommunity && !user && !showLoginNudge && (isUPSC || isCAT) && (
                <WhatsAppCommunityNudge
                  onDismiss={() => setShowWACommunity(false)}
                />
              )}

              {/* Login Nudge for Anonymous Users - shown after 5 messages */}
              {showLoginNudge && !user && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="bg-gradient-to-br from-primary/10 to-primary/20 border border-primary/30 rounded-2xl p-5"
                >
                  <div className="flex items-center gap-2 text-primary mb-3">
                    <Sparkles className="w-5 h-5" />
                    <span className="font-semibold text-sm">Ready to find your intros!</span>
                  </div>
                  
                  <p className="text-foreground mb-4">
                    I've learned enough about you. Quick signup so I can save your profile and find the right connections for you.
                  </p>
                  
                  <Button 
                    onClick={() => navigate("/auth")} 
                    className="w-full"
                    size="lg"
                  >
                    Continue with Email →
                  </Button>
                  
                  <p className="text-xs text-muted-foreground text-center mt-3">
                    Takes 30 seconds • Your conversation is saved
                  </p>
                </motion.div>
              )}

              {/* Pending Intro Cards - only for authenticated users */}
              {user && pendingIntros.map((intro) => (
                <IntroCard
                  key={intro.id}
                  introduction={intro}
                  onAccept={() => handleAcceptIntro(intro)}
                  onDecline={() => handleDeclineIntro(intro)}
                />
              ))}

              {/* Nudge when learning is complete but no intros yet */}
              {user && learningComplete && pendingIntros.length === 0 && activeIntros.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-primary/10 border border-primary/20 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <p className="text-sm text-foreground font-medium">
                      Finding your match...
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    We're working on finding the right person for you. You'll get an email + it'll show up right here — usually within 12 hours!
                  </p>
                  
                  {/* WA Community nudge for UPSC/CAT users waiting for match */}
                  {(isUPSC || isCAT) && (
                    <WhatsAppCommunityNudge
                      variant="compact"
                      onDismiss={() => {}}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            
            {sending && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-1">
                  <motion.span
                    className="w-2 h-2 bg-muted-foreground/60 rounded-full"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                  />
                  <motion.span
                    className="w-2 h-2 bg-muted-foreground/60 rounded-full"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
                  />
                  <motion.span
                    className="w-2 h-2 bg-muted-foreground/60 rounded-full"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
                  />
                </div>
              </motion.div>
            )}
          </div>

          {/* Input - Voice or Text based on experiment variant */}
          {voiceExperiment.currentInputMode === "voice" || voiceExperiment.isRecording ? (
            <Suspense fallback={<div className="border-t border-border p-4 h-20" />}>
              <VoiceInput
                isRecording={voiceExperiment.isRecording}
                recordingDuration={voiceExperiment.recordingDuration}
                audioLevel={voiceExperiment.audioLevel}
                onStartRecording={voiceExperiment.startRecording}
                onStopRecording={voiceExperiment.stopRecording}
                onCancelRecording={voiceExperiment.cancelRecording}
                onSwitchToText={() => voiceExperiment.switchInputMode("text")}
                onTranscriptReady={(text) => {
                  voiceExperiment.trackMessageSent("voice", voiceExperiment.recordingDuration);
                  handleSend(text);
                }}
                disabled={sending || (showLoginNudge && !user)}
              />
            </Suspense>
          ) : (
            <div className="border-t border-border p-4 bg-background">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      voiceExperiment.trackMessageSent("text");
                      handleSend();
                    }
                  }}
                  placeholder={showLoginNudge && !user ? "Sign up to continue..." : "Type a message..."}
                  className="flex-1"
                  disabled={sending || (showLoginNudge && !user)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => voiceExperiment.switchInputMode("voice")}
                  disabled={sending || (showLoginNudge && !user)}
                  className="text-muted-foreground hover:text-primary"
                  title="Use voice instead"
                >
                  <Mic className="w-4 h-4" />
                </Button>
                <Button 
                  onClick={() => {
                    voiceExperiment.trackMessageSent("text");
                    handleSend();
                  }} 
                  disabled={!input.trim() || sending || (showLoginNudge && !user)} 
                  size="icon"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Connections View */
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Waiting for acceptance */}
          {waitingIntros.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Waiting for acceptance
              </h3>
              {waitingIntros.map((intro) => (
                <div
                  key={intro.id}
                  className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-600 font-semibold">
                      {intro.other_user?.full_name?.charAt(0) || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">
                        {intro.other_user?.full_name || "Someone"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Waiting for them to accept...
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Active connections */}
          {activeIntros.length === 0 && waitingIntros.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No active connections yet</p>
              <p className="text-sm mt-1">Keep chatting with ChekInn to get matched!</p>
            </div>
          ) : activeIntros.length > 0 ? (
            <div className="space-y-3">
              {waitingIntros.length > 0 && (
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Active chats
                </h3>
              )}
              {activeIntros.map((intro) => (
                <button
                  key={intro.id}
                  onClick={() => handleOpenChat(intro)}
                  className="w-full p-4 bg-card border border-border rounded-xl text-left hover:bg-muted/50 transition-colors relative"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold relative">
                      {intro.other_user?.full_name?.charAt(0) || "?"}
                      {unreadCounts[intro.id] > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center">
                          {unreadCounts[intro.id] > 9 ? "9+" : unreadCounts[intro.id]}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-medium truncate ${unreadCounts[intro.id] > 0 ? "font-semibold" : ""}`}>
                        {intro.other_user?.full_name || "Anonymous"}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {intro.other_user?.role || "ChekInn member"}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}

    </div>
  );
};

export default Chat;
