import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

interface Introduction {
  id: string;
  user_a_id: string;
  user_b_id: string;
  status: string;
  other_user?: {
    full_name: string;
    avatar_url: string;
    bio: string;
    role: string;
  };
}

interface UserChatViewProps {
  introduction: Introduction;
  onBack: () => void;
}

const UserChatView = ({ introduction, onBack }: UserChatViewProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const otherUserId = introduction.user_a_id === user?.id 
    ? introduction.user_b_id 
    : introduction.user_a_id;

  useEffect(() => {
    loadMessages();
    subscribeToMessages();
  }, [introduction.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from("user_chats")
      .select("*")
      .eq("introduction_id", introduction.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading messages:", error);
      return;
    }

    setMessages(data as ChatMessage[]);

    // Mark messages as read
    if (user) {
      await supabase
        .from("user_chats")
        .update({ read: true })
        .eq("introduction_id", introduction.id)
        .eq("receiver_id", user.id);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`user-chat-${introduction.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_chats",
          filter: `introduction_id=eq.${introduction.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSend = async () => {
    if (!input.trim() || !user || sending) return;

    setSending(true);
    const content = input.trim();
    setInput("");

    const { error } = await supabase.from("user_chats").insert({
      introduction_id: introduction.id,
      sender_id: user.id,
      receiver_id: otherUserId,
      content,
    });

    if (error) {
      console.error("Error sending message:", error);
    }

    setSending(false);
  };

  const isEnded = introduction.status === "ended";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="flex items-center gap-3 px-4 py-3">
          <button 
            onClick={onBack} 
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
            {introduction.other_user?.full_name?.charAt(0) || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold truncate">
              {introduction.other_user?.full_name || "Anonymous"}
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              {introduction.other_user?.role || "ChekInn member"}
            </p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.sender_id === user?.id ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  msg.sender_id === user?.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {messages.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Start the conversation!</p>
            <p className="text-sm mt-1">Say hello to {introduction.other_user?.full_name || "your new connection"}</p>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {isEnded ? (
        <div className="border-t border-border p-6 bg-muted/50 text-center">
          <p className="text-muted-foreground font-medium">Chat ended</p>
          <p className="text-sm text-muted-foreground mt-1">We'll find you more folks 🤝</p>
        </div>
      ) : (
        <div className="border-t border-border p-4 bg-background">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Type a message..."
              className="flex-1"
              disabled={sending}
            />
            <Button onClick={handleSend} disabled={!input.trim() || sending} size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserChatView;
