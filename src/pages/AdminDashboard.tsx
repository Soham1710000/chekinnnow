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
}

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

const AdminDashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [introductions, setIntroductions] = useState<Introduction[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    } else if (user) {
      checkAdminStatus();
    }
  }, [user, authLoading]);

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

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadProfiles(), loadIntroductions()]);
    setLoading(false);
  };

  const loadProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading profiles:", error);
      return;
    }

    setProfiles(data as Profile[]);
  };

  const loadIntroductions = async () => {
    const { data, error } = await supabase
      .from("introductions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading introductions:", error);
      return;
    }

    // Fetch user profiles for each intro
    const introsWithUsers = await Promise.all(
      (data || []).map(async (intro) => {
        const [userA, userB] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", intro.user_a_id).maybeSingle(),
          supabase.from("profiles").select("*").eq("id", intro.user_b_id).maybeSingle(),
        ]);
        return {
          ...intro,
          user_a: userA.data,
          user_b: userB.data,
        };
      })
    );

    setIntroductions(introsWithUsers as Introduction[]);
  };

  const loadUserMessages = async (userId: string) => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading messages:", error);
      return;
    }

    setUserMessages(data || []);
  };

  const loadIntroChats = async (introId: string) => {
    const { data, error } = await supabase
      .from("user_chats")
      .select("*")
      .eq("introduction_id", introId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading chats:", error);
      return;
    }

    setIntroChats(data as ChatMessage[]);
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

    const { error } = await supabase.from("introductions").insert({
      user_a_id: selectedUserA.id,
      user_b_id: selectedUserB.id,
      intro_message: introMessage,
      created_by: user?.id,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setCreating(false);
      return;
    }

    toast({
      title: "Introduction created!",
      description: `${selectedUserA.full_name} and ${selectedUserB.full_name} will see the intro card.`,
    });

    setShowCreateIntro(false);
    setSelectedUserA(null);
    setSelectedUserB(null);
    setIntroMessage("");
    setCreating(false);
    loadIntroductions();
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

    loadIntroductions();
    setViewIntro(null);
  };

  const filteredProfiles = profiles.filter(
    (p) =>
      p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.industry?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || checkingAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-4">You don't have admin access.</p>
        <Button onClick={() => navigate("/")}>Go Home</Button>
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
            <Button variant="outline" size="sm" onClick={loadData}>
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

        {/* Tabs */}
        <Tabs defaultValue="users" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <TabsList>
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
                      <div className="flex items-center gap-2 pt-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${
                            profile.learning_complete
                              ? "bg-green-500/10 text-green-500"
                              : "bg-yellow-500/10 text-yellow-500"
                          }`}
                        >
                          {profile.learning_complete
                            ? "Learning Complete"
                            : `${profile.learning_messages_count || 0}/6 messages`}
                        </span>
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
                        {intro.status === "active" && (
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
                {profiles
                  .filter((p) => p.learning_complete)
                  .map((p) => (
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
                  .filter((p) => p.learning_complete && p.id !== selectedUserA?.id)
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
              {viewIntro?.user_a?.full_name} ↔ {viewIntro?.user_b?.full_name}
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
                          ? viewIntro.user_a?.full_name
                          : viewIntro.user_b?.full_name}
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
