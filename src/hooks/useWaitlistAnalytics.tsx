import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface WaitlistStats {
  totalUsers: number;
  accessGranted: number;
  waiting: number;
  totalReferrals: number;
  dailySignups: { date: string; count: number }[];
  topReferrers: { email: string; referrals: number }[];
}

export const useWaitlistAnalytics = () => {
  const [stats, setStats] = useState<WaitlistStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const { data: entries, error } = await supabase
        .from("waitlist")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (!entries) {
        setStats(null);
        return;
      }

      // Calculate stats
      const totalUsers = entries.length;
      const accessGranted = entries.filter(e => e.access_granted).length;
      const waiting = entries.filter(e => !e.access_granted).length;
      const totalReferrals = entries.reduce((sum, e) => sum + (e.referrals_count || 0), 0);

      // Daily signups (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date.toISOString().split('T')[0];
      });

      const dailySignups = last7Days.map(date => ({
        date,
        count: entries.filter(e => e.created_at.startsWith(date)).length
      }));

      // Top referrers
      const topReferrers = entries
        .filter(e => e.referrals_count > 0)
        .sort((a, b) => b.referrals_count - a.referrals_count)
        .slice(0, 5)
        .map(e => ({
          email: e.email || e.phone || "Unknown",
          referrals: e.referrals_count
        }));

      setStats({
        totalUsers,
        accessGranted,
        waiting,
        totalReferrals,
        dailySignups,
        topReferrers
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return { stats, loading, refetch: fetchStats };
};
