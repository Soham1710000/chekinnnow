import { memo, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, Lock, Eye, Zap, Network, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const Reputation = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }

  const tiers = [
    {
      name: "Trusted Peer",
      current: true,
      icon: Shield,
      capabilities: [
        "Access to Undercurrents",
        "Directional signals",
        "Limited circles",
      ],
    },
    {
      name: "Signal Carrier",
      current: false,
      icon: Zap,
      capabilities: [],
    },
    {
      name: "Social Node",
      current: false,
      icon: Network,
      capabilities: [],
    },
    {
      name: "Steward",
      current: false,
      icon: Crown,
      capabilities: [],
    },
  ];

  const buildsReputation = [
    "Helping others reach clarity",
    "Being sought for judgment",
    "Handling sensitive signals with restraint",
    "Thinking beyond first-order effects",
  ];

  const notReputation = [
    "Not popularity",
    "Not activity",
    "Not speed",
    "Not certainty",
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate("/chat")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-lg">Reputation & Access</h1>
          <div className="w-5" />
        </div>
      </header>

      <div className="p-6 max-w-lg mx-auto space-y-8">
        {/* Framing */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <p className="text-muted-foreground text-sm leading-relaxed">
            Reputation on ChekInn isn't visibility.
          </p>
          <p className="text-foreground font-medium">
            It's trust, earned through judgment and impact.
          </p>
        </motion.div>

        {/* Access Tiers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Access Tiers
          </h2>

          <div className="space-y-3">
            {tiers.map((tier, index) => {
              const Icon = tier.icon;
              return (
                <motion.div
                  key={tier.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + index * 0.05 }}
                  className={`rounded-xl border p-4 ${
                    tier.current
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-muted/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        tier.current
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {tier.current ? (
                        <Icon className="w-5 h-5" />
                      ) : (
                        <Lock className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3
                          className={`font-medium ${
                            tier.current ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {tier.name}
                        </h3>
                        {tier.current && (
                          <span className="text-[10px] uppercase tracking-wider bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                            Current
                          </span>
                        )}
                      </div>

                      {tier.current && tier.capabilities.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {tier.capabilities.map((cap) => (
                            <li
                              key={cap}
                              className="text-sm text-muted-foreground flex items-center gap-2"
                            >
                              <Eye className="w-3 h-3 text-primary/60" />
                              {cap}
                            </li>
                          ))}
                        </ul>
                      ) : !tier.current ? (
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          Unlocked through consistent impact over time.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Incentive */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Network className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground text-sm">
                Influential Circles
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Higher tiers unlock access to the most influential circles — 
                curated groups where signal quality matters most.
              </p>
            </div>
          </div>
        </motion.div>

        {/* What builds reputation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-3"
        >
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            What builds reputation
          </h2>
          <ul className="space-y-2">
            {buildsReputation.map((item, index) => (
              <motion.li
                key={item}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45 + index * 0.05 }}
                className="text-sm text-foreground flex items-center gap-2"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                {item}
              </motion.li>
            ))}
          </ul>
        </motion.div>

        {/* What reputation is not */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="space-y-3 pb-8"
        >
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            What reputation is not
          </h2>
          <ul className="space-y-2">
            {notReputation.map((item, index) => (
              <motion.li
                key={item}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.65 + index * 0.05 }}
                className="text-sm text-muted-foreground flex items-center gap-2"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                {item}
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </div>
    </div>
  );
};

export default Reputation;
