"use client";

import { CheckCircle2, Home, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getJournalDate } from "@/lib/journal-date";
import { useGetChoreBoardQuery, useUpdateChoreBoardMutation } from "@/store/api/choresApi";

function getCancunTodayDate() {
  return getJournalDate();
}

function extractErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "data" in error) {
    const payload = error.data as { error?: string };
    return payload.error || "Failed to update chores";
  }

  return "Failed to update chores";
}

export function ChoreBoard() {
  const { data, isLoading, error, isFetching } = useGetChoreBoardQuery();
  const [updateChoreBoard, { isLoading: isSaving }] = useUpdateChoreBoardMutation();

  const runAction = async (action: "complete" | "pick" | "reset" | "reopen", selection?: string, success?: string) => {
    try {
      await updateChoreBoard({ action, selection }).unwrap();
      if (success) toast.success(success);
    } catch (mutationError) {
      toast.error(extractErrorMessage(mutationError));
    }
  };

  const confirmAndRun = (action: "complete" | "reset" | "reopen", selection: string | undefined, prompt: string, success: string) => {
    if (!window.confirm(prompt)) return;
    void runAction(action, selection, success);
  };

  return (
    <div className="flex h-full flex-col overflow-auto">
      <JournalHeader
        date={getCancunTodayDate()}
        onPrevDay={() => undefined}
        onNextDay={() => undefined}
        onToday={() => undefined}
        showCapture={false}
        showDateNav={false}
        title="Household chores"
        subtitle="Visible, finite, and harder to ignore than the CLI burrow."
      />

      <main className="flex-1 px-4 py-5 sm:px-6">
        {isLoading ? <ChoreBoardSkeleton /> : null}
        {!isLoading && error ? <FailureState /> : null}
        {!isLoading && data ? (
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <section className="rounded-[2rem] border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(255,255,255,0.02),rgba(245,158,11,0.12))] p-5 shadow-[0_0_60px_rgba(16,185,129,0.1)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Family ops</p>
                  <h1 className="mt-2 text-3xl font-semibold text-foreground">Cycle {data.cycleNumber}</h1>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{data.nextMove}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="border-emerald-500/30 bg-background/40 px-3 py-1">
                    {data.counts.completed}/{data.counts.total} done
                  </Badge>
                  <Badge variant="outline" className="border-emerald-500/30 bg-background/40 px-3 py-1">
                    {data.counts.remaining} left
                  </Badge>
                  <Button
                    variant="outline"
                    className="gap-2 border-emerald-500/30 bg-background/40"
                    onClick={() => void runAction("pick", undefined, "Pair refreshed")}
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Refresh pair
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 border-amber-500/30 bg-background/40"
                    onClick={() =>
                      confirmAndRun(
                        "reset",
                        undefined,
                        "Start a fresh chore cycle? This clears the current in-cycle checkmarks.",
                        "Started a fresh chore cycle",
                      )
                    }
                    disabled={isSaving}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset cycle
                  </Button>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
              <Card className="border-emerald-500/20 bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-emerald-300" /> Next picks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.suggestedChoices.map((choice) => (
                    <div key={choice.id} className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.25em] text-emerald-300">Option {choice.label}</p>
                          <p className="mt-2 text-xl font-semibold text-foreground">{choice.name}</p>
                        </div>
                        <Button
                          onClick={() =>
                            confirmAndRun(
                              "complete",
                              choice.label.toLowerCase(),
                              `Mark ${choice.name} done for this cycle?`,
                              `${choice.name} cleared`,
                            )
                          }
                          disabled={isSaving}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Mark done
                        </Button>
                      </div>
                    </div>
                  ))}
                  {data.suggestedChoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No pair waiting. The house is either handled or the state file is being weird again.</p>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <StatCard label="Started" value={new Date(`${data.cycleStartedAt}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                    <StatCard label="Completed" value={String(data.counts.completed)} />
                    <StatCard label="Live" value={isFetching ? "refreshing" : "synced"} />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Home className="h-4 w-4 text-emerald-300" /> Whole cycle</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {data.chores.map((chore) => (
                    <div
                      key={chore.id}
                      className={cn(
                        "rounded-3xl border p-4 text-left transition-colors",
                        chore.completedInCycle
                          ? "border-emerald-500/25 bg-emerald-500/10"
                          : chore.isSuggested
                            ? "border-amber-500/30 bg-amber-500/10"
                            : "border-border/60 bg-background/35 hover:border-emerald-500/25 hover:bg-background/55",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{chore.name}</p>
                        <Badge variant={chore.completedInCycle ? "secondary" : "outline"}>
                          {chore.completedInCycle ? "done" : chore.isSuggested ? "suggested" : "open"}
                        </Badge>
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">
                        {chore.completedInCycle && chore.completedAt
                          ? `Finished ${new Date(chore.completedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                          : `${chore.totalCompletions} total completion${chore.totalCompletions === 1 ? "" : "s"}`}
                      </p>
                      <div className="mt-3">
                        {chore.completedInCycle ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              confirmAndRun(
                                "reopen",
                                chore.id,
                                `Reopen ${chore.name}? This removes the last completion mark for this cycle.`,
                                `${chore.name} reopened`,
                              )
                            }
                            disabled={isSaving}
                          >
                            Undo
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() =>
                              confirmAndRun(
                                "complete",
                                chore.id,
                                `Mark ${chore.name} done for this cycle?`,
                                `${chore.name} cleared`,
                              )
                            }
                            disabled={isSaving}
                          >
                            Mark done
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>

            <Card className="bg-card/85">
              <CardHeader>
                <CardTitle className="text-base">Recent clears</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.history.length ? data.history.map((entry) => (
                  <div key={`${entry.choreId}-${entry.completedAt}`} className="rounded-2xl border border-border/60 bg-background/35 px-4 py-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-foreground">{entry.choreName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.completedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                )) : <p className="text-sm text-muted-foreground">No recent history yet. Somebody has been ducking the mop.</p>}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-border/60 bg-background/35 p-4">
      <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function FailureState() {
  return (
    <Card className="mx-auto max-w-xl border-destructive/30 bg-destructive/10">
      <CardContent className="p-5 text-sm text-foreground">
        Chores failed to load. The house gremlins are trying to go off-grid again.
      </CardContent>
    </Card>
  );
}

function ChoreBoardSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Skeleton className="h-40 rounded-[2rem]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-[2rem]" />
        <Skeleton className="h-72 rounded-[2rem]" />
      </div>
      <Skeleton className="h-60 rounded-[2rem]" />
    </div>
  );
}
