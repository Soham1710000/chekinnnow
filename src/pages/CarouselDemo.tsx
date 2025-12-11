import { useState } from "react";
import { CardCarousel } from "@/components/landing/CardCarousel";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const CarouselDemo = () => {
  const [speed, setSpeed] = useState(40);
  const [pauseOnHover, setPauseOnHover] = useState(true);

  const customCards = [
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="py-8 border-b border-border/50">
        <div className="container-apple">
          <h1 className="text-3xl font-semibold mb-2">Card Carousel Demo</h1>
          <p className="text-muted-foreground">
            Interactive preview of the ChekInn card carousel component
          </p>
        </div>
      </header>

      {/* Controls */}
      <section className="py-12 bg-background-subtle">
        <div className="container-apple">
          <h2 className="text-xl font-semibold mb-8">Props Controls</h2>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-2xl">
            {/* Speed Control */}
            <div className="space-y-4">
              <Label htmlFor="speed">
                Speed: {speed}s (lower = faster)
              </Label>
              <Slider
                id="speed"
                value={[speed]}
                onValueChange={(value) => setSpeed(value[0])}
                min={10}
                max={80}
                step={5}
                className="w-full"
              />
            </div>

            {/* Pause on Hover */}
            <div className="flex items-center space-x-3">
              <Switch
                id="pauseOnHover"
                checked={pauseOnHover}
                onCheckedChange={setPauseOnHover}
              />
              <Label htmlFor="pauseOnHover">Pause on Hover</Label>
            </div>
          </div>

          <div className="mt-8">
            <Button 
              variant="outline" 
              onClick={() => {
                setSpeed(40);
                setPauseOnHover(true);
              }}
            >
              Reset to Defaults
            </Button>
          </div>
        </div>
      </section>

      {/* Carousel Preview */}
      <CardCarousel 
        cards={customCards}
        speed={speed}
        pauseOnHover={pauseOnHover}
      />

      {/* Code Example */}
      <section className="py-16">
        <div className="container-apple">
          <h2 className="text-xl font-semibold mb-6">Usage</h2>
          <pre className="p-6 rounded-2xl bg-card border border-border overflow-x-auto">
            <code className="text-sm">{`<CardCarousel 
  speed={${speed}}
  pauseOnHover={${pauseOnHover}}
  cards={[
    {
      title: "Recruiters",
      description: "Get noticed by top companies",
      icon: "💼",
      gradient: "from-blue-500/10 to-indigo-500/10",
    },
    // ... more cards
  ]}
/>`}</code>
          </pre>
        </div>
      </section>

      {/* Back Link */}
      <div className="py-8 text-center">
        <a 
          href="/" 
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Home
        </a>
      </div>
    </div>
  );
};

export default CarouselDemo;
