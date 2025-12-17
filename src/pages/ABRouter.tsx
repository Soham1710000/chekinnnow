import { useEffect, useState } from "react";
import Index from "./Index";
import IndexB from "./IndexB";
import IndexC from "./IndexC";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";

const ABRouter = () => {
  const [variant, setVariant] = useState<"A" | "B" | "C" | null>(null);
  const { trackEvent } = useFunnelTracking();

  useEffect(() => {
    // Check if user already has a variant assigned
    const existingVariant = sessionStorage.getItem("ab_variant");
    
    if (existingVariant === "A" || existingVariant === "B" || existingVariant === "C") {
      setVariant(existingVariant);
      // Track returning user with existing variant
      trackEvent("ab_variant_view", { variant: existingVariant, isNew: false });
    } else {
      // 35% A, 35% B, 30% C
      const rand = Math.random();
      let newVariant: "A" | "B" | "C";
      if (rand < 0.35) {
        newVariant = "A";
      } else if (rand < 0.70) {
        newVariant = "B";
      } else {
        newVariant = "C";
      }
      sessionStorage.setItem("ab_variant", newVariant);
      setVariant(newVariant);
      // Track new variant assignment
      trackEvent("ab_variant_assigned", { variant: newVariant, isNew: true });
    }
  }, []);

  // Show nothing until variant is determined (prevents flash)
  if (variant === null) {
    return <div className="min-h-screen bg-white" />;
  }

  if (variant === "C") return <IndexC />;
  return variant === "A" ? <Index /> : <IndexB />;
};

export default ABRouter;
