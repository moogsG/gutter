"use client";

import { useState } from "react";
import { AlertTriangle, Check, Circle, Dumbbell, Flame, HeartPulse, Loader2, Martini, NotebookPen, Salad, Sparkles } from "lucide-react";
import { HealthCutBacklogAuditPanel } from "@/components/journal/HealthCutBacklogAudit";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { HealthCutPrepLockCard } from "@/components/journal/HealthCutPrepLockCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useCleanupHealthCutBacklogMutation, useGetHealthCutQuery, useSubmitHealthCutMealLogMutation, useSubmitHealthCutPrepLockMutation, useUpdateEntryMutation } from "@/store/api/journalApi";
import type { HealthCutCategory, HealthCutStatus } from "@/types";
import { toast } from "sonner";
import { getJournalDate, shiftJournalDate } from "@/lib/journal-date";

const CATEGORY_META: Record<HealthCutCategory, { label: string; icon: typeof Flame }> = {
  omad: { label: "OMAD", icon: Flame },
  workout: { label: "Workout", icon: Dumbbell },
  alcohol: { label: "Alcohol", icon: Martini },
  prep: { label: "Prep", icon: NotebookPen },
  nutrition: { label: "Nutrition", icon: Salad },
  other: { label: "Health", icon: HeartPulse },
};

function getCancunTodayDate(): string {
  return getJournalDate();
}

function shiftDate(date: string, amount: number): string {
  return shiftJournalDate(date, amount);
}

function toneForStatus(status: HealthCutStatus): string {
  switch (status) {
    case "done":
      return "border-emerald-500/30 bg-emerald-500/10";
    case "blocked":
      return "border-destructive/30 bg-destructive/10";
    case "in-progress":
      return "border-primary/30 bg-primary/10";
    default:
      return "border-border/60 bg-background/35";
  }
}

function statusLabel(status: HealthCutStatus): string {
  if (status === "in-progress") return "active";
  return status;
}

