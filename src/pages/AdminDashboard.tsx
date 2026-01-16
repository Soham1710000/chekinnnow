import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  MessageCircle,
  Link2,
  ArrowLeft,
  Search,
  Eye,
  XCircle,
  Loader2,
  RefreshCw,
  Mail,
  TrendingUp,
  MousePointer,
  UserPlus,
  CheckCircle,
  Download,
  Repeat,
  Activity,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface OnboardingContext {
  // New flow fields
  decision_posture?: string;
  ask_type?: string;
  lived_context?: string[];
  followup_context?: string[];
  micro_reason?: string;
  decision_weight?: string;
  stakes_text?: string;
  context_chips?: string[];
  open_help_text?: string;
  help_style?: string;
  // Legacy fields (for backwards compatibility)
  lookingFor?: string;
  whyOpportunity?: string;
  constraint?: string;
  motivation?: string;
  motivationExplanation?: string;
  contrarianBelief?: string;
  careerInflection?: string;
  completedAt?: string;
}

interface Profile {
  id: string;
  email: string;
  full_name: string;
  bio: string;
  role: string;
  industry: string;
  goals: string[];
  skills: string[];
  looking_for: string;
  interests: string[];
  communication_style: string;
  learning_complete: boolean;
  learning_messages_count: number;
  ai_insights: any;
  onboarding_context?: OnboardingContext;
  linkedin_url?: string;
  created_at: string;
  chat_messages?: any[];
  message_count?: number;
  active_days?: number;
  is_returning?: boolean;
  first_chat?: string;
  last_chat?: string;
}

interface Introduction {
  id: string;
  user_a_id: string;
  user_b_id: string;
  intro_message: string;
  status: string;
  created_at: string;
  user_a_accepted: boolean | null;
  user_b_accepted: boolean | null;
  user_a?: Profile;
  user_b?: Profile;
  chats?: ChatMessage[];
}

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

interface FunnelStats {
  page_view: number;
  cta_click: number;
  chat_page_loaded: number;
  modal_open: number;
  auth_start: number;
  auth_complete: number;
  waitlist_success: number;
  unique_sessions: number;
  sources: Record<string, number>;
  upsc_cta_clicks: number;
}

interface UPSCStats {
  page_view: number;
  cta_click: number;
  chat_page_loaded: number;
  auth_start: number;
  auth_complete: number;
  unique_sessions: number;
  templates: Record<string, number>;
  recentEvents: FunnelEvent[];
}

interface CATStats {
  page_view: number;
  cta_click: number;
  chat_page_loaded: number;
  auth_start: number;
  auth_complete: number;
  unique_sessions: number;
  templates: Record<string, number>;
  recentEvents: FunnelEvent[];
}

interface MainStats {
  page_view: number;
  cta_click: number;
  chat_page_loaded: number;
  auth_start: number;
  auth_complete: number;
  unique_sessions: number;
}

interface FunnelEvent {
  id: string;
  event_type: string;
  user_id: string | null;
  session_id: string;
  source: string;
  page_url: string;
  created_at: string;
}

interface Lead {
  id: string;
  session_id: string;
  messages: { role: string; content: string; created_at: string }[];
  extracted_insights: any;
  user_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface EngagementMetrics {
  total_users: number;
  users_with_messages: number;
  returning_users: number;
  learning_complete: number;
  avg_messages_per_user: number;
  total_messages: number;
  active_intros: number;
  total_intros: number;
}

// Password is verified server-side only - not stored in client code

const AdminDashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [introductions, setIntroductions] = useState<Introduction[]>([]);
  const [funnelStats, setFunnelStats] = useState<FunnelStats | null>(null);
  const [upscStats, setUpscStats] = useState<UPSCStats | null>(null);
  const [catStats, setCatStats] = useState<CATStats | null>(null);
  const [mainStats, setMainStats] = useState<MainStats | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"all" | "upsc" | "cat" | "main">("all");
  const [recentEvents, setRecentEvents] = useState<FunnelEvent[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [engagementMetrics, setEngagementMetrics] = useState<EngagementMetrics | null>(null);
  const [funnelTimeRange, setFunnelTimeRange] = useState(24);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // Password gate
  const [passwordEntered, setPasswordEntered] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  // Create intro modal
  const [showCreateIntro, setShowCreateIntro] = useState(false);
  const [selectedUserA, setSelectedUserA] = useState<Profile | null>(null);
  const [selectedUserB, setSelectedUserB] = useState<Profile | null>(null);
  const [userANameOverride, setUserANameOverride] = useState("");
  const [userBNameOverride, setUserBNameOverride] = useState("");
  const [introMessage, setIntroMessage] = useState("");
  const [creating, setCreating] = useState(false);

  // View user modal
  const [viewUser, setViewUser] = useState<Profile | null>(null);
  const [userMessages, setUserMessages] = useState<any[]>([]);

  // View chat modal
  const [viewIntro, setViewIntro] = useState<Introduction | null>(null);
  const [introChats, setIntroChats] = useState<ChatMessage[]>([]);

  // Email sending
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailTestMode, setEmailTestMode] = useState(true);
  const [testEmail, setTestEmail] = useState("");

