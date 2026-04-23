"use client";

import { cn } from "@/lib/utils";

export function TypingIndicator({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]" />
      <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
      <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" />
    </div>
  );
}
