import { useEffect } from "react";
import Index from "./Index";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";

const ABRouter = () => {
  const { trackEvent } = useFunnelTracking();

  useEffect(() => {
    trackEvent("ab_variant_view", { variant: "A", isNew: false });
  }, []);

  // Only variant A now - B is killed
  return <Index />;
};

export default ABRouter;