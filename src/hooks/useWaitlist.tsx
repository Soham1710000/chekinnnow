import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

interface WaitlistEntry {
  id: string;
  user_id: string;
  email: string | null;
  phone: string | null;
  waitlist_position: number;
  referral_code: string;
  referrals_count: number;
  referred_by: string | null;
  access_granted: boolean;
  created_at: string;
  updated_at: string;
}

export const useWaitlist = () => {
  const { user } = useAuth();
  const [entry, setEntry] = useState<WaitlistEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialPosition, setInitialPosition] = useState<number | null>(null);

  const fetchWaitlistEntry = async () => {
    if (!user) {
      setEntry(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("waitlist")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setEntry(data);
        if (initialPosition === null) {
          setInitialPosition(data.waitlist_position);
        }
      }
    } catch (error) {
      console.error("Error fetching waitlist entry:", error);
    } finally {
      setLoading(false);
    }
  };

  const createWaitlistEntry = async (referredBy?: string) => {
    if (!user) return null;

    try {
      // Get next position
      const { data: positionData, error: positionError } = await supabase
        .rpc("get_next_waitlist_position");
      
      if (positionError) throw positionError;

      // Generate referral code
      const { data: codeData, error: codeError } = await supabase
        .rpc("generate_referral_code");
      
      if (codeError) throw codeError;

      // Create entry
      const { data, error } = await supabase
        .from("waitlist")
        .insert({
          user_id: user.id,
          email: user.email,
          phone: user.phone,
          waitlist_position: positionData,
          referral_code: codeData,
          referred_by: referredBy || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Process referral if exists
      if (referredBy && referredBy !== codeData) {
        await supabase.rpc("process_referral", { referrer_code: referredBy });
      }

      setEntry(data);
      setInitialPosition(data.waitlist_position);
      return data;
    } catch (error: any) {
      console.error("Error creating waitlist entry:", error);
      toast.error("Failed to join waitlist");
      return null;
    }
  };

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("waitlist-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "waitlist",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setEntry(payload.new as WaitlistEntry);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    fetchWaitlistEntry();
  }, [user]);

  const spotsGained = initialPosition && entry 
    ? Math.max(0, initialPosition - entry.waitlist_position) 
    : 0;

  return {
    entry,
    loading,
    createWaitlistEntry,
    refetch: fetchWaitlistEntry,
    spotsGained,
  };
};
