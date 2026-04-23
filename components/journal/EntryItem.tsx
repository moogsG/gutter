"use client";

import { memo, useState, useRef, useCallback } from "react";
import { SignifierIcon } from "./SignifierIcon";
import type { JournalEntry, Collection, TaskLane, TaskPriority } from "@/types/journal";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  ArrowRight,
  Trash2,
  X,
  FolderPlus,
  FolderMinus,
  CheckCircle,
  Plus,
  ChevronRight,
  CircleDot,
  PauseCircle,
  AlertCircle,
} from "lucide-react";
import { useUpdateEntryMutation, useAddEntryMutation } from "@/store/api/journalApi";

interface EntryItemProps {
  entry: JournalEntry;
  collections?: Collection[];
  isChild?: boolean;
  onToggle?: (id: string) => void;
  onMigrate?: (id: string) => void;
  onKill?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const laneLabels: Record<TaskLane, string> = {
  work: "Work",
  personal: "Personal",
  family: "Family",
  jw: "JW",
  petalz: "Petalz",
};

const laneClassNames: Record<TaskLane, string> = {
  work: "border-blue-500/20 bg-blue-500/8 text-blue-200",
  personal: "border-zinc-500/20 bg-zinc-500/8 text-zinc-200",
  family: "border-emerald-500/20 bg-emerald-500/8 text-emerald-200",
  jw: "border-amber-500/20 bg-amber-500/8 text-amber-200",
  petalz: "border-pink-500/20 bg-pink-500/8 text-pink-200",
};

const priorityLabels: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
};

const priorityClassNames: Record<TaskPriority, string> = {
  low: "border-zinc-500/20 bg-zinc-500/8 text-zinc-300",
  normal: "border-transparent bg-transparent text-muted-foreground",
  high: "border-red-500/20 bg-red-500/8 text-red-200",
};

