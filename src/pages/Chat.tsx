import { useState, useEffect, useRef, lazy, Suspense, memo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ArrowLeft, MessageCircle, Users, Clock, Sparkles, Mic, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

// Core components loaded eagerly for initial render
import IntroCard from "@/components/chat/IntroCard";
import LearningProgress from "@/components/chat/LearningProgress";

// Lazy load heavy components that aren't needed immediately
const UserChatView = lazy(() => import("@/components/chat/UserChatView"));
const UserProfileCard = lazy(() => import("@/components/chat/UserProfileCard"));
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

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-orchestrator`;

// Generate or get session ID
const getSessionId = () => {
  let sessionId = sessionStorage.getItem("chekinn_session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem("chekinn_session_id", sessionId);
  }
  return sessionId;
};

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
  
  const [introductions, setIntroductions] = useState<Introduction[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeChat, setActiveChat] = useState<Introduction | null>(null);
  const [view, setView] = useState<"chekinn" | "connections">("chekinn");
  const [learningComplete, setLearningComplete] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [sessionId] = useState(() => getSessionId());
  const evaluatedIntros = useRef<Set<string>>(new Set());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasTrackedPageLoad = useRef(false);
  const hasSentInitialMessage = useRef(false);
  const chatMessageCounts = useRef<Record<string, number>>({});

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  // Track chat page loaded
  useEffect(() => {
    if (!hasTrackedPageLoad.current && !authLoading && user) {
      hasTrackedPageLoad.current = true;
      trackEvent("chat_page_loaded" as any, { isAuthenticated: true });
    }
  }, [authLoading, user, trackEvent]);

  // Auto-send initial message from landing page
  useEffect(() => {
    if (!hasSentInitialMessage.current && !authLoading && user) {
      const initialMessage = sessionStorage.getItem("chekinn_initial_message");
      if (initialMessage) {
        hasSentInitialMessage.current = true;
        sessionStorage.removeItem("chekinn_initial_message");
        setTimeout(() => {
          handleSend(initialMessage);
        }, 500);
      }
    }
  }, [authLoading, user]);

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

  // Clear unread count when opening a chat
  const handleOpenChat = async (intro: Introduction) => {
    const { count } = await supabase
      .from("user_chats")
      .select("id", { count: "exact", head: true })
      .eq("introduction_id", intro.id);
    
    chatMessageCounts.current[intro.id] = count || 0;
    
    setActiveChat(intro);
    
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

  // Trigger P2P evaluation silently when closing a chat
  const prevActiveChat = useRef<Introduction | null>(null);
  useEffect(() => {
    if (prevActiveChat.current && !activeChat && user && introductions.length > 0) {
      const closedIntro = prevActiveChat.current;
      
      const triggerEvaluation = async () => {
        const { count: msgCount } = await supabase
          .from("user_chats")
          .select("id", { count: "exact", head: true })
          .eq("introduction_id", closedIntro.id);
        
        const hasEnoughMessages = (msgCount || 0) >= 5;
        
        if (hasEnoughMessages && !evaluatedIntros.current.has(closedIntro.id)) {
          evaluatedIntros.current.add(closedIntro.id);
          evaluateP2PChat(closedIntro.id, 'chat_end');
        }
        
        setTimeout(() => {
          checkInOnActiveIntros();
        }, 500);
      };
      
      triggerEvaluation();
    }
    prevActiveChat.current = activeChat;
  }, [activeChat, user, introductions]);

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
  }, [messages]);

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
      await sendBotMessage("Hey! A few quick questions and I'll find you the right person. What brings you here?");
    } else {
      setMessages(data as Message[]);
    }
    setLoading(false);
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

  // Check in on active intros when user comes back
  const checkInOnActiveIntros = async () => {
    if (!user) return;
    
    const activeIntrosToCheckIn = introductions.filter(
      intro => intro.status === "active" && !evaluatedIntros.current.has(intro.id)
    );
    
    if (activeIntrosToCheckIn.length > 0) {
      const intro = activeIntrosToCheckIn[0];
      evaluatedIntros.current.add(intro.id);
      const otherName = intro.other_user?.full_name || "them";
      
      const checkInMessages = [
        `Hey! How's it going with ${otherName}?`,
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
  
  // Check for proactive messages from the new architecture
  const checkProactiveMessage = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          userId: user.id,
          action: "check_proactive",
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.proactive_message) {
          console.log("[Chat] Received proactive message:", data.decision);
          await sendBotMessage(data.proactive_message);
        }
      }
    } catch (error) {
      console.error("[Chat] Error checking proactive message:", error);
    }
  }, [user]);
  
  // Check for proactive messages on load
  useEffect(() => {
    if (user && messages.length > 0) {
      // Check after a delay to not interrupt initial load
      const timer = setTimeout(() => {
        checkProactiveMessage();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user, checkProactiveMessage]);

  const getAIResponseStreaming = async (
    conversationHistory: { role: string; content: string }[],
    onDelta: (text: string) => void
  ): Promise<string | null> => {
    const lastUserMessage = conversationHistory[conversationHistory.length - 1]?.content;
    
    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          userId: user?.id || null,
          message: lastUserMessage,
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
        if (response.status === 402) {
          toast({
            title: "Usage limit",
            description: "AI usage limit reached. Please try again later.",
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
    if (!messageToSend || sending || !user) return;

    setSending(true);
    if (!messageOverride) setInput("");
    const userMessage = messageToSend;

    // Save to DB
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
      // Save final message to DB
      setMessages((prev) => prev.filter(m => m.id !== streamingMsgId));
      await sendBotMessage(aiResponse);
      
      // Track reputation silently
      trackReputationAction('message_sent');
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

  // Loading state
  if (authLoading || !user) {
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
      {/* Undercurrents - Reputation-gated feature */}
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

      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-lg">ChekInn</h1>
          <motion.button
            onClick={() => navigate("/reputation")}
            className="relative text-primary/80 hover:text-primary transition-colors"
            title="Reputation & Access"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
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
            <div className="absolute inset-0 rounded-full bg-primary/10 blur-sm" />
            <Shield className="w-5 h-5 relative z-10" />
          </motion.button>
        </div>
        
        {/* Tabs */}
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
      </header>

      {view === "chekinn" ? (
        <>
          {/* Learning Progress or Profile Card */}
          {learningComplete && userProfile ? (
            <Suspense fallback={<div className="h-20" />}>
              <UserProfileCard profile={userProfile} />
            </Suspense>
          ) : (
            <LearningProgress 
              messageCount={messages.filter(m => m.role === "user").length}
              learningComplete={learningComplete}
            />
          )}
          
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <AnimatePresence mode="popLayout">
              {messages.map((msg, index) => (
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
                  
                  {/* Template buttons after first AI message */}
                  {index === 0 && msg.role === "assistant" && messages.length === 1 && (
                    <div className="mt-3 animate-fade-in">
                      <div className="flex flex-wrap gap-1.5 max-w-[300px]">
                        {GENERAL_TEMPLATES.map((template) => (
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
            </AnimatePresence>

            {/* Pending Intro Cards */}
            {pendingIntros.map((intro) => (
              <IntroCard
                key={intro.id}
                introduction={intro}
                onAccept={() => handleAcceptIntro(intro)}
                onDecline={() => handleDeclineIntro(intro)}
              />
            ))}

            {/* Nudge when learning is complete but no intros yet */}
            {learningComplete && pendingIntros.length === 0 && activeIntros.length === 0 && (
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
                  We're working on finding the right person for you. You'll get a notification when we find someone — usually within 12 hours!
                </p>
              </motion.div>
            )}
            
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
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
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
                disabled={sending}
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
                  placeholder="Type a message..."
                  className="flex-1"
                  disabled={sending}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => voiceExperiment.switchInputMode("voice")}
                  disabled={sending}
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
                  disabled={!input.trim() || sending} 
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
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Active Connections */}
          {activeIntros.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Active Chats</h3>
              {activeIntros.map((intro) => (
                <motion.button
                  key={intro.id}
                  onClick={() => handleOpenChat(intro)}
                  className="w-full bg-card border border-border rounded-xl p-4 text-left hover:bg-muted/50 transition-colors"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-lg font-medium text-primary">
                        {intro.other_user?.full_name?.[0] || "?"}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{intro.other_user?.full_name || "Connection"}</p>
                      <p className="text-sm text-muted-foreground">{intro.other_user?.role || "Member"}</p>
                    </div>
                    {unreadCounts[intro.id] > 0 && (
                      <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                        {unreadCounts[intro.id]}
                      </span>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          )}

          {/* Waiting for Response */}
          {waitingIntros.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Waiting for Response</h3>
              {waitingIntros.map((intro) => (
                <div
                  key={intro.id}
                  className="bg-card border border-border rounded-xl p-4 opacity-70"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <Clock className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{intro.other_user?.full_name || "Connection"}</p>
                      <p className="text-sm text-muted-foreground">Waiting for them to accept...</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {activeIntros.length === 0 && waitingIntros.length === 0 && pendingIntros.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Users className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-foreground mb-2">No connections yet</h3>
              <p className="text-sm text-muted-foreground">
                Keep chatting with ChekInn and we'll introduce you to the right people.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Chat;
