"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppDispatch } from "@/store/store";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { EntryInput } from "@/components/journal/EntryInput";
import { EntryList } from "@/components/journal/EntryList";
import {
  useGetEntriesQuery,
  useAddEntryMutation,
  useUpdateEntryMutation,
  useDeleteEntryMutation,
  journalApi,
} from "@/store/api/journalApi";
import type { Signifier } from "@/types/journal";

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export default function JournalPage() {
  const [currentDate, setCurrentDate] = useState<string>(formatDate(new Date()));
  const { data: entries = [], isLoading } = useGetEntriesQuery(currentDate);
  const [addEntry] = useAddEntryMutation();
  const [updateEntry] = useUpdateEntryMutation();
  const [deleteEntry] = useDeleteEntryMutation();
  const dispatch = useAppDispatch();

  // Prefetch adjacent days for instant navigation
  useEffect(() => {
    const current = new Date(currentDate + "T12:00:00");
    const prev = new Date(current);
    prev.setDate(prev.getDate() - 1);
    const next = new Date(current);
    next.setDate(next.getDate() + 1);

    dispatch(journalApi.endpoints.getEntries.initiate(formatDate(prev), { forceRefetch: false }));
    dispatch(journalApi.endpoints.getEntries.initiate(formatDate(next), { forceRefetch: false }));
  }, [currentDate, dispatch]);

  // Listen for OmniBar date navigation
  useEffect(() => {
    const handler = (e: Event) => {
      const date = (e as CustomEvent<string>).detail;
      if (date) setCurrentDate(date);
    };
    window.addEventListener("omnibar-navigate-date", handler);
    return () => window.removeEventListener("omnibar-navigate-date", handler);
  }, []);

  const handlePrevDay = useCallback(() => {
    setCurrentDate((prev) => {
      const date = new Date(prev + "T12:00:00");
      date.setDate(date.getDate() - 1);
      return formatDate(date);
    });
  }, []);

  const handleNextDay = useCallback(() => {
    setCurrentDate((prev) => {
      const date = new Date(prev + "T12:00:00");
      date.setDate(date.getDate() + 1);
      return formatDate(date);
    });
  }, []);

  const handleToday = useCallback(() => {
    setCurrentDate(formatDate(new Date()));
  }, []);

  const handleAddEntry = useCallback((signifier: Signifier, text: string) => {
    addEntry({
      date: currentDate,
      signifier,
      text,
      tags: text.includes("@jynx") ? ["@jynx"] : [],
    });
  }, [addEntry, currentDate]);

  const handleToggle = useCallback((id: string) => {
    // Search top-level and children
    let entry = entries.find((e) => e.id === id);
    if (!entry) {
      for (const e of entries) {
        const child = e.children?.find((c) => c.id === id);
        if (child) { entry = child; break; }
      }
    }
    if (!entry) return;

    const newStatus = entry.status === "open" ? "done" : "open";
    updateEntry({ id, status: newStatus, _date: currentDate });
  }, [entries, updateEntry, currentDate]);

  const handleMigrate = useCallback((id: string) => {
    updateEntry({ id, status: "migrated", migrated_to: "pending", _date: currentDate });
  }, [updateEntry, currentDate]);

  const handleKill = useCallback((id: string) => {
    updateEntry({ id, status: "killed", _date: currentDate });
  }, [updateEntry, currentDate]);

  const handleDelete = useCallback((id: string) => {
    if (confirm("Permanently delete this entry?")) {
      deleteEntry({ id, hard: true, _date: currentDate });
    }
  }, [deleteEntry, currentDate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <JournalHeader
        date={currentDate}
        onPrevDay={handlePrevDay}
        onNextDay={handleNextDay}
        onToday={handleToday}
      />
      <EntryInput date={currentDate} onSubmit={handleAddEntry} />
      <EntryList
        entries={entries}
        onToggle={handleToggle}
        onMigrate={handleMigrate}
        onKill={handleKill}
        onDelete={handleDelete}
      />
    </>
  );
}
