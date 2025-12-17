import { useEffect, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";

// Static data outside component to avoid recreating
const painPoints = [
  "Where do I start?",
  "Answer writing",
  "Optional confusion",
  "Prelims anxiety",
];

const socialProof = [
  { name: "LBSNAA Alumni", desc: "Current serving officers" },
  { name: "Top 50 Rankers", desc: "From recent attempts" },
  { name: "IIT/IIM/DU", desc: "From top institutions" },
  { name: "Working Professionals", desc: "Who cleared while working" },
];

const steps = [
  {
    title: "Tell us what you're struggling with",
    desc: "A quick 2-minute chat. No forms, no sign-ups."
  },
  {
    title: "We find the right person",
    desc: "Someone who's been through exactly what you're facing."
  },
  {
    title: "Get connected within 12 hours",
    desc: "Have a real conversation with someone who gets it."
  }
];

// Inline SVG arrow to avoid lucide-react bundle
const ArrowIcon = memo(() => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
  </svg>
));
ArrowIcon.displayName = "ArrowIcon";

const UPSC = () => {
  const { trackPageView, trackEvent } = useFunnelTracking();
  const navigate = useNavigate();

  useEffect(() => {
    const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void) => number);
    if (typeof ric === "function") ric(() => trackPageView());
    else setTimeout(() => trackPageView(), 0);
  }, [trackPageView]);

  const handlePainPointClick = useCallback((painPoint: string) => {
    sessionStorage.setItem("chekinn_initial_message", painPoint);
    sessionStorage.setItem("chekinn_source", "upsc");
    trackEvent("cta_click", { variant: "UPSC", template: painPoint });
    navigate("/chat");
  }, [navigate, trackEvent]);

  const handleMainCTA = useCallback(() => {
    sessionStorage.setItem("chekinn_source", "upsc");
    trackEvent("cta_click", { variant: "UPSC", template: "main_cta" });
    navigate("/chat");
  }, [navigate, trackEvent]);

  return (
    <main className="min-h-screen bg-[#FDFCFA] text-[#1C1C1C]">
      {/* Hero Section */}
      <section className="min-h-[100svh] flex flex-col justify-center px-6 py-10">
        <div className="max-w-[520px] w-full mx-auto space-y-8">
          
          {/* Trust indicator - static dot instead of ping animation */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs bg-[#F0EDE8] text-[#737373]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF50]" />
              <span>50+ aspirants connected</span>
            </div>
          </div>

          {/* Headline */}
          <div className="text-center space-y-3">
            <h1 className="text-3xl sm:text-4xl font-semibold leading-tight tracking-tight">
              UPSC is lonely.
              <br />
              <span className="font-normal text-[#737373]">
                It doesn't have to be.
              </span>
            </h1>
            <p className="text-base sm:text-lg text-[#808080]">
              We'll connect you with someone who's been there.
            </p>
          </div>

          {/* Pain points */}
          <div className="space-y-3">
            <p className="text-center text-xs font-medium tracking-wide uppercase text-[#8C8C8C]">
              Sound familiar?
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {painPoints.map((point) => (
                <button
                  key={point}
                  onClick={() => handlePainPointClick(point)}
                  className="px-4 py-2 rounded-full text-sm font-medium transition-colors duration-100 
                    bg-[#F5F2ED] border border-[#E5E0D8] text-[#404040]
                    hover:bg-[#2A3A52] hover:border-[#2A3A52] hover:text-white
                    active:opacity-90"
                >
                  {point}
                </button>
              ))}
            </div>
          </div>

          {/* Main CTA */}
          <div className="text-center space-y-3">
            <button
              onClick={handleMainCTA}
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full font-semibold text-[15px] 
                bg-[#2A3A52] text-white shadow-md
                transition-transform duration-100 hover:scale-[1.02] active:scale-[0.98]"
            >
              Talk to us
              <ArrowIcon />
            </button>
            <p className="text-xs text-[#8C8C8C]">
              No signup needed
            </p>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 px-6 bg-[#F8F6F2]">
        <div className="max-w-[640px] mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-12">
            How it works
          </h2>
          
          <div className="space-y-8">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-[#2A3A52]/10 text-[#2A3A52] font-medium">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-medium text-lg mb-1">{step.title}</h3>
                  <p className="text-base text-[#808080]">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-6">
        <div className="max-w-[640px] mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-4">
            Who you'll meet
          </h2>
          <p className="text-center mb-12 text-[#808080]">
            People who've walked the path you're on
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            {socialProof.map((item) => (
              <div 
                key={item.name}
                className="p-5 rounded-xl bg-[#F5F3EF] border border-[#E8E4DC]"
              >
                <h3 className="font-medium text-base mb-1 text-[#262626]">{item.name}</h3>
                <p className="text-sm text-[#808080]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6 bg-[#F8F6F2]">
        <div className="max-w-[480px] mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold mb-4">
            Ready to talk?
          </h2>
          <p className="mb-8 text-[#808080]">
            Start a conversation. We'll take it from there.
          </p>
          <button
            onClick={handleMainCTA}
            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full font-semibold text-base 
              bg-[#2A3A52] text-white shadow-md
              transition-transform duration-100 hover:scale-[1.02] active:scale-[0.98]"
          >
            Talk to us
            <ArrowIcon />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center">
        <p className="text-xs text-[#999]">
          ChekInn — where aspirants find their people
        </p>
      </footer>
    </main>
  );
};

export default UPSC;
