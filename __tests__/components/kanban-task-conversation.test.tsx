import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KanbanCard } from "@/components/journal/KanbanCard";
import { TaskCommentComposer } from "@/components/journal/TaskCommentComposer";
import { TaskCommentTimeline } from "@/components/journal/TaskCommentTimeline";
import { TaskDetailDrawer } from "@/components/journal/TaskDetailDrawer";
import type { Task, TaskComment } from "@/types";

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {}, listeners: {}, setNodeRef: vi.fn(), transform: null,
    transition: undefined, isDragging: false,
  }),
}));

vi.mock("@/store/api/tasksApi", () => ({
  useGetTaskQuery: () => ({ data: undefined, isLoading: false, isError: false }),
  useGetTaskCommentsQuery: () => ({ data: [], isLoading: false, isError: false }),
  useAddTaskCommentMutation: () => [vi.fn(), { isLoading: false }],
}));

const task: Task = {
  id: "task-1", date: "2026-09-01", text: "Prepare launch notes", status: "open",
  tags: "[\"release\"]", lane: "work", priority: "high", waiting_on: null,
  sort_order: 0, created_at: "2026-09-01T12:00:00Z", updated_at: "2026-09-01T12:00:00Z",
  comment_count: 2, last_comment_at: "2026-09-01T13:00:00Z",
};

const comments: TaskComment[] = [
  {
    id: "comment-1", task_id: task.id, body: "Human **context**", actor_type: "human",
    actor_id: "morgan", source_ref: null, idempotency_key: null, created_at: "2026-09-01T12:00:00Z",
  },
  {
    id: "comment-2", task_id: task.id, body: "Agent follow-up", actor_type: "agent",
    actor_id: "jynx", source_ref: "run:task-42", idempotency_key: "key-1", created_at: "2026-09-01T13:00:00Z",
  },
];

function FocusRestorationHarness() {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  return (
    <>
      <KanbanCard
        task={task}
        onOpen={(openedTask, opener) => {
          openerRef.current = opener;
          setSelectedTask(openedTask);
        }}
      />
      <TaskDetailDrawer
        selectedTask={selectedTask}
        onClose={() => setSelectedTask(null)}
        returnFocusRef={openerRef}
      />
    </>
  );
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { configurable: true, value: () => false });
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: () => undefined });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: () => undefined });
});

describe("Kanban task conversation", () => {
  it("opens a card with click or keyboard activation and shows quiet activity", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<KanbanCard task={task} onOpen={onOpen} />);
    const openButton = screen.getByRole("button", { name: `Open task: ${task.text}` });
    await user.click(openButton);
    openButton.focus();
    await user.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onOpen).toHaveBeenLastCalledWith(task, openButton);
    expect(screen.getByLabelText("2 comments")).toBeInTheDocument();
    expect(screen.getByText(/Active Sep 1/)).toBeInTheDocument();
  });

  it("restores focus to the exact keyboard opener after every drawer close path", async () => {
    const user = userEvent.setup();
    render(<FocusRestorationHarness />);
    const opener = screen.getByRole("button", { name: `Open task: ${task.text}` });

    opener.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(opener).toHaveFocus());

    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("moves status from the card menu without dragging", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(<KanbanCard task={task} onMove={onMove} />);
    await user.click(screen.getByRole("button", { name: `Move ${task.text}` }));
    await user.click(await screen.findByRole("menuitem", { name: "In Progress" }));
    expect(onMove).toHaveBeenCalledWith(task, "in-progress");
  });

  it("renders chronological identities, Markdown, and collapsed provenance", () => {
    render(<TaskCommentTimeline comments={comments} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Morgan");
    expect(items[1]).toHaveTextContent("Jynx");
    expect(screen.getByText("context").tagName).toBe("STRONG");
    const provenance = screen.getByText("Provenance").closest("details");
    expect(provenance).not.toHaveAttribute("open");
    expect(screen.getByText("run:task-42")).toBeInTheDocument();
  });

  it("shows timeline empty, loading, and error states", () => {
    const { rerender } = render(<TaskCommentTimeline comments={[]} />);
    expect(screen.getByText("No comments yet")).toBeInTheDocument();
    rerender(<TaskCommentTimeline comments={[]} isLoading />);
    expect(screen.getByText("Loading conversation…")).toBeInTheDocument();
    rerender(<TaskCommentTimeline comments={[]} error="Conversation could not be loaded." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Conversation could not be loaded.");
  });

  it("submits Markdown and preserves the draft after a mutation failure", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("offline"));
    render(<TaskCommentComposer onSubmit={onSubmit} isSubmitting={false} />);
    const composer = screen.getByLabelText("Add a Markdown comment");
    await user.type(composer, "**Decision** stays local");
    await user.click(screen.getByRole("button", { name: "Add comment" }));
    expect(onSubmit).toHaveBeenCalledWith("**Decision** stays local");
    expect(composer).toHaveValue("**Decision** stays local");
    expect(screen.getByRole("alert")).toHaveTextContent("Your draft is still here");
  });
});
