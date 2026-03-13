"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import {
  Calendar,
  BookOpen,
  ArrowRight,
  FileText,
  Layers,
  Search,
  Sparkles,
  CheckSquare,
  Circle,
  Star,
  Heart,
  Clock,
} from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { cn } from "@/lib/utils";
import { VoiceButton } from "./VoiceButton";
import { useLazySearchEntriesQuery, useLazySemanticSearchQuery } from "@/store/api/journalApi";
import type { JournalEntry, SemanticSearchResult, Signifier } from "@/types/journal";

interface OmniBarProps {
  onNavigateDate?: (date: string) => void;
  currentDate?: string;
}

const NAV_ITEMS = [
  { id: "daily", label: "Daily Log", href: "/", icon: Calendar, keywords: ["today", "daily", "log", "home"] },
  { id: "month", label: "Monthly Log", href: "/month", icon: Layers, keywords: ["month", "monthly", "overview", "calendar"] },
  { id: "future", label: "Future Log", href: "/future", icon: ArrowRight, keywords: ["future", "upcoming", "plan", "schedule"] },
  { id: "collections", label: "Collections", href: "/collections", icon: BookOpen, keywords: ["collections", "lists", "groups"] },
  { id: "migrate", label: "Migrate Entries", href: "/migrate", icon: ArrowRight, keywords: ["migrate", "move", "transfer", "unresolved"] },
];

const SIGNIFIER_ICONS: Record<Signifier, typeof Circle> = {
  task: CheckSquare,
  appointment: Clock,
  note: FileText,
  memory: Heart,
  important: Star,
};

