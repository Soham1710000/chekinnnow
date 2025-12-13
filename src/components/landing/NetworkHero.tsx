import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface Node {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  color: string;
  isCard?: boolean;
}

const generateNodes = (): Node[] => {
  const colors = [
    "hsl(220, 100%, 60%)",
    "hsl(280, 100%, 65%)",
    "hsl(340, 100%, 65%)",
    "hsl(160, 100%, 50%)",
    "hsl(45, 100%, 60%)",
  ];

  const nodes: Node[] = [];
  
  // Generate 12 nodes distributed in 2D space
  const positions = [
    { x: 15, y: 20 }, { x: 75, y: 15 }, { x: 45, y: 35 },
    { x: 25, y: 55 }, { x: 70, y: 45 }, { x: 85, y: 70 },
    { x: 35, y: 75 }, { x: 55, y: 60 }, { x: 10, y: 80 },
    { x: 60, y: 85 }, { x: 90, y: 25 }, { x: 50, y: 10 },
  ];

  positions.forEach((pos, i) => {
    nodes.push({
      id: i,
      x: pos.x,
      y: pos.y,
      size: 40 + Math.random() * 20,
      delay: i * 0.15,
      color: colors[i % colors.length],
      isCard: i % 4 === 0,
    });
  });

  return nodes;
};

const connections = [
  [0, 2], [2, 4], [1, 4], [3, 7], [5, 8], [6, 9],
  [2, 7], [4, 5], [0, 3], [1, 11], [11, 4], [7, 9],
];

const NetworkVisualization = () => {
  const nodes = generateNodes();

  return (
    <div className="relative w-full h-[400px] md:h-[500px]">
      {/* Connection lines */}
      <svg className="absolute inset-0 w-full h-full">
        {connections.map(([from, to], i) => {
          const fromNode = nodes[from];
          const toNode = nodes[to];
          return (
            <motion.line
              key={i}
              x1={`${fromNode.x}%`}
              y1={`${fromNode.y}%`}
              x2={`${toNode.x}%`}
              y2={`${toNode.y}%`}
              stroke="hsl(220, 60%, 40%)"
              strokeWidth="1"
              strokeOpacity="0.3"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.3 }}
              transition={{ duration: 1.5, delay: i * 0.1 }}
            />
          );
        })}
      </svg>

      {/* Nodes */}
      {nodes.map((node) => (
        <motion.div
          key={node.id}
          className="absolute"
          style={{
            left: `${node.x}%`,
            top: `${node.y}%`,
            transform: "translate(-50%, -50%)",
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: node.delay }}
        >
          <motion.div
            animate={{
              y: [0, -8, 0],
              scale: [1, 1.05, 1],
              opacity: [0.8, 1, 0.8],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: node.delay,
            }}
          >
            {node.isCard ? (
              <div
                className="rounded-xl backdrop-blur-sm border border-white/10 p-3 flex items-center gap-2"
                style={{
                  background: `linear-gradient(135deg, ${node.color}20, ${node.color}10)`,
                  boxShadow: `0 4px 20px ${node.color}30`,
                }}
              >
                <div
                  className="w-8 h-8 rounded-full"
                  style={{ background: node.color }}
                />
                <div className="space-y-1">
                  <div className="w-16 h-2 rounded bg-white/20" />
                  <div className="w-12 h-1.5 rounded bg-white/10" />
                </div>
              </div>
            ) : (
              <div
                className="rounded-full flex items-center justify-center text-white font-medium text-sm"
                style={{
                  width: node.size,
                  height: node.size,
                  background: `linear-gradient(135deg, ${node.color}, ${node.color}99)`,
                  boxShadow: `0 4px 20px ${node.color}50`,
                }}
              >
                {String.fromCharCode(65 + (node.id % 26))}
              </div>
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
