import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWaitlistAnalytics } from "@/hooks/useWaitlistAnalytics";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Check, X, LogOut, ArrowLeft, TrendingUp, Users, UserCheck, Share2, Mic, Keyboard, Volume2, MessageSquare, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface WaitlistEntry {
  id: string;
  email: string | null;
  phone: string | null;
  waitlist_position: number;
  referral_code: string;
  referrals_count: number;
  access_granted: boolean;
  created_at: string;
}

interface VoiceExperimentStats {
  voice_first_sessions: number;
  text_first_sessions: number;
  voice_messages_count: number;
  text_messages_count: number;
  voice_recordings_started: number;
  voice_recordings_completed: number;
  voice_recordings_abandoned: number;
  voice_abandon_rate: number;
  avg_voice_duration_seconds: number;
  max_voice_duration_seconds: number;
  avg_messages_voice_first: number;
  avg_messages_text_first: number;
  voice_first_auth_complete: number;
  text_first_auth_complete: number;
  voice_first_conversion_rate: number;
  text_first_conversion_rate: number;
  mode_switches: number;
  recent_voice_events: any[];
}

const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444'];

const Admin = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [voiceStats, setVoiceStats] = useState<VoiceExperimentStats | null>(null);
  const [activeTab, setActiveTab] = useState<"waitlist" | "voice">("voice");
  const { stats, loading: statsLoading } = useWaitlistAnalytics();

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setCheckingAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .rpc("has_role", { _user_id: user.id, _role: "admin" });
        
        if (error) throw error;
        setIsAdmin(data === true);
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      } finally {
        setCheckingAdmin(false);
      }
    };

    if (!authLoading) {
      checkAdminStatus();
    }
  }, [user, authLoading]);

  useEffect(() => {
    const fetchEntries = async () => {
      if (!isAdmin) return;

      try {
        const { data, error } = await supabase
          .from("waitlist")
          .select("*")
          .order("waitlist_position", { ascending: true });

        if (error) throw error;
        setEntries(data || []);
      } catch (error) {
        console.error("Error fetching entries:", error);
        toast.error("Failed to load waitlist entries");
      } finally {
        setLoadingEntries(false);
      }
    };

    if (isAdmin) {
      fetchEntries();
      fetchVoiceStats();
    }
  }, [isAdmin]);

  const fetchVoiceStats = async () => {
    try {
      const adminPassword = prompt("Enter admin password:");
      if (!adminPassword) return;

      const { data, error } = await supabase.functions.invoke("admin-data", {
        body: { password: adminPassword, timeRange: 168 } // Last 7 days
      });

      if (error) throw error;
      if (data.voiceExperimentStats) {
        setVoiceStats(data.voiceExperimentStats);
      }
    } catch (error) {
      console.error("Error fetching voice stats:", error);
    }
  };

  const toggleAccess = async (id: string, currentAccess: boolean) => {
    try {
      const { error } = await supabase
        .from("waitlist")
        .update({ access_granted: !currentAccess })
        .eq("id", id);

      if (error) throw error;

      setEntries((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, access_granted: !currentAccess } : e
        )
      );

      toast.success(`Access ${!currentAccess ? "granted" : "revoked"}`);
    } catch (error) {
      console.error("Error toggling access:", error);
      toast.error("Failed to update access");
    }
  };

  if (authLoading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Admin Access Required</h1>
          <p className="text-gray-600 mb-6">Please sign in to access the admin panel.</p>
          <Button onClick={() => navigate("/waitlist")}>Sign In</Button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">You don't have admin privileges.</p>
          <Button onClick={() => navigate("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  const variantComparisonData = voiceStats ? [
    { name: 'Voice First', sessions: voiceStats.voice_first_sessions, conversions: voiceStats.voice_first_auth_complete, avgMessages: voiceStats.avg_messages_voice_first },
    { name: 'Text First', sessions: voiceStats.text_first_sessions, conversions: voiceStats.text_first_auth_complete, avgMessages: voiceStats.avg_messages_text_first },
  ] : [];

  const inputModeData = voiceStats ? [
    { name: 'Voice', value: voiceStats.voice_messages_count },
    { name: 'Text', value: voiceStats.text_messages_count },
  ] : [];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          </div>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === "voice" ? "default" : "outline"}
            onClick={() => setActiveTab("voice")}
          >
            <Mic className="w-4 h-4 mr-2" />
            Voice Experiment
          </Button>
          <Button
            variant={activeTab === "waitlist" ? "default" : "outline"}
            onClick={() => setActiveTab("waitlist")}
          >
            <Users className="w-4 h-4 mr-2" />
            Waitlist
          </Button>
        </div>

        {activeTab === "voice" && (
          <>
            {/* Voice Experiment Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl p-4 border shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Mic className="w-5 h-5 text-purple-600" />
                  </div>
                  <p className="text-sm text-gray-500">Voice First</p>
                </div>
                <p className="text-3xl font-bold text-purple-600">{voiceStats?.voice_first_sessions || 0}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {voiceStats?.voice_first_conversion_rate || 0}% converted
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                    <Keyboard className="w-5 h-5 text-cyan-600" />
                  </div>
                  <p className="text-sm text-gray-500">Text First</p>
                </div>
                <p className="text-3xl font-bold text-cyan-600">{voiceStats?.text_first_sessions || 0}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {voiceStats?.text_first_conversion_rate || 0}% converted
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Volume2 className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="text-sm text-gray-500">Voice Messages</p>
                </div>
                <p className="text-3xl font-bold text-green-600">{voiceStats?.voice_messages_count || 0}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Avg {voiceStats?.avg_voice_duration_seconds || 0}s duration
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-orange-600" />
                  </div>
                  <p className="text-sm text-gray-500">Text Messages</p>
                </div>
                <p className="text-3xl font-bold text-orange-600">{voiceStats?.text_messages_count || 0}</p>
              </div>
            </div>

            {/* Voice Recording Stats */}
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-xl p-4 border shadow-sm">
                <p className="text-sm text-gray-500 mb-1">Recordings Started</p>
                <p className="text-2xl font-bold">{voiceStats?.voice_recordings_started || 0}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border shadow-sm">
                <p className="text-sm text-gray-500 mb-1">Recordings Completed</p>
                <p className="text-2xl font-bold text-green-600">{voiceStats?.voice_recordings_completed || 0}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border shadow-sm">
                <p className="text-sm text-gray-500 mb-1">Abandon Rate</p>
                <p className="text-2xl font-bold text-red-600">{voiceStats?.voice_abandon_rate || 0}%</p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Variant Comparison */}
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  A/B Test Comparison
                </h3>
                {variantComparisonData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={variantComparisonData}>
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="sessions" fill="#8b5cf6" name="Sessions" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="conversions" fill="#06b6d4" name="Conversions" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-gray-400">
                    No data yet
                  </div>
                )}
              </div>

              {/* Input Mode Distribution */}
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Message Input Mode</h3>
                {inputModeData.some(d => d.value > 0) ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={inputModeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {inputModeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-gray-400">
                    No data yet
                  </div>
                )}
              </div>
            </div>

            {/* Engagement Comparison */}
            <div className="bg-white rounded-xl border shadow-sm p-6 mb-8">
              <h3 className="font-semibold text-gray-900 mb-4">Engagement by Variant</h3>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-2">Voice First</p>
                  <p className="text-4xl font-bold text-purple-600">{voiceStats?.avg_messages_voice_first || 0}</p>
                  <p className="text-xs text-gray-400">avg messages/session</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-2">Text First</p>
                  <p className="text-4xl font-bold text-cyan-600">{voiceStats?.avg_messages_text_first || 0}</p>
                  <p className="text-xs text-gray-400">avg messages/session</p>
                </div>
              </div>
            </div>

            {/* Mode Switches & Max Duration */}
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <div className="bg-white rounded-xl p-4 border shadow-sm">
                <p className="text-sm text-gray-500 mb-1">Mode Switches</p>
                <p className="text-2xl font-bold">{voiceStats?.mode_switches || 0}</p>
                <p className="text-xs text-gray-400">Users switching between voice/text</p>
              </div>
              <div className="bg-white rounded-xl p-4 border shadow-sm">
                <p className="text-sm text-gray-500 mb-1">Max Voice Duration</p>
                <p className="text-2xl font-bold">{voiceStats?.max_voice_duration_seconds || 0}s</p>
                <p className="text-xs text-gray-400">Longest voice recording</p>
              </div>
            </div>
          </>
        )}

        {activeTab === "waitlist" && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl p-4 border shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="text-sm text-gray-500">Total Users</p>
                </div>
                <p className="text-3xl font-bold">{stats?.totalUsers || 0}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <UserCheck className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="text-sm text-gray-500">Access Granted</p>
                </div>
                <p className="text-3xl font-bold text-green-600">{stats?.accessGranted || 0}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-orange-600" />
                  </div>
                  <p className="text-sm text-gray-500">Waiting</p>
                </div>
                <p className="text-3xl font-bold text-orange-600">{stats?.waiting || 0}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Share2 className="w-5 h-5 text-purple-600" />
                  </div>
                  <p className="text-sm text-gray-500">Total Referrals</p>
                </div>
                <p className="text-3xl font-bold text-purple-600">{stats?.totalReferrals || 0}</p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Daily Signups Chart */}
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Daily Signups (Last 7 Days)</h3>
                {stats?.dailySignups && stats.dailySignups.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={stats.dailySignups}>
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { weekday: 'short' })}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip 
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
                        formatter={(value) => [value, 'Signups']}
                      />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-gray-400">
                    No data yet
                  </div>
                )}
              </div>

              {/* Top Referrers */}
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Top Referrers</h3>
                {stats?.topReferrers && stats.topReferrers.length > 0 ? (
                  <div className="space-y-3">
                    {stats.topReferrers.map((referrer, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                            {index + 1}
                          </span>
                          <span className="text-sm text-gray-700 truncate max-w-[180px]">
                            {referrer.email}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-purple-600">
                          {referrer.referrals} referrals
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-gray-400">
                    No referrals yet
                  </div>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h3 className="font-semibold text-gray-900">All Users</h3>
              </div>
              {loadingEntries ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left text-sm font-medium text-gray-500 px-4 py-3">Pos</th>
                        <th className="text-left text-sm font-medium text-gray-500 px-4 py-3">Email</th>
                        <th className="text-left text-sm font-medium text-gray-500 px-4 py-3">Referral Code</th>
                        <th className="text-left text-sm font-medium text-gray-500 px-4 py-3">Referrals</th>
                        <th className="text-left text-sm font-medium text-gray-500 px-4 py-3">Status</th>
                        <th className="text-left text-sm font-medium text-gray-500 px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {entries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">#{entry.waitlist_position}</td>
                          <td className="px-4 py-3 text-gray-600">
                            {entry.email || entry.phone || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                              {entry.referral_code}
                            </code>
                          </td>
                          <td className="px-4 py-3">{entry.referrals_count}</td>
                          <td className="px-4 py-3">
                            {entry.access_granted ? (
                              <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                                <Check className="w-4 h-4" /> Granted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-orange-600 text-sm">
                                <X className="w-4 h-4" /> Waiting
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              size="sm"
                              variant={entry.access_granted ? "outline" : "default"}
                              onClick={() => toggleAccess(entry.id, entry.access_granted)}
                            >
                              {entry.access_granted ? "Revoke" : "Grant"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default Admin;
