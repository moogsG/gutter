"use client";

import { memo, useState, useRef, useCallback } from "react";
import { SignifierIcon } from "./SignifierIcon";
import type { JournalEntry, Collection } from "@/types/journal";
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
import { MoreVertical, ArrowRight, Trash2, X, FolderPlus, FolderMinus, CheckCircle, Plus, ChevronRight } from "lucide-react";
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

export const EntryItem = memo(function EntryItem({ entry, collections = [], isChild, onToggle, onMigrate, onKill, onDelete }: EntryItemProps) {
  const [updateEntry] = useUpdateEntryMutation();
  const [addEntry] = useAddEntryMutation();
  const [expanded, setExpanded] = useState(true);
  const [showSubInput, setShowSubInput] = useState(false);
  const [subText, setSubText] = useState("");
  const subInputRef = useRef<HTMLInputElement>(null);
  const isClickable = entry.signifier === "task" && entry.status === "open";
  const isMigrated = entry.status === "migrated";
  const isKilled = entry.status === "killed";
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
    });
    setSubText("");
    subInputRef.current?.focus();
  }, [subText, addEntry, entry.date, entry.id]);

  const handleAddToCollection = (collectionId: string) => {
    updateEntry({ id: entry.id, collection_id: collectionId });
  };

  const handleRemoveFromCollection = () => {
    updateEntry({ id: entry.id, collection_id: null as unknown as string });
  };

  return (
    <div className={cn(isChild && "ml-6 border-l border-border/50 pl-2")}>
      <div
        className={cn(
          "flex items-start gap-2.5 sm:gap-3 py-2 px-2 sm:px-3 hover:bg-muted/30 rounded-md transition-colors group",
          isMigrated && "opacity-60",
          isKilled && "opacity-40"
        )}
      >
        {/* Expand toggle for entries with children */}
        {hasChildren && !isChild ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", expanded && "rotate-90")} />
          </button>
        ) : !isChild ? (
          <div className="w-3.5 shrink-0" />
        ) : null}

        <button
          onClick={() => isClickable && onToggle?.(entry.id)}
          disabled={!isClickable}
          className={cn(
            "mt-0.5 transition-all shrink-0 touch-manipulation",
            isClickable && "cursor-pointer hover:scale-110 active:scale-95"
          )}
        >
          <SignifierIcon signifier={entry.signifier} status={entry.status} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                "text-sm text-foreground break-words",
                isKilled && "line-through text-muted-foreground"
              )}
            >
              {entry.text}
            </p>
            {hasChildren && (
              <span className="text-xs text-muted-foreground shrink-0">
                {doneCount}/{totalCount}
              </span>
            )}
          </div>
          {entry.tags && entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {entry.tags.map((tag, i) => (
                <span key={i} className="text-xs text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {isMigrated && entry.migrated_to && (
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <ArrowRight className="w-3 h-3 shrink-0" />
              <span>Migrated to {entry.migrated_to}</span>
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity w-7 h-7 sm:w-8 sm:h-8 p-0 shrink-0 touch-manipulation"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {entry.status === "open" && entry.signifier === "task" && (
              <DropdownMenuItem onClick={() => onToggle?.(entry.id)}>
                <CheckCircle className="w-4 h-4" />
                Mark Done
              </DropdownMenuItem>
            )}
            {entry.status === "open" && (
              <>
                <DropdownMenuItem onClick={() => onMigrate?.(entry.id)}>
                  <ArrowRight className="w-4 h-4" />
                  Migrate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onKill?.(entry.id)}>
                  <X className="w-4 h-4" />
                  Strike Out
                </DropdownMenuItem>
              </>
            )}

            {/* Add subtask — only for non-child tasks */}
            {!isChild && entry.signifier === "task" && entry.status === "open" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                  setShowSubInput(true);
                  setExpanded(true);
                  setTimeout(() => subInputRef.current?.focus(), 50);
                }}>
                  <Plus className="w-4 h-4" />
                  Add Subtask
                </DropdownMenuItem>
              </>
            )}

            {collections.length > 0 && (
              <>
                <DropdownMenuSeparator />
                {entry.collection_id ? (
                  <DropdownMenuItem onClick={handleRemoveFromCollection}>
                    <FolderMinus className="w-4 h-4" />
                    Remove from Collection
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <FolderPlus className="w-4 h-4" />
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
              <Trash2 className="w-4 h-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Children / subtasks */}
      {hasChildren && expanded && (
        <div className="mt-0.5">
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

      {/* Inline subtask input */}
      {showSubInput && expanded && (
        <div className="ml-6 border-l border-border/50 pl-2">
          <form
            className="flex items-center gap-2 py-1.5 px-2 sm:px-3"
            onSubmit={(e) => {
              e.preventDefault();
              handleAddSubtask();
            }}
          >
            <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
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
              className="h-7 text-xs bg-transparent border-border/50"
            />
          </form>
        </div>
      )}
    </div>
  );
});
