import { useRef, useState } from "react";
import { motion, useInView, PanInfo } from "framer-motion";

const testimonials = [
  {
    quote: "I met a recruiter from Meesho on day 1. Unreal.",
    author: "Priya S.",
    role: "IIT Delhi, CS '25",
  },
  {
    quote: "Feels like a friend introducing you to the perfect people.",
    author: "Arjun M.",
    role: "BITS Pilani, ECE '24",
  },
  {
    quote: "Got my internship through ChekInn. Wild.",
    author: "Sneha R.",
    role: "NMIMS Mumbai, MBA '25",
  },
  {
    quote: "The AI actually understands what I'm looking for.",
    author: "Rahul K.",
    role: "DU, Economics '24",
  },
];

export const Testimonials = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50;
    if (info.offset.x < -threshold && currentIndex < testimonials.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (info.offset.x > threshold && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  return (
    <section ref={ref} className="section-padding bg-background overflow-hidden">
      <div className="container-apple">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-display-md mb-4">What students say</h2>
        </motion.div>

        {/* Desktop: Grid layout */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="relative p-8 rounded-3xl bg-card border border-border/50 shadow-lg"
            >
              {/* Glow effect */}
              <div 
                className="absolute inset-0 rounded-3xl opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background: "radial-gradient(circle at 50% 50%, hsl(220 100% 70% / 0.1), transparent 70%)",
                }}
              />
              
              <p className="text-lg font-medium mb-6 relative">
                "{testimonial.quote}"
              </p>
              <div className="relative">
                <p className="font-semibold">{testimonial.author}</p>
                <p className="text-sm text-muted-foreground">{testimonial.role}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mobile: Swipeable */}
        <div className="md:hidden">
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            animate={{ x: -currentIndex * 100 + "%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex"
          >
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.author}
                className="flex-shrink-0 w-full px-4"
              >
                <div className="p-8 rounded-3xl bg-card border border-border/50 shadow-lg">
                  <p className="text-lg font-medium mb-6">
                    "{testimonial.quote}"
                  </p>
                  <div>
                    <p className="font-semibold">{testimonial.author}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Dots indicator */}
          <div className="flex justify-center gap-2 mt-6">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex 
                    ? "bg-foreground w-6" 
                    : "bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
