import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";
import { ArrowRight } from "lucide-react";

// Relatable pain points for UPSC aspirants
const painPoints = [
  "Where do I even start?",
  "Stuck with answer writing",
  "How to pick my optional?",
  "Prelims giving anxiety",
];

const UPSC = () => {
  const { trackPageView, trackEvent } = useFunnelTracking();
  const navigate = useNavigate();

  useEffect(() => {
    trackPageView();
  }, [trackPageView]);

  const handlePainPointClick = (painPoint: string) => {
    trackEvent("cta_click", { variant: "UPSC", template: painPoint });
    sessionStorage.setItem("chekinn_initial_message", painPoint);
    sessionStorage.setItem("chekinn_source", "upsc");
    navigate("/chat");
  };

  const handleMainCTA = () => {
    trackEvent("cta_click", { variant: "UPSC", template: "main_cta" });
    sessionStorage.setItem("chekinn_source", "upsc");
    navigate("/chat");
  };

  return (
    <main 
      className="min-h-[100svh] flex flex-col"
      style={{ 
        backgroundColor: 'hsl(50 20% 98%)',
        color: 'hsl(0 0% 11%)'
      }}
    >
      {/* Main content - essay style centered layout */}
      <div className="flex-1 flex flex-col justify-center px-6 py-16 sm:py-24">
        <div className="max-w-[640px] w-full mx-auto space-y-16">
          
          {/* Small trust indicator */}
          <div className="flex justify-center">
            <div 
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-sm"
              style={{ 
                backgroundColor: 'hsl(50 10% 93%)',
                color: 'hsl(0 0% 40%)'
              }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'hsl(140 50% 45%)' }}></span>
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: 'hsl(140 50% 40%)' }}></span>
              </span>
              <span>50+ aspirants connected this week</span>
            </div>
          </div>

          {/* Headline - essay style typography */}
          <div className="text-center space-y-6">
            <h1 
              className="text-[clamp(2rem,5vw,3rem)] font-semibold leading-[1.2] tracking-tight"
              style={{ color: 'hsl(0 0% 11%)' }}
            >
              UPSC is lonely.
              <br />
              <span 
                className="font-normal"
                style={{ color: 'hsl(0 0% 40%)' }}
              >
                It doesn't have to be.
              </span>
            </h1>
            <p 
              className="text-lg sm:text-xl leading-relaxed max-w-md mx-auto"
              style={{ color: 'hsl(0 0% 45%)' }}
            >
              Tell us what you're going through. We'll connect you with someone who's been there.
            </p>
          </div>

          {/* Subtle divider */}
          <div className="flex justify-center">
            <div 
              className="w-12 h-px"
              style={{ backgroundColor: 'hsl(50 10% 80%)' }}
            />
          </div>

          {/* Pain points - soft card style */}
          <div className="space-y-5">
            <p 
              className="text-center text-sm font-medium tracking-wide uppercase"
              style={{ color: 'hsl(0 0% 55%)' }}
            >
              Sound familiar?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
              {painPoints.map((point, index) => (
                <button
                  key={index}
                  onClick={() => handlePainPointClick(point)}
                  className="px-5 py-4 rounded-xl text-left transition-all duration-200 active:scale-[0.98]"
                  style={{ 
                    backgroundColor: 'hsl(50 15% 95%)',
                    border: '1px solid hsl(50 10% 88%)',
                    color: 'hsl(0 0% 20%)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'hsl(50 15% 92%)';
                    e.currentTarget.style.borderColor = 'hsl(220 38% 20%)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'hsl(50 15% 95%)';
                    e.currentTarget.style.borderColor = 'hsl(50 10% 88%)';
                  }}
                >
                  <span className="text-[15px] font-medium">{point}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main CTA - solid dark, rounded, soft shadow */}
          <div className="text-center space-y-4 pt-4">
            <button
              onClick={handleMainCTA}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-full font-semibold text-base transition-all duration-200 active:scale-[0.98]"
              style={{ 
                backgroundColor: 'hsl(220 38% 20%)',
                color: 'hsl(0 0% 98%)',
                boxShadow: '0 4px 20px -4px hsl(220 38% 20% / 0.35)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 30px -4px hsl(220 38% 20% / 0.45)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 20px -4px hsl(220 38% 20% / 0.35)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Talk to us
              <ArrowRight className="w-4 h-4" />
            </button>
            <p 
              className="text-sm"
              style={{ color: 'hsl(0 0% 55%)' }}
            >
              No signup needed • Takes 2 minutes
            </p>
          </div>

          {/* Social proof - subtle, understated */}
          <div 
            className="pt-8 border-t text-center"
            style={{ borderColor: 'hsl(50 10% 88%)' }}
          >
            <p 
              className="text-sm leading-relaxed"
              style={{ color: 'hsl(0 0% 50%)' }}
            >
              Members include IAS Officers, LBSNAA Alumni,
              <br className="hidden sm:block" />
              {" "}and aspirants from IIT Delhi, JNU, DU & SRCC
            </p>
          </div>
        </div>
      </div>

      {/* Footer - minimal */}
      <footer className="py-8 text-center">
        <p 
          className="text-xs"
          style={{ color: 'hsl(0 0% 60%)' }}
        >
          ChekInn — where aspirants find their people
        </p>
      </footer>
    </main>
  );
};

export default UPSC;