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

export const EntryList = memo(function EntryList({ entries, onToggle, onMigrate, onKill, onDelete }: EntryListProps) {
  const { data: collections = [] } = useGetCollectionsQuery();

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p className="text-sm">No entries yet. Start writing.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-1">
        {entries.map((entry) => (
          <EntryItem
            key={entry.id}
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
