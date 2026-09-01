"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowUpRight, Flame, Layers3, PauseCircle, TimerReset } from "lucide-react";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useMoveTaskMutation } from "@/store/api/tasksApi";
import { useGetWipLimitQuery } from "@/store/api/wipApi";
import type { WipLimitItem } from "@/types";

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

function TaskCard({
  task,
  onMoveOpen,
  onMoveBlocked,
  pendingAction,
  tone,
}: {
  task: WipLimitItem;
  onMoveOpen?: () => void;
  onMoveBlocked?: () => void;
  pendingAction?: "open" | "blocked" | null;
  tone: string;
}) {
  return (
    <div className={cn("rounded-[1.6rem] border bg-background/35 p-4", tone)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-relaxed text-foreground">{task.title}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Badge variant="outline" className={laneTone(task.lane)}>{task.lane || "personal"}</Badge>
            <Badge variant="outline" className={priorityTone(task.priority)}>{task.priority || "normal"}</Badge>
            <span>{task.ageDays}d old</span>
            {task.isLegacy ? <span>legacy import</span> : null}
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
      {onMoveOpen ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button variant="outline" size="sm" className="w-full" onClick={onMoveOpen} disabled={pendingAction !== null}>
            {pendingAction === "open" ? "Cooling..." : "Move back to open"}
          </Button>
          {task.waitingOn && onMoveBlocked ? (
            <Button variant="outline" size="sm" className="w-full" onClick={onMoveBlocked} disabled={pendingAction !== null}>
              {pendingAction === "blocked" ? "Blocking..." : "Move to blocked"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function WipLimitBoard({ date }: { date: string }) {
  const { data, isLoading, error, isFetching, refetch } = useGetWipLimitQuery(date);
  const [moveTask] = useMoveTaskMutation();
  const [pendingAction, setPendingAction] = useState<{ taskId: string; status: "open" | "blocked" } | null>(null);

  const moveTaskStatus = async (taskId: string, status: "open" | "blocked") => {
    setPendingAction({ taskId, status });
    try {
      await moveTask({ taskId, status }).unwrap();
      await refetch();
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-auto">
      <JournalHeader
        date={date}
        onPrevDay={() => {}}
        onNextDay={() => {}}
        onToday={() => {}}
        showCapture={false}
        showDateNav={false}
        title="WIP Limit"
        subtitle="Today-only board. Ranking favors recent updates, non-legacy work, and tasks not waiting on someone else."
      />

      <main className="flex-1 px-4 py-5 sm:px-6">
        {isLoading ? <WipSkeleton /> : null}
        {!isLoading && error ? <FailureState /> : null}
        {!isLoading && data ? (
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <section className="rounded-[2rem] border border-primary/20 bg-[linear-gradient(135deg,rgba(56,189,248,0.16),rgba(255,255,255,0.02),rgba(255,61,154,0.08))] p-5 shadow-[0_0_60px_rgba(56,189,248,0.08)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-primary/80">WIP limit</p>
                  <h1 className="mt-2 text-3xl font-semibold text-foreground">Stop pretending all of this is current</h1>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{data.headline}</p>
                  <p className="mt-3 text-sm text-foreground">{data.nextMove}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground/80">
                    Snapshot for {date}. Historical WIP views are disabled until they can be honest.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                  <StatPill icon={Flame} label="Keep hot" value={data.counts.keep} />
                  <StatPill icon={PauseCircle} label="Cool down" value={data.counts.coolDown} />
                  <StatPill icon={TimerReset} label="Stale" value={data.counts.stale} />
                  <StatPill icon={Layers3} label="Legacy" value={data.counts.legacy} />
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <Card className="border-primary/20 bg-card/85">
                <CardHeader>
                  <CardTitle className="text-base text-foreground">Best candidates to keep hot</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {data.keepFocus.map((task) => (
                    <TaskCard key={task.id} task={task} tone="border-primary/20" />
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-primary" /> Lane pressure</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {data.laneBreakdown.map((item) => (
                      <Badge key={item.lane} variant="outline" className="px-3 py-1 text-xs uppercase tracking-[0.18em]">
                        {item.lane} · {item.count}
                      </Badge>
                    ))}
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>1. Keep at most three truly active tasks.</p>
                    <p>2. Ranking is based on recent updates and cleanup pressure, not mystical certainty about what deserves your soul.</p>
                    <p>3. If a task is blocked on someone else, move it to blocked instead of letting it cosplay progress.</p>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section>
              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="text-base text-foreground">Cool these down</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 lg:grid-cols-2">
                  {data.coolDownQueue.length ? data.coolDownQueue.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      tone={task.isLegacy ? "border-fuchsia-500/20" : "border-border/60"}
                      onMoveOpen={() => moveTaskStatus(task.id, "open")}
                      onMoveBlocked={task.waitingOn ? () => moveTaskStatus(task.id, "blocked") : undefined}
                      pendingAction={pendingAction?.taskId === task.id ? pendingAction.status : null}
                    />
                  )) : (
                    <p className="text-sm text-muted-foreground">Nothing else is squatting in the in-progress lane.</p>
                  )}
                </CardContent>
              </Card>
            </section>

            <p className="text-center text-xs text-muted-foreground">
              {isFetching ? "Refreshing..." : `Generated ${new Date(data.generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
            </p>
          </div>
        ) : null}
      </main>
    </div>
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
        WIP board failed to load. The task swamp is hiding again.
      </CardContent>
    </Card>
  );
}

function WipSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Skeleton className="h-40 rounded-[2rem]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-3xl" />
        <Skeleton className="h-80 rounded-3xl" />
      </div>
      <Skeleton className="h-[32rem] rounded-3xl" />
    </div>
  );
}
