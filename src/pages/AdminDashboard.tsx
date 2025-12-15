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
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
  created_at: string;
  chat_messages?: any[];
  message_count?: number;
}

interface Introduction {
  id: string;
  user_a_id: string;
  user_b_id: string;
  intro_message: string;
  status: string;
  created_at: string;
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

const ADMIN_PASSWORD = "chekinn2024";

const AdminDashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [introductions, setIntroductions] = useState<Introduction[]>([]);
  const [funnelStats, setFunnelStats] = useState<FunnelStats | null>(null);
  const [recentEvents, setRecentEvents] = useState<FunnelEvent[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [funnelTimeRange, setFunnelTimeRange] = useState(24);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // Password gate
  const [passwordEntered, setPasswordEntered] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  // Create intro modal
  const [showCreateIntro, setShowCreateIntro] = useState(false);
  const [selectedUserA, setSelectedUserA] = useState<Profile | null>(null);
  const [selectedUserB, setSelectedUserB] = useState<Profile | null>(null);
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

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setPasswordEntered(true);
      setPasswordError(false);
      loadData();
    } else {
      setPasswordError(true);
    }
  };

  const checkAdminStatus = async () => {
    if (!user) return;

    const { data, error } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (error) {
      console.error("Error checking admin status:", error);
      setCheckingAdmin(false);
      return;
    }

    setIsAdmin(data);
    setCheckingAdmin(false);

    if (data) {
      loadData();
    }
  };

  const loadData = async (timeRange?: number) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-data", {
        body: { password: ADMIN_PASSWORD, timeRange: timeRange || funnelTimeRange },
      });

      if (error) throw error;

      setProfiles(data.profiles || []);
      setIntroductions(data.introductions || []);
      setFunnelStats(data.funnelStats || null);
      setRecentEvents(data.recentEvents || []);
      setLeads(data.leads || []);
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
      const { data, error } = await supabase.functions.invoke("admin-create-intro", {
        body: {
          password: ADMIN_PASSWORD,
          user_a_id: selectedUserA.id,
          user_b_id: selectedUserB.id,
          intro_message: introMessage,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Introduction created!",
        description: `${selectedUserA.full_name} and ${selectedUserB.full_name} will see the intro card.`,
      });

      setShowCreateIntro(false);
      setSelectedUserA(null);
      setSelectedUserB(null);
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
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
                <Link2 className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {introductions.filter((i) => i.status === "active").length}
                </p>
                <p className="text-sm text-muted-foreground">Active Chats</p>
              </div>
            </div>
          </div>
        </div>

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

        {/* Tabs */}
        <Tabs defaultValue="funnel" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <TabsList>
              <TabsTrigger value="funnel">Funnel</TabsTrigger>
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
            {/* Time Range Selector */}
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

            {/* Funnel Stats */}
            {funnelStats && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-muted-foreground">Page Views</span>
                  </div>
                  <p className="text-2xl font-bold">{funnelStats.page_view}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MousePointer className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">CTA Clicks</span>
                  </div>
                  <p className="text-2xl font-bold">{funnelStats.cta_click}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageCircle className="w-4 h-4 text-cyan-500" />
                    <span className="text-sm text-muted-foreground">Chat Loaded</span>
                  </div>
                  <p className="text-2xl font-bold">{funnelStats.chat_page_loaded || 0}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <UserPlus className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm text-muted-foreground">Auth Started</span>
                  </div>
                  <p className="text-2xl font-bold">{funnelStats.auth_start}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm text-muted-foreground">Auth Complete</span>
                  </div>
                  <p className="text-2xl font-bold">{funnelStats.auth_complete}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-purple-500" />
                    <span className="text-sm text-muted-foreground">Waitlist Success</span>
                  </div>
                  <p className="text-2xl font-bold">{funnelStats.waitlist_success}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-muted-foreground">Sessions</span>
                  </div>
                  <p className="text-2xl font-bold">{funnelStats.unique_sessions}</p>
                </div>
              </div>
            )}

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

                    {/* AI Summary - highlighted */}
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
                      {profile.looking_for && (
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
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold border-2 border-background">
                            {intro.user_a?.full_name?.charAt(0) || "?"}
                          </div>
                          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 font-semibold border-2 border-background">
                            {intro.user_b?.full_name?.charAt(0) || "?"}
                          </div>
                        </div>
                        <div>
                          <h3 className="font-medium">
                            {intro.user_a?.full_name || "User A"} ↔{" "}
                            {intro.user_b?.full_name || "User B"}
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
            <div>
              <label className="text-sm font-medium mb-2 block">User A</label>
              <select
                className="w-full p-2 border border-border rounded-lg bg-background"
                value={selectedUserA?.id || ""}
                onChange={(e) => {
                  const user = profiles.find((p) => p.id === e.target.value);
                  setSelectedUserA(user || null);
                }}
              >
              <option value="">Select user...</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.email} - {p.role || "No role"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">User B</label>
              <select
                className="w-full p-2 border border-border rounded-lg bg-background"
                value={selectedUserB?.id || ""}
                onChange={(e) => {
                  const user = profiles.find((p) => p.id === e.target.value);
                  setSelectedUserB(user || null);
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
                  <p className="text-muted-foreground">Looking For</p>
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
