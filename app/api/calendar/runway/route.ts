import { type NextRequest, NextResponse } from "next/server";
import { calendarCache, fetchCalendarEvents } from "@/lib/calendar";
import { buildCalendarRunway } from "@/lib/calendar-runway";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import type { CalendarEvent } from "@/types";

function getRequestedDate(input: string | null): string {
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cancun",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function shiftDate(date: string, amount: number): string {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + amount);
  return next.toISOString().split("T")[0];
}

function parseFailedCalendars(lastError: string | null): string[] {
  if (!lastError) return [];
  return lastError
    .split("|")
    .map((segment) => segment.trim().split(":")[0]?.trim())
    .filter(Boolean) as string[];
}

function normalizeEvents(events: Awaited<ReturnType<typeof fetchCalendarEvents>>["data"]): CalendarEvent[] {
  return (events || []).map((event) => ({
    id: event.id,
    title: event.summary,
    startDate: event.startDate,
    endDate: event.endDate,
    calendar: event.calendar,
    allDay: event.allDay,
    location: event.location,
  }));
}

export async function GET(request: NextRequest) {
  const limited = rateLimitMiddleware(request, {
    windowMs: 60000,
    maxRequests: 30,
  });
  if (limited) return limited;

  const requestedDate = getRequestedDate(request.nextUrl.searchParams.get("date"));
  const rangeEndDate = shiftDate(requestedDate, 6);
  const result = await fetchCalendarEvents(requestedDate, rangeEndDate);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Failed to load calendar runway" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    buildCalendarRunway(
      requestedDate,
      normalizeEvents(result.data),
      parseFailedCalendars(calendarCache.lastError),
    ),
  );
}
