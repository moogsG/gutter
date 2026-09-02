"use client";

import { Activity, AlertTriangle, Bot, Clock3, Gauge, ScrollText, TimerReset } from "lucide-react";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetSessionActivityBoardQuery } from "@/store/api/sessionsApi";
import { getJournalDate, shiftJournalDate } from "@/lib/journal-date";

function getCancunTodayDate(): string {
  return getJournalDate();
}

function shiftDate(date: string, amount: number): string {
  return shiftJournalDate(date, amount);
}

function formatStamp(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SessionSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Skeleton className="h-40 rounded-[2rem]" />
      <div className="grid gap-4 lg:grid-cols-4">
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
      </div>
      <Skeleton className="h-96 rounded-3xl" />
    </div>
  );
}

export function SessionActivityBoard({ date, onDateChange }: { date: string; onDateChange: (date: string) => void }) {
  const { data, isLoading, error } = useGetSessionActivityBoardQuery(date);

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
        {isLoading ? <SessionSkeleton /> : null}
        {!isLoading && error ? (
          <Card className="mx-auto max-w-xl border-destructive/30 bg-destructive/10">
            <CardContent className="flex items-center gap-3 p-5 text-sm text-foreground">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Session board failed to load. Even the lie detector needs a nap sometimes.
            </CardContent>
          </Card>
        ) : null}
        {!isLoading && data ? (
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <section className="rounded-[2rem] border border-primary/20 bg-[linear-gradient(135deg,rgba(255,61,154,0.16),rgba(255,255,255,0.02),rgba(125,211,252,0.12))] p-5 shadow-[0_0_60px_rgba(255,61,154,0.08)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-primary/80">Session truth</p>
                  <h1 className="mt-2 text-3xl font-semibold text-foreground">{data.displayDate}</h1>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    One honest screen for how much agent churn actually happened, instead of letting a single scary number boss you around.
                  </p>
                </div>
                <div className="max-w-xl rounded-3xl border border-primary/20 bg-background/35 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Next move</p>
                  <p className="mt-2 text-sm text-foreground">{data.nextMove}</p>
                </div>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={Activity} label="That day" value={data.overview.requestedDaySessions} detail="Codex transcript sessions found" />
              <MetricCard icon={TimerReset} label="Cron share" value={data.overview.requestedDayCronSessions} detail="Automated runs on that date" />
              <MetricCard icon={Clock3} label="Last 7 days" value={data.overview.recentSevenDaySessions} detail="Recent transcript sessions" />
              <MetricCard icon={Bot} label="Active agents" value={data.overview.activeAgents} detail="Agents with recent session traffic" />
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <Card className="border-primary/20 bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Gauge className="h-4 w-4 text-primary" /> Honesty check</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.activityReport ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <SnapshotBox label="Reported active" value={data.activityReport.reportedActive} />
                        <SnapshotBox label="Observed sessions" value={data.activityReport.observedSessions} />
                        <SnapshotBox label="Delta" value={data.activityReport.delta} />
                      </div>
                      <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{data.activityReport.date} daily note</p>
                        <p className="mt-2 text-sm text-foreground">{data.activityReport.line}</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No daily note activity line was found in the last seven days. At least the bullshit meter isn’t pretending certainty.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4 text-primary" /> Agent load</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.byAgent.map((agent) => (
                    <div key={agent.agentId} className="rounded-3xl border border-border/60 bg-background/35 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{agent.agentId}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{agent.cronCount} cron-driven session{agent.cronCount === 1 ? "" : "s"}</p>
                        </div>
                        <Badge variant="outline">{agent.count} total</Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Clock3 className="h-4 w-4 text-primary" /> Recent days</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {data.days.map((day) => (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => onDateChange(day.date)}
                      className={`rounded-3xl border p-4 text-left transition-colors ${
                        day.date === date ? "border-primary/40 bg-primary/10" : "border-border/60 bg-background/35 hover:bg-background/55"
                      }`}
                    >
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{day.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">{day.totalSessions}</p>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{day.cronSessions} cron</span>
                        <span>{day.uniqueAgents} agents</span>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><ScrollText className="h-4 w-4 text-primary" /> Recent sessions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.recentSessions.map((session) => (
                    <div key={session.id} className="rounded-3xl border border-border/60 bg-background/35 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{session.agentId}</Badge>
                        <Badge variant="outline">{session.category}</Badge>
                        <Badge variant="outline">{session.model}</Badge>
                      </div>
                      <p className="mt-3 text-sm font-medium text-foreground">{session.title}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatStamp(session.startedAt)} • {session.source}
                        {session.cronLabel ? ` • ${session.cronLabel}` : ""}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>

            <Card className="bg-card/85">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><TimerReset className="h-4 w-4 text-primary" /> Top cron chatter</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {data.topCronLabels.length ? data.topCronLabels.map((cron) => (
                  <Badge key={cron.label} variant="outline" className="px-3 py-1">
                    {cron.label} • {cron.count}
                  </Badge>
                )) : (
                  <p className="text-sm text-muted-foreground">No cron-labeled sessions were found in the last seven days.</p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: number; detail: string }) {
  return (
    <Card className="border-primary/20 bg-card/85">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function SnapshotBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/35 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
