import { useRef } from "react";
import { motion, useInView } from "framer-motion";

interface LogoItem {
  name: string;
  category: "recruiter" | "mentor";
}

const logos: LogoItem[] = [
  // Recruiters
  { name: "Google", category: "recruiter" },
  { name: "Swiggy", category: "recruiter" },
  { name: "Meesho", category: "recruiter" },
  { name: "Zepto", category: "recruiter" },
  { name: "Unacademy", category: "recruiter" },
  { name: "CRED", category: "recruiter" },
  // Mentors
  { name: "Razorpay", category: "mentor" },
  { name: "Bain", category: "mentor" },
  { name: "BCG", category: "mentor" },
  { name: "Deloitte", category: "mentor" },
];

const LogoCard = ({ name, index }: { name: string; index: number }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="group flex items-center justify-center p-8 rounded-2xl bg-card border border-border/30 hover:border-border transition-all duration-300"
    >
      <span className="text-lg font-semibold text-muted-foreground group-hover:text-foreground transition-colors duration-300">
        {name}
      </span>
    </motion.div>
  );
};

export const TrustSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const recruiters = logos.filter(l => l.category === "recruiter");
  const mentors = logos.filter(l => l.category === "mentor");

  return (
    <section ref={ref} className="section-padding bg-background-fog">
      <div className="container-apple">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <h2 className="text-display-md mb-4">Who's already here</h2>
          <p className="text-body-md text-muted-foreground">
            Trusted by industry leaders
          </p>
        </motion.div>

        {/* Recruiters */}
        <div className="mb-16">
          <motion.h3
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-8 text-center"
          >
            Recruiters from
          </motion.h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {recruiters.map((logo, index) => (
              <LogoCard key={logo.name} name={logo.name} index={index} />
            ))}
          </div>
        </div>

        {/* Mentors */}
        <div>
          <motion.h3
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-8 text-center"
          >
            Mentors from
          </motion.h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {mentors.map((logo, index) => (
              <LogoCard key={logo.name} name={logo.name} index={index + recruiters.length} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
