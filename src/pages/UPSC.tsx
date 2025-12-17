import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";
import { ArrowRight } from "lucide-react";

// Compact pain points
const painPoints = [
  "Where do I start?",
  "Answer writing",
  "Optional confusion",
  "Prelims anxiety",
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
      {/* Main content - compact one-fold layout */}
      <div className="flex-1 flex flex-col justify-center px-6 py-10">
        <div className="max-w-[520px] w-full mx-auto space-y-8">
          
          {/* Small trust indicator */}
          <div className="flex justify-center animate-fade-in">
            <div 
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
              style={{ 
                backgroundColor: 'hsl(50 10% 93%)',
                color: 'hsl(0 0% 45%)'
              }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'hsl(140 50% 45%)' }}></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: 'hsl(140 50% 40%)' }}></span>
              </span>
              <span>50+ aspirants connected</span>
            </div>
          </div>

          {/* Headline */}
          <div className="text-center space-y-3 animate-fade-in" style={{ animationDelay: '50ms' }}>
            <h1 
              className="text-3xl sm:text-4xl font-semibold leading-tight tracking-tight"
              style={{ color: 'hsl(0 0% 11%)' }}
            >
              UPSC is lonely.
              <br />
              <span 
                className="font-normal"
                style={{ color: 'hsl(0 0% 45%)' }}
              >
                It doesn't have to be.
              </span>
            </h1>
            <p 
              className="text-base sm:text-lg"
              style={{ color: 'hsl(0 0% 50%)' }}
            >
              We'll connect you with someone who's been there.
            </p>
          </div>

          {/* Pain points - compact inline pills */}
          <div className="space-y-3 animate-fade-in" style={{ animationDelay: '100ms' }}>
            <p 
              className="text-center text-xs font-medium tracking-wide uppercase"
              style={{ color: 'hsl(0 0% 55%)' }}
            >
              Sound familiar?
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {painPoints.map((point, index) => (
                <button
                  key={index}
                  onClick={() => handlePainPointClick(point)}
                  className="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
                  style={{ 
                    backgroundColor: 'hsl(50 15% 94%)',
                    border: '1px solid hsl(50 10% 86%)',
                    color: 'hsl(0 0% 25%)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'hsl(220 38% 20%)';
                    e.currentTarget.style.borderColor = 'hsl(220 38% 20%)';
                    e.currentTarget.style.color = 'hsl(0 0% 98%)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'hsl(50 15% 94%)';
                    e.currentTarget.style.borderColor = 'hsl(50 10% 86%)';
                    e.currentTarget.style.color = 'hsl(0 0% 25%)';
                  }}
                >
                  {point}
                </button>
              ))}
            </div>
          </div>

          {/* Main CTA */}
          <div className="text-center space-y-3 animate-fade-in" style={{ animationDelay: '150ms' }}>
            <button
              onClick={handleMainCTA}
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full font-semibold text-[15px] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{ 
                backgroundColor: 'hsl(220 38% 20%)',
                color: 'hsl(0 0% 98%)',
                boxShadow: '0 4px 20px -4px hsl(220 38% 20% / 0.35)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 30px -4px hsl(220 38% 20% / 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 20px -4px hsl(220 38% 20% / 0.35)';
              }}
            >
              Talk to us
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
            <p 
              className="text-xs"
              style={{ color: 'hsl(0 0% 55%)' }}
            >
              No signup needed
            </p>
          </div>

          {/* Social proof - subtle */}
          <div 
            className="pt-6 text-center animate-fade-in"
            style={{ animationDelay: '200ms' }}
          >
            <p 
              className="text-xs leading-relaxed"
              style={{ color: 'hsl(0 0% 55%)' }}
            >
              IAS Officers • LBSNAA Alumni • IIT Delhi • JNU • DU
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};

export default UPSC;