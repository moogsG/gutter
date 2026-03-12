"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { EntryInput } from "@/components/journal/EntryInput";
import { EntryItem } from "@/components/journal/EntryItem";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calendar, FileText, ChevronDown, ChevronUp, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JournalEntry } from "@/types/journal";
import {
  useGetEntriesQuery,
  useUpdateEntryMutation,
  useDeleteEntryMutation,
  useAddEntryMutation,
} from "@/store/api/journalApi";
import type { Signifier } from "@/types/journal";

interface CalendarEvent {
  id: string;
  summary: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  calendar: string;
  location?: string;
}

interface MeetingPrep {
  id: string;
  eventId: string;
  title: string;
  time: string;
  calendar: string;
  prepNotes: string | null;
  prepStatus: string;
  transcript: string | null;
  summary: string | null;
  actionItems: string | null;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDuration(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const durationMs = endDate.getTime() - startDate.getTime();
  const minutes = Math.round(durationMs / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

interface MeetingCardProps {
  event: CalendarEvent;
  prep?: MeetingPrep;
  onRequestPrep: () => void;
  onUploadTranscript: (transcript: string) => void;
}

function MeetingCard({ event, prep, onRequestPrep, onUploadTranscript }: MeetingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showTranscriptUpload, setShowTranscriptUpload] = useState(false);
  const [transcriptText, setTranscriptText] = useState("");

  const prepStatusColor = {
    none: "bg-gray-500/20 text-gray-300 border-gray-500/30",
    preparing: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    ready: "bg-green-500/20 text-green-300 border-green-500/30",
  };

  const transcriptStatusColor = {
    none: "bg-gray-500/20 text-gray-300 border-gray-500/30",
    has: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    summarized: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  };

  const prepStatus = prep ? prep.prepStatus : "none";
  const transcriptStatus = prep?.summary
    ? "summarized"
    : prep?.transcript
    ? "has"
    : "none";

  const handleUpload = () => {
    if (transcriptText.trim()) {
      onUploadTranscript(transcriptText);
      setTranscriptText("");
      setShowTranscriptUpload(false);
    }
  };

  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
            <h3 className="font-semibold text-foreground truncate">{event.summary}</h3>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              {event.allDay ? "All day" : formatTime(event.startDate)}
            </span>
            {!event.allDay && (
              <span>· {formatDuration(event.startDate, event.endDate)}</span>
            )}
            <span>· {event.calendar}</span>
            {event.location && <span>· {event.location}</span>}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="shrink-0"
        >
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Status badges */}
      <div className="flex items-center gap-2 mt-3">
        <Badge className={cn("text-xs", prepStatusColor[prepStatus as keyof typeof prepStatusColor])}>
          {prepStatus === "none" && "No prep"}
          {prepStatus === "preparing" && "Preparing..."}
          {prepStatus === "ready" && "Prep ready"}
        </Badge>
        <Badge
          className={cn("text-xs", transcriptStatusColor[transcriptStatus as keyof typeof transcriptStatusColor])}
        >
          {transcriptStatus === "none" && "No transcript"}
          {transcriptStatus === "has" && "Has transcript"}
          {transcriptStatus === "summarized" && "Summarized"}
        </Badge>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-4 space-y-3">
          {prep?.prepNotes && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Prep Notes</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {prep.prepNotes}
              </p>
            </div>
          )}

