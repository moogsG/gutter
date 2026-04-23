"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SignifierIcon } from "./SignifierIcon";
import type { Signifier, TaskLane, TaskPriority } from "@/types/journal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Command, Sparkles, Loader2 } from "lucide-react";
import { useDispatch } from "react-redux";
import { journalApi } from "@/store/api/journalApi";
import { VoiceButton } from "./VoiceButton";
import { inferMetadata, cleanCaptureText } from "@/lib/smart-capture";

interface EntryInputProps {
  date: string;
  onSubmit: (signifier: Signifier, text: string, metadata?: { lane?: TaskLane | null; priority?: TaskPriority | null }) => void;
}

const signifiers: Signifier[] = ["task", "appointment", "note", "memory", "important"];

type InputMode = "quick" | "command";

export function EntryInput({ date, onSubmit }: EntryInputProps) {
  const dispatch = useDispatch();
  const [mode, setMode] = useState<InputMode>("quick");
  const [selectedSignifier, setSelectedSignifier] = useState<Signifier>("task");
  const [text, setText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [date]);

  const handleCommandSubmit = async (command: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch("/api/journal/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command,
          context: { currentDate: date, currentPage: "daily" },
        }),
      });

      const result = await response.json();

      if (result.ok) {
        toast.success(result.message);
        setText("");
        dispatch(journalApi.util.invalidateTags(["JournalDay", "Collections", "FutureLog", "JournalMonth"]));
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to execute command");
      console.error("Command error:", error);
    } finally {
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  };

  // Smart inference for quick mode
  const inferred = useMemo(() => {
    if (mode !== "quick" || !text.trim()) {
      return { lane: null, priority: null, waiting_on: null, status: null, signifier: null };
    }
    const result = inferMetadata(text);
    // Only use signifier inference if user hasn't explicitly chosen one
    // (i.e., still on default "task")
    return result;
  }, [mode, text]);
  
  // Auto-switch signifier if detected and user hasn't manually changed it
  useEffect(() => {
    if (mode === "quick" && inferred.signifier && selectedSignifier === "task") {
      // Only auto-switch if we have high confidence
      if (inferred.signifier !== "task") {
        setSelectedSignifier(inferred.signifier);
      }
    }
  }, [inferred.signifier, mode, selectedSignifier]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isProcessing) return;

    if (mode === "command") {
      handleCommandSubmit(text.trim());
    } else {
      // Clean and normalize text before submission
      const cleaned = cleanCaptureText(text);
      
      // Include smart inference for all types in quick mode
      const metadata = {
        lane: inferred.lane,
        priority: inferred.priority,
        waiting_on: inferred.waiting_on,
        status: inferred.status,
      };
      onSubmit(selectedSignifier, cleaned, metadata);
      setText("");
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mode !== "quick") return;

    // Cmd/Ctrl + K for command mode
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setMode("command");
      return;
    }

    if (e.key === "/" && !text) {
      e.preventDefault();
      return;
    }
    if (text === "/") {
      const shortcutMap: Record<string, Signifier> = {
        t: "task",
        a: "appointment",
        n: "note",
        m: "memory",
        i: "important",
      };
      const sig = shortcutMap[e.key.toLowerCase()];
      if (sig) {
        setSelectedSignifier(sig);
        setText("");
        e.preventDefault();
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-3 sm:p-4 bg-card border-b border-border">
      {/* Mode toggle + signifiers on same row for mobile */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
        <Button
          type="button"
          variant={mode === "quick" ? "default" : "ghost"}
          size="sm"
          onClick={() => setMode("quick")}
          className={cn(
            "h-7 px-2 sm:px-3 text-xs shrink-0",
            mode === "quick" && "bg-primary/20 hover:bg-primary/30"
          )}
        >
          <Sparkles className="w-3 h-3 sm:mr-1.5" />
          <span className="hidden sm:inline">Quick</span>
        </Button>
        <Button
          type="button"
          variant={mode === "command" ? "default" : "ghost"}
          size="sm"
          onClick={() => setMode("command")}
          className={cn(
            "h-7 px-2 sm:px-3 text-xs shrink-0",
            mode === "command" && "bg-accent/20 hover:bg-accent/30"
          )}
        >
          <Command className="w-3 h-3 sm:mr-1.5" />
          <span className="hidden sm:inline">Command</span>
        </Button>

        {/* Signifier buttons inline on same row */}
        {mode === "quick" && (
          <>
            <div className="w-px h-5 bg-border shrink-0" />
            {signifiers.map((sig) => (
              <Button
                key={sig}
                type="button"
                variant={selectedSignifier === sig ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedSignifier(sig)}
                className={cn(
                  "w-7 h-7 p-0 shrink-0",
                  selectedSignifier === sig && "bg-primary/20 hover:bg-primary/30"
                )}
              >
                <SignifierIcon signifier={sig} status="open" />
              </Button>
            ))}
          </>
        )}
      </div>

      {/* Input + submit */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          {mode === "command" && (
            <div className="flex items-center text-accent shrink-0">
              <Command className="w-4 h-4" />
            </div>
          )}
          <Input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            placeholder={
              mode === "command"
                ? 'Natural language: "buy milk", "create a Books collection"'
                : "Type / for shortcuts, ⌘K for commands"
            }
            className={cn(
              "flex-1 h-9 bg-background border-border text-sm",
              mode === "command" && "border-accent/30 focus-visible:ring-accent/50"
            )}
          />
          <VoiceButton
            disabled={isProcessing}
            onTranscript={(transcript) => {
              if (mode === "command") {
                // In command mode, execute the voice command directly
                handleCommandSubmit(transcript);
              } else {
                // In quick mode, populate the input so user can review/edit
                setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
                inputRef.current?.focus();
              }
            }}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!text.trim() || isProcessing}
            className={cn(
              "h-9 px-3 shrink-0",
              mode === "command" && "bg-accent hover:bg-accent/80"
            )}
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === "command" ? (
              "Run"
            ) : (
              "Add"
            )}
          </Button>
        </div>
        {/* Smart inference badges - show for all types in quick mode */}
        {mode === "quick" && text.trim() && (inferred.lane || inferred.priority || inferred.waiting_on || inferred.status || (inferred.signifier && inferred.signifier !== selectedSignifier)) && (
          <div className="flex items-center gap-1.5 px-1 flex-wrap">
            <span className="text-[10px] text-muted-foreground/50">Auto-detected:</span>
            {inferred.signifier && inferred.signifier !== selectedSignifier && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-300/70 border border-purple-500/20">
                type: {inferred.signifier}
              </span>
            )}
            {inferred.status && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-md border",
                inferred.status === "blocked"
                  ? "bg-amber-500/10 text-amber-300/70 border-amber-500/20"
                  : "bg-blue-500/10 text-blue-300/70 border-blue-500/20"
              )}>
                {inferred.status === "in-progress" ? "in progress" : inferred.status}
              </span>
            )}
            {inferred.lane && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary/70 border border-primary/20">
                {inferred.lane}
              </span>
            )}
            {inferred.priority && inferred.priority !== "normal" && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-md border",
                inferred.priority === "high" 
                  ? "bg-rose-500/10 text-rose-300/70 border-rose-500/20"
                  : "bg-blue-500/10 text-blue-300/70 border-blue-500/20"
              )}>
                {inferred.priority}
              </span>
            )}
            {inferred.waiting_on && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300/70 border border-amber-500/20">
                waiting: {inferred.waiting_on}
              </span>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