export const EntryItem = memo(function EntryItem({ entry, collections = [], isChild, onToggle, onMigrate, onKill, onDelete }: EntryItemProps) {
  const [updateEntry] = useUpdateEntryMutation();
  const [addEntry] = useAddEntryMutation();
  const [expanded, setExpanded] = useState(true);
  const [showSubInput, setShowSubInput] = useState(false);
  const [subText, setSubText] = useState("");
  const subInputRef = useRef<HTMLInputElement>(null);
  const isTask = entry.signifier === "task";
  const isMigrated = entry.status === "migrated";
  const isKilled = entry.status === "killed";
  const isDone = entry.status === "done";
  const hasChildren = entry.children && entry.children.length > 0;
  const doneCount = entry.children?.filter((c) => c.status === "done").length ?? 0;
  const totalCount = entry.children?.length ?? 0;

  const handleAddSubtask = useCallback(() => {
    if (!subText.trim()) return;
    addEntry({
      date: entry.date,
      signifier: "task",
      text: subText.trim(),
      parent_id: entry.id,
      lane: entry.lane ?? undefined,
      priority: entry.priority ?? undefined,
    });
    setSubText("");
    subInputRef.current?.focus();
  }, [subText, addEntry, entry.date, entry.id, entry.lane, entry.priority]);

  const handleAddToCollection = (collectionId: string) => {
    updateEntry({ id: entry.id, collection_id: collectionId, _date: entry.date });
  };

  const handleRemoveFromCollection = () => {
    updateEntry({ id: entry.id, collection_id: null as unknown as string, _date: entry.date });
  };

  const setStatus = (status: JournalEntry["status"]) => {
    updateEntry({ id: entry.id, status, _date: entry.date });
  };

  const setLane = (lane: TaskLane | null) => {
    updateEntry({ id: entry.id, lane, _date: entry.date });
  };

  const setPriority = (priority: TaskPriority | null) => {
    updateEntry({ id: entry.id, priority, _date: entry.date });
  };

  const waitingOn = entry.waiting_on?.trim();

  return (
    <div className={cn(isChild && "ml-6 border-l border-border/40 pl-3")}>
      <div
        className={cn(
          "group rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-border/60 hover:bg-muted/20 sm:px-3",
          isMigrated && "opacity-60",
          isKilled && "opacity-40",
          entry.status === "blocked" && "border-amber-500/20 bg-amber-500/5",
          entry.status === "in-progress" && "border-blue-500/15 bg-blue-500/5"
        )}
      >
        <div className="flex items-start gap-2.5 sm:gap-3">
          {hasChildren && !isChild ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")} />
            </button>
          ) : !isChild ? (
            <div className="w-3.5 shrink-0" />
          ) : null}

          <button
            onClick={() => isTask && onToggle?.(entry.id)}
            disabled={!isTask}
            className={cn(
              "mt-0.5 shrink-0 transition-all",
              isTask && "cursor-pointer hover:scale-110 active:scale-95"
            )}
          >
            <SignifierIcon signifier={entry.signifier} status={entry.status} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <p
                className={cn(
                  "flex-1 break-words text-sm leading-6 text-foreground",
                  isDone && "text-muted-foreground line-through",
                  isKilled && "text-muted-foreground line-through"
                )}
              >
                {entry.text}
              </p>
              {hasChildren && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {doneCount}/{totalCount}
                </span>
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {isTask && entry.status !== "open" && !isKilled && !isMigrated && (
                <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {entry.status === "in-progress" ? "In progress" : entry.status}
                </span>
              )}

              {entry.lane && (
                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide", laneClassNames[entry.lane])}>
                  {laneLabels[entry.lane]}
                </span>
              )}

              {entry.priority && entry.priority !== "normal" && (
                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide", priorityClassNames[entry.priority])}>
                  {priorityLabels[entry.priority]}
                </span>
              )}

              {waitingOn && (
                <span className="rounded-full border border-amber-500/20 bg-amber-500/8 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                  Waiting on {waitingOn}
                </span>
              )}

              {entry.tags && entry.tags.length > 0 && (
                <span className="text-xs text-muted-foreground">{entry.tags.join(" · ")}</span>
              )}
            </div>

            {isMigrated && entry.migrated_to && (
              <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowRight className="h-3 w-3 shrink-0" />
                <span>Migrated to {entry.migrated_to}</span>
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 p-0 opacity-60 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {isTask && (
                <>
                  <DropdownMenuItem onClick={() => setStatus("open")}>
                    <CircleDot className="h-4 w-4" />
                    Mark Open
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatus("in-progress")}>
                    <PauseCircle className="h-4 w-4" />
                    Mark In Progress
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatus("blocked")}>
                    <AlertCircle className="h-4 w-4" />
                    Mark Blocked
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatus("done")}>
                    <CheckCircle className="h-4 w-4" />
                    Mark Done
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Set Lane</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-40">
                      {(Object.keys(laneLabels) as TaskLane[]).map((lane) => (
                        <DropdownMenuItem key={lane} onClick={() => setLane(lane)}>
                          {laneLabels[lane]}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setLane(null)}>Clear Lane</DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Set Priority</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-40">
                      {(Object.keys(priorityLabels) as TaskPriority[]).map((priority) => (
                        <DropdownMenuItem key={priority} onClick={() => setPriority(priority)}>
                          {priorityLabels[priority]}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setPriority(null)}>Clear Priority</DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
              )}

              {entry.status === "open" && (
                <>
                  <DropdownMenuItem onClick={() => onMigrate?.(entry.id)}>
                    <ArrowRight className="h-4 w-4" />
                    Migrate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onKill?.(entry.id)}>
                    <X className="h-4 w-4" />
                    Strike Out
                  </DropdownMenuItem>
                </>
              )}

              {!isChild && isTask && entry.status !== "done" && entry.status !== "killed" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setShowSubInput(true);
                      setExpanded(true);
                      setTimeout(() => subInputRef.current?.focus(), 50);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Add Subtask
                  </DropdownMenuItem>
                </>
              )}

              {collections.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  {entry.collection_id ? (
                    <DropdownMenuItem onClick={handleRemoveFromCollection}>
                      <FolderMinus className="h-4 w-4" />
                      Remove from Collection
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <FolderPlus className="h-4 w-4" />
                        Add to Collection
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-44">
                        {collections.map((col) => (
                          <DropdownMenuItem
                            key={col.id}
                            onClick={() => handleAddToCollection(col.id)}
                          >
                            {col.title}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                </>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete?.(entry.id)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="mt-1">
          {entry.children!.map((child) => (
            <EntryItem
              key={child.id}
              entry={child}
              collections={collections}
              isChild
              onToggle={onToggle}
              onMigrate={onMigrate}
              onKill={onKill}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {showSubInput && expanded && (
        <div className="ml-6 border-l border-border/40 pl-3">
          <form
            className="flex items-center gap-2 py-2 pr-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleAddSubtask();
            }}
          >
            <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <Input
              ref={subInputRef}
              type="text"
              value={subText}
              onChange={(e) => setSubText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowSubInput(false);
                  setSubText("");
                }
              }}
              onBlur={() => {
                if (!subText.trim()) {
                  setShowSubInput(false);
                }
              }}
              placeholder="Add subtask..."
              className="h-8 border-border/50 bg-transparent text-xs"
            />
          </form>
        </div>
      )}
    </div>
  );
});
