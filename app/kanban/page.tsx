"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import Link from "next/link";
import { MessageSquarePlus, RefreshCw } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { KanbanCardOverlay } from "@/components/journal/KanbanCard";
import { KanbanColumn } from "@/components/journal/KanbanColumn";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { TaskDetailDrawer } from "@/components/journal/TaskDetailDrawer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type KanbanStatus,
  useGetKanbanBoardTasksQuery,
  useMoveTaskMutation,
} from "@/store/api/tasksApi";
import type { Task } from "@/types";

const COLUMNS = [
  { id: "todo", title: "To Do", accentClass: "bg-muted-foreground", countClass: "bg-muted text-muted-foreground" },
  { id: "in-progress", title: "In Progress", accentClass: "bg-primary", countClass: "bg-primary/15 text-primary" },
  { id: "blocked", title: "Blocked", accentClass: "bg-destructive", countClass: "bg-destructive/15 text-destructive" },
  { id: "done", title: "Done", accentClass: "bg-chart-3", countClass: "bg-chart-3/15 text-chart-3" },
] satisfies Array<{ id: KanbanStatus; title: string; accentClass: string; countClass: string }>;

const COLUMN_TO_DB_STATUS: Record<KanbanStatus, string> = {
  todo: "open", "in-progress": "in-progress", blocked: "blocked", done: "done",
};

function KanbanSkeleton() {
  return <div className="flex gap-4 overflow-x-auto p-6">{COLUMNS.map((column) => (
    <div key={column.id} className="w-[280px] shrink-0 space-y-3">
      <Skeleton className="h-5 w-24" /><Skeleton className="h-40 w-full" />
    </div>
  ))}</div>;
}

function findColumn(taskId: string, columns: Record<KanbanStatus, Task[]>): KanbanStatus | null {
  return COLUMNS.find((column) => columns[column.id].some((task) => task.id === taskId))?.id ?? null;
}

export default function KanbanPage() {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const drawerOpenerRef = useRef<HTMLElement | null>(null);
  const boardQuery = useGetKanbanBoardTasksQuery({});
  const [moveTask] = useMoveTaskMutation();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const columnTasks = useMemo<Record<KanbanStatus, Task[]>>(() => {
    const tasks = (boardQuery.data ?? []).filter((task) => task?.id);
    return {
      todo: tasks.filter((task) => task.status === "open"),
      "in-progress": tasks.filter((task) => task.status === "in-progress"),
      blocked: tasks.filter((task) => task.status === "blocked"),
      done: tasks.filter((task) => task.status === "done"),
    };
  }, [boardQuery.data]);

  const handleMove = useCallback(async (task: Task, status: string) => {
    if (task.status === status) return;
    setMovingTaskId(task.id);
    setMutationError(null);
    try {
      await moveTask({ taskId: task.id, status }).unwrap();
      setSelectedTask((current) => current?.id === task.id ? { ...current, status } : current);
    } catch {
      setMutationError(`Could not move “${task.text}”. Its previous status was restored.`);
    } finally {
      setMovingTaskId(null);
    }
  }, [moveTask]);

  const handleOpenTask = useCallback((task: Task, opener: HTMLButtonElement) => {
    drawerOpenerRef.current = opener;
    setSelectedTask(task);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const source = findColumn(String(event.active.id), columnTasks);
    setActiveTask(source ? columnTasks[source].find((task) => task.id === event.active.id) ?? null : null);
  }, [columnTasks]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveTask(null);
    if (!event.over) return;
    const source = findColumn(String(event.active.id), columnTasks);
    const overId = String(event.over.id);
    const target = COLUMNS.some((column) => column.id === overId)
      ? overId as KanbanStatus
      : findColumn(overId, columnTasks);
    if (!source || !target || source === target) return;
    const task = columnTasks[source].find((item) => item.id === event.active.id);
    if (task) void handleMove(task, COLUMN_TO_DB_STATUS[target]);
  }, [columnTasks, handleMove]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <JournalHeader
        date={new Date().toISOString().split("T")[0]}
        onPrevDay={() => {}}
        onNextDay={() => {}}
        onToday={() => {}}
        showDateNav={false}
        showCapture={false}
        title="Kanban"
        subtitle="Task lifecycle and conversation"
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div><h1 className="text-lg font-semibold text-foreground">Task board</h1><p className="text-sm text-muted-foreground">All active task work, across capture dates.</p></div>
        <Button asChild><Link href="/?capture=task"><MessageSquarePlus />Capture task in journal</Link></Button>
      </div>
      {mutationError ? <div role="alert" className="mx-6 mt-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><span>{mutationError}</span><Button variant="ghost" size="xs" onClick={() => setMutationError(null)}>Dismiss</Button></div> : null}
      {boardQuery.isLoading ? <KanbanSkeleton /> : boardQuery.isError ? (
        <div className="m-6 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center"><p className="text-sm text-destructive">The task board could not be loaded.</p><Button className="mt-3" variant="outline" onClick={() => boardQuery.refetch()}><RefreshCw />Try again</Button></div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 overflow-x-auto overflow-y-hidden"><div className="flex h-full min-w-max gap-4 p-6">
            {COLUMNS.map((column) => <div key={column.id} className="flex w-[280px] xl:w-[300px]"><KanbanColumn {...column} tasks={columnTasks[column.id]} onOpenTask={handleOpenTask} onMoveTask={handleMove} movingTaskId={movingTaskId} /></div>)}
          </div></div>
          <DragOverlay>{activeTask ? <KanbanCardOverlay task={activeTask} /> : null}</DragOverlay>
        </DndContext>
      )}
      <TaskDetailDrawer selectedTask={selectedTask} onClose={() => setSelectedTask(null)} returnFocusRef={drawerOpenerRef} />
    </div>
  );
}
