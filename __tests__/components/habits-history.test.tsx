import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getHabits = vi.fn();
vi.mock("@/store/api/habitsApi", () => ({
  useGetHabitsMomentumQuery: (...args: unknown[]) => getHabits(...args),
}));
vi.mock("@/components/journal/JournalHeader", () => ({ JournalHeader: () => <header /> }));

const baseData = {
  requestedDate: "2026-09-02",
  generatedAt: "2026-09-02T12:00:00.000Z",
  windowDays: 14,
  displayRange: "Aug 20 - Sep 2",
  trackerHealth: { mode: "missing", lastUpdated: null, daysStale: null, note: null },
  summary: { trackedDays: 2, missingDays: 12, coveragePercent: 14, strongHabits: 0, slippingHabits: 0 },
  nextMove: "",
  today: [],
  habits: [{ id: "workout", label: "Workout / Walk", description: "Move", hits: 1, trackedDays: 1, currentStreak: 0, bestStreak: 1, hitRate: 100, lastHitDate: "2026-09-01" }],
  days: [
    { date: "2026-08-30", label: "Aug 30", weekday: "Sun", statuses: { workout: "done" } },
    { date: "2026-08-31", label: "Aug 31", weekday: "Mon", statuses: { workout: "skipped" } },
    { date: "2026-09-01", label: "Sep 1", weekday: "Tue", statuses: { workout: "missed" } },
    { date: "2026-09-02", label: "Sep 2", weekday: "Wed", statuses: { workout: "unlogged" } },
  ],
  legacySnapshot: [],
};

describe("Habits history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getHabits.mockReturnValue({ data: baseData, isLoading: false, error: undefined, isFetching: false });
  });

  it("presents history as secondary and distinguishes every policy state", async () => {
    const { HabitsMomentumBoard } = await import("@/components/journal/HabitsMomentumBoard");
    render(<HabitsMomentumBoard date="2026-09-02" onDateChange={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Habit history" })).toBeInTheDocument();
    expect(screen.getByText(/Today is where you check in/i)).toBeInTheDocument();
    for (const label of ["Done", "Skipped", "Missed (explicit policy only)", "Unlogged"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByLabelText("Workout / Walk on Aug 30: Done")).toBeInTheDocument();
    expect(screen.getByLabelText("Workout / Walk on Aug 31: Skipped")).toBeInTheDocument();
    expect(screen.getByLabelText("Workout / Walk on Sep 1: Missed")).toBeInTheDocument();
    expect(screen.getByLabelText("Workout / Walk on Sep 2: Unlogged")).toBeInTheDocument();
    expect(screen.queryByText(/proof|truth board|support stack/i)).not.toBeInTheDocument();
  });

  it("reconciles an empty reporting window without showing 0/0", async () => {
    getHabits.mockReturnValue({
      data: {
        ...baseData,
        summary: { ...baseData.summary, trackedDays: 0, missingDays: 14, coveragePercent: 0 },
        habits: baseData.habits.map((habit) => ({ ...habit, hits: 0, trackedDays: 0, hitRate: 0, lastHitDate: null })),
        days: baseData.days.map((day) => ({ ...day, statuses: { workout: "unlogged" } })),
      },
      isLoading: false,
      error: undefined,
      isFetching: false,
    });
    const { HabitsMomentumBoard } = await import("@/components/journal/HabitsMomentumBoard");
    render(<HabitsMomentumBoard date="2026-09-02" onDateChange={vi.fn()} />);

    expect(screen.getByText("No check-ins from Aug 20 - Sep 2.")).toBeInTheDocument();
    expect(screen.getByText(/14-day reporting window/i)).toBeInTheDocument();
    expect(screen.queryByText(/0\/0/)).not.toBeInTheDocument();
  });
});
