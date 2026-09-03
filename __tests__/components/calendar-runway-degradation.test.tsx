import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarRunwayPanel } from "@/components/journal/CalendarRunwayPanel";

const refetch = vi.fn();

vi.mock("@/store/api/tasksApi", () => ({
  useGetCalendarRunwayQuery: () => ({
    data: {
      source: {
        state: "unavailable",
        message: "Calendar could not be reached. Check the CLI and retry.",
        recovery: "retry",
      },
      displayRange: "Sep 2 - Sep 8",
      busyDays: 0,
      activeEvents: 0,
      conflictCount: 0,
      allDayCount: 0,
      calendarBreakdown: [],
      nextMove: "No calendar events.",
      failedCalendars: [],
      upcomingDays: [],
      conflicts: [],
    },
    isLoading: false,
    error: undefined,
    refetch,
  }),
}));

describe("CalendarRunwayPanel degradation", () => {
  it("shows actionable retry recovery instead of an empty schedule", () => {
    render(<CalendarRunwayPanel date="2026-09-02" />);

    expect(screen.getByText("Calendar could not be reached. Check the CLI and retry.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
