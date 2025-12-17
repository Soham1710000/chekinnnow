import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";
import { ArrowRight, Users, MessageCircle, Sparkles } from "lucide-react";

// Compact pain points
const painPoints = [
  "Where do I start?",
  "Answer writing",
  "Optional confusion",
  "Prelims anxiety",
];

// Social proof people
const socialProof = [
  { name: "LBSNAA Alumni", desc: "Current serving officers" },
  { name: "Top 50 Rankers", desc: "From recent attempts" },
  { name: "IIT/IIM/DU", desc: "From top institutions" },
  { name: "Working Professionals", desc: "Who cleared while working" },
];

const UPSC = () => {
  const { trackPageView, trackEvent } = useFunnelTracking();
  const navigate = useNavigate();

  // Defer tracking to not block render
  useEffect(() => {
    requestIdleCallback ? requestIdleCallback(() => trackPageView()) : setTimeout(trackPageView, 0);
  }, [trackPageView]);

  const handlePainPointClick = useCallback((painPoint: string) => {
    sessionStorage.setItem("chekinn_initial_message", painPoint);
    sessionStorage.setItem("chekinn_source", "upsc");
    // Track async to not block navigation
    trackEvent("cta_click", { variant: "UPSC", template: painPoint });
    navigate("/chat");
  }, [navigate, trackEvent]);

  const handleMainCTA = useCallback(() => {
    sessionStorage.setItem("chekinn_source", "upsc");
    trackEvent("cta_click", { variant: "UPSC", template: "main_cta" });
    navigate("/chat");
  }, [navigate, trackEvent]);

  return (
    <main className="min-h-screen bg-[hsl(50_20%_98%)] text-[hsl(0_0%_11%)]">
      {/* Hero Section - One Fold */}
      <section className="min-h-[100svh] flex flex-col justify-center px-6 py-10">
        <div className="max-w-[520px] w-full mx-auto space-y-8">
          
          {/* Small trust indicator - no animation delay */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs bg-[hsl(50_10%_93%)] text-[hsl(0_0%_45%)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-[hsl(140_50%_45%)]"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[hsl(140_50%_40%)]"></span>
              </span>
              <span>50+ aspirants connected</span>
            </div>
          </div>

          {/* Headline - no animation delay */}
          <div className="text-center space-y-3">
            <h1 className="text-3xl sm:text-4xl font-semibold leading-tight tracking-tight text-[hsl(0_0%_11%)]">
              UPSC is lonely.
              <br />
              <span className="font-normal text-[hsl(0_0%_45%)]">
                It doesn't have to be.
              </span>
            </h1>
            <p className="text-base sm:text-lg text-[hsl(0_0%_50%)]">
              We'll connect you with someone who's been there.
            </p>
          </div>

          {/* Pain points - CSS hover instead of JS */}
          <div className="space-y-3">
            <p className="text-center text-xs font-medium tracking-wide uppercase text-[hsl(0_0%_55%)]">
              Sound familiar?
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {painPoints.map((point, index) => (
                <button
                  key={index}
                  onClick={() => handlePainPointClick(point)}
                  className="px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 
                    bg-[hsl(50_15%_94%)] border border-[hsl(50_10%_86%)] text-[hsl(0_0%_25%)]
                    hover:bg-[hsl(220_38%_20%)] hover:border-[hsl(220_38%_20%)] hover:text-white
                    active:scale-[0.97]"
                >
                  {point}
                </button>
              ))}
            </div>
          </div>

          {/* Main CTA - CSS hover instead of JS */}
          <div className="text-center space-y-3">
            <button
              onClick={handleMainCTA}
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full font-semibold text-[15px] 
                bg-[hsl(220_38%_20%)] text-white shadow-[0_4px_20px_-4px_hsl(220_38%_20%/0.35)]
                transition-all duration-150 hover:shadow-[0_8px_30px_-4px_hsl(220_38%_20%/0.5)] 
                hover:scale-[1.02] active:scale-[0.98]"
            >
              Talk to us
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-xs text-[hsl(0_0%_55%)]">
              No signup needed
            </p>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-20 px-6 bg-[hsl(50_15%_96%)]">
        <div className="max-w-[640px] mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-12 text-[hsl(0_0%_11%)]">
            How it works
          </h2>
          
          <div className="space-y-8">
            {[
              {
                icon: MessageCircle,
                title: "Tell us what you're struggling with",
                desc: "A quick 2-minute chat. No forms, no sign-ups."
              },
              {
                icon: Sparkles,
                title: "We find the right person",
                desc: "Someone who's been through exactly what you're facing."
              },
              {
                icon: Users,
                title: "Get connected within 12 hours",
                desc: "Have a real conversation with someone who gets it."
              }
            ].map((step, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-[hsl(220_38%_20%/0.1)]">
                  <step.icon className="w-5 h-5 text-[hsl(220_38%_20%)]" />
                </div>
                <div>
                  <h3 className="font-medium text-lg mb-1 text-[hsl(0_0%_11%)]">
                    {step.title}
                  </h3>
                  <p className="text-base text-[hsl(0_0%_50%)]">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-20 px-6">
        <div className="max-w-[640px] mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-4 text-[hsl(0_0%_11%)]">
            Who you'll meet
          </h2>
          <p className="text-center mb-12 text-[hsl(0_0%_50%)]">
            People who've walked the path you're on
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            {socialProof.map((item, i) => (
              <div 
                key={i}
                className="p-5 rounded-xl bg-[hsl(50_15%_95%)] border border-[hsl(50_10%_88%)]"
              >
                <h3 className="font-medium text-base mb-1 text-[hsl(0_0%_15%)]">
                  {item.name}
                </h3>
                <p className="text-sm text-[hsl(0_0%_50%)]">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-6 bg-[hsl(50_15%_96%)]">
        <div className="max-w-[480px] mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold mb-4 text-[hsl(0_0%_11%)]">
            Ready to talk?
          </h2>
          <p className="mb-8 text-[hsl(0_0%_50%)]">
            Start a conversation. We'll take it from there.
          </p>
          <button
            onClick={handleMainCTA}
            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full font-semibold text-base 
              bg-[hsl(220_38%_20%)] text-white shadow-[0_4px_20px_-4px_hsl(220_38%_20%/0.35)]
              transition-all duration-150 hover:shadow-[0_8px_30px_-4px_hsl(220_38%_20%/0.5)]
              hover:scale-[1.02] active:scale-[0.98]"
          >
            Talk to us
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center">
        <p className="text-xs text-[hsl(0_0%_60%)]">
          ChekInn — where aspirants find their people
        </p>
      </footer>
    </main>
  );
};

export default UPSC;
