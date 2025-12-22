import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFunnelTracking } from "./useFunnelTracking";

export type ExperimentVariant = "VOICE_FIRST" | "TEXT_FIRST";
export type InputMode = "voice" | "text";

interface VoiceExperimentState {
  variant: ExperimentVariant;
  currentInputMode: InputMode;
  isRecording: boolean;
  recordingDuration: number;
  audioLevel: number;
  voiceMessagesCount: number;
  textMessagesCount: number;
  sessionStartTime: number;
}

interface UseVoiceExperimentReturn {
  variant: ExperimentVariant;
  currentInputMode: InputMode;
  isRecording: boolean;
  recordingDuration: number;
  audioLevel: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  cancelRecording: () => void;
  switchInputMode: (mode: InputMode) => void;
  trackMessageSent: (mode: InputMode, durationSeconds?: number) => void;
  isVoiceFirst: boolean;
}

const VARIANT_STORAGE_KEY = "chekinn_experiment_variant";
const VOICE_STATS_KEY = "chekinn_voice_stats";

// Generate or retrieve experiment variant (50/50 split)
const getOrAssignVariant = (): ExperimentVariant => {
  const stored = localStorage.getItem(VARIANT_STORAGE_KEY);
  if (stored === "VOICE_FIRST" || stored === "TEXT_FIRST") {
    return stored;
  }
  
  // Random 50/50 assignment
  const variant: ExperimentVariant = Math.random() < 0.5 ? "VOICE_FIRST" : "TEXT_FIRST";
  localStorage.setItem(VARIANT_STORAGE_KEY, variant);
  sessionStorage.setItem(VARIANT_STORAGE_KEY, variant);
  
  return variant;
};

export const useVoiceExperiment = (): UseVoiceExperimentReturn => {
  const { trackEvent } = useFunnelTracking();
  const [variant] = useState<ExperimentVariant>(() => getOrAssignVariant());
  const [currentInputMode, setCurrentInputMode] = useState<InputMode>(() => 
    variant === "VOICE_FIRST" ? "voice" : "text"
  );
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track variant assignment on mount
  useEffect(() => {
    trackEvent("experiment_assigned" as any, { 
      variant,
      first_input_mode: currentInputMode 
    });
  }, []);

  // Audio level visualization
  const updateAudioLevel = useCallback(() => {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setAudioLevel(average / 255);
    }
    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        } 
      });
      
      streamRef.current = stream;
      
      // Set up audio analysis for visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;
      recordingStartTimeRef.current = Date.now();
      
      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingDuration(0);
      
      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
        setRecordingDuration(elapsed);
        
        // Auto-stop at 60 seconds
        if (elapsed >= 60) {
          stopRecording();
        }
      }, 1000);
      
      // Start audio level visualization
      updateAudioLevel();
      
      trackEvent("voice_recording_started" as any, { variant });
      
    } catch (error) {
      console.error("Error starting recording:", error);
      trackEvent("voice_recording_error" as any, { 
        variant, 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  }, [variant, trackEvent, updateAudioLevel]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
        resolve(null);
        return;
      }
      
      const duration = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
      
      mediaRecorderRef.current.onstop = async () => {
        // Clean up
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        
        setIsRecording(false);
        setAudioLevel(0);
        
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
        });
        
        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          
          try {
            // Call edge function for transcription
            const { data, error } = await supabase.functions.invoke('voice-to-text', {
              body: { audio: base64Audio, duration }
            });
            
            if (error) {
              console.error("Transcription error:", error);
              trackEvent("voice_transcription_error" as any, { variant, error: error.message });
              resolve(null);
              return;
            }
            
            trackEvent("voice_recording_completed" as any, { 
              variant, 
              duration_seconds: duration,
              transcript_length: data?.text?.length || 0,
              detected_language: data?.detected_language || 'unknown'
            });
            
            resolve(data?.text || null);
            
          } catch (err) {
            console.error("Transcription error:", err);
            resolve(null);
          }
        };
        
        reader.readAsDataURL(audioBlob);
      };
      
      mediaRecorderRef.current.stop();
    });
  }, [variant, trackEvent]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    setIsRecording(false);
    setRecordingDuration(0);
    setAudioLevel(0);
    
    trackEvent("voice_recording_abandoned" as any, { 
      variant,
      duration_at_abandon: Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)
    });
  }, [variant, trackEvent]);

  const switchInputMode = useCallback((mode: InputMode) => {
    setCurrentInputMode(mode);
    trackEvent("input_mode_switched" as any, { 
      variant,
      from_mode: currentInputMode,
      to_mode: mode 
    });
  }, [variant, currentInputMode, trackEvent]);

  const trackMessageSent = useCallback((mode: InputMode, durationSeconds?: number) => {
    trackEvent("message_sent" as any, { 
      variant,
      input_mode: mode,
      voice_duration_seconds: mode === "voice" ? durationSeconds : undefined
    });
  }, [variant, trackEvent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    variant,
    currentInputMode,
    isRecording,
    recordingDuration,
    audioLevel,
    startRecording,
    stopRecording,
    cancelRecording,
    switchInputMode,
    trackMessageSent,
    isVoiceFirst: variant === "VOICE_FIRST",
  };
};
