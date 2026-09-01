"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";
import {
  Square,
  CheckSquare,
  AlertTriangle,
  GripVertical,
  MessageCircle,
  MoreHorizontal,
} from "lucide-react";

interface KanbanCardProps {
  task: Task;
  isDragging?: boolean;
  onOpen?: (task: Task) => void;
  onMove?: (task: Task, status: string) => void;
  isMoving?: boolean;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "done") {
    return <CheckSquare className="w-3.5 h-3.5 shrink-0 text-primary" />;
  }
  if (status === "blocked") {
    return <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-chart-5" />;
  }
  return <Square className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />;
}

function formatShortDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function parseTags(tags: string | string[] | null): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  try { return JSON.parse(tags); } catch { return []; }
}

const STATUS_OPTIONS = [
  ["open", "To Do"],
  ["in-progress", "In Progress"],
  ["blocked", "Blocked"],
  ["done", "Done"],
] as const;

export function KanbanCard({ task, isDragging, onOpen, onMove, isMoving }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const isActive = isDragging || isSortableDragging;
  const tags = parseTags(task.tags as string | string[] | null);

  // dnd-kit requires the computed transform/transition to be applied via style
  // This is a mandatory runtime value — allowed per CODING-STANDARDS (dynamic runtime exception)
  const dndStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={dndStyle}
      className={cn(
        "group relative rounded-lg border border-border bg-card p-3 shadow-sm",
        "select-none",
        isActive && "opacity-50 ring-2 ring-primary/40"
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute top-2.5 right-2 text-muted-foreground/30 group-hover:text-muted-foreground/70 transition-colors bg-transparent border-0 p-0 cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        className="flex w-full items-start gap-2 pr-5 text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onOpen?.(task)}
        aria-label={`Open task: ${task.text}`}
      >
        <StatusIcon status={task.status} />
        <span className="text-sm text-foreground leading-snug line-clamp-3">{task.text}</span>
      </button>

      {/* Footer: tags + date */}
      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-4 font-normal border-border/60 text-muted-foreground"
          >
            {tag}
          </Badge>
        ))}
        {task.comment_count ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground" aria-label={`${task.comment_count} comments`}>
            <MessageCircle className="size-3" /> {task.comment_count}
          </span>
        ) : null}
        {task.last_comment_at ? (
          <span className="text-[10px] text-muted-foreground/70">Active {formatShortDate(task.last_comment_at)}</span>
        ) : null}
        {task.date && (
          <span className="text-[10px] text-muted-foreground/50">
            {formatShortDate(task.date)}
          </span>
        )}
        {onMove ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-auto rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Move ${task.text}`}
                disabled={isMoving}
              >
                <MoreHorizontal className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              {STATUS_OPTIONS.map(([status, label]) => (
                <DropdownMenuItem
                  key={status}
                  disabled={task.status === status}
                  onSelect={() => onMove(task, status)}
                >
                  {label}{task.status === status ? " (current)" : ""}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}

// Overlay card shown while dragging — no transform applied, full opacity
export function KanbanCardOverlay({ task }: { task: Task }) {
  const tags = parseTags(task.tags as string | string[] | null);

  return (
    <div className="rotate-1 cursor-grabbing select-none rounded-lg border border-primary/60 bg-card p-3 shadow-sm ring-2 ring-primary/30">
      <div className="flex items-start gap-2 pr-5">
        <StatusIcon status={task.status} />
        <p className="text-sm text-foreground leading-snug line-clamp-3">
          {task.text}
        </p>
      </div>
      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-4 font-normal border-border/60 text-muted-foreground"
          >
            {tag}
          </Badge>
        ))}
      </div>
    </div>
  );
}
