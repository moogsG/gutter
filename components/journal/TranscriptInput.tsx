"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoiceButton } from "./VoiceButton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, FileText, MessageSquare, Sparkles } from "lucide-react";
import { cleanCaptureText } from "@/lib/smart-capture";

interface TranscriptInputProps {
  date: string;
  onEntriesCreated?: () => void;
}

type ProcessMode = "organize" | "talk" | "both";

interface ProcessedResult {
  mode: ProcessMode;
  original: string;
  entries?: Array<{
    signifier: string;
    text: string;
    metadata?: any;
  }>;
  conversational?: {
    text: string;
    signifier: string;
  };
}

export function TranscriptInput({ date, onEntriesCreated }: TranscriptInputProps) {
  const [mode, setMode] = useState<ProcessMode>("organize");
  const [text, setText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessedResult | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleVoiceTranscript = useCallback((transcript: string) => {
    setText((prev) => (prev ? `${prev}\n\n${transcript}` : transcript));
    textareaRef.current?.focus();
  }, []);

  const handleProcess = async () => {
    if (!text.trim()) return;

    setIsProcessing(true);
    setResult(null);

    try {
      const cleaned = cleanCaptureText(text);
      
      const response = await fetch("/api/journal/transcript/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: cleaned,
          mode,
          date,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to process transcript");
      }

      const data: ProcessedResult = await response.json();
      setResult(data);

      // Show success feedback
      if (mode === "organize" && data.entries) {
        toast.success(`Extracted ${data.entries.length} ${data.entries.length === 1 ? "entry" : "entries"}`);
      } else if (mode === "talk" && data.conversational) {
        toast.success("Saved conversational entry");
      } else if (mode === "both") {
        const count = (data.entries?.length || 0) + (data.conversational ? 1 : 0);
        toast.success(`Created ${count} ${count === 1 ? "entry" : "entries"}`);
      }

      // Clear input on success
      setText("");
      onEntriesCreated?.();
    } catch (error) {
      console.error("Transcript processing error:", error);
      toast.error("Failed to process transcript");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl + Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleProcess();
    }
  };

  return (
    <Card className="bg-card/60 backdrop-blur-xl border-border">
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Transcript Capture
          </CardTitle>
          <VoiceButton
            onTranscript={handleVoiceTranscript}
            disabled={isProcessing}
            className="w-7 h-7"
          />
        </div>
        
        <Tabs value={mode} onValueChange={(v) => setMode(v as ProcessMode)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="organize" className="text-xs gap-1.5">
              <FileText className="w-3 h-3" />
              <span className="hidden sm:inline">Organize</span>
            </TabsTrigger>
            <TabsTrigger value="talk" className="text-xs gap-1.5">
              <MessageSquare className="w-3 h-3" />
              <span className="hidden sm:inline">Talk</span>
            </TabsTrigger>
            <TabsTrigger value="both" className="text-xs gap-1.5">
              <Sparkles className="w-3 h-3" />
              <span className="hidden sm:inline">Both</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="text-[10px] text-muted-foreground/70 space-y-0.5">
          {mode === "organize" && (
            <p>Extract tasks, appointments, and notes from your transcript</p>
          )}
          {mode === "talk" && (
            <p>Save as a conversational note or memory</p>
          )}
          {mode === "both" && (
            <p>Extract entries AND save the full transcript</p>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            mode === "organize"
              ? "Paste or record a transcript to extract entries..."
              : mode === "talk"
                ? "Talk through your thoughts, ideas, or memories..."
                : "Capture everything — I'll organize it and keep the original"
          }
          disabled={isProcessing}
          className={cn(
            "w-full min-h-[120px] p-3 rounded-lg resize-y",
            "bg-background border border-border",
            "text-sm text-foreground placeholder:text-muted-foreground/50",
            "focus:outline-none focus:ring-2 focus:ring-primary/50",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        />

        <div className="flex items-center justify-between">
          <div className="text-[10px] text-muted-foreground/50">
            {text.length > 0 && `${text.length} characters`}
            {text.trim() && " • ⌘↩ to process"}
          </div>
          <Button
            onClick={handleProcess}
            disabled={!text.trim() || isProcessing}
            size="sm"
            className="h-8 px-3"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                Processing...
              </>
            ) : (
              "Process"
            )}
          </Button>
        </div>

        {result && (
          <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
            <div className="text-xs font-medium text-primary">
              {result.mode === "organize" && `Extracted ${result.entries?.length || 0} entries`}
              {result.mode === "talk" && "Saved conversational entry"}
              {result.mode === "both" && `Created ${(result.entries?.length || 0) + (result.conversational ? 1 : 0)} entries`}
            </div>
            {result.entries && result.entries.length > 0 && (
              <div className="space-y-1">
                {result.entries.map((entry, i) => (
                  <div key={i} className="text-[11px] text-foreground/70 pl-2 border-l-2 border-primary/30">
                    [{entry.signifier}] {entry.text}
                  </div>
                ))}
              </div>
            )}
            {result.conversational && (
              <div className="text-[11px] text-foreground/70 pl-2 border-l-2 border-primary/30">
                [{result.conversational.signifier}] {result.conversational.text.substring(0, 80)}
                {result.conversational.text.length > 80 && "..."}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
