"use client";

import { memo, useCallback, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
      return;
    }

    // Start recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.start();
      setState("recording");
    } catch (err) {
      console.error("Microphone access error:", err);
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
