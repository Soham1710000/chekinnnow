import { useEffect, useState } from "react";
import Index from "./Index";
import IndexB from "./IndexB";

const ABRouter = () => {
  const [variant, setVariant] = useState<"A" | "B" | null>(null);

  useEffect(() => {
    // Check if user already has a variant assigned
    const existingVariant = sessionStorage.getItem("ab_variant");
    
    if (existingVariant === "A" || existingVariant === "B") {
      setVariant(existingVariant);
    } else {
      // Randomly assign 50/50
      const newVariant = Math.random() < 0.5 ? "A" : "B";
      sessionStorage.setItem("ab_variant", newVariant);
      setVariant(newVariant);
    }
  }, []);

  // Show nothing until variant is determined (prevents flash)
  if (variant === null) {
    return <div className="min-h-screen bg-white" />;
  }

  return variant === "A" ? <Index /> : <IndexB />;
};

export default ABRouter;
