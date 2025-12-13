import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";

interface Node {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  color: string;
  type: "avatar" | "card";
  floatDuration: number;
  floatOffset: number;
}

const COLORS = [
  "hsl(220, 100%, 60%)",  // Blue
  "hsl(280, 100%, 65%)",  // Purple
  "hsl(340, 100%, 65%)",  // Pink
  "hsl(160, 100%, 45%)",  // Teal
  "hsl(45, 100%, 55%)",   // Yellow
  "hsl(200, 100%, 55%)",  // Cyan
  "hsl(320, 100%, 60%)",  // Magenta
];

const INITIALS = ["JD", "SK", "AM", "TW", "RB", "KC", "LM", "NP", "ES", "VR", "DH", "BG", "CT", "FW", "HZ"];

const generateNodes = (): Node[] => {
  const nodes: Node[] = [];
  
  // Positions distributed across the container (percentage-based)
  const positions = [
    // Circular avatars
    { x: 12, y: 18, type: "avatar" as const },
    { x: 78, y: 12, type: "avatar" as const },
    { x: 45, y: 8, type: "avatar" as const },
    { x: 88, y: 45, type: "avatar" as const },
    { x: 22, y: 72, type: "avatar" as const },
    { x: 65, y: 78, type: "avatar" as const },
    { x: 8, y: 45, type: "avatar" as const },
    { x: 55, y: 42, type: "avatar" as const },
    { x: 32, y: 35, type: "avatar" as const },
    { x: 75, y: 62, type: "avatar" as const },
    { x: 42, y: 88, type: "avatar" as const },
    { x: 92, y: 82, type: "avatar" as const },
    // Rounded rectangle cards
    { x: 25, y: 52, type: "card" as const },
    { x: 68, y: 28, type: "card" as const },
    { x: 48, y: 65, type: "card" as const },
  ];

  positions.forEach((pos, i) => {
    nodes.push({
      id: i,
      x: pos.x,
      y: pos.y,
      size: pos.type === "avatar" ? 36 + Math.random() * 16 : 0,
      delay: i * 0.08,
      color: COLORS[i % COLORS.length],
      type: pos.type,
      floatDuration: 4 + Math.random() * 3,
      floatOffset: Math.random() * 12 - 6,
    });
  });

  return nodes;
};

// Pre-defined connections between nodes
const CONNECTIONS: [number, number][] = [
  [0, 8], [8, 12], [12, 6], [2, 13], [13, 7], [7, 14],
  [1, 13], [3, 9], [9, 14], [4, 12], [5, 14], [10, 4],
  [11, 9], [2, 1], [6, 4], [8, 7], [5, 11],
];

const AvatarNode = ({ node, initial }: { node: Node; initial: string }) => (
  <motion.div
    className="rounded-full flex items-center justify-center text-white font-semibold text-xs shadow-lg"
    style={{
      width: node.size,
      height: node.size,
      background: `linear-gradient(145deg, ${node.color}, ${node.color}cc)`,
      boxShadow: `0 8px 32px ${node.color}40, inset 0 1px 0 rgba(255,255,255,0.2)`,
    }}
  >
    {initial}
  </motion.div>
);

const CardNode = ({ node }: { node: Node }) => (
  <div
    className="rounded-2xl backdrop-blur-md border border-white/15 p-3 flex items-center gap-3 min-w-[120px]"
    style={{
      background: `linear-gradient(145deg, ${node.color}18, ${node.color}08)`,
      boxShadow: `0 8px 32px ${node.color}25, inset 0 1px 0 rgba(255,255,255,0.1)`,
    }}
  >
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold"
      style={{ background: node.color }}
    >
      {INITIALS[node.id % INITIALS.length]}
    </div>
    <div className="space-y-1.5">
      <div className="w-14 h-2 rounded-full bg-white/25" />
      <div className="w-10 h-1.5 rounded-full bg-white/12" />
    </div>
  </div>
);

const NetworkVisualization = () => {
  const nodes = useMemo(() => generateNodes(), []);

  return (
    <div className="relative w-full h-[420px] md:h-[520px]">
      {/* Connection lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(220, 100%, 60%)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(280, 100%, 65%)" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        {CONNECTIONS.map(([from, to], i) => {
          const fromNode = nodes[from];
          const toNode = nodes[to];
          if (!fromNode || !toNode) return null;
          return (
            <motion.line
              key={i}
              x1={`${fromNode.x}%`}
              y1={`${fromNode.y}%`}
              x2={`${toNode.x}%`}
              y2={`${toNode.y}%`}
              stroke="url(#lineGradient)"
              strokeWidth="1.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.15, 0.35, 0.15] }}
              transition={{
                duration: 3,
                delay: i * 0.1,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          );
        })}
      </svg>

      {/* Nodes */}
      {nodes.map((node) => (
        <motion.div
          key={node.id}
          className="absolute z-10"
          style={{
            left: `${node.x}%`,
            top: `${node.y}%`,
            transform: "translate(-50%, -50%)",
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.5,
            delay: node.delay,
            ease: [0.34, 1.56, 0.64, 1],
          }}
        >
          <motion.div
            animate={{
              y: [0, node.floatOffset, 0],
              scale: [1, 1.04, 1],
              opacity: [0.85, 1, 0.85],
            }}
            transition={{
              duration: node.floatDuration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: node.delay * 0.5,
            }}
          >
            {node.type === "card" ? (
              <CardNode node={node} />
            ) : (
              <AvatarNode node={node} initial={INITIALS[node.id % INITIALS.length]} />
            )}
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
};

export const NetworkHero = () => {
  return (
    <section className="relative min-h-screen bg-[hsl(220,20%,8%)] overflow-hidden flex items-center">
      {/* Background gradient */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/4 w-[600px] h-[600px] rounded-full bg-[hsl(220,100%,50%)] opacity-10 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-[hsl(280,100%,60%)] opacity-10 blur-[100px]" />
      </div>

      <div className="container-apple relative z-10 py-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left column - Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-center lg:text-left"
          >
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6"
            >
              Social Network on{" "}
              <span className="bg-gradient-to-r from-[hsl(220,100%,60%)] to-[hsl(280,100%,65%)] bg-clip-text text-transparent">
                iMessage
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-lg md:text-xl text-white/60 max-w-lg mx-auto lg:mx-0 mb-8"
            >
              Connect with your network through the messaging app you already use. 
              AI-powered introductions, seamless conversations, real relationships.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <Button
                className="bg-gradient-to-r from-[hsl(220,100%,60%)] to-[hsl(280,100%,65%)] text-white border-0 px-8 py-6 text-lg font-medium rounded-full hover:opacity-90 transition-opacity"
                asChild
              >
                <a href="https://app.emergent.sh/share?app=voicechat-companion" target="_blank" rel="noopener noreferrer">
                  Try it out
                </a>
              </Button>
              <Button
                variant="outline"
                className="border-white/20 text-white bg-white/5 hover:bg-white/10 px-8 py-6 text-lg font-medium rounded-full"
                asChild
              >
                <a href="https://app.emergent.sh/share?app=voicechat-companion" target="_blank" rel="noopener noreferrer">
                  Sign in
                </a>
              </Button>
            </motion.div>
          </motion.div>

          {/* Right column - Network Visualization */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="order-first lg:order-last"
          >
            <NetworkVisualization />
          </motion.div>
        </div>
      </div>
    </section>
  );
};
