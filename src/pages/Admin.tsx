import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Check, X, LogOut, ArrowLeft } from "lucide-react";

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

const Admin = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);

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
    }
  }, [isAdmin]);

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
            <h1 className="text-2xl font-bold text-gray-900">Waitlist Admin</h1>
          </div>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 border">
            <p className="text-sm text-gray-500">Total Users</p>
            <p className="text-2xl font-bold">{entries.length}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border">
            <p className="text-sm text-gray-500">Access Granted</p>
            <p className="text-2xl font-bold text-green-600">
              {entries.filter((e) => e.access_granted).length}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 border">
            <p className="text-sm text-gray-500">Waiting</p>
            <p className="text-2xl font-bold text-orange-600">
              {entries.filter((e) => !e.access_granted).length}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 border">
            <p className="text-sm text-gray-500">Total Referrals</p>
            <p className="text-2xl font-bold">
              {entries.reduce((sum, e) => sum + e.referrals_count, 0)}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border overflow-hidden">
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
                    <th className="text-left text-sm font-medium text-gray-500 px-4 py-3">Email/Phone</th>
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
      </motion.div>
    </div>
  );
};

export default Admin;
