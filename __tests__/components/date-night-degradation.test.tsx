import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateNightBoard } from "@/components/journal/DateNightBoard";

const refetch = vi.fn();

vi.mock("@/components/journal/JournalHeader", () => ({
  JournalHeader: () => <div>Journal header</div>,
}));

vi.mock("@/store/api/dateNightApi", () => ({
  useGetDateNightQuery: () => ({
    data: {
      requestedDate: "2026-09-02",
      displayDate: "Wednesday, September 2, 2026",
      generatedAt: "2026-09-02T12:00:00.000Z",
      status: "drifting",
      headline: "Calendar context is unavailable.",
      warnings: [],
      sources: {
        calendar: {
          state: "unavailable",
          message: "Calendar could not be reached. Check the CLI and retry.",
          recovery: "retry",
        },
        workspace: {
          state: "not-configured",
          message: "Set OPENCLAW_WORKSPACE_PATH to load saved date-night context.",
          recovery: "configure",
        },
      },
      nextEvent: null,
      counts: { upcomingEvents: 0, giftIdeas: 0, prepQuestions: 0 },
      drift: { hasRealDateNight: false, hasCheckInOnly: false, staleGestureDays: null },
      lastGesture: null,
      prep: null,
      partner: { budget: "$200/month", favorites: [], nextMoves: [] },
      giftIdeas: [],
    },
    isLoading: false,
    error: null,
    isFetching: false,
    refetch,
  }),
}));

describe("Date Night source recovery", () => {
  it("shows typed Calendar retry and workspace configuration guidance", () => {
    render(<DateNightBoard date="2026-09-02" onDateChange={vi.fn()} />);

    expect(screen.getByText("Calendar could not be reached. Check the CLI and retry.")).toBeInTheDocument();
    expect(screen.getByText("Set OPENCLAW_WORKSPACE_PATH to load saved date-night context.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
