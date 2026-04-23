"use client";

import { memo, useCallback, useRef, useState, useEffect } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuickVoiceButtonProps {
  onTranscript: (text: string) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  disabled?: boolean;
}

type RecordingState = "idle" | "recording" | "processing";

/**
 * Quick voice button optimized for rapid voice-to-text in conversations
 * Press and hold to record, release to transcribe and send
 */
export const QuickVoiceButton = memo(function QuickVoiceButton({
  onTranscript,
  onRecordingStateChange,
  disabled,
}: QuickVoiceButtonProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const pressTimerRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return null;

    return new Promise<Blob>((resolve) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm;codecs=opus" });
        chunksRef.current = [];
        resolve(blob);
      };
      recorder.stop();
    });
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      // Determine best mime type for browser (Safari compatibility)
      let mimeType = "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4"; // Safari fallback
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.start();
      setState("recording");
      onRecordingStateChange?.(true);
    } catch (err) {
      console.error("Microphone access error:", err);
      cleanup();
      setState("idle");
    }
  }, [cleanup, onRecordingStateChange]);

  const handleStart = useCallback(() => {
    if (disabled || state !== "idle") return;
    
    // Short delay before starting recording (prevents accidental triggers)
    pressTimerRef.current = window.setTimeout(() => {
      startRecording();
    }, 100);
  }, [disabled, state, startRecording]);

  const handleEnd = useCallback(async () => {
    // Clear the press timer if we haven't started recording yet
    if (pressTimerRef.current !== null) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }

    if (state !== "recording") return;

    const blob = await stopRecording();
    cleanup();
    onRecordingStateChange?.(false);

    if (!blob || blob.size < 1000) {
      setState("idle");
      return;
    }

    setState("processing");

    try {
      const formData = new FormData();
      formData.append("audio", blob, "voice.webm");

      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const res = await fetch(`${basePath}/api/journal/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Transcription failed");

      const { text } = await res.json();
      if (text && text.trim()) {
        onTranscript(text.trim());
      }
    } catch (err) {
      console.error("Voice transcription error:", err);
    } finally {
      setState("idle");
    }
  }, [state, stopRecording, cleanup, onTranscript, onRecordingStateChange]);

  // Prevent context menu on long press (mobile)
  const handleContextMenu = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (state === "recording") {
      e.preventDefault();
    }
  }, [state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      if (pressTimerRef.current !== null) {
        clearTimeout(pressTimerRef.current);
      }
    };
  }, [cleanup]);

  return (
    <Button
      type="button"
      variant={state === "recording" ? "default" : "outline"}
      size="lg"
      onMouseDown={handleStart}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
      onContextMenu={handleContextMenu}
      disabled={disabled || state === "processing"}
      className={cn(
        "relative h-14 w-14 rounded-full p-0 transition-all touch-none select-none",
        state === "recording" && "bg-red-500/20 ring-4 ring-red-500/30 scale-110",
        state === "idle" && "hover:scale-105",
        "active:scale-95"
      )}
      title={
        state === "idle"
          ? "Hold to record, release to send"
          : state === "recording"
            ? "Recording... Release to send"
            : "Processing..."
      }
    >
      {state === "recording" ? (
        <MicOff className="w-6 h-6 text-red-400 animate-pulse" />
      ) : (
        <Mic className={cn(
          "w-6 h-6",
          state === "processing" && "animate-pulse opacity-50"
        )} />
      )}
      {state === "recording" && (
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-red-400 whitespace-nowrap">
          Release to send
        </span>
      )}
    </Button>
  );
});
