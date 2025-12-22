import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, X, Keyboard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VoiceInputProps {
  isRecording: boolean;
  recordingDuration: number;
  audioLevel: number;
  onStartRecording: () => void;
  onStopRecording: () => Promise<string | null>;
  onCancelRecording: () => void;
  onSwitchToText: () => void;
  onTranscriptReady: (text: string) => void;
  disabled?: boolean;
  isVoiceFirst: boolean;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const VoiceInput = ({
  isRecording,
  recordingDuration,
  audioLevel,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onSwitchToText,
  onTranscriptReady,
  disabled,
  isVoiceFirst,
}: VoiceInputProps) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleStopAndTranscribe = async () => {
    setIsProcessing(true);
    try {
      const transcript = await onStopRecording();
      if (transcript) {
        onTranscriptReady(transcript);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (isRecording || isProcessing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="bg-background border-t border-border p-4"
      >
        <div className="flex flex-col items-center gap-4">
          {/* Waveform visualization */}
          <div className="flex items-center justify-center gap-1 h-16">
            {isProcessing ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Processing...</span>
              </div>
            ) : (
              <>
                {[...Array(20)].map((_, i) => {
                  const height = Math.max(4, Math.min(48, 
                    8 + (audioLevel * 40) * Math.sin((i + Date.now() / 100) * 0.5) * Math.random()
                  ));
                  return (
                    <motion.div
                      key={i}
                      className="w-1 bg-primary rounded-full"
                      animate={{ height }}
                      transition={{ duration: 0.1 }}
                    />
                  );
                })}
              </>
            )}
          </div>
          
          {/* Duration and max indicator */}
          <div className="text-center">
            <span className={cn(
              "text-lg font-mono",
              recordingDuration >= 55 && "text-destructive font-bold"
            )}>
              {formatDuration(recordingDuration)}
            </span>
            <span className="text-muted-foreground text-sm ml-1">/ 1:00</span>
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancelRecording}
              disabled={isProcessing}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="w-5 h-5" />
            </Button>
            
            <Button
              size="lg"
              onClick={handleStopAndTranscribe}
              disabled={isProcessing}
              className="w-16 h-16 rounded-full bg-primary hover:bg-primary/90"
            >
              {isProcessing ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Square className="w-6 h-6 fill-current" />
              )}
            </Button>
            
            <div className="w-10" /> {/* Spacer for centering */}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="bg-background border-t border-border p-4">
      <div className="flex flex-col items-center gap-3">
        {/* Main CTA - Voice */}
        <Button
          size="lg"
          onClick={onStartRecording}
          disabled={disabled}
          className="w-full max-w-xs h-14 rounded-full bg-primary hover:bg-primary/90 text-lg font-semibold gap-2"
        >
          <Mic className="w-5 h-5" />
          Talk it out
        </Button>
        
        {/* Secondary CTA - Text */}
        <button
          onClick={onSwitchToText}
          disabled={disabled}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
        >
          <Keyboard className="w-4 h-4" />
          Type instead
        </button>
      </div>
    </div>
  );
};

export default VoiceInput;
