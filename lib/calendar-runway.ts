import type {
  CalendarEvent,
  CalendarRunwayConflict,
  CalendarRunwayData,
  CalendarRunwayDay,
} from "@/types";
import { shiftJournalDate } from "@/lib/journal-date";

function shiftDate(date: string, amount: number): string {
  return shiftJournalDate(date, amount);
}

function formatDayLabel(date: string): { label: string; dayName: string } {
  const target = new Date(`${date}T12:00:00`);
  return {
    label: target.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    dayName: target.toLocaleDateString("en-US", {
      weekday: "short",
    }),
  };
}

function formatTimeRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const startTime = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const endTime = end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${startTime}-${endTime}`;
}

function toCalendarEvent(event: CalendarEvent): CalendarEvent {
  return {
    ...event,
    isCanceled: event.title.startsWith("Canceled:"),
  };
}

function getConflicts(date: string, events: CalendarEvent[]): CalendarRunwayConflict[] {
  const timedEvents = events
    .filter((event) => !event.allDay && !event.isCanceled)
    .sort(
      (left, right) =>
        new Date(left.startDate).getTime() - new Date(right.startDate).getTime(),
    );

  const conflicts: CalendarRunwayConflict[] = [];

  for (let index = 0; index < timedEvents.length; index += 1) {
    const current = timedEvents[index];
    const currentEnd = new Date(current.endDate).getTime();

    for (let nextIndex = index + 1; nextIndex < timedEvents.length; nextIndex += 1) {
      const candidate = timedEvents[nextIndex];
      const candidateStart = new Date(candidate.startDate).getTime();

      if (candidateStart >= currentEnd) break;

      const overlapMinutes = Math.max(
        1,
        Math.round(
          (Math.min(currentEnd, new Date(candidate.endDate).getTime()) - candidateStart) /
            60000,
        ),
      );
      const { label } = formatDayLabel(date);

      conflicts.push({
        id: `${current.id}-${candidate.id}-${date}`,
        date,
        dayLabel: label,
        startDate: current.startDate,
        endDate: candidate.endDate,
        calendars: [...new Set([current.calendar, candidate.calendar])],
        overlapMinutes,
        title: `${formatTimeRange(current.startDate, current.endDate)} overlaps ${candidate.title}`,
        events: [
          {
            id: current.id,
            title: current.title,
            calendar: current.calendar,
            startDate: current.startDate,
            endDate: current.endDate,
          },
          {
            id: candidate.id,
            title: candidate.title,
            calendar: candidate.calendar,
            startDate: candidate.startDate,
            endDate: candidate.endDate,
          },
        ],
      });
    }
  }

  return conflicts;
}

function buildNextMove(
  requestedDate: string,
  days: CalendarRunwayDay[],
  conflicts: CalendarRunwayConflict[],
  failedCalendars: string[],
): string {
  if (failedCalendars.length) {
    return `Calendar read was degraded for ${failedCalendars.join(", ")}. Check that before trusting a quiet-looking day.`;
  }

  if (conflicts.length) {
    const [first] = conflicts;
    return `${first.dayLabel} has an overlap between ${first.events[0]?.title || "two events"} and ${first.events[1]?.title || "another event"}. Untangle it before it bites you.`;
  }

  const nextBusyDay = days.find((day) => day.totalEvents > 0);
  if (!nextBusyDay) {
    return `No calendar events from ${requestedDate} through ${shiftDate(requestedDate, 6)}. Use the quiet to set tomorrow's top three and family plan.`;
  }

  const firstEvent = nextBusyDay.events.find((event) => !event.isCanceled) || nextBusyDay.events[0];
  if (!firstEvent) {
    return `No live events landed in the next seven days. Enjoy the suspiciously empty runway while it lasts.`;
  }

  if (firstEvent.allDay) {
    return `${nextBusyDay.dayName} starts with ${firstEvent.title}. Make sure the all-day stuff is actually handled, not just parked.`;
  }

  return `${nextBusyDay.dayName} starts with ${firstEvent.title} at ${new Date(firstEvent.startDate).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}. Prep before you’re half-awake and useless.`;
}

export function buildCalendarRunway(
  requestedDate: string,
  rawEvents: CalendarEvent[],
  failedCalendars: string[] = [],
): Omit<CalendarRunwayData, "source"> {
  const events = rawEvents.map(toCalendarEvent);
  const upcomingDays: CalendarRunwayDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(requestedDate, index);
    const dayEvents = events
      .filter((event) => event.startDate.slice(0, 10) === date)
      .sort(
        (left, right) =>
          new Date(left.startDate).getTime() - new Date(right.startDate).getTime(),
      );
    const { label, dayName } = formatDayLabel(date);

    return {
      date,
      label,
      dayName,
      totalEvents: dayEvents.length,
      allDayCount: dayEvents.filter((event) => event.allDay).length,
      canceledCount: dayEvents.filter((event) => event.isCanceled).length,
      events: dayEvents,
    };
  });

  const conflicts = upcomingDays.flatMap((day) => getConflicts(day.date, day.events)).slice(0, 8);
  const activeEvents = events.filter((event) => !event.isCanceled).length;
  const calendarBreakdown = Array.from(
    events.reduce((counts, event) => {
      if (event.isCanceled) return counts;
      counts.set(event.calendar, (counts.get(event.calendar) || 0) + 1);
      return counts;
    }, new Map<string, number>()),
  )
    .map(([calendar, count]) => ({ calendar, count }))
    .sort((left, right) => right.count - left.count || left.calendar.localeCompare(right.calendar));

  return {
    requestedDate,
    rangeEndDate: shiftDate(requestedDate, 6),
    displayRange: `${formatDayLabel(requestedDate).label} - ${formatDayLabel(shiftDate(requestedDate, 6)).label}`,
    generatedAt: new Date().toISOString(),
    totalEvents: events.length,
    activeEvents,
    busyDays: upcomingDays.filter((day) => day.totalEvents > 0).length,
    allDayCount: upcomingDays.reduce((total, day) => total + day.allDayCount, 0),
    conflictCount: conflicts.length,
    failedCalendars,
    nextMove: buildNextMove(requestedDate, upcomingDays, conflicts, failedCalendars),
    calendarBreakdown,
    upcomingDays,
    conflicts,
  };
}
