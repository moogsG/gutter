"use client";

import { memo } from "react";
import { EntryItem } from "./EntryItem";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetCollectionsQuery } from "@/store/api/journalApi";
import type { JournalEntry } from "@/types/journal";

interface EntryListProps {
  entries: JournalEntry[];
  onToggle?: (id: string) => void;
  onMigrate?: (id: string) => void;
  onKill?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function sortEntries(entries: JournalEntry[]): JournalEntry[] {
  const weight = (entry: JournalEntry) => {
    if (entry.signifier !== "task") return 3;
    switch (entry.status) {
      case "blocked":
        return 0;
      case "in-progress":
        return 1;
      case "open":
        return 2;
      case "done":
        return 4;
      default:
        return 5;
    }
  };

  return [...entries].sort((a, b) => {
    const byWeight = weight(a) - weight(b);
    if (byWeight !== 0) return byWeight;
    return a.sort_order - b.sort_order;
  });
}

export const EntryList = memo(function EntryList({ entries, onToggle, onMigrate, onKill, onDelete }: EntryListProps) {
  const { data: collections = [] } = useGetCollectionsQuery();
  const orderedEntries = sortEntries(entries);

  if (orderedEntries.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <p className="text-sm">No entries yet. Start writing.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-1">
        {orderedEntries.map((entry, index) => (
          <EntryItem
            key={entry.id || `entry-${entry.date}-${entry.sort_order}-${index}`}
            entry={entry}
            collections={collections}
            onToggle={onToggle}
            onMigrate={onMigrate}
            onKill={onKill}
            onDelete={onDelete}
          />
        ))}
      </div>
    </ScrollArea>
  );
});
