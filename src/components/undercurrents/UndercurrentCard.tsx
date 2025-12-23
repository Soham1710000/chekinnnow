import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Undercurrent {
  observation: string;
  interpretation: string;
  uncertainty: string;
}

interface UndercurrentCardProps {
  undercurrent: Undercurrent;
  prompt: string | null;
  onSubmitResponse: (response: string) => Promise<boolean>;
  onDismiss: () => void;
}

export function UndercurrentCard({ 
  undercurrent, 
  prompt, 
  onSubmitResponse, 
  onDismiss 
}: UndercurrentCardProps) {
  const [response, setResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!response.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    const success = await onSubmitResponse(response);
    setIsSubmitting(false);
    
    if (success) {
      setResponse('');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-48px)]"
    >
      <div className="bg-background/95 backdrop-blur-xl border border-border/30 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary/60 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
              Undercurrent
            </span>
          </div>
          <button
            onClick={onDismiss}
            className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-5 space-y-4">
          {/* Observation */}
          <div>
            <p className="text-sm text-foreground/90 leading-relaxed">
              {undercurrent.observation}
            </p>
          </div>

          {/* Interpretation */}
          <div>
            <p className="text-sm text-muted-foreground leading-relaxed italic">
              {undercurrent.interpretation}
            </p>
          </div>

          {/* Uncertainty */}
          <div className="pt-2 border-t border-border/10">
            <p className="text-xs text-muted-foreground/70 leading-relaxed">
              {undercurrent.uncertainty}
            </p>
          </div>
        </div>

        {/* Response Section */}
        {prompt && (
          <div className="px-5 pb-5 space-y-3">
            <div className="pt-3 border-t border-border/20">
              <p className="text-xs font-medium text-muted-foreground mb-3">
                {prompt}
              </p>
              <Textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Your interpretation..."
                className="min-h-[80px] text-sm bg-muted/30 border-border/20 resize-none focus:border-primary/40"
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={!response.trim() || isSubmitting}
                size="sm"
                className="gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                Submit
              </Button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

interface FirstAccessModalProps {
  onDismiss: () => void;
}

export function UndercurrentsFirstAccess({ onDismiss }: FirstAccessModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="bg-background border border-border/30 rounded-2xl shadow-2xl p-8 max-w-sm mx-4 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-3 h-3 bg-primary/60 rounded-full mx-auto mb-6 animate-pulse" />
        
        <h2 className="text-lg font-semibold text-foreground mb-3">
          You now have access to Undercurrents.
        </h2>
        
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          These are not facts. They are signals.
        </p>
        
        <Button
          onClick={onDismiss}
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
        >
          Continue
        </Button>
      </motion.div>
    </motion.div>
  );
}

interface UndercurrentsIndicatorProps {
  canReceiveNew: boolean;
  onClick: () => void;
}

export function UndercurrentsIndicator({ canReceiveNew, onClick }: UndercurrentsIndicatorProps) {
  if (!canReceiveNew) return null;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="fixed bottom-24 right-6 z-40 p-3 bg-background/80 backdrop-blur-xl border border-border/30 rounded-full shadow-lg hover:shadow-xl transition-shadow"
    >
      <div className="relative">
        <div className="w-2 h-2 bg-primary/60 rounded-full" />
        <div className="absolute inset-0 w-2 h-2 bg-primary/40 rounded-full animate-ping" />
      </div>
    </motion.button>
  );
}