function parseNaturalDate(input: string): string | null {
  const lower = input.toLowerCase().trim();
  const today = new Date();

  if (lower === "today" || lower === "now") {
    return formatDate(today);
  }
  if (lower === "yesterday") {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return formatDate(d);
  }
  if (lower === "tomorrow") {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return formatDate(d);
  }

  // "last monday", "last tuesday", etc.
  const lastDayMatch = lower.match(/^last\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
  if (lastDayMatch) {
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const targetDay = days.indexOf(lastDayMatch[1]);
    const d = new Date(today);
    const currentDay = d.getDay();
    let diff = currentDay - targetDay;
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() - diff);
    return formatDate(d);
  }

  // "next monday", etc.
  const nextDayMatch = lower.match(/^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
  if (nextDayMatch) {
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const targetDay = days.indexOf(nextDayMatch[1]);
    const d = new Date(today);
    const currentDay = d.getDay();
    let diff = targetDay - currentDay;
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() + diff);
    return formatDate(d);
  }

  // "march 15", "mar 15", "3/15", etc.
  const monthDayMatch = lower.match(/^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})$/);
  if (monthDayMatch) {
    const months: Record<string, number> = {
      jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
      apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
      aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
      nov: 10, november: 10, dec: 11, december: 11,
    };
    const month = months[monthDayMatch[1]];
    const day = parseInt(monthDayMatch[2], 10);
    if (month !== undefined && day >= 1 && day <= 31) {
      const d = new Date(today.getFullYear(), month, day);
      return formatDate(d);
    }
  }

  // "3/15" or "03/15"
  const slashMatch = lower.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10) - 1;
    const day = parseInt(slashMatch[2], 10);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const d = new Date(today.getFullYear(), month, day);
      return formatDate(d);
    }
  }

  // ISO date "2026-03-15"
  const isoMatch = lower.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return lower;
  }

  return null;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatEntryDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function OmniBar({ onNavigateDate, currentDate }: OmniBarProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<JournalEntry[]>([]);
  const [semanticResults, setSemanticResults] = useState<SemanticSearchResult[]>([]);
  const router = useRouter();
  const [triggerSearch] = useLazySearchEntriesQuery();
  const [triggerSemantic] = useLazySemanticSearchQuery();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // cmd+k listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setSearchResults([]);
      setSemanticResults([]);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const result = await triggerSearch(query.trim()).unwrap();
        setSearchResults(result);

        // Semantic fallback when FTS returns fewer than 3 results
        if (result.length < 3) {
          try {
            const sem = await triggerSemantic({ q: query.trim(), limit: 5 }).unwrap();
            // Exclude ids already in FTS results
            const ftsIds = new Set(result.map((e) => e.id));
            setSemanticResults(sem.filter((r) => !ftsIds.has(r.id)));
          } catch {
            setSemanticResults([]);
          }
        } else {
          setSemanticResults([]);
        }
      } catch {
        setSearchResults([]);
        setSemanticResults([]);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, triggerSearch, triggerSemantic]);

  const handleSelect = useCallback(
    (value: string) => {
      setOpen(false);

      // Navigation items
      const navItem = NAV_ITEMS.find((n) => n.id === value);
      if (navItem) {
        router.push(navItem.href);
        return;
      }

      // Date navigation
      if (value.startsWith("date:")) {
        const date = value.slice(5);
        if (onNavigateDate) {
          onNavigateDate(date);
        }
        router.push("/");
        return;
      }

      // Entry — navigate to that day
      if (value.startsWith("entry:")) {
        const [, date] = value.split(":");
        if (onNavigateDate) {
          onNavigateDate(date);
        }
        router.push("/");
        return;
      }
    },
    [router, onNavigateDate]
  );

  const parsedDate = query.trim().length > 0 ? parseNaturalDate(query) : null;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Omni Bar"
      className={cn(
        "fixed inset-0 z-50",
        "[&_[cmdk-overlay]]:fixed [&_[cmdk-overlay]]:inset-0 [&_[cmdk-overlay]]:bg-black/60 [&_[cmdk-overlay]]:backdrop-blur-sm",
      )}
    >
      {/* Accessible title (visually hidden for Radix Dialog) */}
      <VisuallyHidden.Root>
        <DialogPrimitive.Title>Journal Command Palette</DialogPrimitive.Title>
      </VisuallyHidden.Root>
      <DialogPrimitive.Description className="sr-only">
        Navigate pages, search entries, or jump to a date
      </DialogPrimitive.Description>

      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Command palette */}
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50">
        <div className="mx-4 overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-primary/5">
          {/* Input */}
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="w-4 h-4 shrink-0 text-muted-foreground" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Navigate, search entries, or jump to a date..."
              className="flex-1 h-12 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            <VoiceButton
              onTranscript={(text) => setQuery(text)}
              className="text-muted-foreground"
            />
            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* Date jump */}
            {parsedDate && (
              <Command.Group heading="Jump to Date">
                <Command.Item
                  value={`date:${parsedDate}`}
                  onSelect={handleSelect}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer aria-selected:bg-primary/10 aria-selected:text-primary"
                >
                  <Calendar className="w-4 h-4 shrink-0 text-primary" />
                  <span>
                    Go to{" "}
                    <span className="font-medium text-foreground">
                      {formatEntryDate(parsedDate)}
                    </span>
                  </span>
                </Command.Item>
              </Command.Group>
            )}

            {/* Navigation */}
            <Command.Group heading="Navigation">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <Command.Item
                    key={item.id}
                    value={item.id}
                    keywords={item.keywords}
                    onSelect={handleSelect}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer aria-selected:bg-primary/10 aria-selected:text-primary"
                  >
                    <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <span>{item.label}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>

            {/* FTS search results */}
            {searchResults.length > 0 && (
              <Command.Group heading="Entries">
                {searchResults.map((entry) => {
                  const Icon = SIGNIFIER_ICONS[entry.signifier] || FileText;
                  return (
                    <Command.Item
                      key={entry.id}
                      value={`entry:${entry.date}:${entry.id}`}
                      onSelect={handleSelect}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer aria-selected:bg-primary/10 aria-selected:text-primary"
                    >
                      <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-foreground">{entry.text}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatEntryDate(entry.date)}
                          {entry.status === "done" && " — completed"}
                          {entry.status === "migrated" && " — migrated"}
                        </p>
                      </div>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {/* Semantic search fallback (when FTS returns < 3 results) */}
            {semanticResults.length > 0 && (
              <Command.Group heading="Similar Entries">
                {semanticResults.map((result) => {
                  const Icon = SIGNIFIER_ICONS[result.signifier as Signifier] || Sparkles;
                  return (
                    <Command.Item
                      key={result.id}
                      value={`entry:${result.date}:${result.id}`}
                      onSelect={handleSelect}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer aria-selected:bg-primary/10 aria-selected:text-primary"
                    >
                      <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-foreground">{result.text}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatEntryDate(result.date)}
                          {" — similar"}
                        </p>
                      </div>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {/* Quick tips when empty */}
            {query.trim().length === 0 && (
              <Command.Group heading="Tips">
                <div className="px-3 py-2 text-xs text-muted-foreground space-y-1">
                  <p>Type a page name to navigate (daily, monthly, future...)</p>
                  <p>Type a date to jump (tomorrow, march 15, 3/15...)</p>
                  <p>Type anything else to search across all entries</p>
                </div>
              </Command.Group>
            )}
          </Command.List>
        </div>
      </div>
    </Command.Dialog>
  );
}
