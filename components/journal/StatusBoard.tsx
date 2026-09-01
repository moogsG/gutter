"use client";

import { Activity, AlertTriangle, CheckCircle2, Clock3, Database, HeartPulse, ShieldAlert, Sparkles } from "lucide-react";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetStatusBoardQuery } from "@/store/api/statusApi";
import type { StatusCheck, StatusServiceProbe } from "@/types";

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

function getCheckTone(state: StatusCheck["state"] | StatusServiceProbe["state"]) {
  if (state === "healthy") return "border-emerald-500/25 bg-emerald-500/10";
  if (state === "disabled") return "border-border/60 bg-background/35";
  if (state === "down") return "border-destructive/30 bg-destructive/10";
  return "border-amber-500/30 bg-amber-500/10";
}

function getCheckIcon(state: StatusCheck["state"] | StatusServiceProbe["state"]) {
  if (state === "healthy") return CheckCircle2;
  if (state === "down") return ShieldAlert;
  return AlertTriangle;
}

function formatDuration(durationMs: number | null) {
  if (durationMs === null) return "No timing";
  if (durationMs >= 1000) return `${(durationMs / 1000).toFixed(2)}s`;
  return `${Math.round(durationMs)}ms`;
}

function formatStamp(value: string | null) {
  if (!value) return "No timestamp";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Skeleton className="h-40 rounded-[2rem]" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-48 rounded-3xl" />
      </div>
      <Skeleton className="h-96 rounded-3xl" />
    </div>
  );
}

