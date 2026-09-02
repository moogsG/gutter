"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, ShieldAlert, Siren, Skull, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetFollowThroughRadarQuery,
  useUpdateFollowThroughPromiseMutation,
  useUpdateFollowThroughTaskMutation,
} from "@/store/api/radarApi";
import type { FollowThroughPromise, FollowThroughTask } from "@/types";
import { getJournalDate, shiftJournalDate } from "@/lib/journal-date";

function getCancunTodayDate(): string {
  return getJournalDate();
}

function shiftDate(date: string, amount: number): string {
  return shiftJournalDate(date, amount);
}

function laneTone(lane: string | null) {
  switch (lane) {
    case "work":
      return "border-sky-500/30 text-sky-200";
    case "family":
      return "border-amber-500/30 text-amber-200";
    case "petalz":
      return "border-fuchsia-500/30 text-fuchsia-200";
    case "jw":
      return "border-emerald-500/30 text-emerald-200";
    default:
      return "border-border text-muted-foreground";
  }
}

function priorityTone(priority: string | null) {
  if (priority === "high") return "border-destructive/40 text-destructive";
  if (priority === "low") return "border-border text-muted-foreground";
  return "border-primary/30 text-primary";
}

function PromiseCard({
  promise,
  busy,
  onResolve,
  onDrop,
}: {
  promise: FollowThroughPromise;
  busy: boolean;
  onResolve: (promise: FollowThroughPromise) => void;
  onDrop: (promise: FollowThroughPromise) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/35 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-relaxed text-foreground">{promise.text}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Badge variant="outline" className={promise.overdue ? "border-destructive/40 text-destructive" : "border-primary/25 text-primary"}>
              {promise.overdue ? "overdue" : "pending"}
            </Badge>
            <span>{promise.staleDays}d stale</span>
            <span>{promise.deadline ? `due ${promise.deadline}` : "no deadline"}</span>
          </div>
          {promise.context ? <p className="mt-2 text-xs text-muted-foreground">{promise.context}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <Button size="sm" variant="outline" onClick={() => onResolve(promise)} disabled={busy}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Done
          </Button>
          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => onDrop(promise)} disabled={busy}>
            <Trash2 className="mr-2 h-4 w-4" />
            Drop
          </Button>
        </div>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  busy,
  onDone,
  onKill,
}: {
  task: FollowThroughTask;
  busy: boolean;
  onDone: (task: FollowThroughTask) => void;
  onKill: (task: FollowThroughTask) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/35 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-relaxed text-foreground">{task.title}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Badge variant="outline" className={laneTone(task.lane)}>{task.lane || "personal"}</Badge>
            <Badge variant="outline" className={priorityTone(task.priority)}>{task.priority || "normal"}</Badge>
            <span>{task.status}</span>
            <span>{task.ageDays}d old</span>
          </div>
          {task.waitingOn ? <p className="mt-2 text-xs text-muted-foreground">Waiting on {task.waitingOn}</p> : null}
        </div>
        <Link
          href={`/day/${task.date}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2 py-1 text-xs text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
        >
          {task.date}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onDone(task)} disabled={busy}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Done
        </Button>
        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => onKill(task)} disabled={busy}>
          <Skull className="mr-2 h-4 w-4" />
          Kill
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  count,
  empty,
  children,
}: {
  title: string;
  subtitle: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-card/85">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base text-foreground">{title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <Badge variant="outline" className="border-primary/25 bg-background/40 px-2.5 py-1">
            {count}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {count ? children : <p className="text-sm text-muted-foreground">{empty}</p>}
      </CardContent>
    </Card>
  );
}

function StatPill({ icon: Icon, label, value }: { icon: typeof AlertTriangle; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-background/35 px-3 py-2">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function FailureState() {
  return (
    <Card className="mx-auto max-w-xl border-destructive/30 bg-destructive/10">
      <CardContent className="flex items-center gap-3 p-5 text-sm text-foreground">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        Follow-through radar failed to load. Even the guilt dashboard is being slippery.
      </CardContent>
    </Card>
  );
}

function RadarSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Skeleton className="h-40 rounded-[2rem]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-52 rounded-3xl" />
        <Skeleton className="h-52 rounded-3xl" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-96 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    </div>
  );
}

export function FollowThroughRadar({ date, onDateChange }: { date: string; onDateChange: (date: string) => void }) {
  const { data, isLoading, error, isFetching } = useGetFollowThroughRadarQuery(date);
  const [updatePromise, { isLoading: isSavingPromise }] = useUpdateFollowThroughPromiseMutation();
  const [updateTask, { isLoading: isSavingTask }] = useUpdateFollowThroughTaskMutation();

  const handlePromiseStatus = async (promise: FollowThroughPromise, status: "resolved" | "dropped") => {
    const verb = status === "resolved" ? "mark done" : "drop";
    if (!window.confirm(`${verb === "mark done" ? "Mark" : "Drop"} "${promise.text}"?`)) return;

    try {
      await updatePromise({ promiseId: promise.id, status }).unwrap();
      toast.success(status === "resolved" ? "Promise closed" : "Promise dropped");
    } catch {
      toast.error("Promise update failed");
    }
  };

  const handleTaskStatus = async (task: FollowThroughTask, status: "done" | "killed") => {
    const label = status === "done" ? "mark done" : "kill";
    if (!window.confirm(`${label === "mark done" ? "Mark" : "Kill"} "${task.title}"?`)) return;

    try {
      await updateTask({ taskId: task.id, status }).unwrap();
      toast.success(status === "done" ? "Task closed" : "Task killed");
    } catch {
      toast.error("Task update failed");
    }
  };

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
        {isLoading ? <RadarSkeleton /> : null}
        {!isLoading && error ? <FailureState /> : null}
        {!isLoading && data ? (
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <section className="rounded-[2rem] border border-primary/20 bg-[linear-gradient(135deg,rgba(255,61,154,0.16),rgba(255,255,255,0.02),rgba(251,191,36,0.10))] p-5 shadow-[0_0_60px_rgba(255,61,154,0.08)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-primary/80">Follow-through radar</p>
                  <h1 className="mt-2 text-3xl font-semibold text-foreground">See the promises quietly rotting</h1>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    One screen for stale promises, blocked work, and old carryover that keeps siphoning attention because nobody killed it cleanly.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                  <StatPill icon={Siren} label="Overdue promises" value={data.counts.overduePromises} />
                  <StatPill icon={ShieldAlert} label="Blocked" value={data.counts.blocked} />
                  <StatPill icon={Clock3} label="Waiting" value={data.counts.waiting} />
                  <StatPill icon={Sparkles} label="Oldest loop" value={data.counts.oldestCarryoverDays} />
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-primary/20 bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Start here
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-2xl border border-primary/20 bg-primary/8 p-4">
                    <p className="text-base font-medium text-foreground">{data.nextMove}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-border/60 bg-background/35 p-3">
                      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Pending promises</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">{data.counts.pendingPromises}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/35 p-3">
                      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Carryover</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">{data.counts.unresolvedCarryover}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/35 p-3">
                      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Oldest open loop</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">{data.counts.oldestCarryoverDays}d</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="text-base text-foreground">Use it honestly</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>1. Use Done only when the thing truly happened, not because you are tired of seeing it.</p>
                  <p>2. Use Drop or Kill when the item is dead, stale, or no longer deserves calendar-space in your skull.</p>
                  <p>3. Rewrite blocked work into a real next step on the day page if the original task is too vague.</p>
                  <p>4. Promises here only reflect what got written down, so missing data is its own indictment.</p>
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <Section
                title="Broken promises"
                subtitle="Pending commitments from memory that never got closed cleanly."
                count={data.sections.promises.length}
                empty="No pending promises recorded right now. Either you behaved or the tracking did."
              >
                {data.sections.promises.map((promise) => (
                  <PromiseCard
                    key={promise.id}
                    promise={promise}
                    busy={isSavingPromise}
                    onResolve={(entry) => void handlePromiseStatus(entry, "resolved")}
                    onDrop={(entry) => void handlePromiseStatus(entry, "dropped")}
                  />
                ))}
              </Section>

              <Section
                title="Stuck and waiting"
                subtitle="Tasks blocked outright or waiting on someone else to stop dragging their feet."
                count={data.sections.stuck.length}
                empty="No blocked or waiting tasks surfaced for this date."
              >
                {data.sections.stuck.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    busy={isSavingTask}
                    onDone={(entry) => void handleTaskStatus(entry, "done")}
                    onKill={(entry) => void handleTaskStatus(entry, "killed")}
                  />
                ))}
              </Section>
            </section>

            <Section
              title="Old unresolved carryover"
              subtitle="The oldest still-open loops from earlier days, because avoiding them does not make them younger."
              count={data.sections.carryover.length}
              empty="No older unresolved carryover for this date."
            >
              {data.sections.carryover.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  busy={isSavingTask}
                  onDone={(entry) => void handleTaskStatus(entry, "done")}
                  onKill={(entry) => void handleTaskStatus(entry, "killed")}
                />
              ))}
            </Section>

            <p className="text-center text-xs text-muted-foreground">
              {isFetching ? "Refreshing..." : `Generated ${new Date(data.generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
