import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const refetchMeetingPrep = vi.fn();

vi.mock("@/components/journal/JournalHeader", () => ({
  JournalHeader: () => <div>Journal header</div>,
}));

vi.mock("@/components/journal/CalendarRunwayPanel", () => ({
  CalendarRunwayPanel: () => <div>Calendar runway</div>,
}));

vi.mock("@/components/meeting/MeetingDrawer", () => ({
  MeetingDrawer: () => null,
}));

vi.mock("@/store/api/tasksApi", () => ({
  useGetCalendarMonthQuery: () => ({
    data: {
      events: [],
      source: {
        state: "empty",
        message: "No calendar events in this range.",
        recovery: null,
      },
    },
    isLoading: false,
  }),
}));

vi.mock("@/store/api/meetingPrepApi", () => ({
  useGetMeetingPrepQuery: () => ({
    data: {
      meetings: [],
      source: {
        state: "unavailable",
        message: "Calendar could not be reached. Check the CLI and retry.",
        recovery: "retry",
      },
    },
    refetch: refetchMeetingPrep,
  }),
}));

describe("Month meeting-prep degradation", () => {
  it("shows actionable retry recovery instead of treating unavailable prep as empty", async () => {
    const { default: MonthlyLogPage } = await import("@/app/month/page");

    render(<MonthlyLogPage />);

    expect(screen.getByText("Calendar could not be reached. Check the CLI and retry.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetchMeetingPrep).toHaveBeenCalledOnce();
  });
});