"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { cleanCaptureText } from "@/lib/smart-capture";
import type { Message, ConversationState, ProcessMode } from "@/components/journal/captureTypes";

function storageKey(date: string) {
  return `gutter-capture-chat-${date}`;
}

function loadState(date: string): ConversationState {
  try {
    const raw = localStorage.getItem(storageKey(date));
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        messages: parsed.messages.map((m: Message) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })),
      };
    }
  } catch {}
  return { messages: [] };
}

function saveState(date: string, state: ConversationState) {
  try {
    localStorage.setItem(storageKey(date), JSON.stringify(state));
  } catch {}
}

function detectMode(text: string): ProcessMode {
  const lower = text.toLowerCase().trim();

  const explicitTalk = [
    /\blet'?s just talk\b/,
    /\bjust talk\b/,
    /\bcan we talk\b/,
    /\bi just want to talk\b/,
    /\bthinking out loud\b/,
    /\bdon't save this\b/,
    /\bdo not save this\b/,
  ];
  if (explicitTalk.some((pattern) => pattern.test(lower))) return "talk";

  const explicitOrganize = [
    /\badd (?:a |an )?task\b/,
    /\bcreate (?:a |an )?(?:task|note|event|appointment|reminder|collection)\b/,
    /\bsave (?:this|that|it) as\b/,
    /\bmark (?:it|this|that) done\b/,
    /\bput (?:this|that|it) on (?:my )?calendar\b/,
    /\badd (?:this|that|it) to (?:my )?(?:calendar|future log|collection)\b/,
    /\bschedule\b/,
    /\bremind me\b/,
  ];
  if (explicitOrganize.some((pattern) => pattern.test(lower))) return "organize";

  const saveAsIntent = /\b(note|calendar|prep|future|future log|collection|task|todo|appointment|meeting)\b/i.test(lower)
    && /\b(save|add|create|make|put|log|schedule|mark)\b/i.test(lower);
  if (saveAsIntent) return "organize";

  return "talk";
}

export function useCaptureChat(date: string, onEntriesCreated?: () => void) {
  const [state, setState] = useState<ConversationState>(() => loadState(date));
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { saveState(date, state); }, [date, state]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [state.messages, isTyping]);
  useEffect(() => { setState(loadState(date)); setInput(""); }, [date]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const addMessage = useCallback((msg: Omit<Message, "id" | "timestamp">) => {
    setState((prev) => ({
      messages: [...prev.messages, { ...msg, id: `m-${Date.now()}-${Math.random()}`, timestamp: new Date() }],
    }));
  }, []);

  const handleVoiceTranscript = useCallback((transcript: string) => {
    setInput((prev) => {
      const next = prev ? `${prev} ${transcript}` : transcript;
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
      });
      return next;
    });
    inputRef.current?.focus();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  const processMessage = useCallback(async (text: string) => {
    const cleaned = cleanCaptureText(text);
    const mode = detectMode(cleaned);
    addMessage({ role: "user", content: cleaned });
    setIsProcessing(true);
    setIsTyping(true);

    try {
      const sessionId = `session-${date}`;
      const res = await fetch("/api/journal/transcript/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleaned, mode, date, sessionId }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();

      await new Promise((r) => setTimeout(r, 350));
      setIsTyping(false);

      const count: number = data.entries?.length ?? 0;
      const saved = !!data.conversational?.savedToJournal;
      const aiReply: string = data.conversational?.aiResponse ?? "";
      const modeLabel = mode;
      let reply = aiReply || (count === 0
        ? "Hmm, I couldn't pull anything structured. Want to rephrase?"
        : count === 1 ? "Got it." : `Nice — pulled ${count} entries from that.`);

      addMessage({
        role: "assistant",
        content: reply,
        result: {
          entriesCreated: modeLabel === "talk" ? 0 : count,
          conversationalSaved: saved,
          savedAs: saved ? (data.conversational?.signifier || "note") : null,
        },
      });
      onEntriesCreated?.();
    } catch {
      setIsTyping(false);
      addMessage({ role: "assistant", content: "Sorry, something went wrong. Try again?" });
      toast.error("Failed to capture");
    } finally {
      setIsProcessing(false);
    }
  }, [date, addMessage, onEntriesCreated]);

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || isProcessing) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    await processMessage(text);
  }, [input, isProcessing, processMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  }, [handleSubmit]);

  const clearChat = useCallback(() => {
    setState({ messages: [] });
    localStorage.removeItem(storageKey(date));
  }, [date]);

  return {
    messages: state.messages,
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
  };
}
