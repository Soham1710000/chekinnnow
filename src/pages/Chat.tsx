import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ArrowLeft, MessageCircle, Users, Clock, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import IntroCard from "@/components/chat/IntroCard";
import UserChatView from "@/components/chat/UserChatView";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";

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
const LOGIN_NUDGE_THRESHOLD = 5;

// Generate or get session ID for anonymous users
const getSessionId = () => {
  let sessionId = sessionStorage.getItem("chekinn_session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem("chekinn_session_id", sessionId);
  }
  return sessionId;
};

const Chat = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { trackEvent } = useFunnelTracking();
  const [messages, setMessages] = useState<Message[]>([]);
  const [localMessages, setLocalMessages] = useState<Message[]>(() => [{
    id: `local-${Date.now()}`,
    role: "assistant" as const,
    content: "Hey! Tell me a bit about yourself and who you'd like to meet — I'll find the right person and make the intro for you.",
    message_type: "text",
    metadata: {},
    created_at: new Date().toISOString(),
  }]); // Pre-populate for instant load
  const [introductions, setIntroductions] = useState<Introduction[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false); // Start false for instant render
  const [sending, setSending] = useState(false);
  const [activeChat, setActiveChat] = useState<Introduction | null>(null);
  const [view, setView] = useState<"chekinn" | "connections">("chekinn");
  const [learningComplete, setLearningComplete] = useState(false);
  const [showLoginNudge, setShowLoginNudge] = useState(false);
  const [sessionId] = useState(() => getSessionId());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasTrackedPageLoad = useRef(false);

  // Track chat page loaded
  useEffect(() => {
    if (!hasTrackedPageLoad.current && !authLoading) {
      hasTrackedPageLoad.current = true;
      trackEvent("chat_page_loaded" as any, { isAuthenticated: !!user });
    }
  }, [authLoading, user, trackEvent]);

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
    }
  }, [user]);

  // Check if we should show login nudge for anonymous users
  useEffect(() => {
    if (!user) {
      const userMsgCount = localMessages.filter(m => m.role === "user").length;
      if (userMsgCount >= LOGIN_NUDGE_THRESHOLD) {
        setShowLoginNudge(true);
      }
    }
  }, [localMessages, user]);

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
      .select("learning_complete")
      .eq("id", user.id)
      .maybeSingle();
    
    if (data?.learning_complete) {
      setLearningComplete(true);
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
        // Start conversation with AI
        const welcomeMessage = await getAIResponse([]);
        if (welcomeMessage) {
          await sendBotMessage(welcomeMessage);
        }
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

  const getAIResponse = async (conversationHistory: { role: string; content: string }[]) => {
    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: conversationHistory,
          userId: user?.id || null, // null for anonymous
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429) {
          toast({
            title: "Please wait",
            description: "Too many messages. Try again in a moment.",
            variant: "destructive",
          });
          return null;
        }
        throw new Error(errorData.error || "AI request failed");
      }

      const data = await response.json();
      return data.message;
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

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    // If showing login nudge, don't allow more messages
    if (showLoginNudge && !user) {
      toast({
        title: "Quick step needed",
        description: "Sign up to continue and get your introductions!",
      });
      return;
    }

    setSending(true);
    const userMessage = input.trim();
    setInput("");

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

      const aiResponse = await getAIResponse(conversationHistory);
      if (aiResponse) {
        await sendBotMessage(aiResponse);
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

      const aiResponse = await getAIResponse(conversationHistory);
      if (aiResponse) {
        const botMsg: Message = {
          id: `local-${Date.now() + 1}`,
          role: "assistant",
          content: aiResponse,
          message_type: "text",
          metadata: {},
          created_at: new Date().toISOString(),
        };
        setLocalMessages((prev) => [...prev, botMsg]);
        // Save to leads table after every message exchange
        saveLeadToDb([...localMessages, newMsg, botMsg]);
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
      <UserChatView 
        introduction={activeChat} 
        onBack={() => setActiveChat(null)} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-lg">ChekInn</h1>
          <div className="w-5" />
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
                  
                  {/* Template buttons after first AI message */}
                  {index === 0 && msg.role === "assistant" && activeMessages.length === 1 && (
                    <div className="flex flex-wrap gap-1.5 mt-3 max-w-[300px] animate-fade-in">
                      {[
                        "Interview prep buddy",
                        "Test my project",
                        "Explore a career",
                        "Break into tech",
                        "Get some advice",
                        "Pitch my startup",
                        "Find co-builder for project"
                      ].map((template) => (
                        <button
                          key={template}
                          onClick={() => {
                            setInput(template);
                          }}
                          className="text-xs px-3 py-1.5 rounded-full border border-primary/40 bg-primary/10 hover:bg-primary/20 transition-all text-primary font-medium hover:scale-105 hover:shadow-sm"
                        >
                          {template}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Login Nudge for Anonymous Users */}
              {showLoginNudge && !user && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="bg-gradient-to-br from-primary/10 to-primary/20 border border-primary/30 rounded-2xl p-5"
                >
                  <div className="flex items-center gap-2 text-primary mb-3">
                    <Sparkles className="w-5 h-5" />
                    <span className="font-semibold text-sm">Finding your intros...</span>
                  </div>
                  
                  <p className="text-foreground mb-4">
                    I've got a good sense of what you're looking for. Quick signup so I can save your profile and find the right connections for you.
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
                  className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-center"
                >
                  <p className="text-sm text-foreground font-medium">
                    🎯 We've got your profile!
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    We're working on finding the right introduction for you. Check back soon!
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            
            {sending && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-muted rounded-2xl px-4 py-2.5 text-muted-foreground">
                  <span className="animate-pulse">Typing...</span>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-4 bg-background">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder={showLoginNudge && !user ? "Sign up to continue..." : "Type a message..."}
                className="flex-1"
                disabled={sending || (showLoginNudge && !user)}
              />
              <Button onClick={handleSend} disabled={!input.trim() || sending || (showLoginNudge && !user)} size="icon">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
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
                  onClick={() => setActiveChat(intro)}
                  className="w-full p-4 bg-card border border-border rounded-xl text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                      {intro.other_user?.full_name?.charAt(0) || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">
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
