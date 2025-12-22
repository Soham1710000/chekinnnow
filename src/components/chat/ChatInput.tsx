import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VoiceInput from "./VoiceInput";
import { InputMode } from "@/hooks/useVoiceExperiment";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (text?: string) => void;
  currentInputMode: InputMode;
  isVoiceFirst: boolean;
  isRecording: boolean;
  recordingDuration: number;
  audioLevel: number;
  onStartRecording: () => void;
  onStopRecording: () => Promise<string | null>;
  onCancelRecording: () => void;
  onSwitchInputMode: (mode: InputMode) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput = ({
  value,
  onChange,
  onSend,
  currentInputMode,
  isVoiceFirst,
  isRecording,
  recordingDuration,
  audioLevel,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onSwitchInputMode,
  disabled,
  placeholder,
}: ChatInputProps) => {
  const handleTranscriptReady = (text: string) => {
    onSend(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  // Show voice input when in voice mode or recording
  if (currentInputMode === "voice" || isRecording) {
    return (
      <VoiceInput
        isRecording={isRecording}
        recordingDuration={recordingDuration}
        audioLevel={audioLevel}
        onStartRecording={onStartRecording}
        onStopRecording={onStopRecording}
        onCancelRecording={onCancelRecording}
        onSwitchToText={() => onSwitchInputMode("text")}
        onTranscriptReady={handleTranscriptReady}
        disabled={disabled}
        isVoiceFirst={isVoiceFirst}
      />
    );
  }

  // Text input mode
  return (
    <div className="border-t border-border p-4 bg-background">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Type a message..."}
          className="flex-1"
          disabled={disabled}
        />
        
        {/* Voice toggle button - show for text-first variant or when user switched to text */}
        {!isVoiceFirst && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onSwitchInputMode("voice")}
            disabled={disabled}
            className="text-muted-foreground hover:text-primary"
            title="Use voice instead"
          >
            <Mic className="w-4 h-4" />
          </Button>
        )}
        
        {isVoiceFirst && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onSwitchInputMode("voice")}
            disabled={disabled}
            className="text-muted-foreground hover:text-primary"
            title="Use voice instead"
          >
            <Mic className="w-4 h-4" />
          </Button>
        )}
        
        <Button 
          onClick={() => onSend()} 
          disabled={!value.trim() || disabled} 
          size="icon"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default ChatInput;
