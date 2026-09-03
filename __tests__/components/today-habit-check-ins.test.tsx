import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveCheckIn = vi.fn();
const getHabits = vi.fn();

vi.mock("@/store/api/habitsApi", () => ({
  useGetHabitsMomentumQuery: (...args: unknown[]) => getHabits(...args),
  useSetHabitCheckInMutation: () => [saveCheckIn, { isLoading: false }],
}));

const workout = {
  habitId: "workout",
  label: "Workout / Walk",
  description: "Move for the day.",
  schedule: "daily" as const,
  state: "unlogged" as const,
  suggestion: "A related signal was found. Confirm it yourself.",
};

function dataWith(state: "done" | "skipped" | "unlogged" = "unlogged") {
  return { today: [{ ...workout, state }] };
}

describe("TodayHabitCheckIns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getHabits.mockReturnValue({ data: dataWith(), isLoading: false, error: undefined });
  });

  it("lets a keyboard user directly mark a scheduled habit Done", async () => {
    saveCheckIn.mockReturnValue({ unwrap: async () => ({}) });
    const user = userEvent.setup();
    const { TodayHabitCheckIns } = await import("@/components/journal/TodayHabitCheckIns");
    render(<TodayHabitCheckIns date="2026-09-02" />);

    const done = screen.getByRole("button", { name: "Mark Workout / Walk done" });
    done.focus();
    await user.keyboard("{Enter}");

    expect(saveCheckIn).toHaveBeenCalledWith({ habitId: "workout", date: "2026-09-02", state: "done" });
    expect(done).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/related signal/i)).toBeInTheDocument();
  });

  it("optimistically shows Skipped and restores Unlogged with an actionable error if saving fails", async () => {
    let reject!: (error: Error) => void;
    saveCheckIn.mockReturnValue({
      unwrap: () => new Promise((_, rejectPromise) => { reject = rejectPromise; }),
    });
    const user = userEvent.setup();
    const { TodayHabitCheckIns } = await import("@/components/journal/TodayHabitCheckIns");
    render(<TodayHabitCheckIns date="2026-09-02" />);

    const skipped = screen.getByRole("button", { name: "Mark Workout / Walk skipped or not applicable" });
    await user.click(skipped);
    expect(skipped).toHaveAttribute("aria-pressed", "true");

    reject(new Error("offline"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not save Workout \/ Walk/i));
    expect(screen.getByRole("button", { name: "Leave Workout / Walk unlogged" })).toHaveAttribute("aria-pressed", "true");
  });

  it("uses a wrapping mobile-safe layout and keeps Unlogged explicit", async () => {
    const { TodayHabitCheckIns } = await import("@/components/journal/TodayHabitCheckIns");
    const { container } = render(<TodayHabitCheckIns date="2026-09-02" />);

    expect(screen.getByRole("heading", { name: "Habit check-ins" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave Workout / Walk unlogged" })).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector("[data-testid='habit-actions']")).toHaveClass("flex-wrap");
    expect(container.querySelector("[class*='min-w-[']")).toBeNull();
  });
});
