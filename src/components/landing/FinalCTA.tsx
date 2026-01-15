import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const FinalCTA = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const navigate = useNavigate();

  const handleClick = async () => {
    // Check if user is already logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Already logged in, go straight to chat
      navigate("/chat");
    } else {
      // Go directly to auth
      navigate("/auth");
    }
  };

  return (
    <section ref={ref} className="py-12 md:py-16 lg:py-20 bg-background">
      <div className="container-apple">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="flex justify-center"
          >
            <Button 
              variant="hero" 
              size="hero"
              onClick={handleClick}
            >
              Let's Talk
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};