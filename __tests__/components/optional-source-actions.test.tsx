import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChoreBoard } from "@/components/journal/ChoreBoard";

vi.mock("@/store/api/choresApi", () => ({
  useGetChoreBoardQuery: () => ({
    data: {
      source: {
        state: "not-configured",
        message: "Chores needs an OpenClaw workspace before it can store a cycle.",
        recovery: "configure",
      },
      generatedAt: "2026-09-02T12:00:00.000Z",
      cycleNumber: 0,
      cycleStartedAt: "2026-09-02",
      lastCompletedCycleAt: null,
      counts: { total: 0, completed: 0, remaining: 0 },
      suggestedChoices: [],
      chores: [],
      history: [],
      nextMove: "Set OPENCLAW_WORKSPACE_PATH to enable chore tracking.",
    },
    isLoading: false,
    isFetching: false,
    error: undefined,
    refetch: vi.fn(),
  }),
  useUpdateChoreBoardMutation: () => [vi.fn(), { isLoading: false }],
}));

describe("optional source actions", () => {
  it("disables chore mutations while the workspace is not configured", () => {
    render(<ChoreBoard />);

    expect(screen.getByRole("button", { name: /refresh pair/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /reset cycle/i })).toBeDisabled();
  });
});
