"use client";

import type { JournalEntry, TaskLane } from "@/types/journal";
import { Check, Circle, ArrowRight } from "lucide-react";
import { useUpdateEntryMutation, useMigrateEntriesMutation } from "@/store/api/journalApi";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";

interface TodayFocusProps {
  entries: JournalEntry[];
  date: string;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getMigrateTargetDate(viewDate: string): string {
  const today = formatDate(new Date());
  if (viewDate === today) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDate(tomorrow);
  }
  return today;
}

function isTask(entry: JournalEntry) {
  return entry.signifier === "task";
}

/**
 * Rank tasks by actionability - what should be done RIGHT NOW
 * Lower score = more urgent/important
 */
function rankTask(entry: JournalEntry): number {
  // High priority always surfaces first
  if (entry.priority === "high") return 0;
  
  // Then normal priority
  if (entry.priority === "normal") return 1;
  
  // Low priority tasks sink
  if (entry.priority === "low") return 2;
  
  // Tasks with no priority go last
  return 3;
}

function getLaneLabel(lane: TaskLane | null | undefined): string {
  if (!lane) return "";
  const labels: Record<TaskLane, string> = {
    work: "Work",
    personal: "Personal",
    family: "Family",
    jw: "JW",
    petalz: "Petalz",
  };
  return labels[lane] || "";
}

