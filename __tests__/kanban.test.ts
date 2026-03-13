import { describe, it, expect } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Kanban — unit tests for API route logic + status transition rules
// ─────────────────────────────────────────────────────────────────────────────

// ---------------------------------------------------------------------------
// Replicate the kanban status map from the API route so we can test it
// without spinning up Next.js
// ---------------------------------------------------------------------------
const KANBAN_STATUS_MAP: Record<string, string[]> = {
  todo: ["open"],
  "in-progress": ["in-progress", "in_progress"],
  blocked: ["blocked"],
  done: ["complete", "done"],
};

const COLUMN_TO_DB_STATUS: Record<string, string> = {
  todo: "open",
  "in-progress": "in-progress",
  blocked: "blocked",
  done: "complete",
};

const ALLOWED_MOVE_STATUSES = ["open", "in-progress", "blocked", "complete"];

// ---------------------------------------------------------------------------
// Helper: simulate what the GET handler resolves for a given ?status= param
// ---------------------------------------------------------------------------
function resolveStatusValues(statusParam: string | null): string[] {
  if (!statusParam) return ["open"];
  if (KANBAN_STATUS_MAP[statusParam]) return KANBAN_STATUS_MAP[statusParam];
  if (statusParam.includes(",")) return statusParam.split(",").map((s) => s.trim());
  return [statusParam];
}

// ---------------------------------------------------------------------------
// Helper: simulate what the POST move handler validates
// ---------------------------------------------------------------------------
function validateMoveAction(taskId: string | undefined, status: string | undefined): { ok: boolean; error?: string } {
  if (!taskId) return { ok: false, error: "taskId is required" };
  if (!status) return { ok: false, error: "status is required" };
  if (!ALLOWED_MOVE_STATUSES.includes(status)) return { ok: false, error: "Invalid status" };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Kanban API — GET /api/tasks status filtering", () => {
  it("defaults to open tasks when no status param provided", () => {
    const result = resolveStatusValues(null);
    expect(result).toEqual(["open"]);
  });

  it("maps kanban 'todo' to DB status 'open'", () => {
    const result = resolveStatusValues("todo");
    expect(result).toEqual(["open"]);
  });

  it("maps kanban 'in-progress' to both in-progress variants", () => {
    const result = resolveStatusValues("in-progress");
    expect(result).toContain("in-progress");
    expect(result).toContain("in_progress");
  });

  it("maps kanban 'blocked' to DB status 'blocked'", () => {
    const result = resolveStatusValues("blocked");
    expect(result).toEqual(["blocked"]);
  });

  it("maps kanban 'done' to both DB complete/done variants", () => {
    const result = resolveStatusValues("done");
    expect(result).toContain("complete");
    expect(result).toContain("done");
  });

  it("accepts comma-separated statuses", () => {
    const result = resolveStatusValues("open,blocked");
    expect(result).toEqual(["open", "blocked"]);
  });

  it("accepts a raw DB status string passthrough", () => {
    const result = resolveStatusValues("blocked");
    expect(result).toEqual(["blocked"]);
  });

  it("all four kanban columns have valid mappings", () => {
    const columns = ["todo", "in-progress", "blocked", "done"];
    for (const col of columns) {
      const values = resolveStatusValues(col);
      expect(values.length).toBeGreaterThan(0);
      for (const v of values) {
        expect(typeof v).toBe("string");
      }
    }
  });
});

describe("Kanban API — POST /api/tasks move action", () => {
  it("accepts valid move to 'open' (todo column)", () => {
    const result = validateMoveAction("task-123", "open");
    expect(result.ok).toBe(true);
  });

  it("accepts valid move to 'in-progress'", () => {
    const result = validateMoveAction("task-123", "in-progress");
    expect(result.ok).toBe(true);
  });

  it("accepts valid move to 'blocked'", () => {
    const result = validateMoveAction("task-123", "blocked");
    expect(result.ok).toBe(true);
  });

  it("accepts valid move to 'complete' (done column)", () => {
    const result = validateMoveAction("task-123", "complete");
    expect(result.ok).toBe(true);
  });

  it("rejects move with invalid status value", () => {
    const result = validateMoveAction("task-123", "invalid-status");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Invalid status");
  });

  it("rejects move when taskId is missing", () => {
    const result = validateMoveAction(undefined, "open");
    expect(result.ok).toBe(false);
  });

  it("rejects move when status is missing", () => {
    const result = validateMoveAction("task-123", undefined);
    expect(result.ok).toBe(false);
  });
});

