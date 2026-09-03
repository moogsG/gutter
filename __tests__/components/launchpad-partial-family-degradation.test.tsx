import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EveningResetBoard } from "@/components/journal/EveningResetBoard";
import { TomorrowLaunchpad } from "@/components/journal/TomorrowLaunchpad";
import type { EveningResetData, TomorrowLaunchpadData } from "@/types";

const queryState = vi.hoisted(() => ({
  tomorrow: null as TomorrowLaunchpadData | null,
  reset: null as EveningResetData | null,
}));

vi.mock("@/components/journal/JournalHeader", () => ({
  JournalHeader: () => <div>Journal header</div>,
}));

vi.mock("@/store/api/tomorrowApi", () => ({
  useGetTomorrowLaunchpadQuery: () => ({
    data: queryState.tomorrow,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/store/api/resetApi", () => ({
  useGetEveningResetQuery: () => ({
    data: queryState.reset,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

const partialFamilySource = {
  state: "not-configured" as const,
  message: "Family planning is partially configured. Add meal-planner to OPENCLAW_WORKSPACE_PATH to load meals.",
  recovery: "configure" as const,
};

beforeEach(() => {
  queryState.tomorrow = {
    sources: {
      focus: { state: "empty", message: "No focus report is available yet.", recovery: null },
      calendar: { state: "empty", message: "No calendar events in this range.", recovery: null },
      family: partialFamilySource,
    },
    requestedDate: "2026-09-03",
    displayDate: "Thursday, September 3",
    generatedAt: "2026-09-02T12:00:00.000Z",
    focus: { pickOne: null, topThree: [], boardLoad: null },
    meetings: [],
    family: {
      dinner: null,
      mealPlan: { displayRange: null, source: "missing", updatedAt: null },
      grocery: { itemCount: 0, sections: [] },
      relationship: {
        status: "drifting",
        headline: null,
        nextEventTitle: null,
        nextEventDate: null,
        nextMove: null,
      },
      chores: {
        cycleNumber: 1,
        remaining: 11,
        suggestedChoices: [
          { id: "bathroom-1", name: "Bathroom 1", label: "A" },
          { id: "bathroom-2", name: "Bathroom 2", label: "B" },
        ],
        nextMove: "Pick one chore.",
      },
      nextMove: "Pick one chore.",
    },
    systemHealth: {
      overall: "warning",
      gutter: { status: "unknown", checkedAt: null },
      calendar: { status: "unknown", checkedAt: null },
    },
  };

  queryState.reset = {
    sources: {
      calendar: { state: "empty", message: "No calendar events in this range.", recovery: null },
      family: partialFamilySource,
    },
    requestedDate: "2026-09-02",
    tomorrowDate: "2026-09-03",
    displayDate: "Wednesday, September 2",
    generatedAt: "2026-09-02T12:00:00.000Z",
    checklist: ["Close the day."],
    today: {
      completedCount: 4,
      leftoverCount: 0,
      carryoverCount: 0,
      wins: [],
      leftovers: [],
    },
    tomorrow: {
      seededCount: 2,
      nonHealthCount: 2,
      healthCount: 0,
      topTasks: [],
      meetings: [],
      dinner: null,
      groceryItemCount: 0,
    },
  };
});

describe("partial family source recovery", () => {
  it("shows meal-planner configuration recovery without hiding Tomorrow chore data", () => {
    render(<TomorrowLaunchpad date="2026-09-03" onDateChange={vi.fn()} />);

    expect(screen.getByText(partialFamilySource.message)).toBeInTheDocument();
    expect(screen.getByText("11 chores left this cycle")).toBeInTheDocument();
    expect(screen.getByText("A: Bathroom 1")).toBeInTheDocument();
  });

  it("shows meal-planner configuration recovery without hiding Reset journal data", () => {
    render(<EveningResetBoard date="2026-09-02" onDateChange={vi.fn()} />);

    expect(screen.getByText(partialFamilySource.message)).toBeInTheDocument();
    expect(screen.getAllByText("4")).not.toHaveLength(0);
    expect(screen.getByText("Close the day.")).toBeInTheDocument();
  });
});
