import type { NextRequest } from "next/server";
import { fetchCalendarEvents } from "@/lib/calendar";
import { getDb } from "@/lib/db";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import type { MeetingPrepQueueData, MeetingPrepQueueItem } from "@/types";
import { getJournalDate, shiftJournalDate } from "@/lib/journal-date";

const WINDOW_DAYS = 7;

function isIsoDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function getCancunTodayDate(): string {
  return getJournalDate();
}

function shiftDate(date: string, amount: number): string {
  return shiftJournalDate(date, amount);
}

function formatRange(from: string, to: string): string {
  const fromText = new Date(`${from}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const toText = new Date(`${to}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${fromText} - ${toText}`;
}

function getUrgency(occurrenceDate: string, requestedDate: string): MeetingPrepQueueItem["urgency"] {
  if (occurrenceDate === requestedDate) return "today";
  if (occurrenceDate === shiftDate(requestedDate, 1)) return "tomorrow";
  return "later";
}

function getHoursUntil(value: string): number | null {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return null;
  return Math.max(0, Math.round((timestamp - Date.now()) / (1000 * 60 * 60)));
}

function isCanceled(title: string): boolean {
  return /^cancell?ed:/i.test(title.trim());
}

export async function GET(request: NextRequest) {
  const limited = rateLimitMiddleware(request, {
    windowMs: 60000,
    maxRequests: 30,
  });
  if (limited) return limited;

  try {
    const params = new URL(request.url).searchParams;
    const requestedDate = isIsoDate(params.get("date")) ? params.get("date")! : getCancunTodayDate();
    const rangeEndDate = shiftDate(requestedDate, WINDOW_DAYS - 1);
    const calendarResult = await fetchCalendarEvents(requestedDate, rangeEndDate);

    if (!calendarResult.ok) {
      return Response.json({ error: calendarResult.error || "Calendar unavailable" }, { status: 503 });
    }

    const db = getDb();
    const prepRows = db.prepare(`
      SELECT
        event_id,
        occurrence_date,
        prep_status,
        prep_notes,
        transcript,
        summary,
        action_items
      FROM meeting_prep
      WHERE occurrence_date >= ? AND occurrence_date <= ?
    `).all(requestedDate, rangeEndDate) as Array<{
      event_id: string;
      occurrence_date: string;
      prep_status: "none" | "preparing" | "ready";
      prep_notes: string | null;
      transcript: string | null;
      summary: string | null;
      action_items: string | null;
    }>;

    const prepByKey = new Map(
      prepRows.map((row) => [`${row.event_id}::${row.occurrence_date}`, row]),
    );

    const meetings = (calendarResult.data || [])
      .filter((event) => !event.allDay && !isCanceled(event.summary))
      .sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime())
      .map((event): MeetingPrepQueueItem => {
        const occurrenceDate = event.startDate.split("T")[0];
        const prep = prepByKey.get(`${event.id}::${occurrenceDate}`);
        let actionItemCount = 0;

        if (prep?.action_items) {
          try {
            const parsed = JSON.parse(prep.action_items) as unknown;
            actionItemCount = Array.isArray(parsed) ? parsed.length : 0;
          } catch {
            actionItemCount = 0;
          }
        }

        return {
          id: `${event.id}::${occurrenceDate}`,
          eventId: event.id,
          title: event.summary,
          calendar: event.calendar,
          startDate: event.startDate,
          endDate: event.endDate,
          occurrenceDate,
          location: event.location,
          prepStatus: prep?.prep_status || "none",
          hasPrepNotes: Boolean(prep?.prep_notes),
          hasTranscript: Boolean(prep?.transcript),
          hasSummary: Boolean(prep?.summary),
          actionItemCount,
          urgency: getUrgency(occurrenceDate, requestedDate),
          hoursUntil: getHoursUntil(event.startDate),
        };
      });

    const payload: MeetingPrepQueueData = {
      requestedDate,
      rangeEndDate,
      displayRange: formatRange(requestedDate, rangeEndDate),
      generatedAt: new Date().toISOString(),
      counts: {
        total: meetings.length,
        redZone: meetings.filter((meeting) => meeting.prepStatus !== "ready" && meeting.urgency !== "later").length,
        ready: meetings.filter((meeting) => meeting.prepStatus === "ready").length,
        later: meetings.filter((meeting) => meeting.prepStatus !== "ready" && meeting.urgency === "later").length,
        notesCaptured: meetings.filter((meeting) => meeting.hasPrepNotes || meeting.hasTranscript || meeting.hasSummary || meeting.actionItemCount > 0).length,
      },
      groups: {
        redZone: meetings.filter((meeting) => meeting.prepStatus !== "ready" && meeting.urgency !== "later"),
        ready: meetings.filter((meeting) => meeting.prepStatus === "ready"),
        later: meetings.filter((meeting) => meeting.prepStatus !== "ready" && meeting.urgency === "later"),
      },
    };

    return Response.json(payload);
  } catch (error) {
    console.error("[meeting-prep-queue] failed to build queue", error);
    return Response.json({ error: "Failed to build meeting queue" }, { status: 500 });
  }
}
