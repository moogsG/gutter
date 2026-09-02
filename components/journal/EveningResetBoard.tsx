"use client";

import Link from "next/link";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, Clock3, MoonStar, ShoppingCart, Target } from "lucide-react";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetEveningResetQuery } from "@/store/api/resetApi";
import type { EveningResetTask } from "@/types";
import { getJournalDate, shiftJournalDate } from "@/lib/journal-date";

function shiftDate(date: string, amount: number): string {
  return shiftJournalDate(date, amount);
}

function getCancunTodayDate(): string {
  return getJournalDate();
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function taskMeta(task: EveningResetTask): string {
  return [task.lane, task.status, task.priority, task.waitingOn ? `waiting on ${task.waitingOn}` : null].filter(Boolean).join(" • ");
}

function TaskList({ tasks, empty, href }: { tasks: EveningResetTask[]; empty: string; href: string }) {
  if (!tasks.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <Link key={task.id} href={href} className="block rounded-2xl border border-border/60 bg-background/35 p-3 transition-colors hover:border-primary/30">
          <p className="text-sm font-medium text-foreground">{task.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{taskMeta(task)}</p>
        </Link>
      ))}
    </div>
  );
}

export function EveningResetBoard({ date, onDateChange }: { date: string; onDateChange: (date: string) => void }) {
  const { data, isLoading, error, isFetching } = useGetEveningResetQuery(date);

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
        {isLoading ? <ResetSkeleton /> : null}
        {!isLoading && error ? <FailureState /> : null}
        {!isLoading && data ? (
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/18 via-card to-secondary/10 p-5 shadow-[0_0_60px_rgba(255,61,154,0.08)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-primary/80">Evening reset</p>
                  <h1 className="mt-2 text-3xl font-semibold text-foreground">{data.displayDate}</h1>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">A clean shutdown screen for wins, leftovers, and whether tomorrow is actually staged or just lurking.</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="gap-1 border-primary/30 bg-background/30 px-3 py-1"><CheckCircle2 className="h-3.5 w-3.5" /> {data.today.completedCount} wins</Badge>
                  <Badge variant="outline" className="gap-1 border-primary/30 bg-background/30 px-3 py-1"><MoonStar className="h-3.5 w-3.5" /> {data.today.leftoverCount} leftovers</Badge>
                  <Badge variant="outline" className="gap-1 border-primary/30 bg-background/30 px-3 py-1"><Target className="h-3.5 w-3.5" /> {data.tomorrow.seededCount} queued for tomorrow</Badge>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <Card className="bg-card/85">
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4 text-primary" /> Close Today</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-border/60 bg-background/35 p-3"><p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Completed</p><p className="mt-2 text-2xl font-semibold text-foreground">{data.today.completedCount}</p></div>
                    <div className="rounded-2xl border border-border/60 bg-background/35 p-3"><p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Leftovers</p><p className="mt-2 text-2xl font-semibold text-foreground">{data.today.leftoverCount}</p></div>
                    <div className="rounded-2xl border border-border/60 bg-background/35 p-3"><p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Older Carryover</p><p className="mt-2 text-2xl font-semibold text-foreground">{data.today.carryoverCount}</p></div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.25em] text-muted-foreground">Wins</p>
                    <TaskList tasks={data.today.wins} empty="No Gutter tasks were marked done today. Brutal, but at least the board is telling the truth." href={`/day/${data.requestedDate}`} />
                  </div>
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.25em] text-muted-foreground">Leftovers</p>
                    <TaskList tasks={data.today.leftovers} empty="No open leftovers for this day." href={`/day/${data.requestedDate}`} />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/85">
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-primary" /> Stage Tomorrow</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-border/60 bg-background/35 p-3"><p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Seeded</p><p className="mt-2 text-2xl font-semibold text-foreground">{data.tomorrow.seededCount}</p></div>
                    <div className="rounded-2xl border border-border/60 bg-background/35 p-3"><p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Real Tasks</p><p className="mt-2 text-2xl font-semibold text-foreground">{data.tomorrow.nonHealthCount}</p></div>
                    <div className="rounded-2xl border border-border/60 bg-background/35 p-3"><p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Health Checks</p><p className="mt-2 text-2xl font-semibold text-foreground">{data.tomorrow.healthCount}</p></div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.25em] text-muted-foreground">Tomorrow queue</p>
                    <TaskList tasks={data.tomorrow.topTasks} empty="Nothing is seeded for tomorrow yet. Morning-you gets to suffer the decision tax unless you fix that." href={`/day/${data.tomorrowDate}`} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-background/35 p-3">
                      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Meetings</p>
                      {data.tomorrow.meetings.length ? data.tomorrow.meetings.map((meeting) => <p key={`${meeting.id}-${meeting.startDate}`} className="mt-2 text-sm text-foreground">{formatTime(meeting.startDate)} • {meeting.title}</p>) : <p className="mt-2 text-sm text-muted-foreground">No meetings tomorrow.</p>}
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/35 p-3">
                      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Family ops</p>
                      <p className="mt-2 text-sm text-foreground">{data.tomorrow.dinner ? `${data.tomorrow.dinner.mealName} • ${data.tomorrow.dinner.prepTime}` : "No dinner plan found yet."}</p>
                      <p className="mt-2 text-xs text-muted-foreground"><ShoppingCart className="mr-1 inline h-3.5 w-3.5" /> {data.tomorrow.groceryItemCount} grocery items still open</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            <Card className="bg-card/85">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock3 className="h-4 w-4 text-primary" /> Shutdown Checklist</CardTitle></CardHeader>
              <CardContent className="grid gap-3 lg:grid-cols-2">
                {data.checklist.map((item) => <div key={item} className="rounded-2xl border border-border/60 bg-background/35 p-3 text-sm text-foreground">{item}</div>)}
                <Link href="/tomorrow" className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/8 p-3 text-sm text-foreground transition-colors hover:border-primary/35">
                  <span>Open tomorrow launchpad</span>
                  <ChevronRight className="h-4 w-4 text-primary" />
                </Link>
              </CardContent>
            </Card>

            <p className="text-center text-xs text-muted-foreground">{isFetching ? "Refreshing..." : `Generated ${new Date(data.generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}</p>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function FailureState() {
  return (
    <Card className="mx-auto max-w-xl border-destructive/30 bg-destructive/10">
      <CardContent className="flex items-center gap-3 p-5 text-sm text-foreground">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        Evening reset failed to load. The stack is dodging bedtime chores again.
      </CardContent>
    </Card>
  );
}

function ResetSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Skeleton className="h-40 rounded-3xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[32rem] rounded-3xl" />
        <Skeleton className="h-[32rem] rounded-3xl" />
      </div>
      <Skeleton className="h-48 rounded-3xl" />
    </div>
  );
}