export function HealthCutDashboard({ date, onDateChange }: { date: string; onDateChange: (date: string) => void }) {
  const { data, isLoading, error, isFetching } = useGetHealthCutQuery(date);
  const [draft, setDraft] = useState("");
  const [prepDraft, setPrepDraft] = useState("");
  const [submitMealLog, { isLoading: isSubmitting }] = useSubmitHealthCutMealLogMutation();
  const [submitPrepLock, { isLoading: isSubmittingPrep }] = useSubmitHealthCutPrepLockMutation();
  const [updateEntry, { isLoading: isSavingTask }] = useUpdateEntryMutation();
  const [cleanupBacklog, { isLoading: isCleaningBacklog }] = useCleanupHealthCutBacklogMutation();

  const handleMealLog = async () => {
    const text = draft.trim();
    if (!text) {
      toast.error("Write the food confession first.");
      return;
    }

    try {
      await submitMealLog({ date, text }).unwrap();
      setDraft("");
      toast.success("Meal log saved");
    } catch {
      toast.error("Failed to save meal log");
    }
  };

  const handlePrepLock = async () => {
    const text = prepDraft.trim();
    if (!text) {
      toast.error("Write tomorrow's protein first.");
      return;
    }

    try {
      await submitPrepLock({ date, text }).unwrap();
      setPrepDraft("");
      toast.success("Tomorrow protein locked");
    } catch {
      toast.error("Failed to lock tomorrow's protein");
    }
  };

  const handleStatus = async (id: string, status: HealthCutStatus) => {
    const nextStatus = status === "done" ? "open" : "done";
    try {
      await updateEntry({ id, status: nextStatus, _date: date }).unwrap();
      toast.success(nextStatus === "done" ? "Checkpoint done" : "Checkpoint reopened");
    } catch {
      toast.error("Failed to update checkpoint");
    }
  };

  const handleCleanup = async (category?: HealthCutCategory) => {
    try {
      const result = await cleanupBacklog({ date, category }).unwrap();
      toast.success(
        result.killedCount > 0
          ? `Killed ${result.killedCount} stale prompt${result.killedCount === 1 ? "" : "s"}`
          : "Nothing stale left to kill",
      );
    } catch {
      toast.error("Failed to clean up stale prompts");
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
        {isLoading ? <HealthCutSkeleton /> : null}
        {!isLoading && error ? <FailureState /> : null}
        {!isLoading && data ? (
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <section className="rounded-[2rem] border border-primary/20 bg-[linear-gradient(135deg,rgba(255,61,154,0.18),rgba(255,255,255,0.02),rgba(56,189,248,0.12))] p-5 shadow-[0_0_60px_rgba(255,61,154,0.1)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-primary/80">Health cut cockpit</p>
                  <h1 className="mt-2 text-3xl font-semibold text-foreground">{data.displayDate}</h1>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    One obvious place to run the cut without pretending scattered prompts count as a system.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="border-primary/30 bg-background/40 px-3 py-1">
                    {data.mode === "cut" ? "Weekday cut" : "Weekend balance"}
                  </Badge>
                  <Badge variant="outline" className="border-primary/30 bg-background/40 px-3 py-1">
                    {data.counts.done}/{data.counts.total} done
                  </Badge>
                  <Badge variant="outline" className="border-primary/30 bg-background/40 px-3 py-1">
                    {data.mealLog.completed ? "meal logged" : "meal log open"}
                  </Badge>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[0.98fr_1.02fr]">
              <HealthCutBacklogAuditPanel
                audit={data.audit}
                busy={isCleaningBacklog}
                onCleanup={(category) => void handleCleanup(category)}
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-[0.98fr_1.02fr]">
              <Card className="border-primary/20 bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Checkpoints</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-4">
                    <StatCard label="Done" value={data.counts.done} />
                    <StatCard label="Left" value={data.counts.remaining} />
                    <StatCard label="Blocked" value={data.counts.blocked} />
                    <StatCard label="Total" value={data.counts.total} />
                  </div>
                  {data.checkpoints.length ? data.checkpoints.map((checkpoint) => {
                    const meta = CATEGORY_META[checkpoint.category];
                    const Icon = meta.icon;
                    return (
                      <div key={checkpoint.id} className={cn("rounded-3xl border p-4", toneForStatus(checkpoint.status))}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                              <Icon className="h-3.5 w-3.5" />
                              {meta.label}
                            </div>
                            <p className="mt-2 text-sm leading-relaxed text-foreground">{checkpoint.text}</p>
                          </div>
                          <div className="flex items-center gap-2 self-start">
                            <Badge variant={checkpoint.status === "done" ? "secondary" : "outline"}>
                              {statusLabel(checkpoint.status)}
                            </Badge>
                            <Button
                              size="sm"
                              variant={checkpoint.status === "done" ? "outline" : "default"}
                              onClick={() => void handleStatus(checkpoint.id, checkpoint.status)}
                              disabled={isSavingTask}
                            >
                              {checkpoint.status === "done" ? "Reopen" : "Mark done"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  }) : <p className="text-sm text-muted-foreground">No cut checkpoints seeded for this day.</p>}
                </CardContent>
              </Card>

              <div className="flex flex-col gap-4">
                <HealthCutPrepLockCard
                  prepLock={data.prepLock}
                  draft={prepDraft}
                  isSubmitting={isSubmittingPrep}
                  onDraftChange={setPrepDraft}
                  onSubmit={() => void handlePrepLock()}
                />

                <Card className={cn("bg-card/85", data.mealLog.completed ? "border-emerald-500/25" : "border-primary/20")}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><HeartPulse className="h-4 w-4 text-primary" /> Food Gate</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className={cn("rounded-3xl border p-4", data.mealLog.completed ? "border-emerald-500/30 bg-emerald-500/10" : "border-primary/30 bg-primary/10")}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-foreground">{data.mealLog.prompt}</p>
                        <Badge variant={data.mealLog.completed ? "secondary" : "outline"}>
                          {data.mealLog.completed ? "logged" : "open"}
                        </Badge>
                      </div>
                      {data.mealLog.latestEntry ? (
                        <div className="mt-3 rounded-2xl border border-border/60 bg-background/40 p-3">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Latest entry</p>
                          <p className="mt-2 text-sm text-foreground">{data.mealLog.latestEntry.text}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {new Date(data.mealLog.latestEntry.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} • {data.mealLog.entriesCount} update{data.mealLog.entriesCount === 1 ? "" : "s"}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Nothing logged yet. Don’t cosplay accuracy.
                        </p>
                      )}
                    </div>
                    <Textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Protein, portions, sauces, drinks, and any snack crimes..."
                      className="min-h-[110px] resize-none bg-background/70"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">Keep it brutally plain. Food, portions, damage.</p>
                      <Button size="sm" onClick={() => void handleMealLog()} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {isSubmitting ? "Saving..." : data.mealLog.completed ? "Add update" : "Submit food log"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/85">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><Check className="h-4 w-4 text-primary" /> Recent Runs</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {data.history.map((day) => (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => onDateChange(day.date)}
                        className={cn(
                          "rounded-3xl border p-4 text-left transition-colors",
                          day.date === date ? "border-primary/40 bg-primary/10" : "border-border/60 bg-background/35 hover:bg-background/55",
                        )}
                      >
                        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{day.label}</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">{day.done}/{day.total}</p>
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{day.remaining} left</span>
                          <span>{day.mealLogged ? "meal logged" : "no meal log"}</span>
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              </div>
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/35 px-3 py-3 text-center">
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function FailureState() {
  return (
    <Card className="mx-auto max-w-xl border-destructive/30 bg-destructive/10">
      <CardContent className="flex items-center gap-3 p-5 text-sm text-foreground">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        Health cut data failed to load. The support stack is slacking off again.
      </CardContent>
    </Card>
  );
}

function HealthCutSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Skeleton className="h-40 rounded-[2rem]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[34rem] rounded-[2rem]" />
        <div className="grid gap-4">
          <Skeleton className="h-[22rem] rounded-[2rem]" />
          <Skeleton className="h-[12rem] rounded-[2rem]" />
        </div>
      </div>
    </div>
  );
}
