import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFunnelTracking } from "./useFunnelTracking";

export type InputMode = "voice" | "text";

interface UseVoiceInputReturn {
  currentInputMode: InputMode;
  isRecording: boolean;
  recordingDuration: number;
  audioLevel: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  cancelRecording: () => void;
  switchInputMode: (mode: InputMode) => void;
  trackMessageSent: (mode: InputMode, durationSeconds?: number) => void;
}

export const useVoiceInput = (): UseVoiceInputReturn => {
  const { trackEvent } = useFunnelTracking();
  const [currentInputMode, setCurrentInputMode] = useState<InputMode>("text");
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
      mediaRecorder.start(100);
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
      
      trackEvent("voice_recording_started" as any, {});
      
    } catch (error) {
      console.error("Error starting recording:", error);
      trackEvent("voice_recording_error" as any, { 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  }, [trackEvent, updateAudioLevel]);

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
              trackEvent("voice_transcription_error" as any, { error: error.message });
              resolve(null);
              return;
            }
            
            trackEvent("voice_recording_completed" as any, { 
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
  }, [trackEvent]);

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
      duration_at_abandon: Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)
    });
  }, [trackEvent]);

  const switchInputMode = useCallback((mode: InputMode) => {
    setCurrentInputMode(mode);
    trackEvent("input_mode_switched" as any, { 
      from_mode: currentInputMode,
      to_mode: mode 
    });
  }, [currentInputMode, trackEvent]);

  const trackMessageSent = useCallback((mode: InputMode, durationSeconds?: number) => {
    trackEvent("message_sent" as any, { 
      input_mode: mode,
      voice_duration_seconds: mode === "voice" ? durationSeconds : undefined
    });
  }, [trackEvent]);

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
    currentInputMode,
    isRecording,
    recordingDuration,
    audioLevel,
    startRecording,
    stopRecording,
    cancelRecording,
    switchInputMode,
    trackMessageSent,
  };
};
