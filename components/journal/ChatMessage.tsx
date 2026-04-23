"use client";

import { cn } from "@/lib/utils";
import { Sparkles, Check } from "lucide-react";
import type { Message } from "./captureTypes";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex items-end gap-2", isUser ? "flex-row-reverse" : "flex-row")}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mb-0.5">
          <Sparkles className="w-3 h-3 text-primary" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        )}
      >
        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
        {message.result && (
          <div className="flex flex-wrap items-center gap-2 mt-1.5 pt-1.5 border-t border-white/10">
            {(message.result.entriesCreated ?? 0) > 0 && (
              <span className="text-[10px] opacity-70 flex items-center gap-1">
                <Check className="w-2.5 h-2.5" />
                {message.result.entriesCreated}{" "}
                {message.result.entriesCreated === 1 ? "entry" : "entries"}
              </span>
            )}
            {message.result.conversationalSaved && (
              <span className="text-[10px] opacity-70 flex items-center gap-1">
                <Check className="w-2.5 h-2.5" />
                saved as {message.result.savedAs || "note"}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