export function TodayFocus({ entries, date }: TodayFocusProps) {
  const [updateEntry] = useUpdateEntryMutation();
  const [migrateEntries] = useMigrateEntriesMutation();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processingBatch, setProcessingBatch] = useState(false);

  const blocked = entries.filter(
    (entry) => isTask(entry) && entry.status === "blocked"
  );
  const inProgress = entries.filter(
    (entry) => isTask(entry) && entry.status === "in-progress"
  );
  
  // Get all actionable tasks grouped by lane for context switching
  const allActionable = entries.filter(
    (entry) => isTask(entry) && entry.status === "open"
  ).sort((a, b) => {
    const byRank = rankTask(a) - rankTask(b);
    if (byRank !== 0) return byRank;
    return a.sort_order - b.sort_order;
  });
  
  // Group by lane for Today view
  const actionableByLane = allActionable.reduce((acc, task) => {
    const lane = task.lane || "personal";
    if (!acc[lane]) acc[lane] = [];
    acc[lane].push(task);
    return acc;
  }, {} as Record<TaskLane, JournalEntry[]>);
  
  // Get top 3 across all lanes, but note which lanes have work
  const actionable = allActionable.slice(0, 3);
  const activeLanes = Object.keys(actionableByLane) as TaskLane[];

  // Show empty state or nothing
  const hasContent = blocked.length > 0 || inProgress.length > 0 || actionable.length > 0;
  if (!hasContent) {
    // Optional: show empty state only if there are tasks today at all
    const hasTasks = entries.some(e => isTask(e));
    if (hasTasks) {
      return (
        <section className="border-b border-border bg-card/30 px-3 py-3 sm:px-4">
          <div className="flex items-center justify-center py-4">
            <p className="text-sm text-muted-foreground/60">All clear — everything's done or on hold</p>
          </div>
        </section>
      );
    }
    return null;
  }

  const handleStart = async (id: string) => {
    setProcessingId(id);
    try {
      await updateEntry({ id, status: "in-progress", _date: date }).unwrap();
      toast.success("Started task");
    } catch (error) {
      toast.error("Failed to start task");
    } finally {
      setProcessingId(null);
    }
  };

  const handleComplete = async (id: string) => {
    setProcessingId(id);
    try {
      await updateEntry({ id, status: "done", _date: date }).unwrap();
      toast.success("Task completed");
    } catch (error) {
      toast.error("Failed to complete task");
    } finally {
      setProcessingId(null);
    }
  };

  const handleUnblock = async (id: string) => {
    setProcessingId(id);
    try {
      await updateEntry({ id, status: "open", _date: date }).unwrap();
      toast.success("Task unblocked");
    } catch (error) {
      toast.error("Failed to unblock task");
    } finally {
      setProcessingId(null);
    }
  };

  const handleMigrate = async (id: string) => {
    const targetDate = getMigrateTargetDate(date);
    setProcessingId(id);
    try {
      const result = await migrateEntries({ entryIds: [id], targetDate }).unwrap();
      toast.success(`Migrated to ${result.targetDate}`);
    } catch (error) {
      toast.error("Failed to migrate");
    } finally {
      setProcessingId(null);
    }
  };

  const handleUnblockAll = async () => {
    setProcessingBatch(true);
    try {
      // Unblock all blocked tasks in parallel
      await Promise.all(
        blocked.map(task => 
          updateEntry({ id: task.id, status: "open", _date: date }).unwrap()
        )
      );
      toast.success(`Unblocked ${blocked.length} task${blocked.length > 1 ? 's' : ''}`);
    } catch (error) {
      toast.error("Failed to unblock all tasks");
    } finally {
      setProcessingBatch(false);
    }
  };

  return (
    <section className="border-b border-border bg-card/30 px-3 py-3 sm:px-4">
      <div className="flex flex-col gap-3">
        {/* Blockers demand immediate attention */}
        {blocked.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                Blocked — needs unblocking
              </p>
              {blocked.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleUnblockAll}
                  disabled={processingBatch}
                  className="h-6 px-2 text-[10px] text-amber-200 hover:bg-amber-500/20"
                >
                  Unblock all {blocked.length}
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {blocked.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  className="group rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 hover:bg-amber-500/15 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{task.text}</p>
                      {task.waiting_on && (
                        <p className="mt-1 text-xs text-amber-200/70">
                          Waiting: {task.waiting_on}
                        </p>
                      )}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUnblock(task.id)}
                        disabled={processingId === task.id}
                        className="h-7 px-2 text-xs hover:bg-amber-500/20"
                      >
                        <Circle className="w-3 h-3 mr-1" />
                        Unblock
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active work - what's actually being done */}
        {inProgress.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-200">
              Active right now
            </p>
            <div className="flex flex-col gap-2">
              {inProgress.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  className="group rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 hover:bg-blue-500/15 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <p className="text-sm text-foreground flex-1">{task.text}</p>
                      {task.lane && (
                        <span className="text-[10px] uppercase tracking-wider text-blue-200/60 shrink-0">
                          {getLaneLabel(task.lane)}
                        </span>
                      )}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleComplete(task.id)}
                        disabled={processingId === task.id}
                        className="h-7 px-2 text-xs hover:bg-blue-500/20"
                      >
                        <Check className="w-3 h-3 mr-1" />
                        Done
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actionable tasks - grouped by lane when multiple lanes present */}
        {actionable.length > 0 && (
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Do next
              </p>
              {activeLanes.length > 1 && (
                <p className="text-[10px] text-muted-foreground/50">
                  {activeLanes.length} contexts
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {actionable.map((task) => {
                const isHighPriority = task.priority === "high";
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "group rounded-lg border px-3 py-2 transition-colors",
                      isHighPriority
                        ? "border-rose-500/30 bg-rose-500/8 hover:bg-rose-500/12"
                        : "border-border/60 bg-background/70 hover:bg-background"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <p className="text-sm text-foreground flex-1">{task.text}</p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {task.lane && activeLanes.length > 1 && (
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                              {getLaneLabel(task.lane)}
                            </span>
                          )}
                          {isHighPriority && (
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-300">
                              High
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStart(task.id)}
                          disabled={processingId === task.id}
                          className={cn(
                            "h-7 px-2 text-xs",
                            isHighPriority ? "hover:bg-rose-500/20" : "hover:bg-blue-500/20"
                          )}
                        >
                          <Circle className="w-3 h-3 mr-1" />
                          Start
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleComplete(task.id)}
                          disabled={processingId === task.id}
                          className={cn(
                            "h-7 px-2 text-xs",
                            isHighPriority ? "hover:bg-rose-500/20" : "hover:bg-primary/20"
                          )}
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Done
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleMigrate(task.id)}
                          disabled={processingId === task.id}
                          className={cn(
                            "h-7 px-2 text-xs",
                            isHighPriority ? "hover:bg-rose-500/20" : "hover:bg-primary/20"
                          )}
                        >
                          <ArrowRight className="w-3 h-3 mr-1" />
                          Later
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