export function StatusBoard({ date, onDateChange }: { date: string; onDateChange: (date: string) => void }) {
  const { data, isLoading, error } = useGetStatusBoardQuery(date);

  return (
    <div className="flex h-full flex-col overflow-auto">
      <JournalHeader
        date={date}
        onPrevDay={() => onDateChange(shiftDate(date, -1))}
        onNextDay={() => onDateChange(shiftDate(date, 1))}
        onToday={() => onDateChange(getCancunTodayDate())}
        showCapture={false}
      />

      <main className="flex-1 px-4 py-5 sm:px-6">
        {isLoading ? <StatusSkeleton /> : null}
        {!isLoading && error ? (
          <Card className="mx-auto max-w-xl border-destructive/30 bg-destructive/10">
            <CardContent className="flex items-center gap-3 p-5 text-sm text-foreground">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Status board failed to load. The reliability page tripped over its own damn shoelaces.
            </CardContent>
          </Card>
        ) : null}
        {!isLoading && data ? (
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <section className="rounded-[2rem] border border-primary/20 bg-[linear-gradient(135deg,rgba(255,61,154,0.16),rgba(255,255,255,0.02),rgba(125,211,252,0.12))] p-5 shadow-[0_0_60px_rgba(255,61,154,0.08)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-primary/80">Support status</p>
                  <h1 className="mt-2 text-3xl font-semibold text-foreground">{data.headline}</h1>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    One obvious screen for whether Gutter, calendar reads, and nightly support signals are actually trustworthy.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                  <Card className="border-primary/20 bg-background/35 px-3 py-2"><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Active tasks</p><p className="mt-2 text-xl font-semibold text-foreground">{data.tasks.totalActive}</p></Card>
                  <Card className="border-primary/20 bg-background/35 px-3 py-2"><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Done today</p><p className="mt-2 text-xl font-semibold text-foreground">{data.tasks.doneToday}</p></Card>
                  <Card className="border-primary/20 bg-background/35 px-3 py-2"><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Calendar events</p><p className="mt-2 text-xl font-semibold text-foreground">{data.calendar.eventCount}</p></Card>
                  <Card className="border-primary/20 bg-background/35 px-3 py-2"><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Warnings</p><p className="mt-2 text-xl font-semibold text-foreground">{data.warnings.length}</p></Card>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-primary/20 bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Next move</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-2xl border border-primary/20 bg-primary/8 p-4">
                    <p className="text-base font-medium text-foreground">{data.nextMove}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">Generated {formatStamp(data.generatedAt)} for {data.requestedDate}.</p>
                </CardContent>
              </Card>

              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4 text-primary" /> Live task pulse</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-border/60 bg-background/35 p-3"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Open</p><p className="mt-2 text-2xl font-semibold text-foreground">{data.tasks.open}</p></div>
                  <div className="rounded-2xl border border-border/60 bg-background/35 p-3"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">In progress</p><p className="mt-2 text-2xl font-semibold text-foreground">{data.tasks.inProgress}</p></div>
                  <div className="rounded-2xl border border-border/60 bg-background/35 p-3"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Blocked</p><p className="mt-2 text-2xl font-semibold text-foreground">{data.tasks.blocked}</p></div>
                  <div className="rounded-2xl border border-border/60 bg-background/35 p-3"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Latest write</p><p className="mt-2 text-sm font-medium text-foreground">{formatStamp(data.tasks.latestUpdateAt)}</p></div>
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 xl:grid-cols-3">
              {data.checks.map((check) => {
                const Icon = getCheckIcon(check.state);
                return (
                  <Card key={check.label} className={`bg-card/85 ${getCheckTone(check.state)}`}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between gap-3 text-base">
                        <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /> {check.label}</span>
                        <Badge variant="outline">{check.state}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm font-medium text-foreground">{check.summary}</p>
                      <p className="text-sm text-muted-foreground">{check.detail}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{formatStamp(check.checkedAt)}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-primary" /> Live probe timings</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  {data.probes.map((probe) => {
                    const Icon = getCheckIcon(probe.state);
                    return (
                      <div key={probe.label} className={`rounded-3xl border p-4 ${getCheckTone(probe.state)}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <Icon className="h-4 w-4 text-primary" />
                            {probe.label}
                          </div>
                          <Badge variant="outline">{probe.state}</Badge>
                        </div>
                        <p className="mt-4 text-3xl font-semibold text-foreground">{formatDuration(probe.durationMs)}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">Warning threshold {formatDuration(probe.thresholdMs)}</p>
                        <p className="mt-4 text-sm text-foreground">{probe.summary}</p>
                        <p className="mt-2 text-sm text-muted-foreground">{probe.detail}</p>
                        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">{formatStamp(probe.checkedAt)}</p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><HeartPulse className="h-4 w-4 text-primary" /> Flagged signals</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.dailySignals.length ? data.dailySignals.map((signal) => (
                    <div key={`${signal.date}-${signal.message}`} className={`rounded-2xl border p-4 ${signal.severity === "warning" ? "border-amber-500/30 bg-amber-500/10" : "border-border/60 bg-background/35"}`}>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{signal.date} • {signal.source}</p>
                      <p className="mt-2 text-sm text-foreground">{signal.message}</p>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">No signal lines were found in the July 24-25, 2026 memory notes.</p>}
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="h-4 w-4 text-primary" /> Recent incidents</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.incidents.length ? data.incidents.map((incident) => (
                    <div
                      key={incident.id}
                      className={`rounded-2xl border p-4 ${incident.status === "down" ? "border-destructive/30 bg-destructive/10" : "border-emerald-500/25 bg-emerald-500/10"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{incident.summary}</p>
                        <Badge variant="outline">{incident.service}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{incident.detail}</p>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">{formatStamp(incident.timestamp)}</p>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">No recent service state changes were recorded.</p>}
                </CardContent>
              </Card>

              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Clock3 className="h-4 w-4 text-primary" /> Nightly context</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-foreground">{data.nightly.topic || "No recent nightly initiative recorded."}</p>
                  <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {data.nightly.date ? <Badge variant="outline">{data.nightly.date}</Badge> : null}
                    {data.nightly.status ? <Badge variant="outline">{data.nightly.status}</Badge> : null}
                    {data.nightly.category ? <Badge variant="outline">{data.nightly.category}</Badge> : null}
                  </div>
                  <p className="text-muted-foreground">
                    {data.calendar.failedCalendars.length
                      ? `Degraded calendars: ${data.calendar.failedCalendars.join(", ")}.`
                      : data.calendar.enabled
                        ? "No failed calendars were recorded on the last read."
                        : "Calendar bridge is currently disabled."}
                  </p>
                  {data.warnings.length ? <div className="rounded-2xl border border-border/60 bg-background/35 p-3 text-sm text-muted-foreground">{data.warnings[0]}</div> : null}
                </CardContent>
              </Card>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
