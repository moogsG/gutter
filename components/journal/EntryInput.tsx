"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SignifierIcon } from "./SignifierIcon";
import type { Signifier } from "@/types/journal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Command, Sparkles, Loader2 } from "lucide-react";
import { useDispatch } from "react-redux";
import { journalApi } from "@/store/api/journalApi";
import { VoiceButton } from "./VoiceButton";

interface EntryInputProps {
  date: string;
  onSubmit: (signifier: Signifier, text: string) => void;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isProcessing) return;

    if (mode === "command") {
      handleCommandSubmit(text.trim());
    } else {
      onSubmit(selectedSignifier, text.trim());
      setText("");
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mode !== "quick") return;

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
              ? 'e.g. "buy milk", "create a Books collection"'
              : "What's on your mind?"
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
    </form>
  );
}
