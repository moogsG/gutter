"use client";

import { CalendarDays, Clock3, Flag, Layers3, PauseCircle, Tags } from "lucide-react";
import { TaskCommentComposer } from "@/components/journal/TaskCommentComposer";
import { TaskCommentTimeline } from "@/components/journal/TaskCommentTimeline";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  useAddTaskCommentMutation,
  useGetTaskCommentsQuery,
  useGetTaskQuery,
} from "@/store/api/tasksApi";
import type { RefObject } from "react";
import type { Task } from "@/types";

function parseTags(tags: string | string[] | null | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function timestamp(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function statusLabel(status: string): string {
  return { open: "To Do", "in-progress": "In Progress", blocked: "Blocked", done: "Done" }[status]
    ?? status.replace("-", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function Metadata({ task }: { task: Task }) {
  const tags = parseTags(task.tags);
  const items = [
    { icon: Layers3, label: "Lane", value: task.lane || "Unassigned" },
    { icon: Flag, label: "Priority", value: task.priority || "Normal" },
    { icon: PauseCircle, label: "Waiting on", value: task.waiting_on || "Nothing" },
    { icon: CalendarDays, label: "Captured", value: task.date },
  ];
  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="size-3.5" />{label}</dt>
            <dd className="mt-1 truncate text-sm text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Tags className="mt-0.5 size-3.5 shrink-0" />
        <div className="flex flex-wrap gap-1.5">
          {tags.length ? tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>) : "No tags"}
        </div>
      </div>
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Clock3 className="mt-0.5 size-3.5 shrink-0" />
        <span>Created {timestamp(task.created_at)} · Updated {timestamp(task.updated_at)}</span>
      </div>
    </div>
  );
}

interface TaskDetailDrawerProps {
  selectedTask: Task | null;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}

export function TaskDetailDrawer({ selectedTask, onClose, returnFocusRef }: TaskDetailDrawerProps) {
  const taskId = selectedTask?.id ?? "";
  const detail = useGetTaskQuery(taskId, { skip: !taskId });
  const comments = useGetTaskCommentsQuery(taskId, { skip: !taskId });
  const [addComment, addState] = useAddTaskCommentMutation();
  const task = detail.data ?? selectedTask;

  async function submitComment(body: string) {
    if (!taskId) return;
    await addComment({ taskId, body }).unwrap();
  }

  return (
    <Sheet open={Boolean(selectedTask)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        className="w-full gap-0 p-0 sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current?.focus();
        }}
      >
        <SheetHeader className="border-b border-border pr-12">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{task ? statusLabel(task.status) : "Task"}</Badge>
            {task?.lane ? <Badge variant="secondary">{task.lane}</Badge> : null}
          </div>
          <SheetTitle className="text-left text-lg leading-snug">{task?.text ?? "Task details"}</SheetTitle>
          <SheetDescription className="text-left">Task details and chronological conversation</SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 p-5">
            {detail.isLoading && !task ? <p className="text-sm text-muted-foreground">Loading task…</p> : null}
            {detail.isError ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Task details could not be loaded.</p> : null}
            {task ? <Metadata task={task} /> : null}
            <section aria-labelledby="task-conversation-title" className="space-y-4">
              <div>
                <h3 id="task-conversation-title" className="font-semibold text-foreground">Conversation</h3>
                <p className="text-xs text-muted-foreground">Oldest context first</p>
              </div>
              <TaskCommentTimeline
                comments={comments.data ?? []}
                isLoading={comments.isLoading}
                error={comments.isError ? "Conversation could not be loaded." : null}
              />
            </section>
            <TaskCommentComposer onSubmit={submitComment} isSubmitting={addState.isLoading} />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
