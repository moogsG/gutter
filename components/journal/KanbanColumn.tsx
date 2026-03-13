"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { KanbanCard } from "@/components/journal/KanbanCard";
import type { Task } from "@/types";
import type { KanbanStatus } from "@/store/api/tasksApi";

interface KanbanColumnProps {
  id: KanbanStatus;
  title: string;
  tasks: Task[];
  isOver?: boolean;
  accentClass: string;
  countClass: string;
}

export function KanbanColumn({
  id,
  title,
  tasks,
  accentClass,
  countClass,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const taskIds = tasks.map((t) => t.id);

  return (
    <div className="flex flex-col min-w-0 flex-1">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full shrink-0", accentClass)} />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {title}
          </h2>
        </div>
        <span
          className={cn(
            "text-xs font-medium tabular-nums px-1.5 py-0.5 rounded-full",
            countClass
          )}
        >
          {tasks.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 rounded-xl border border-border/50 bg-muted/30 p-2 space-y-2 min-h-[200px] transition-colors",
          isOver && "border-primary/40 bg-primary/5"
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard key={task.id} task={task} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-full min-h-[120px]">
            <p className="text-xs text-muted-foreground/40 select-none">
              Drop tasks here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
