import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionActivityBoard } from "@/components/journal/SessionActivityBoard";

const refetch = vi.fn();

vi.mock("@/components/journal/JournalHeader", () => ({
  JournalHeader: () => <div>Journal header</div>,
}));

vi.mock("@/store/api/sessionsApi", () => ({
  useGetSessionActivityBoardQuery: () => ({
    data: {
      sources: {
        transcripts: {
          state: "not-configured",
          message: "Set OPENCLAW_AGENTS_PATH to load agent transcripts.",
          recovery: "configure",
        },
        memory: {
          state: "unavailable",
          message: "Session activity notes are unavailable. Check the workspace and retry.",
          recovery: "retry",
        },
      },
      requestedDate: "2026-09-02",
      displayDate: "Wednesday, September 2, 2026",
      generatedAt: "2026-09-02T12:00:00.000Z",
      overview: {
        requestedDaySessions: 0,
        requestedDayCronSessions: 0,
        recentSevenDaySessions: 0,
        activeAgents: 0,
      },
      activityReport: null,
      days: [],
      byAgent: [],
      recentSessions: [],
      topCronLabels: [],
      nextMove: "Configure optional session sources to load activity.",
    },
    isLoading: false,
    error: null,
    refetch,
  }),
}));

describe("SessionActivityBoard source recovery", () => {
  it("shows configuration and retry recovery while retaining the empty board", () => {
    render(<SessionActivityBoard date="2026-09-02" onDateChange={vi.fn()} />);

    expect(screen.getByText("Set OPENCLAW_AGENTS_PATH to load agent transcripts.")).toBeInTheDocument();
    expect(screen.getByText("Session activity notes are unavailable. Check the workspace and retry.")).toBeInTheDocument();
    expect(screen.getByText("Wednesday, September 2, 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