  // Backfill state
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillResults, setBackfillResults] = useState<{
    summary: { total: number; processed: number; skipped: number; errors: number; wouldProcess?: number; dryRun?: boolean };
    results: any[];
  } | null>(null);

  // Profile summary generation
  const [generatingSummary, setGeneratingSummary] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(false);
    
    try {
      const { data, error } = await supabase.functions.invoke("admin-data", {
        body: { password: passwordInput, timeRange: funnelTimeRange },
      });
      
      if (error || data?.error) {
        setPasswordError(true);
        return;
      }
      
      setAdminPassword(passwordInput);
      setPasswordEntered(true);
      setProfiles(data.profiles || []);
      setIntroductions(data.introductions || []);
      setFunnelStats(data.funnelStats || null);
      setUpscStats(data.upscStats || null);
      setCatStats(data.catStats || null);
      setMainStats(data.mainStats || null);
      setRecentEvents(data.recentEvents || []);
      setLeads(data.leads || []);
      setEngagementMetrics(data.engagementMetrics || null);
      setLoading(false);
    } catch {
      setPasswordError(true);
    }
  };

  const loadData = async (timeRange?: number) => {
    if (!adminPassword) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-data", {
        body: { password: adminPassword, timeRange: timeRange || funnelTimeRange },
      });

      if (error) throw error;

      setProfiles(data.profiles || []);
      setIntroductions(data.introductions || []);
      setFunnelStats(data.funnelStats || null);
      setUpscStats(data.upscStats || null);
      setCatStats(data.catStats || null);
      setMainStats(data.mainStats || null);
      setRecentEvents(data.recentEvents || []);
      setLeads(data.leads || []);
      setEngagementMetrics(data.engagementMetrics || null);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error loading data",
        description: "Could not fetch admin data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTimeRangeChange = (hours: number) => {
    setFunnelTimeRange(hours);
    loadData(hours);
  };

  // Use pre-loaded chat data from edge function
  const loadUserMessages = (userId: string) => {
    const profile = profiles.find(p => p.id === userId);
    if (profile?.chat_messages) {
      // Sort ascending for display
      setUserMessages([...profile.chat_messages].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ));
    } else {
      setUserMessages([]);
    }
  };

  // Use pre-loaded chat data from edge function
  const loadIntroChats = (introId: string) => {
    const intro = introductions.find(i => i.id === introId);
    if (intro?.chats) {
      // Sort ascending for display
      setIntroChats([...intro.chats].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ));
    } else {
      setIntroChats([]);
    }
  };

  const handleCreateIntro = async () => {
    if (!selectedUserA || !selectedUserB || !introMessage.trim()) {
      toast({
        title: "Missing information",
        description: "Please select both users and write an intro message.",
        variant: "destructive",
      });
      return;
    }

    if (selectedUserA.id === selectedUserB.id) {
      toast({
        title: "Invalid selection",
        description: "Cannot create an introduction between the same user.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);

    try {
      // Update names if overrides provided
      if (userANameOverride.trim()) {
        await supabase.functions.invoke("admin-data", {
          body: {
            password: adminPassword,
            action: "update_profile_name",
            user_id: selectedUserA.id,
            full_name: userANameOverride.trim(),
          },
        });
      }
      if (userBNameOverride.trim()) {
        await supabase.functions.invoke("admin-data", {
          body: {
            password: adminPassword,
            action: "update_profile_name",
            user_id: selectedUserB.id,
            full_name: userBNameOverride.trim(),
          },
        });
      }

      const { data, error } = await supabase.functions.invoke("admin-create-intro", {
        body: {
          password: adminPassword,
          user_a_id: selectedUserA.id,
          user_b_id: selectedUserB.id,
          intro_message: introMessage,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const nameA = userANameOverride.trim() || selectedUserA.full_name || selectedUserA.email;
      const nameB = userBNameOverride.trim() || selectedUserB.full_name || selectedUserB.email;

      toast({
        title: "Introduction created!",
        description: `${nameA} and ${nameB} will see the intro card.`,
      });

      setShowCreateIntro(false);
      setSelectedUserA(null);
      setSelectedUserB(null);
      setUserANameOverride("");
      setUserBNameOverride("");
      setIntroMessage("");
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleEndIntro = async (intro: Introduction) => {
    const { error } = await supabase
      .from("introductions")
      .update({
        status: "ended",
        ended_by: user?.id,
        end_reason: "Ended by admin",
      })
      .eq("id", intro.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Introduction ended",
      description: "The conversation has been closed.",
    });

    loadData();
    setViewIntro(null);
  };

  const handleSendLaunchEmail = async () => {
    if (emailTestMode && !testEmail.trim()) {
      toast({
        title: "Enter test email",
        description: "Please enter an email address for the test.",
        variant: "destructive",
      });
      return;
    }

    setSendingEmail(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-launch-email", {
        body: emailTestMode ? { testEmail: testEmail.trim() } : {},
      });

      if (error) throw error;

      toast({
        title: "Emails sent!",
        description: `Successfully sent to ${data.sent} users. ${data.failed > 0 ? `${data.failed} failed.` : ""}`,
      });
    } catch (error: any) {
      console.error("Error sending emails:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send emails",
        variant: "destructive",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleRunBackfill = async (dryRun: boolean) => {
    setBackfillRunning(true);
    setBackfillResults(null);

    try {
      const { data, error } = await supabase.functions.invoke("backfill-profiles", {
        body: { password: adminPassword, dryRun },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setBackfillResults(data);
      
      toast({
        title: dryRun ? "Dry run complete" : "Backfill complete!",
        description: dryRun 
          ? `Would process ${data.summary?.wouldProcess || 0} profiles`
          : `Processed ${data.summary?.processed || 0} profiles successfully`,
      });

      if (!dryRun) {
        loadData(); // Refresh data after backfill
      }
    } catch (error: any) {
      console.error("Backfill error:", error);
      toast({
        title: "Backfill failed",
        description: error.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBackfillRunning(false);
    }
  };

  const handleGenerateSummary = async (userId: string) => {
    setGeneratingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke("summarize-profile", {
        body: { userId, password: adminPassword },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Summary generated!",
        description: `Profile summary created successfully${data.linkedInData ? ' with LinkedIn data' : ''}.`,
      });

      // Update the viewUser with new ai_insights
      if (viewUser && viewUser.id === userId) {
        setViewUser({
          ...viewUser,
          ai_insights: {
            ...viewUser.ai_insights,
            profileSummary: data.summary,
            linkedInData: data.linkedInData,
            generatedAt: new Date().toISOString(),
          },
        });
      }

      // Refresh data to get updated profiles
      loadData();
    } catch (error: any) {
      console.error("Summary generation error:", error);
      toast({
        title: "Failed to generate summary",
        description: error.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleExportCSV = () => {
    // Combine AI chats and user-to-user chats
    const rows: string[] = [];
    rows.push("type,user_email,user_name,other_user_email,other_user_name,role,content,created_at");

    // AI chat messages from profiles
    profiles.forEach((profile) => {
      if (profile.chat_messages) {
        profile.chat_messages.forEach((msg: any) => {
          const row = [
            "ai_chat",
            profile.email || "",
            profile.full_name || "",
            "",
            "",
            msg.role || "",
            `"${(msg.content || "").replace(/"/g, '""')}"`,
            msg.created_at || "",
          ].join(",");
          rows.push(row);
        });
      }
    });

    // User-to-user chats from introductions
    introductions.forEach((intro) => {
      if (intro.chats) {
        intro.chats.forEach((chat) => {
          const sender = intro.user_a?.id === chat.sender_id ? intro.user_a : intro.user_b;
          const receiver = intro.user_a?.id === chat.receiver_id ? intro.user_a : intro.user_b;
          const row = [
            "user_chat",
            sender?.email || "",
            sender?.full_name || "",
            receiver?.email || "",
            receiver?.full_name || "",
            "user",
            `"${(chat.content || "").replace(/"/g, '""')}"`,
            chat.created_at || "",
          ].join(",");
          rows.push(row);
        });
      }
    });

    // Anonymous leads
    leads.forEach((lead) => {
      if (lead.messages) {
        lead.messages.forEach((msg) => {
          const row = [
            lead.user_id ? "converted_lead" : "anonymous_lead",
            lead.user_id || "",
            `session:${lead.session_id}`,
            "",
            "",
            msg.role || "",
            `"${(msg.content || "").replace(/"/g, '""')}"`,
            msg.created_at || "",
          ].join(",");
          rows.push(row);
        });
      }
    });

    const csvContent = rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `chekinn-chats-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "CSV exported",
      description: `Exported ${rows.length - 1} messages.`,
    });
  };

  const filteredProfiles = profiles.filter(
    (p) =>
      p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.industry?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Password gate screen
  if (!passwordEntered) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold mb-2 text-center">Admin Access</h1>
          <p className="text-muted-foreground mb-6 text-center">Enter password to continue</p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <Input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Enter admin password"
              className={passwordError ? "border-red-500" : ""}
            />
            {passwordError && (
              <p className="text-sm text-red-500">Incorrect password</p>
            )}
            <Button type="submit" className="w-full">
              Access Dashboard
            </Button>
          </form>
          <Button 
            variant="ghost" 
            className="w-full mt-4" 
            onClick={() => navigate("/")}
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-bold text-lg">ChekInn Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleRunBackfill(true)}
              disabled={backfillRunning}
            >
              {backfillRunning ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {backfillRunning ? "Running..." : "Backfill Dry Run"}
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => handleRunBackfill(false)}
              disabled={backfillRunning}
            >
              {backfillRunning ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Run Backfill
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => loadData()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4">
        {/* Top Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{profiles.length}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Repeat className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {engagementMetrics?.returning_users || profiles.filter(p => p.is_returning).length}
                </p>
                <p className="text-sm text-muted-foreground">Returning</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <MessageCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {profiles.filter((p) => p.learning_complete).length}
                </p>
                <p className="text-sm text-muted-foreground">Learning Done</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 rounded-lg">
                <Activity className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {engagementMetrics?.avg_messages_per_user || 0}
                </p>
                <p className="text-sm text-muted-foreground">Avg Msgs/User</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Link2 className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{introductions.length}</p>
                <p className="text-sm text-muted-foreground">Introductions</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <BarChart3 className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {engagementMetrics?.total_messages || 0}
                </p>
                <p className="text-sm text-muted-foreground">Total Msgs</p>
              </div>
            </div>
          </div>
        </div>

        {/* Engagement Metrics Card */}
        {engagementMetrics && (
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-border rounded-xl p-4 mb-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Repeat className="w-4 h-4" />
              Engagement Overview
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Users w/ Messages</p>
                <span className="text-lg font-bold">{engagementMetrics.users_with_messages}</span>
                <span className="text-xs text-muted-foreground ml-1">
                  ({((engagementMetrics.users_with_messages / engagementMetrics.total_users) * 100).toFixed(0)}%)
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Returning Users</p>
                <span className="text-lg font-bold text-amber-600">{engagementMetrics.returning_users}</span>
                <span className="text-xs text-muted-foreground ml-1">
                  ({engagementMetrics.users_with_messages > 0 
                    ? ((engagementMetrics.returning_users / engagementMetrics.users_with_messages) * 100).toFixed(0) 
                    : 0}%)
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Learning Complete</p>
                <span className="text-lg font-bold text-green-600">{engagementMetrics.learning_complete}</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Avg Msgs/User</p>
                <span className="text-lg font-bold">{engagementMetrics.avg_messages_per_user}</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Active Intros</p>
                <span className="text-lg font-bold text-blue-600">{engagementMetrics.active_intros}</span>
                <span className="text-xs text-muted-foreground ml-1">/ {engagementMetrics.total_intros}</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Messages</p>
                <span className="text-lg font-bold">{engagementMetrics.total_messages}</span>
              </div>
            </div>
          </div>
        )}

        {/* Email Section */}
        <div className="bg-card border border-border rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Send Launch Email</h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={emailTestMode}
                onChange={(e) => setEmailTestMode(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Test mode</span>
            </label>
            {emailTestMode && (
              <Input
                placeholder="Test email address"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="sm:w-64"
              />
            )}
            <Button
              onClick={handleSendLaunchEmail}
              disabled={sendingEmail}
              variant={emailTestMode ? "outline" : "default"}
            >
              {sendingEmail ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              {emailTestMode ? "Send Test" : `Send to All (${profiles.length})`}
            </Button>
          </div>
          {!emailTestMode && (
            <p className="text-sm text-destructive mt-2">
              ⚠️ This will send emails to ALL {profiles.length} users!
            </p>
          )}
        </div>

        {/* Backfill Results Banner */}
        {backfillResults && (
          <div className="bg-card border border-border rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Backfill Results {backfillResults.summary.dryRun ? "(Dry Run)" : ""}
              </h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setBackfillResults(null)}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total Profiles</p>
                <p className="font-bold text-lg">{backfillResults.summary.total}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Processed</p>
                <p className="font-bold text-lg text-green-500">
                  {backfillResults.summary.processed || backfillResults.summary.wouldProcess || 0}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Skipped (low msgs)</p>
                <p className="font-bold text-lg text-amber-500">{backfillResults.summary.skipped}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Errors</p>
                <p className="font-bold text-lg text-red-500">{backfillResults.summary.errors}</p>
              </div>
            </div>
            {backfillResults.results.filter(r => r.status === "success").length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-2">Successfully processed:</p>
                <div className="flex flex-wrap gap-2">
                  {backfillResults.results
                    .filter(r => r.status === "success")
                    .slice(0, 10)
                    .map((r, i) => (
                      <span key={i} className="text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded">
                        {r.insights?.full_name || r.userId.slice(0, 8)}
                      </span>
                    ))}
                  {backfillResults.results.filter(r => r.status === "success").length > 10 && (
                    <span className="text-xs text-muted-foreground">
                      +{backfillResults.results.filter(r => r.status === "success").length - 10} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="funnel" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <TabsList>
              <TabsTrigger value="funnel">Funnel</TabsTrigger>
              <TabsTrigger value="upsc" className="text-orange-600 data-[state=active]:bg-orange-500/10">
                UPSC
                {upscStats && upscStats.page_view > 0 && (
                  <span className="ml-1.5 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {upscStats.page_view}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="cat" className="text-blue-600 data-[state=active]:bg-blue-500/10">
                CAT
                {catStats && catStats.page_view > 0 && (
                  <span className="ml-1.5 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {catStats.page_view}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="leads">
                Leads
                {leads.filter(l => !l.converted_at).length > 0 && (
                  <span className="ml-1.5 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {leads.filter(l => !l.converted_at).length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="introductions">Introductions</TabsTrigger>
            </TabsList>

            <div className="flex gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button onClick={() => setShowCreateIntro(true)}>
                Create Intro
              </Button>
            </div>
          </div>

          {/* Funnel Tab */}
          <TabsContent value="funnel" className="space-y-4">
            {/* Time Range & Source Selectors */}
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                {[1, 6, 24, 72, 168].map((hours) => (
                  <Button
                    key={hours}
                    variant={funnelTimeRange === hours ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleTimeRangeChange(hours)}
                  >
                    {hours === 1 ? "1h" : hours === 6 ? "6h" : hours === 24 ? "24h" : hours === 72 ? "3d" : "7d"}
                  </Button>
                ))}
              </div>
              
              {/* Source Filter */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Source:</span>
                <div className="flex gap-1">
                  {(["all", "upsc", "cat", "main"] as const).map((src) => (
                    <Button
                      key={src}
                      variant={sourceFilter === src ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSourceFilter(src)}
                      className={
                        src === "upsc" && sourceFilter === "upsc" ? "bg-orange-600 hover:bg-orange-700" : 
                        src === "cat" && sourceFilter === "cat" ? "bg-blue-600 hover:bg-blue-700" : ""
                      }
                    >
                      {src === "all" ? "All" : src === "upsc" ? "UPSC" : src === "cat" ? "CAT" : "Main"}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* UPSC Stats Card */}
            {funnelStats && funnelStats.upsc_cta_clicks > 0 && (
              <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-border rounded-xl p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  UPSC Traffic
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">UPSC CTA Clicks</p>
                    <span className="text-lg font-bold text-orange-600">{funnelStats.upsc_cta_clicks}</span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total CTA Clicks</p>
                    <span className="text-lg font-bold">{funnelStats.cta_click}</span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">UPSC %</p>
                    <span className="text-lg font-bold text-orange-600">
                      {funnelStats.cta_click > 0 ? ((funnelStats.upsc_cta_clicks / funnelStats.cta_click) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Funnel Stats */}
            {(() => {
              const stats = funnelStats;
              if (!stats) return null;
              return (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className="w-4 h-4 text-blue-500" />
                      <span className="text-sm text-muted-foreground">Page Views</span>
                    </div>
                    <p className="text-2xl font-bold">{stats.page_view}</p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MousePointer className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-muted-foreground">CTA Clicks</span>
                    </div>
                    <p className="text-2xl font-bold">{stats.cta_click}</p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageCircle className="w-4 h-4 text-cyan-500" />
                      <span className="text-sm text-muted-foreground">Chat Loaded</span>
                    </div>
                    <p className="text-2xl font-bold">{stats.chat_page_loaded || 0}</p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <UserPlus className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm text-muted-foreground">Auth Started</span>
                    </div>
                    <p className="text-2xl font-bold">{stats.auth_start}</p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm text-muted-foreground">Auth Complete</span>
                    </div>
                    <p className="text-2xl font-bold">{stats.auth_complete}</p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-purple-500" />
                      <span className="text-sm text-muted-foreground">Waitlist Success</span>
                    </div>
                    <p className="text-2xl font-bold">{stats.waitlist_success}</p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-muted-foreground">Sessions</span>
                    </div>
                    <p className="text-2xl font-bold">{stats.unique_sessions}</p>
                  </div>
                </div>
              );
            })()}

            {/* Conversion Rates */}
            {funnelStats && funnelStats.page_view > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="font-semibold mb-3">Conversion Rates</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">View → Click</p>
                    <p className="text-xl font-bold">
                      {((funnelStats.cta_click / funnelStats.page_view) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Click → Chat</p>
                    <p className="text-xl font-bold">
                      {funnelStats.cta_click > 0 
                        ? (((funnelStats.chat_page_loaded || 0) / funnelStats.cta_click) * 100).toFixed(1) 
                        : 0}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Chat → Auth Start</p>
                    <p className="text-xl font-bold">
                      {(funnelStats.chat_page_loaded || 0) > 0 
                        ? ((funnelStats.auth_start / (funnelStats.chat_page_loaded || 1)) * 100).toFixed(1) 
                        : 0}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Auth Start → Complete</p>
                    <p className="text-xl font-bold">
                      {funnelStats.auth_start > 0 
                        ? ((funnelStats.auth_complete / funnelStats.auth_start) * 100).toFixed(1) 
                        : 0}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Overall</p>
                    <p className="text-xl font-bold text-primary">
                      {((funnelStats.auth_complete / funnelStats.page_view) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Traffic Sources */}
            {funnelStats && Object.keys(funnelStats.sources).length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="font-semibold mb-3">Traffic Sources</h3>
                <div className="space-y-2">
                  {Object.entries(funnelStats.sources)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)
                    .map(([source, count]) => (
                      <div key={source} className="flex justify-between items-center">
                        <span className="text-sm truncate max-w-[200px]">{source || 'direct'}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Recent Events */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold mb-3">Recent Events</h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {recentEvents.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No events yet. Events will appear as users interact with the site.</p>
                ) : (
                  recentEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          event.event_type === 'page_view' ? 'bg-blue-100 text-blue-700' :
                          event.event_type === 'cta_click' ? 'bg-green-100 text-green-700' :
                          event.event_type === 'chat_page_loaded' ? 'bg-cyan-100 text-cyan-700' :
                          event.event_type === 'auth_start' ? 'bg-yellow-100 text-yellow-700' :
                          event.event_type === 'auth_complete' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {event.event_type}
                        </span>
                        <span className="text-sm text-muted-foreground">{event.page_url}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* UPSC Analytics Tab */}
          <TabsContent value="upsc" className="space-y-4">
            <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-xl p-4">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                UPSC Landing Page Analytics
              </h2>
              
              {upscStats ? (
                <div className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Eye className="w-4 h-4 text-blue-500" />
                        <span className="text-sm text-muted-foreground">Page Views</span>
                      </div>
                      <p className="text-2xl font-bold text-orange-600">{upscStats.page_view}</p>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <MousePointer className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-muted-foreground">CTA Clicks</span>
                      </div>
                      <p className="text-2xl font-bold text-orange-600">{upscStats.cta_click}</p>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageCircle className="w-4 h-4 text-cyan-500" />
                        <span className="text-sm text-muted-foreground">Chat Loaded</span>
                      </div>
                      <p className="text-2xl font-bold text-orange-600">{upscStats.chat_page_loaded}</p>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <UserPlus className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm text-muted-foreground">Auth Started</span>
                      </div>
                      <p className="text-2xl font-bold text-orange-600">{upscStats.auth_start}</p>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm text-muted-foreground">Auth Complete</span>
                      </div>
                      <p className="text-2xl font-bold text-orange-600">{upscStats.auth_complete}</p>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-muted-foreground">Sessions</span>
                      </div>
                      <p className="text-2xl font-bold text-orange-600">{upscStats.unique_sessions}</p>
                    </div>
                  </div>

                  {/* UPSC Conversion Rates */}
                  {upscStats.page_view > 0 && (
                    <div className="bg-card border border-border rounded-xl p-4">
                      <h3 className="font-semibold mb-3">UPSC Conversion Funnel</h3>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">View → Click</p>
                          <p className="text-xl font-bold text-orange-600">
                            {((upscStats.cta_click / upscStats.page_view) * 100).toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Click → Chat</p>
                          <p className="text-xl font-bold text-orange-600">
                            {upscStats.cta_click > 0 
                              ? ((upscStats.chat_page_loaded / upscStats.cta_click) * 100).toFixed(1) 
                              : 0}%
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Chat → Auth Start</p>
                          <p className="text-xl font-bold text-orange-600">
                            {upscStats.chat_page_loaded > 0 
                              ? ((upscStats.auth_start / upscStats.chat_page_loaded) * 100).toFixed(1) 
                              : 0}%
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Auth → Complete</p>
                          <p className="text-xl font-bold text-orange-600">
                            {upscStats.auth_start > 0 
                              ? ((upscStats.auth_complete / upscStats.auth_start) * 100).toFixed(1) 
                              : 0}%
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Overall</p>
                          <p className="text-xl font-bold text-orange-500">
                            {((upscStats.auth_complete / upscStats.page_view) * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CTA Template Breakdown */}
                  {Object.keys(upscStats.templates || {}).length > 0 && (
                    <div className="bg-card border border-border rounded-xl p-4">
                      <h3 className="font-semibold mb-3">Pain Point Clicks</h3>
                      <div className="space-y-2">
                        {Object.entries(upscStats.templates)
                          .sort(([, a], [, b]) => b - a)
                          .map(([template, count]) => (
                            <div key={template} className="flex justify-between items-center">
                              <span className="text-sm">{template}</span>
                              <span className="font-medium text-orange-600">{count}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* UPSC vs Main Comparison */}
                  {mainStats && (
                    <div className="bg-card border border-border rounded-xl p-4">
                      <h3 className="font-semibold mb-3">UPSC vs Main Page Comparison</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Page Views</p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-lg font-bold text-orange-600">{upscStats.page_view}</span>
                            <span className="text-muted-foreground">vs</span>
                            <span className="text-lg font-bold">{mainStats.page_view}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Click Rate</p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-lg font-bold text-orange-600">
                              {upscStats.page_view > 0 ? ((upscStats.cta_click / upscStats.page_view) * 100).toFixed(1) : 0}%
                            </span>
                            <span className="text-muted-foreground">vs</span>
                            <span className="text-lg font-bold">
                              {mainStats.page_view > 0 ? ((mainStats.cta_click / mainStats.page_view) * 100).toFixed(1) : 0}%
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Signups</p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-lg font-bold text-orange-600">{upscStats.auth_complete}</span>
                            <span className="text-muted-foreground">vs</span>
                            <span className="text-lg font-bold">{mainStats.auth_complete}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Overall Conversion</p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-lg font-bold text-orange-600">
                              {upscStats.page_view > 0 ? ((upscStats.auth_complete / upscStats.page_view) * 100).toFixed(1) : 0}%
                            </span>
                            <span className="text-muted-foreground">vs</span>
                            <span className="text-lg font-bold">
                              {mainStats.page_view > 0 ? ((mainStats.auth_complete / mainStats.page_view) * 100).toFixed(1) : 0}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recent UPSC Events */}
                  {(upscStats.recentEvents?.length ?? 0) > 0 && (
                    <div className="bg-card border border-border rounded-xl p-4">
                      <h3 className="font-semibold mb-3">Recent UPSC Activity</h3>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {upscStats.recentEvents.map((event) => (
                          <div key={event.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                event.event_type === 'page_view' ? 'bg-blue-100 text-blue-700' :
                                event.event_type === 'cta_click' ? 'bg-green-100 text-green-700' :
                                event.event_type === 'chat_page_loaded' ? 'bg-cyan-100 text-cyan-700' :
                                event.event_type === 'auth_start' ? 'bg-yellow-100 text-yellow-700' :
                                event.event_type === 'auth_complete' ? 'bg-emerald-100 text-emerald-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {event.event_type}
                              </span>
                              <span className="text-sm text-muted-foreground truncate max-w-[150px]">
                                {(event as any).metadata?.template || event.page_url}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(event.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No UPSC analytics data yet. Data will appear once users visit the /upsc page.</p>
              )}
            </div>
          </TabsContent>

          {/* CAT Analytics Tab */}
          <TabsContent value="cat" className="space-y-4">
            <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                CAT/MBA Landing Page Analytics
              </h2>
              
              {catStats ? (
                <div className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Eye className="w-4 h-4 text-blue-500" />
                        <span className="text-sm text-muted-foreground">Page Views</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">{catStats.page_view}</p>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <MousePointer className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-muted-foreground">CTA Clicks</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">{catStats.cta_click}</p>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageCircle className="w-4 h-4 text-cyan-500" />
                        <span className="text-sm text-muted-foreground">Chat Loaded</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">{catStats.chat_page_loaded}</p>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <UserPlus className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm text-muted-foreground">Auth Started</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">{catStats.auth_start}</p>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm text-muted-foreground">Auth Complete</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">{catStats.auth_complete}</p>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-muted-foreground">Sessions</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">{catStats.unique_sessions}</p>
                    </div>
                  </div>

                  {/* CAT Conversion Rates */}
                  {catStats.page_view > 0 && (
                    <div className="bg-card border border-border rounded-xl p-4">
                      <h3 className="font-semibold mb-3">CAT Conversion Funnel</h3>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">View → Click</p>
                          <p className="text-xl font-bold text-blue-600">
                            {((catStats.cta_click / catStats.page_view) * 100).toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Click → Chat</p>
                          <p className="text-xl font-bold text-blue-600">
                            {catStats.cta_click > 0 
                              ? ((catStats.chat_page_loaded / catStats.cta_click) * 100).toFixed(1) 
                              : 0}%
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Chat → Auth Start</p>
                          <p className="text-xl font-bold text-blue-600">
                            {catStats.chat_page_loaded > 0 
                              ? ((catStats.auth_start / catStats.chat_page_loaded) * 100).toFixed(1) 
                              : 0}%
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Auth → Complete</p>
                          <p className="text-xl font-bold text-blue-600">
                            {catStats.auth_start > 0 
                              ? ((catStats.auth_complete / catStats.auth_start) * 100).toFixed(1) 
                              : 0}%
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Overall</p>
                          <p className="text-xl font-bold text-blue-500">
                            {((catStats.auth_complete / catStats.page_view) * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CTA Template Breakdown */}
                  {Object.keys(catStats.templates || {}).length > 0 && (
                    <div className="bg-card border border-border rounded-xl p-4">
                      <h3 className="font-semibold mb-3">Pain Point Clicks</h3>
                      <div className="space-y-2">
                        {Object.entries(catStats.templates)
                          .sort(([, a], [, b]) => b - a)
                          .map(([template, count]) => (
                            <div key={template} className="flex justify-between items-center">
                              <span className="text-sm">{template}</span>
                              <span className="font-medium text-blue-600">{count}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* CAT vs Main Comparison */}
                  {mainStats && (
                    <div className="bg-card border border-border rounded-xl p-4">
                      <h3 className="font-semibold mb-3">CAT vs Main Page Comparison</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Page Views</p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-lg font-bold text-blue-600">{catStats.page_view}</span>
                            <span className="text-muted-foreground">vs</span>
                            <span className="text-lg font-bold">{mainStats.page_view}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Click Rate</p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-lg font-bold text-blue-600">
                              {catStats.page_view > 0 ? ((catStats.cta_click / catStats.page_view) * 100).toFixed(1) : 0}%
                            </span>
                            <span className="text-muted-foreground">vs</span>
                            <span className="text-lg font-bold">
                              {mainStats.page_view > 0 ? ((mainStats.cta_click / mainStats.page_view) * 100).toFixed(1) : 0}%
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Signups</p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-lg font-bold text-blue-600">{catStats.auth_complete}</span>
                            <span className="text-muted-foreground">vs</span>
                            <span className="text-lg font-bold">{mainStats.auth_complete}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Overall Conversion</p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-lg font-bold text-blue-600">
                              {catStats.page_view > 0 ? ((catStats.auth_complete / catStats.page_view) * 100).toFixed(1) : 0}%
                            </span>
                            <span className="text-muted-foreground">vs</span>
                            <span className="text-lg font-bold">
                              {mainStats.page_view > 0 ? ((mainStats.auth_complete / mainStats.page_view) * 100).toFixed(1) : 0}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recent CAT Events */}
                  {(catStats.recentEvents?.length ?? 0) > 0 && (
                    <div className="bg-card border border-border rounded-xl p-4">
                      <h3 className="font-semibold mb-3">Recent CAT Activity</h3>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {catStats.recentEvents.map((event) => (
                          <div key={event.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                event.event_type === 'page_view' ? 'bg-blue-100 text-blue-700' :
                                event.event_type === 'cta_click' ? 'bg-green-100 text-green-700' :
                                event.event_type === 'chat_page_loaded' ? 'bg-cyan-100 text-cyan-700' :
                                event.event_type === 'auth_start' ? 'bg-yellow-100 text-yellow-700' :
                                event.event_type === 'auth_complete' ? 'bg-emerald-100 text-emerald-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {event.event_type}
                              </span>
                              <span className="text-sm text-muted-foreground truncate max-w-[150px]">
                                {(event as any).metadata?.template || event.page_url}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(event.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No CAT analytics data yet. Data will appear once users visit the /cat page.</p>
              )}
            </div>
          </TabsContent>

          {/* Leads Tab */}
          <TabsContent value="leads" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-2xl font-bold">{leads.length}</p>
                <p className="text-sm text-muted-foreground">Total Leads</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-2xl font-bold text-orange-500">{leads.filter(l => !l.converted_at).length}</p>
                <p className="text-sm text-muted-foreground">Unconverted</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-2xl font-bold text-green-500">{leads.filter(l => l.converted_at).length}</p>
                <p className="text-sm text-muted-foreground">Converted</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-2xl font-bold">
                  {leads.length > 0 ? Math.round((leads.filter(l => l.converted_at).length / leads.length) * 100) : 0}%
                </p>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
              </div>
            </div>

            {leads.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No leads yet. Anonymous chat sessions will appear here.
              </div>
            ) : (
              <div className="space-y-4">
                {leads.map((lead) => (
                  <div
                    key={lead.id}
                    className={`bg-card border rounded-xl p-4 ${
                      lead.converted_at ? 'border-green-500/30' : 'border-orange-500/30'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            lead.converted_at 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {lead.converted_at ? 'Converted' : 'Pending'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {lead.messages?.length || 0} messages
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Session: {lead.session_id.slice(0, 20)}...
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    
                    {/* Messages preview */}
                    <div className="bg-muted/50 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                      {(lead.messages || []).slice(0, 10).map((msg, idx) => (
                        <div key={idx} className={`text-sm ${msg.role === 'user' ? 'text-primary' : 'text-muted-foreground'}`}>
                          <span className="font-medium">{msg.role === 'user' ? 'User:' : 'AI:'}</span>{' '}
                          {msg.content.slice(0, 150)}{msg.content.length > 150 ? '...' : ''}
                        </div>
                      ))}
                      {(lead.messages?.length || 0) > 10 && (
                        <p className="text-xs text-muted-foreground">
                          +{lead.messages.length - 10} more messages...
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredProfiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="bg-card border border-border rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                          {profile.full_name?.charAt(0) || "?"}
                        </div>
                        <div>
                          <h3 className="font-medium">
                            {profile.full_name || "No name"}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {profile.email}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setViewUser(profile);
                          loadUserMessages(profile.id);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Onboarding Context - most important for matching */}
                    {(profile.onboarding_context?.ask_type || profile.onboarding_context?.lookingFor) && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-3">
                        <p className="text-xs font-medium text-emerald-600 mb-1">🎯 Check-in Intent</p>
                        {/* New flow display */}
                        {profile.onboarding_context.ask_type && (
                          <p className="text-sm font-medium capitalize">{profile.onboarding_context.ask_type.replace(/_/g, ' ')}</p>
                        )}
                        {profile.onboarding_context.lived_context && profile.onboarding_context.lived_context.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">Lived:</span> {profile.onboarding_context.lived_context.slice(0, 2).map(c => c.replace(/_/g, ' ')).join(', ')}
                            {profile.onboarding_context.lived_context.length > 2 && ` +${profile.onboarding_context.lived_context.length - 2} more`}
                          </p>
                        )}
                        {profile.onboarding_context.decision_weight && (
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">Stakes:</span> {profile.onboarding_context.decision_weight.replace(/_/g, ' ')}
                          </p>
                        )}
                        {/* Legacy flow fallback */}
                        {!profile.onboarding_context.ask_type && profile.onboarding_context.lookingFor && (
                          <>
                            <p className="text-sm font-medium">{profile.onboarding_context.lookingFor}</p>
                            {profile.onboarding_context.constraint && (
                              <p className="text-xs text-muted-foreground mt-1">
                                <span className="font-medium">Constraints:</span> {profile.onboarding_context.constraint}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* AI Summary */}
                    {profile.ai_insights?.summary && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-3">
                        <p className="text-xs font-medium text-primary mb-1">AI Summary</p>
                        <p className="text-sm">{profile.ai_insights.summary}</p>
                      </div>
                    )}

                    <div className="space-y-2 text-sm">
                      {profile.role && (
                        <p>
                          <span className="text-muted-foreground">Role:</span>{" "}
                          {profile.role}
                        </p>
                      )}
                      {profile.industry && (
                        <p>
                          <span className="text-muted-foreground">Industry:</span>{" "}
                          {profile.industry}
                        </p>
                      )}
                      {/* Fallback to looking_for if no onboarding context */}
                      {!profile.onboarding_context?.lookingFor && profile.looking_for && (
                        <p>
                          <span className="text-muted-foreground">Looking for:</span>{" "}
                          {profile.looking_for}
                        </p>
                      )}
                      {profile.skills && profile.skills.length > 0 && (
                        <p>
                          <span className="text-muted-foreground">Skills:</span>{" "}
                          {profile.skills.join(", ")}
                        </p>
                      )}
                      {profile.interests && profile.interests.length > 0 && (
                        <p>
                          <span className="text-muted-foreground">Interests:</span>{" "}
                          {profile.interests.join(", ")}
                        </p>
                      )}
                      <div className="flex items-center gap-2 pt-2 flex-wrap">
                        {profile.is_returning && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/10 text-amber-600 flex items-center gap-1">
                            <Repeat className="w-3 h-3" />
                            Returning ({profile.active_days}d)
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${
                            profile.learning_complete
                              ? "bg-green-500/10 text-green-500"
                              : "bg-yellow-500/10 text-yellow-500"
                          }`}
                        >
                          {profile.learning_complete
                            ? "Ready to match"
                            : "Learning..."}
                        </span>
                        {(profile.message_count ?? 0) > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/10 text-blue-500">
                            💬 {profile.message_count} msgs
                          </span>
                        )}
                      </div>
                      {profile.is_returning && profile.first_chat && profile.last_chat && (
                        <p className="text-xs text-muted-foreground mt-2">
                          First: {new Date(profile.first_chat).toLocaleDateString()} • 
                          Last: {new Date(profile.last_chat).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="introductions" className="space-y-4">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : introductions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Link2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No introductions yet</p>
                <Button className="mt-4" onClick={() => setShowCreateIntro(true)}>
                  Create First Introduction
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {introductions.map((intro) => (
                  <div
                    key={intro.id}
                    className="bg-card border border-border rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex -space-x-2">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold border-2 border-background">
                              {intro.user_a?.full_name?.charAt(0) || "?"}
                            </div>
                            {intro.user_a_accepted && (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                <CheckCircle className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 font-semibold border-2 border-background">
                              {intro.user_b?.full_name?.charAt(0) || "?"}
                            </div>
                            {intro.user_b_accepted && (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                <CheckCircle className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <h3 className="font-medium">
                            <span className={intro.user_a_accepted ? "text-green-600" : "text-muted-foreground"}>
                              {intro.user_a?.full_name || "User A"}
                              {intro.user_a_accepted && " ✓"}
                            </span>
                            {" ↔ "}
                            <span className={intro.user_b_accepted ? "text-green-600" : "text-muted-foreground"}>
                              {intro.user_b?.full_name || "User B"}
                              {intro.user_b_accepted && " ✓"}
                            </span>
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {intro.intro_message}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${
                            intro.status === "active"
                              ? "bg-green-500/10 text-green-500"
                              : intro.status === "ended"
                              ? "bg-red-500/10 text-red-500"
                              : intro.status === "declined"
                              ? "bg-gray-500/10 text-gray-500"
                              : "bg-yellow-500/10 text-yellow-500"
                          }`}
                        >
                          {intro.status}
                        </span>
                        {(intro.chats?.length ?? 0) > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/10 text-blue-500">
                            💬 {intro.chats?.length} msgs
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setViewIntro(intro);
                            loadIntroChats(intro.id);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {intro.status === "active" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            onClick={() => handleEndIntro(intro)}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Intro Modal */}
      <Dialog open={showCreateIntro} onOpenChange={setShowCreateIntro}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Introduction</DialogTitle>
            <DialogDescription>
              Match two users and write a personalized intro message.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium block">User A</label>
              <select
                className="w-full p-2 border border-border rounded-lg bg-background"
                value={selectedUserA?.id || ""}
                onChange={(e) => {
                  const user = profiles.find((p) => p.id === e.target.value);
                  setSelectedUserA(user || null);
                  setUserANameOverride("");
                }}
              >
              <option value="">Select user...</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.email} - {p.role || "No role"}
                  </option>
                ))}
              </select>
              {selectedUserA && (
                <Input
                  placeholder={`Name override (current: ${selectedUserA.full_name || "none"})`}
                  value={userANameOverride}
                  onChange={(e) => setUserANameOverride(e.target.value)}
                  className="text-sm"
                />
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium block">User B</label>
              <select
                className="w-full p-2 border border-border rounded-lg bg-background"
                value={selectedUserB?.id || ""}
                onChange={(e) => {
                  const user = profiles.find((p) => p.id === e.target.value);
                  setSelectedUserB(user || null);
                  setUserBNameOverride("");
                }}
              >
              <option value="">Select user...</option>
                {profiles
                  .filter((p) => p.id !== selectedUserA?.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || p.email} - {p.role || "No role"}
                    </option>
                  ))}
              </select>
              {selectedUserB && (
                <Input
                  placeholder={`Name override (current: ${selectedUserB.full_name || "none"})`}
                  value={userBNameOverride}
                  onChange={(e) => setUserBNameOverride(e.target.value)}
                  className="text-sm"
                />
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Introduction Message
              </label>
              <Textarea
                value={introMessage}
                onChange={(e) => setIntroMessage(e.target.value)}
                placeholder="Why should these two connect? Write a compelling reason..."
                rows={4}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCreateIntro(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateIntro} disabled={creating}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Introduction"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View User Modal */}
      <Dialog open={!!viewUser} onOpenChange={() => setViewUser(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewUser?.full_name || "User Details"}</DialogTitle>
          </DialogHeader>

          {viewUser && (
            <div className="space-y-4">
              {/* Onboarding Context - Primary matching info */}
              {(viewUser.onboarding_context?.ask_type || viewUser.onboarding_context?.lookingFor) && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                  <h4 className="font-semibold text-emerald-700 mb-3">🎯 Match Context</h4>
                  <div className="space-y-3">
                    {/* New flow fields */}
                    {viewUser.onboarding_context.ask_type && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Check-in Intent</p>
                        <p className="font-medium capitalize">{viewUser.onboarding_context.ask_type.replace(/_/g, ' ')}</p>
                      </div>
                    )}
                    {viewUser.onboarding_context.decision_posture && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Decision Style</p>
                        <p className="capitalize">{viewUser.onboarding_context.decision_posture.replace(/_/g, ' ')}</p>
                      </div>
                    )}
                    {viewUser.onboarding_context.lived_context && viewUser.onboarding_context.lived_context.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Lived Experience</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {viewUser.onboarding_context.lived_context.map((ctx) => (
                            <span key={ctx} className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full capitalize">
                              {ctx.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {viewUser.onboarding_context.followup_context && viewUser.onboarding_context.followup_context.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Relevant Forks</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {viewUser.onboarding_context.followup_context.map((ctx) => (
                            <span key={ctx} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full capitalize">
                              {ctx.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {viewUser.onboarding_context.decision_weight && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Decision Weight</p>
                        <p className="capitalize">{viewUser.onboarding_context.decision_weight.replace(/_/g, ' ')}</p>
                      </div>
                    )}
                    {viewUser.onboarding_context.stakes_text && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">What's at Stake</p>
                        <p className="text-sm italic">"{viewUser.onboarding_context.stakes_text}"</p>
                      </div>
                    )}
                    {viewUser.onboarding_context.context_chips && viewUser.onboarding_context.context_chips.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Current Constraints</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {viewUser.onboarding_context.context_chips.map((chip) => (
                            <span key={chip} className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full capitalize">
                              {chip.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {viewUser.onboarding_context.micro_reason && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Additional Context</p>
                        <p className="text-sm italic">"{viewUser.onboarding_context.micro_reason}"</p>
                      </div>
                    )}
                    {viewUser.onboarding_context.open_help_text && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Can Help With</p>
                        <p className="text-sm italic">"{viewUser.onboarding_context.open_help_text}"</p>
                      </div>
                    )}
                    {viewUser.onboarding_context.help_style && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Help Style</p>
                        <p className="capitalize">{viewUser.onboarding_context.help_style.replace(/_/g, ' ')}</p>
                      </div>
                    )}
                    {/* Legacy fields for backwards compatibility */}
                    {!viewUser.onboarding_context.ask_type && viewUser.onboarding_context.lookingFor && (
                      <>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Looking For</p>
                          <p className="font-medium">{viewUser.onboarding_context.lookingFor}</p>
                        </div>
                        {viewUser.onboarding_context.whyOpportunity && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Why This Opportunity</p>
                            <p>{viewUser.onboarding_context.whyOpportunity}</p>
                          </div>
                        )}
                        {viewUser.onboarding_context.constraint && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Constraints</p>
                            <p>{viewUser.onboarding_context.constraint}</p>
                          </div>
                        )}
                        {viewUser.onboarding_context.motivation && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Motivation</p>
                            <p>{viewUser.onboarding_context.motivation}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* AI Profile Summary - Generated from LinkedIn + Onboarding */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-primary flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    AI Profile Summary
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerateSummary(viewUser.id)}
                    disabled={generatingSummary}
                  >
                    {generatingSummary ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    {generatingSummary ? "Generating..." : viewUser.ai_insights?.profileSummary ? "Regenerate" : "Generate Summary"}
                  </Button>
                </div>
                
                {viewUser.ai_insights?.profileSummary ? (
                  <div className="space-y-3 text-sm">
                    {viewUser.ai_insights.profileSummary.headline && (
                      <div>
                        <p className="font-semibold text-foreground">{viewUser.ai_insights.profileSummary.headline}</p>
                      </div>
                    )}
                    {viewUser.ai_insights.profileSummary.narrative && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Narrative</p>
                        <p>{viewUser.ai_insights.profileSummary.narrative}</p>
                      </div>
                    )}
                    {viewUser.ai_insights.profileSummary.decisionContext && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Current Decision</p>
                        <p className="italic">"{viewUser.ai_insights.profileSummary.decisionContext}"</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {viewUser.ai_insights.profileSummary.seeking && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Seeking</p>
                          <p>{viewUser.ai_insights.profileSummary.seeking}</p>
                        </div>
                      )}
                      {viewUser.ai_insights.profileSummary.offering && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Offering</p>
                          <p>{viewUser.ai_insights.profileSummary.offering}</p>
                        </div>
                      )}
                    </div>
                    {viewUser.ai_insights.profileSummary.matchKeywords?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Match Keywords</p>
                        <div className="flex flex-wrap gap-1">
                          {viewUser.ai_insights.profileSummary.matchKeywords.map((keyword: string) => (
                            <span key={keyword} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {viewUser.ai_insights.profileSummary.matchTypes?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Best Matches</p>
                        <div className="flex flex-wrap gap-1">
                          {viewUser.ai_insights.profileSummary.matchTypes.map((type: string) => (
                            <span key={type} className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-xs rounded-full">
                              {type}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {viewUser.ai_insights.profileSummary.urgency && (
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          viewUser.ai_insights.profileSummary.urgency === 'high' 
                            ? 'bg-red-500/10 text-red-500' 
                            : viewUser.ai_insights.profileSummary.urgency === 'medium' 
                            ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-green-500/10 text-green-500'
                        }`}>
                          {viewUser.ai_insights.profileSummary.urgency} urgency
                        </span>
                        {viewUser.ai_insights.generatedAt && (
                          <span className="text-xs text-muted-foreground">
                            Generated {new Date(viewUser.ai_insights.generatedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                    {viewUser.ai_insights.linkedInData && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                          📊 LinkedIn: {viewUser.ai_insights.linkedInData.name} - {viewUser.ai_insights.linkedInData.headline}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Click "Generate Summary" to create an AI-powered profile summary using LinkedIn data and onboarding context.
                  </p>
                )}

                {/* Legacy AI insights */}
                {viewUser.ai_insights?.summary && !viewUser.ai_insights?.profileSummary && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground">Legacy Summary</p>
                    <p className="text-sm">{viewUser.ai_insights.summary}</p>
                  </div>
                )}
                
                {viewUser.onboarding_context?.contrarianBelief && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-muted-foreground">Contrarian Belief</p>
                    <p className="text-sm">{viewUser.onboarding_context.contrarianBelief}</p>
                  </div>
                )}
                {viewUser.onboarding_context?.careerInflection && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-muted-foreground">Career Inflection</p>
                    <p className="text-sm">{viewUser.onboarding_context.careerInflection}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p>{viewUser.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Role</p>
                  <p>{viewUser.role || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Industry</p>
                  <p>{viewUser.industry || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Looking For (legacy)</p>
                  <p>{viewUser.looking_for || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Skills</p>
                  <p>{viewUser.skills?.join(", ") || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Interests</p>
                  <p>{viewUser.interests?.join(", ") || "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Communication Style</p>
                  <p>{viewUser.communication_style || "—"}</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Chat History with ChekInn</h4>
                <div className="bg-muted/50 rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
                  {userMessages.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No messages yet</p>
                  ) : (
                    userMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-2 rounded-lg text-sm ${
                          msg.role === "user"
                            ? "bg-primary/10 ml-8"
                            : "bg-background mr-8"
                        }`}
                      >
                        <p className="text-xs text-muted-foreground mb-1">
                          {msg.role === "user" ? "User" : "ChekInn"}
                        </p>
                        {msg.content}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Chat Modal */}
      <Dialog open={!!viewIntro} onOpenChange={() => setViewIntro(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewIntro?.user_a?.full_name || viewIntro?.user_a?.email || "User A"} ↔ {viewIntro?.user_b?.full_name || viewIntro?.user_b?.email || "User B"}
            </DialogTitle>
          </DialogHeader>

          {viewIntro && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 max-h-96 overflow-y-auto space-y-2">
                {introChats.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center">
                    No messages yet
                  </p>
                ) : (
                  introChats.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-2 rounded-lg text-sm ${
                        msg.sender_id === viewIntro.user_a_id
                          ? "bg-primary/10 mr-8"
                          : "bg-blue-500/10 ml-8"
                      }`}
                    >
                      <p className="text-xs text-muted-foreground mb-1">
                        {msg.sender_id === viewIntro.user_a_id
                          ? (viewIntro.user_a?.full_name || viewIntro.user_a?.email || "User A")
                          : (viewIntro.user_b?.full_name || viewIntro.user_b?.email || "User B")}
                      </p>
                      {msg.content}
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  variant="destructive"
                  onClick={() => handleEndIntro(viewIntro)}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  End Conversation
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