          {prep?.summary && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Summary</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {prep.summary}
              </p>
            </div>
          )}

          {prep?.actionItems && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Action Items</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {prep.actionItems}
              </p>
            </div>
          )}

          {prep?.transcript && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Transcript</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap max-h-64 overflow-y-auto">
                {prep.transcript}
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {!prep?.prepNotes && (
              <Button size="sm" variant="outline" onClick={onRequestPrep}>
                Request Prep
              </Button>
            )}
            {!showTranscriptUpload ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowTranscriptUpload(true)}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Transcript
              </Button>
            ) : (
              <div className="w-full space-y-2">
                <textarea
                  value={transcriptText}
                  onChange={(e) => setTranscriptText(e.target.value)}
                  placeholder="Paste meeting transcript here..."
                  className="w-full min-h-[120px] p-2 rounded-md bg-background border border-border text-sm resize-y"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleUpload}>
                    Upload
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowTranscriptUpload(false);
                      setTranscriptText("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function DayDetailPage() {
  const params = useParams();
  const router = useRouter();
  const date = params.date as string;

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [meetingPreps, setMeetingPreps] = useState<MeetingPrep[]>([]);
  const [loading, setLoading] = useState(true);

  // Use RTK Query for entries
  const { data: entries = [] } = useGetEntriesQuery(date);
  const [addEntry] = useAddEntryMutation();
  const [updateEntry] = useUpdateEntryMutation();
  const [deleteEntry] = useDeleteEntryMutation();

  const loadDayData = async () => {
    setLoading(true);
    try {
      // Fetch calendar events
      const eventsRes = await fetch(`/api/calendar/events?from=${date}&to=${date}`);
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(Array.isArray(eventsData) ? eventsData : []);
      }

      // Fetch meeting preps
      const prepsRes = await fetch("/api/meeting-prep");
      if (prepsRes.ok) {
        const prepsData = await prepsRes.json();
        setMeetingPreps(prepsData.meetings || []);
      }
    } catch (error) {
      console.error("Failed to load day data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDayData();
  }, [date]);

  // Poll for prep updates while any meeting is still "preparing"
  useEffect(() => {
    const hasPreparing = meetingPreps.some((m) => m.prepStatus === "preparing");
    if (!hasPreparing) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/meeting-prep");
        if (!res.ok) return;
        const data = await res.json();
        setMeetingPreps(data.meetings || []);
      } catch {}
    }, 4000);

    return () => clearInterval(interval);
  }, [meetingPreps]);

  const handlePrevDay = () => {
    const currentDate = new Date(date + "T12:00:00");
    currentDate.setDate(currentDate.getDate() - 1);
    const newDate = currentDate.toISOString().split("T")[0];
    router.push(`/day/${newDate}`);
  };

  const handleNextDay = () => {
    const currentDate = new Date(date + "T12:00:00");
    currentDate.setDate(currentDate.getDate() + 1);
    const newDate = currentDate.toISOString().split("T")[0];
    router.push(`/day/${newDate}`);
  };

  const handleToday = () => {
    const today = new Date().toISOString().split("T")[0];
    router.push(`/day/${today}`);
  };

  const handleRequestPrep = async (event: CalendarEvent) => {
    try {
      await fetch("/api/meeting-prep/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          title: event.summary,
          time: event.startDate,
          calendar: event.calendar,
          occurrenceDate: date,
        }),
      });
      loadDayData();
    } catch (error) {
      console.error("Failed to request prep:", error);
    }
  };

  const handleUploadTranscript = async (event: CalendarEvent, transcript: string) => {
    try {
      await fetch("/api/meeting-prep/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          title: event.summary,
          time: event.startDate,
          transcript,
          occurrenceDate: date,
        }),
      });
      loadDayData();
    } catch (error) {
      console.error("Failed to upload transcript:", error);
    }
  };

  const handleAddEntry = useCallback(
    (signifier: Signifier, text: string) => {
      addEntry({
        date,
        signifier,
        text,
        tags: text.includes("@jynx") ? ["@jynx"] : [],
      });
    },
    [addEntry, date]
  );

  const handleToggle = useCallback(
    (id: string) => {
      // Search top-level and children
      let entry = entries.find((e) => e.id === id);
      if (!entry) {
        for (const e of entries) {
          const child = e.children?.find((c) => c.id === id);
          if (child) {
            entry = child;
            break;
          }
        }
      }
      if (!entry) return;

      const newStatus = entry.status === "open" ? "done" : "open";
      updateEntry({ id, status: newStatus, _date: date });
    },
    [entries, updateEntry, date]
  );

  const handleMigrate = useCallback(
    (id: string) => {
      updateEntry({ id, status: "migrated", migrated_to: "pending", _date: date });
    },
    [updateEntry, date]
  );

  const handleKill = useCallback(
    (id: string) => {
      updateEntry({ id, status: "killed", _date: date });
    },
    [updateEntry, date]
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (confirm("Permanently delete this entry?")) {
        deleteEntry({ id, hard: true, _date: date });
      }
    },
    [deleteEntry, date]
  );

  const dateObj = new Date(date + "T12:00:00");
  const dateHeader = dateObj.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Find prep for each event
  const eventsWithPrep = events.map((event) => {
    const prep = meetingPreps.find(
      (p) => p.eventId === event.id && p.time?.split("T")[0] === date
    );
    return { event, prep };
  });

  return (
    <div className="min-h-screen bg-background">
      <JournalHeader
        date={date}
        onPrevDay={handlePrevDay}
        onNextDay={handleNextDay}
        onToday={handleToday}
      />

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        {/* Date header with stats */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{dateHeader}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{events.length} {events.length === 1 ? "meeting" : "meetings"}</span>
            <span>·</span>
            <span>{entries.length} journal {entries.length === 1 ? "entry" : "entries"}</span>
          </div>
        </div>

        <Separator />

        {/* Meetings section */}
        {events.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl font-semibold">Meetings</h2>
            </div>
            <div className="space-y-3">
              {eventsWithPrep.map(({ event, prep }) => (
                <MeetingCard
                  key={event.id}
                  event={event}
                  prep={prep}
                  onRequestPrep={() => handleRequestPrep(event)}
                  onUploadTranscript={(transcript) =>
                    handleUploadTranscript(event, transcript)
                  }
                />
              ))}
            </div>
          </section>
        )}

        {/* Journal section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            <h2 className="text-xl font-semibold">Journal</h2>
          </div>

          {entries.length > 0 && (
            <div className="space-y-2">
              {entries.map((entry) => (
                <EntryItem
                  key={entry.id}
                  entry={entry}
                  onToggle={handleToggle}
                  onMigrate={handleMigrate}
                  onKill={handleKill}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          <EntryInput date={date} onSubmit={handleAddEntry} />
        </section>
      </div>
    </div>
  );
}
