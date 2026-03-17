"use client";

import { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Kanban, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanColumn } from "@/components/journal/KanbanColumn";
import { KanbanCardOverlay } from "@/components/journal/KanbanCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetKanbanTasksQuery,
  useMoveTaskMutation,
  type KanbanStatus,
} from "@/store/api/tasksApi";
import type { Task } from "@/types";

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDisplayDateLong(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const COLUMNS: {
  id: KanbanStatus;
  title: string;
  accentClass: string;
  countClass: string;
}[] = [
  {
    id: "todo",
    title: "To Do",
    accentClass: "bg-muted-foreground",
    countClass: "bg-muted text-muted-foreground",
  },
  {
    id: "in-progress",
    title: "In Progress",
    accentClass: "bg-primary",
    countClass: "bg-primary/15 text-primary",
  },
  {
    id: "blocked",
    title: "Blocked",
    accentClass: "bg-destructive",
    countClass: "bg-destructive/15 text-destructive",
  },
  {
    id: "done",
    title: "Done",
    accentClass: "bg-chart-3",
    countClass: "bg-chart-3/15 text-chart-3",
  },
];

// Map kanban column id to DB status string for the move mutation
const COLUMN_TO_DB_STATUS: Record<KanbanStatus, string> = {
  todo: "open",
  "in-progress": "in-progress",
  blocked: "blocked",
  done: "done",
};

function KanbanSkeleton() {
  return (
    <div className="flex gap-4 p-6 overflow-x-auto">
      {COLUMNS.map((col) => (
        <div key={col.id} className="flex flex-col w-[280px]">
          <Skeleton className="h-5 w-24 mb-3" />
          <div className="rounded-xl border border-border/50 bg-muted/30 p-2 space-y-2 min-h-[200px]">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-20 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function KanbanPage() {
  const [currentDate, setCurrentDate] = useState<string>(formatDate(new Date()));
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [moveTask] = useMoveTaskMutation();

  const todoQuery = useGetKanbanTasksQuery({ status: "todo", date: currentDate });
  const inProgressQuery = useGetKanbanTasksQuery({ status: "in-progress", date: currentDate });
  const blockedQuery = useGetKanbanTasksQuery({ status: "blocked", date: currentDate });
  const doneQuery = useGetKanbanTasksQuery({ status: "done", date: currentDate });

  const isLoading =
    todoQuery.isLoading ||
    inProgressQuery.isLoading ||
    blockedQuery.isLoading ||
    doneQuery.isLoading;

  const columnTasks = useMemo<Record<KanbanStatus, Task[]>>(
    () => ({
      todo: todoQuery.data ?? [],
      "in-progress": inProgressQuery.data ?? [],
      blocked: blockedQuery.data ?? [],
      done: doneQuery.data ?? [],
    }),
    [todoQuery.data, inProgressQuery.data, blockedQuery.data, doneQuery.data]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const goToPrevDay = useCallback(() => {
    const d = new Date(currentDate + "T12:00:00");
    d.setDate(d.getDate() - 1);
    setCurrentDate(formatDate(d));
  }, [currentDate]);

  const goToNextDay = useCallback(() => {
    const d = new Date(currentDate + "T12:00:00");
    d.setDate(d.getDate() + 1);
    setCurrentDate(formatDate(d));
  }, [currentDate]);

  const goToToday = useCallback(() => {
    setCurrentDate(formatDate(new Date()));
  }, []);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      for (const col of COLUMNS) {
        const found = columnTasks[col.id].find((t) => t.id === active.id);
        if (found) {
          setActiveTask(found);
          return;
        }
      }
    },
    [columnTasks]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTask(null);

      if (!over) return;

      const overId = over.id as string;

      // Determine which column the card was dropped into
      let targetColumn: KanbanStatus | null = null;
      if (COLUMNS.some((c) => c.id === overId)) {
        targetColumn = overId as KanbanStatus;
      } else {
        // over is a card — find which column it belongs to
        for (const col of COLUMNS) {
          if (columnTasks[col.id].some((t) => t.id === overId)) {
            targetColumn = col.id;
            break;
          }
        }
      }

      if (!targetColumn) return;

      // Find source column
      let sourceColumn: KanbanStatus | null = null;
      for (const col of COLUMNS) {
        if (columnTasks[col.id].some((t) => t.id === active.id)) {
          sourceColumn = col.id;
          break;
        }
      }

      if (!sourceColumn || sourceColumn === targetColumn) return;

      moveTask({
        taskId: active.id as string,
        status: COLUMN_TO_DB_STATUS[targetColumn],
      });
    },
    [columnTasks, moveTask]
  );

  const isToday = currentDate === formatDate(new Date());

  if (isLoading) return <KanbanSkeleton />;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header with date navigation */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <Kanban className="w-4 h-4 text-primary" />
          <h1 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Kanban
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goToPrevDay} className="w-8 h-8 p-0">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant={isToday ? "outline" : "secondary"}
            size="sm"
            onClick={goToToday}
            className="h-8 px-3"
          >
            <Calendar className="w-3.5 h-3.5 mr-2" />
            <span className="hidden sm:inline">Today</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={goToNextDay} className="w-8 h-8 p-0">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-foreground hidden sm:inline ml-2">
            {formatDisplayDateLong(currentDate)}
          </span>
          <span className="text-sm font-medium text-foreground sm:hidden ml-1">
            {formatDisplayDate(currentDate)}
          </span>
        </div>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-4 p-6 h-full min-w-max">
            {COLUMNS.map((col) => (
              <div key={col.id} className="w-[280px] xl:w-[300px] flex">
                <KanbanColumn
                  id={col.id}
                  title={col.title}
                  tasks={columnTasks[col.id]}
                  accentClass={col.accentClass}
                  countClass={col.countClass}
                />
              </div>
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeTask ? <KanbanCardOverlay task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
