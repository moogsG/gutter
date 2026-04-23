"use client";

import { VoiceButton } from "./VoiceButton";
import { TypingIndicator } from "./TypingIndicator";
import { ChatMessage } from "./ChatMessage";
import { cn } from "@/lib/utils";
import { Trash2, Sparkles } from "lucide-react";
import { useCaptureChat } from "@/hooks/useCaptureChat";

const WELCOME =
  "Hey! What's on your mind? I can capture tasks, calendar events, and notes — or just listen if you want to think out loud.";

interface ConversationalTranscriptProps {
  date: string;
  onEntriesCreated?: () => void;
}

export function ConversationalTranscript({ date, onEntriesCreated }: ConversationalTranscriptProps) {
  const {
    messages,
    input,
    isProcessing,
    isTyping,
    inputRef,
    bottomRef,
    handleInputChange,
    handleVoiceTranscript,
    handleSubmit,
    handleKeyDown,
    clearChat,
  } = useCaptureChat(date, onEntriesCreated);

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {isEmpty ? (
          <AssistantBubble content={WELCOME} />
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
        )}
        {isTyping && (
          <div className="flex items-end gap-2">
            <AvatarDot />
            <div className="rounded-2xl rounded-bl-sm px-3.5 py-3 bg-muted">
              <TypingIndicator />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-border px-4 py-3 space-y-2">
        <div className="flex items-stretch gap-2">
          <div className="flex flex-1 items-end gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 transition-[border-color,box-shadow] focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={isEmpty ? "Start talking or typing…" : "Continue…"}
              disabled={isProcessing}
              rows={2}
              className={cn(
                "flex-1 min-h-[56px] max-h-40 bg-transparent py-1 resize-none overflow-y-auto",
                "text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50",
                "focus:outline-none",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            />
            <VoiceButton onTranscript={handleVoiceTranscript} disabled={isProcessing} className="mb-1 text-muted-foreground hover:text-foreground" />
          </div>
        </div>
        {messages.length > 0 && !isProcessing && (
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground/40">Enter to send, Shift+Enter for new line</p>
            <button
              onClick={clearChat}
              className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-2.5 h-2.5" />
              Clear chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AvatarDot() {
  return (
    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mb-0.5">
      <Sparkles className="w-3 h-3 text-primary" />
    </div>
  );
}

function AssistantBubble({ content }: { content: string }) {
  return (
    <div className="flex items-end gap-2">
      <AvatarDot />
      <div className="max-w-[75%] rounded-2xl rounded-bl-sm px-3.5 py-2.5 bg-muted text-sm text-foreground">
        <p className="leading-relaxed">{content}</p>
      </div>
    </div>
  );
}
