"use client";

import { memo, useCallback, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

type RecordingState = "idle" | "recording" | "processing";

export const VoiceButton = memo(function VoiceButton({
  onTranscript,
  disabled,
  className,
}: VoiceButtonProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;

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

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  const handleClick = useCallback(async () => {
    console.log("[VoiceButton] click", { state, disabled });

    if (state === "recording") {
      // Stop and transcribe
      const blob = await stopRecording();
      cleanup();

      if (!blob || blob.size < 1000) {
        // Too short, ignore
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

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.detail || data?.error || "Transcription failed");
        }

        const text = typeof data?.text === "string" ? data.text : "";
        console.log("[VoiceButton] transcript result", { textLength: text.length });
        if (text && text.trim()) {
          onTranscript(text.trim());
        } else {
          toast.error("No speech detected");
        }
      } catch (err) {
        console.error("Voice transcription error:", err);
        toast.error(err instanceof Error ? err.message : "Voice transcription failed");
      } finally {
        setState("idle");
      }
      return;
    }

    // Start recording
    try {
      console.log("[VoiceButton] capability check", {
        hasWindow: typeof window !== "undefined",
        hasMediaDevices: !!navigator?.mediaDevices,
        hasGetUserMedia: !!navigator?.mediaDevices?.getUserMedia,
        hasMediaRecorder: typeof MediaRecorder !== "undefined",
      });

      if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
        console.error("[VoiceButton] getUserMedia unsupported");
        toast.error("Microphone capture is not supported in this browser");
        return;
      }

      if (typeof MediaRecorder === "undefined") {
        console.error("[VoiceButton] MediaRecorder unavailable");
        toast.error("MediaRecorder is not available in this browser");
        return;
      }

      console.log("[VoiceButton] requesting microphone access");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      console.log("[VoiceButton] microphone access granted", {
        tracks: stream.getAudioTracks().map((track) => ({
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
        })),
      });
      streamRef.current = stream;

      // Determine best mime type for browser (Safari compatibility)
      let mimeType = "audio/webm";
      const supportsWebmOpus = MediaRecorder.isTypeSupported("audio/webm;codecs=opus");
      const supportsWebm = MediaRecorder.isTypeSupported("audio/webm");
      const supportsMp4 = MediaRecorder.isTypeSupported("audio/mp4");
      console.log("[VoiceButton] mime support", {
        supportsWebmOpus,
        supportsWebm,
        supportsMp4,
      });

      if (supportsWebmOpus) {
        mimeType = "audio/webm;codecs=opus";
      } else if (supportsMp4) {
        mimeType = "audio/mp4"; // Safari fallback
      } else if (supportsWebm) {
        mimeType = "audio/webm";
      }

      console.log("[VoiceButton] creating MediaRecorder", { mimeType });
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        toast.error("Recording failed");
        cleanup();
        setState("idle");
      };

      recorder.start();
      console.log("[VoiceButton] recording started", { mimeType });
      setState("recording");
    } catch (err) {
      console.error("Microphone access error:", err);
      const message = err instanceof Error ? `${err.name}: ${err.message}` : "Microphone access failed";
      toast.error(message);
      cleanup();
      setState("idle");
    }
  }, [state, stopRecording, cleanup, onTranscript]);

  return (
    <Button
      type="button"
      variant={state === "recording" ? "destructive" : "ghost"}
      size="sm"
      onClick={handleClick}
      disabled={disabled || state === "processing"}
      className={cn(
        "w-8 h-8 p-0 shrink-0 transition-all",
        state === "recording" && "animate-pulse ring-2 ring-destructive/50",
        className
      )}
      title={
        state === "idle"
          ? "Record voice note"
          : state === "recording"
            ? "Stop recording"
            : "Transcribing..."
      }
    >
      {state === "idle" && <Mic className="w-4 h-4" />}
      {state === "recording" && <Square className="w-3.5 h-3.5 fill-current" />}
      {state === "processing" && <Loader2 className="w-4 h-4 animate-spin" />}
    </Button>
  );
});
