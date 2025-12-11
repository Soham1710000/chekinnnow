import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

interface CarouselCard {
  title: string;
  description: string;
  icon: string;
  gradient: string;
}

const defaultCards: CarouselCard[] = [
  {
    title: "Recruiters",
    description: "Get noticed by top companies actively hiring",
    icon: "💼",
    gradient: "from-blue-500/10 to-indigo-500/10",
  },
  {
    title: "Mentors",
    description: "Learn from industry veterans who've been there",
    icon: "🎯",
    gradient: "from-purple-500/10 to-pink-500/10",
  },
  {
    title: "Internships",
    description: "Land opportunities at startups & enterprises",
    icon: "🚀",
    gradient: "from-orange-500/10 to-red-500/10",
  },
  {
    title: "Founders",
    description: "Connect with entrepreneurs building the future",
    icon: "⚡",
    gradient: "from-yellow-500/10 to-amber-500/10",
  },
  {
    title: "Campus Hubs",
    description: "Join communities at your college",
    icon: "🏛️",
    gradient: "from-green-500/10 to-emerald-500/10",
  },
];

interface CardCarouselProps {
  cards?: CarouselCard[];
  speed?: number;
  pauseOnHover?: boolean;
}

export const CardCarousel = ({ 
  cards = defaultCards, 
  speed = 40,
  pauseOnHover = true 
}: CardCarouselProps) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [isPaused, setIsPaused] = useState(false);

  // Duplicate cards for infinite scroll effect
  const duplicatedCards = [...cards, ...cards];

  return (
    <section ref={ref} className="section-padding bg-background-subtle overflow-hidden">
      <div className="container-apple mb-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <h2 className="text-display-md mb-4">
            Find your people
          </h2>
          <p className="text-body-md text-muted-foreground max-w-xl mx-auto">
            ChekInn connects you with the right opportunities
          </p>
        </motion.div>
      </div>

      <div 
        className="relative"
        onMouseEnter={() => pauseOnHover && setIsPaused(true)}
        onMouseLeave={() => pauseOnHover && setIsPaused(false)}
      >
        <motion.div
          className="flex gap-6"
          animate={{
            x: isPaused ? undefined : [0, -50 * cards.length * 16],
          }}
          transition={{
            x: {
              duration: speed,
              repeat: Infinity,
              ease: "linear",
            },
          }}
          style={{ width: "max-content" }}
        >
          {duplicatedCards.map((card, index) => (
            <motion.div
              key={`${card.title}-${index}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: (index % cards.length) * 0.1 }}
              whileHover={{ scale: 1.05, y: -8 }}
              className={`
                relative flex-shrink-0 w-72 p-8 rounded-3xl
                bg-gradient-to-br ${card.gradient}
                bg-card border border-border/50
                shadow-lg hover:shadow-xl
                transition-shadow duration-300
                cursor-pointer
              `}
            >
              <div className="text-4xl mb-4">{card.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{card.title}</h3>
              <p className="text-sm text-muted-foreground">{card.description}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Fade edges */}
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background-subtle to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background-subtle to-transparent pointer-events-none" />
      </div>
    </section>
  );
};
