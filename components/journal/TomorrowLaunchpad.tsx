"use client";

import { AlertTriangle, CalendarDays, Sparkles, Target, Wrench } from "lucide-react";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { TomorrowFamilyPanel } from "@/components/journal/TomorrowFamilyPanel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useGetTomorrowLaunchpadQuery } from "@/store/api/tomorrowApi";

function getTomorrowBaseDate(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Cancun",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const base = new Date(Date.UTC(Number(lookup.year), Number(lookup.month) - 1, Number(lookup.day), 12));
  base.setUTCDate(base.getUTCDate() + 1);
  return base.toISOString().split("T")[0];
}

function getCancunTodayDate(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
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

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function toneForHealth(status: string) {
  if (status === "healthy") return "border-chart-3/30 bg-chart-3/10";
  if (status === "stale") return "border-chart-5/30 bg-chart-5/10";
  return "border-destructive/30 bg-destructive/10";
}

export function TomorrowLaunchpad({ date, onDateChange }: { date: string; onDateChange: (date: string) => void }) {
  const { data, isLoading, isFetching, error } = useGetTomorrowLaunchpadQuery(date);

  return (
    <div className="flex flex-col h-full overflow-auto">
      <JournalHeader
        date={date}
        onPrevDay={() => onDateChange(shiftDate(date, -1))}
        onNextDay={() => onDateChange(shiftDate(date, 1))}
        onToday={() => onDateChange(getCancunTodayDate())}
        showCapture={false}
      />

      <main className="flex-1 px-4 py-5 sm:px-6">
        {isLoading ? <LaunchpadSkeleton /> : null}
        {!isLoading && error ? <FailureState /> : null}
        {!isLoading && data ? (
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/18 via-card to-secondary/10 p-5 shadow-[0_0_60px_rgba(255,61,154,0.08)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-primary/80">Tomorrow launchpad</p>
                  <h1 className="mt-2 text-3xl font-semibold text-foreground">{data.displayDate}</h1>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    One place for your next work move, tomorrow’s meetings, family friction, and whether the support stack is quietly lying to you.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="gap-1 border-primary/30 bg-background/30 px-3 py-1">
                    <CalendarDays className="w-3.5 h-3.5" /> {data.meetings.length} meetings
                  </Badge>
                  <Badge variant="outline" className="gap-1 border-primary/30 bg-background/30 px-3 py-1">
                    <Target className="w-3.5 h-3.5" /> {data.focus.topThree.length} focus items
                  </Badge>
                  <Badge variant="outline" className="gap-1 border-primary/30 bg-background/30 px-3 py-1">
                    {data.family.grocery.itemCount} groceries
                  </Badge>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-primary/20 bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="w-4 h-4 text-primary" /> Pick One First</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-primary/20 bg-primary/8 p-4">
                    <p className="text-lg font-medium text-foreground">{data.focus.pickOne?.title || "Nothing surfaced from focus reset yet."}</p>
                    {data.focus.pickOne ? (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <Badge variant="secondary">{data.focus.pickOne.lane || "unknown lane"}</Badge>
                        <Badge variant="outline">{data.focus.pickOne.status || "unknown status"}</Badge>
                        <Badge variant="outline">{data.focus.pickOne.priority || "no priority"}</Badge>
                        {data.focus.pickOne.staleDays ? <Badge variant="outline">{data.focus.pickOne.staleDays}d stale</Badge> : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {data.focus.topThree.map((task) => (
                      <div key={task.raw} className="rounded-2xl border border-border/60 bg-background/40 p-3">
                        <p className="text-sm font-medium text-foreground">{task.title}</p>
                        <p className="mt-2 text-xs text-muted-foreground">{[task.lane, task.status, task.staleDays ? `${task.staleDays}d stale` : null].filter(Boolean).join(" • ")}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className={cn("border-border/70", toneForHealth(data.systemHealth.overall))}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Wrench className="w-4 h-4" /> System Truth Check</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <HealthRow label="Gutter" status={data.systemHealth.gutter.status} checkedAt={data.systemHealth.gutter.checkedAt} />
                  <HealthRow label="Calendar" status={data.systemHealth.calendar.status} checkedAt={data.systemHealth.calendar.checkedAt} />
                  <p className="text-xs text-muted-foreground">
                    {data.systemHealth.overall === "healthy" ? "No obvious rot detected." : data.systemHealth.overall === "stale" ? "Checks are stale, so don’t trust a fake-green morning." : "Something is degraded. Fix the support stack before you trust it."}
                  </p>
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="w-4 h-4 text-primary" /> Meetings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.meetings.length ? data.meetings.map((meeting) => (
                    <div key={`${meeting.id}-${meeting.startDate}`} className="rounded-2xl border border-border/60 bg-background/35 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{meeting.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{formatTime(meeting.startDate)} • {meeting.calendar}{meeting.location ? ` • ${meeting.location}` : ""}</p>
                        </div>
                        <Badge variant={meeting.prepStatus === "ready" ? "default" : "outline"}>{meeting.prepStatus === "none" ? "no prep" : meeting.prepStatus}</Badge>
                      </div>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">No non-all-day meetings. You might survive the day unsupervised.</p>}
                </CardContent>
              </Card>

              <TomorrowFamilyPanel family={data.family} />
            </section>

            <p className="text-center text-xs text-muted-foreground">{isFetching ? "Refreshing..." : `Generated ${new Date(data.generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}</p>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function HealthRow({ label, status, checkedAt }: { label: string; status: string; checkedAt: string | null }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border/50 bg-background/35 px-3 py-2">
      <div>
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{checkedAt ? `Last check ${new Date(checkedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "No check recorded"}</p>
      </div>
      <Badge variant={status === "up" ? "default" : "destructive"}>{status}</Badge>
    </div>
  );
}

function FailureState() {
  return (
    <Card className="mx-auto max-w-xl border-destructive/30 bg-destructive/10">
      <CardContent className="flex items-center gap-3 p-5 text-sm text-foreground">
        <AlertTriangle className="w-5 h-5 text-destructive" />
        Tomorrow launchpad failed to load. The stack is being dramatic again.
      </CardContent>
    </Card>
  );
}

function LaunchpadSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Skeleton className="h-40 rounded-3xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-3xl" />
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    </div>
  );
}
