"use client";

import { AlertTriangle, CalendarClock, CalendarRange, Layers3, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCalendarColorToken } from "@/lib/calendar-colors";
import { cn } from "@/lib/utils";
import { useGetCalendarRunwayQuery } from "@/store/api/tasksApi";

function toneForCalendar(calendar: string) {
  const token = getCalendarColorToken(calendar);
  const map: Record<string, string> = {
    "cal-gradient": "border-cal-gradient/35 bg-cal-gradient/10 text-cal-gradient",
    "cal-family": "border-cal-family/35 bg-cal-family/10 text-cal-family",
    "cal-home": "border-cal-home/35 bg-cal-home/10 text-cal-home",
    "cal-jw": "border-cal-jw/35 bg-cal-jw/10 text-cal-jw",
    "cal-school": "border-cal-school/35 bg-cal-school/10 text-cal-school",
    "cal-birthdays": "border-cal-birthdays/35 bg-cal-birthdays/10 text-cal-birthdays",
    "cal-holidays": "border-cal-holidays/35 bg-cal-holidays/10 text-cal-holidays",
  };
  return map[token] || map["cal-home"];
}

function formatEventTime(startDate: string, allDay: boolean) {
  if (allDay) return "All day";
  return new Date(startDate).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function RunwaySkeleton() {
  return (
    <section className="grid gap-4 border-b border-border/50 px-3 py-3 sm:px-6 sm:py-4 xl:grid-cols-[1.1fr_0.9fr]">
      <Skeleton className="h-52 rounded-[1.75rem]" />
      <Skeleton className="h-52 rounded-[1.75rem]" />
    </section>
  );
}

export function CalendarRunwayPanel({ date }: { date: string }) {
  const { data, isLoading, error } = useGetCalendarRunwayQuery({ date });

  if (isLoading) return <RunwaySkeleton />;

  if (error || !data) {
    return (
      <section className="border-b border-border/50 px-3 py-3 sm:px-6 sm:py-4">
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-foreground">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Calendar runway failed to load. The schedule board tripped over its own ankles.
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="grid gap-4 border-b border-border/50 px-3 py-3 sm:px-6 sm:py-4 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-primary/20 bg-[linear-gradient(135deg,rgba(122,162,247,0.18),rgba(255,255,255,0.02),rgba(235,188,186,0.12))] shadow-[0_0_50px_rgba(122,162,247,0.08)]">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-primary/80">Calendar runway</p>
              <CardTitle className="mt-2 text-2xl text-foreground">{data.displayRange}</CardTitle>
            </div>
            <Badge variant="outline">{data.busyDays} busy day{data.busyDays === 1 ? "" : "s"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            One honest glance at the next seven days across every calendar instead of pretending the monthly grid counts as planning.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-border/60 bg-background/35 p-3"><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Active events</p><p className="mt-2 text-2xl font-semibold text-foreground">{data.activeEvents}</p></div>
            <div className="rounded-2xl border border-border/60 bg-background/35 p-3"><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Conflicts</p><p className="mt-2 text-2xl font-semibold text-foreground">{data.conflictCount}</p></div>
            <div className="rounded-2xl border border-border/60 bg-background/35 p-3"><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">All-day</p><p className="mt-2 text-2xl font-semibold text-foreground">{data.allDayCount}</p></div>
            <div className="rounded-2xl border border-border/60 bg-background/35 p-3"><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Calendars</p><p className="mt-2 text-2xl font-semibold text-foreground">{data.calendarBreakdown.length}</p></div>
          </div>

          <div className="rounded-[1.5rem] border border-primary/20 bg-background/45 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Next move
            </div>
            <p className="mt-3 text-sm text-foreground">{data.nextMove}</p>
            {data.failedCalendars.length ? (
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-amber-300">
                Degraded calendars: {data.failedCalendars.join(", ")}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {data.calendarBreakdown.map((entry) => (
              <Badge key={entry.calendar} variant="outline" className={cn("border px-2.5 py-1", toneForCalendar(entry.calendar))}>
                {entry.calendar} {entry.count}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card className="bg-card/85">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-primary" /> Upcoming days</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.upcomingDays.map((day) => (
              <div key={day.date} className="rounded-2xl border border-border/60 bg-background/35 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{day.dayName}, {day.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {day.totalEvents ? `${day.totalEvents} event${day.totalEvents === 1 ? "" : "s"}` : "No events"}
                      {day.canceledCount ? ` • ${day.canceledCount} canceled` : ""}
                    </p>
                  </div>
                  {day.allDayCount ? <Badge variant="outline">{day.allDayCount} all-day</Badge> : null}
                </div>
                {day.events.length ? (
                  <div className="mt-3 space-y-2">
                    {day.events.slice(0, 3).map((event) => (
                      <div key={`${day.date}-${event.id}`} className="rounded-xl border border-border/50 bg-background/60 px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className={cn("text-sm text-foreground", event.isCanceled && "line-through text-muted-foreground")}>{event.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{formatEventTime(event.startDate, event.allDay)}{event.location ? ` • ${event.location}` : ""}</p>
                          </div>
                          <Badge variant="outline" className={cn("border", toneForCalendar(event.calendar))}>{event.calendar}</Badge>
                        </div>
                      </div>
                    ))}
                    {day.events.length > 3 ? <p className="text-xs text-muted-foreground">+{day.events.length - 3} more hiding lower in the month grid</p> : null}
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-card/85">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Layers3 className="h-4 w-4 text-primary" /> Conflict watch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.conflicts.length ? data.conflicts.map((conflict) => (
              <div key={conflict.id} className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{conflict.dayLabel}</p>
                  <Badge variant="outline">{conflict.overlapMinutes}m overlap</Badge>
                </div>
                <p className="mt-2 text-sm text-foreground">{conflict.events.map((event) => event.title).join(" vs ")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {conflict.calendars.map((calendar) => (
                    <Badge key={`${conflict.id}-${calendar}`} variant="outline" className={cn("border", toneForCalendar(calendar))}>
                      {calendar}
                    </Badge>
                  ))}
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-foreground">
                No timed overlaps in this seven-day window. Miracles do happen.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
