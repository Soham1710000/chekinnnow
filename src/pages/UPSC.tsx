import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";
import { ArrowRight, Users, MessageCircle, Sparkles, Phone } from "lucide-react";

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

  const handleWhatsApp = () => {
    window.open("https://wa.me/917600504810?text=Hi! I need help with UPSC preparation", "_blank");
  };

  return (
    <main 
      className="min-h-screen"
      style={{ 
        backgroundColor: 'hsl(50 20% 98%)',
        color: 'hsl(0 0% 11%)'
      }}
    >
      {/* Hero Section - One Fold */}
      <section className="min-h-[100svh] flex flex-col justify-center px-6 py-10">
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
              <ArrowRight className="w-4 h-4" />
            </button>
            <p 
              className="text-xs"
              style={{ color: 'hsl(0 0% 55%)' }}
            >
              No signup needed
            </p>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section 
        className="py-20 px-6"
        style={{ backgroundColor: 'hsl(50 15% 96%)' }}
      >
        <div className="max-w-[640px] mx-auto">
          <h2 
            className="text-2xl sm:text-3xl font-semibold text-center mb-12"
            style={{ color: 'hsl(0 0% 11%)' }}
          >
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
                <div 
                  className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'hsl(220 38% 20% / 0.1)' }}
                >
                  <step.icon className="w-5 h-5" style={{ color: 'hsl(220 38% 20%)' }} />
                </div>
                <div>
                  <h3 
                    className="font-medium text-lg mb-1"
                    style={{ color: 'hsl(0 0% 11%)' }}
                  >
                    {step.title}
                  </h3>
                  <p 
                    className="text-base"
                    style={{ color: 'hsl(0 0% 50%)' }}
                  >
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
          <h2 
            className="text-2xl sm:text-3xl font-semibold text-center mb-4"
            style={{ color: 'hsl(0 0% 11%)' }}
          >
            Who you'll meet
          </h2>
          <p 
            className="text-center mb-12"
            style={{ color: 'hsl(0 0% 50%)' }}
          >
            People who've walked the path you're on
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            {socialProof.map((item, i) => (
              <div 
                key={i}
                className="p-5 rounded-xl"
                style={{ 
                  backgroundColor: 'hsl(50 15% 95%)',
                  border: '1px solid hsl(50 10% 88%)'
                }}
              >
                <h3 
                  className="font-medium text-base mb-1"
                  style={{ color: 'hsl(0 0% 15%)' }}
                >
                  {item.name}
                </h3>
                <p 
                  className="text-sm"
                  style={{ color: 'hsl(0 0% 50%)' }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section 
        className="py-20 px-6"
        style={{ backgroundColor: 'hsl(50 15% 96%)' }}
      >
        <div className="max-w-[480px] mx-auto text-center">
          <h2 
            className="text-2xl sm:text-3xl font-semibold mb-4"
            style={{ color: 'hsl(0 0% 11%)' }}
          >
            Ready to talk?
          </h2>
          <p 
            className="mb-8"
            style={{ color: 'hsl(0 0% 50%)' }}
          >
            Start a conversation. We'll take it from there.
          </p>
          <button
            onClick={handleMainCTA}
            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full font-semibold text-base transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{ 
              backgroundColor: 'hsl(220 38% 20%)',
              color: 'hsl(0 0% 98%)',
              boxShadow: '0 4px 20px -4px hsl(220 38% 20% / 0.35)'
            }}
          >
            Talk to us
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center">
        <p 
          className="text-xs"
          style={{ color: 'hsl(0 0% 60%)' }}
        >
          ChekInn — where aspirants find their people
        </p>
      </footer>

      {/* Floating Help Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={handleWhatsApp}
          className="flex items-center gap-2 px-4 py-3 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
          style={{ 
            backgroundColor: 'hsl(140 50% 40%)',
            color: 'white'
          }}
          aria-label="Chat on WhatsApp"
        >
          <Phone className="w-5 h-5" />
          <span className="text-sm font-medium">Need help?</span>
        </button>
      </div>
    </main>
  );
};

export default UPSC;