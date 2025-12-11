import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Shield, Lock, Trash2 } from "lucide-react";

const privacyPoints = [
  {
    icon: Shield,
    title: "Your data is yours",
    description: "We never sell your information",
  },
  {
    icon: Lock,
    title: "Your chats stay private",
    description: "End-to-end encrypted conversations",
  },
  {
    icon: Trash2,
    title: "Delete everything anytime",
    description: "Full control over your data",
  },
];

export const PrivacySection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="section-padding bg-background-fog">
      <div className="container-apple">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-display-md mb-4">Privacy first</h2>
          <p className="text-body-md text-muted-foreground">
            Built with trust at the core
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {privacyPoints.map((point, index) => (
            <motion.div
              key={point.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.15 }}
              className="text-center"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-card border border-border/50 mb-6">
                <point.icon className="w-6 h-6 text-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{point.title}</h3>
              <p className="text-muted-foreground">{point.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