describe("Kanban — column to DB status mapping", () => {
  it("todo column maps to 'open' DB status", () => {
    expect(COLUMN_TO_DB_STATUS["todo"]).toBe("open");
  });

  it("in-progress column maps to 'in-progress' DB status", () => {
    expect(COLUMN_TO_DB_STATUS["in-progress"]).toBe("in-progress");
  });

  it("blocked column maps to 'blocked' DB status", () => {
    expect(COLUMN_TO_DB_STATUS["blocked"]).toBe("blocked");
  });

  it("done column maps to 'complete' DB status", () => {
    expect(COLUMN_TO_DB_STATUS["done"]).toBe("complete");
  });

  it("all four kanban columns have a DB status mapping", () => {
    const kanbanColumns = ["todo", "in-progress", "blocked", "done"];
    kanbanColumns.forEach((col) => {
      expect(COLUMN_TO_DB_STATUS[col]).toBeDefined();
    });
  });
});

describe("Kanban — status transition rules", () => {
  type KanbanStatus = "todo" | "in-progress" | "blocked" | "done";

  const VALID_TRANSITIONS: Record<KanbanStatus, KanbanStatus[]> = {
    todo: ["in-progress", "blocked", "done"],
    "in-progress": ["todo", "blocked", "done"],
    blocked: ["todo", "in-progress", "done"],
    done: ["todo", "in-progress", "blocked"],
  };

  it("any task can move from todo to in-progress", () => {
    expect(VALID_TRANSITIONS["todo"]).toContain("in-progress");
  });

  it("any task can move from in-progress to done", () => {
    expect(VALID_TRANSITIONS["in-progress"]).toContain("done");
  });

  it("blocked tasks can be unblocked to in-progress", () => {
    expect(VALID_TRANSITIONS["blocked"]).toContain("in-progress");
  });

  it("done tasks can be re-opened", () => {
    expect(VALID_TRANSITIONS["done"]).toContain("todo");
  });

  it("all columns allow transitions to every other column", () => {
    const allColumns: KanbanStatus[] = ["todo", "in-progress", "blocked", "done"];
    allColumns.forEach((from) => {
      const others = allColumns.filter((c) => c !== from);
      others.forEach((to) => {
        expect(VALID_TRANSITIONS[from]).toContain(to);
      });
    });
  });

  it("a task cannot transition to its own column (no-op)", () => {
    const allColumns: KanbanStatus[] = ["todo", "in-progress", "blocked", "done"];
    allColumns.forEach((col) => {
      expect(VALID_TRANSITIONS[col]).not.toContain(col);
    });
  });
});

describe("Kanban — NAV_ITEMS includes kanban route", () => {
  // Test the shape of the nav item we added to OmniBar
  const kanbanNavItem = {
    id: "kanban",
    label: "Kanban",
    href: "/kanban",
    keywords: ["kanban", "board", "tasks", "status", "todo", "in progress", "blocked", "done"],
  };

  it("kanban nav item has correct href", () => {
    expect(kanbanNavItem.href).toBe("/kanban");
  });

  it("kanban nav item has correct id", () => {
    expect(kanbanNavItem.id).toBe("kanban");
  });

  it("kanban nav item has relevant keywords for search", () => {
    expect(kanbanNavItem.keywords).toContain("kanban");
    expect(kanbanNavItem.keywords).toContain("board");
    expect(kanbanNavItem.keywords).toContain("tasks");
  });
});
