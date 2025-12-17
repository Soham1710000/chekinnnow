import { useEffect, useState } from "react";
import Index from "./Index";
import IndexB from "./IndexB";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";

const ABRouter = () => {
  const [variant, setVariant] = useState<"A" | "B" | null>(null);
  const { trackEvent } = useFunnelTracking();

  useEffect(() => {
    const existingVariant = sessionStorage.getItem("ab_variant");
    
    if (existingVariant === "A" || existingVariant === "B") {
      setVariant(existingVariant);
      trackEvent("ab_variant_view", { variant: existingVariant, isNew: false });
    } else {
      // 50/50 split
      const newVariant = Math.random() < 0.5 ? "A" : "B";
      sessionStorage.setItem("ab_variant", newVariant);
      setVariant(newVariant);
      trackEvent("ab_variant_assigned", { variant: newVariant, isNew: true });
    }
  }, []);

  if (variant === null) {
    return <div className="min-h-screen bg-white" />;
  }

  return variant === "A" ? <Index /> : <IndexB />;
};

export default ABRouter;