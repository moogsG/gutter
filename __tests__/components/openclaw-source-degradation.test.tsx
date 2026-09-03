import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FollowThroughRadar } from "@/components/journal/FollowThroughRadar";
import { LinkedInBoard } from "@/components/journal/LinkedInBoard";
import { ProjectRunwayBoard } from "@/components/journal/ProjectRunwayBoard";

const projectRefetch = vi.fn();
const linkedInRefetch = vi.fn();
const radarRefetch = vi.fn();

vi.mock("@/components/journal/JournalHeader", () => ({
  JournalHeader: () => <div>Journal header</div>,
}));

vi.mock("@/store/api/projectRunwayApi", () => ({
  useGetProjectRunwayQuery: () => ({
    data: {
      source: {
        state: "not-configured",
        message: "Set OPENCLAW_WORKSPACE_PATH to load PROJECTS.md.",
        recovery: "configure",
      },
      requestedDate: "2026-09-02",
      generatedAt: "2026-09-02T12:00:00.000Z",
      headline: "Live project data remains available.",
      nextMove: "Pick one live task.",
      document: { lastUpdated: null, staleDays: null, activeProjects: 0, blockerCount: 0 },
      documentedProjects: [],
      liveLanes: [],
      currentInProgress: [],
      staleInProgress: [],
      truthGap: { liveInProgressCount: 0, legacyInProgressCount: 0, nonLegacyInProgressCount: 0 },
    },
    isLoading: false,
    error: null,
    isFetching: false,
    refetch: projectRefetch,
  }),
}));

vi.mock("@/store/api/linkedinApi", () => ({
  useGetLinkedInBoardQuery: () => ({
    data: {
      source: {
        state: "unavailable",
        message: "LinkedIn planning data is unavailable. Check the workspace and retry.",
        recovery: "retry",
      },
      requestedDate: "2026-09-02",
      generatedAt: "2026-09-02T12:00:00.000Z",
      headline: "LinkedIn planning is temporarily unavailable.",
      nextMove: "Retry the source.",
      postingGapDays: null,
      overview: { totalLoggedPosts: 0, reviewedPosts: 0, draftCount: 0, readyHooks: 0 },
      themeBank: [],
      prompts: [],
      hooks: [],
      angles: [],
      drafts: [],
      postLog: [],
      analyticsPosts: [],
      bestPost: null,
      latestPost: null,
      latestAnalyticsPost: null,
    },
    isLoading: false,
    error: null,
    isFetching: false,
    refetch: linkedInRefetch,
  }),
}));

vi.mock("@/store/api/radarApi", () => ({
  useGetFollowThroughRadarQuery: () => ({
    data: {
      source: {
        state: "not-configured",
        message: "Set OPENCLAW_WORKSPACE_PATH to load tracked promises.",
        recovery: "configure",
      },
      requestedDate: "2026-09-02",
      generatedAt: "2026-09-02T12:00:00.000Z",
      nextMove: "Review the live task queue.",
      counts: {
        pendingPromises: 0,
        overduePromises: 0,
        blocked: 0,
        waiting: 0,
        unresolvedCarryover: 0,
        oldestCarryoverDays: 0,
      },
      sections: { promises: [], stuck: [], carryover: [] },
    },
    isLoading: false,
    error: null,
    isFetching: false,
    refetch: radarRefetch,
  }),
  useUpdateFollowThroughPromiseMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateFollowThroughTaskMutation: () => [vi.fn(), { isLoading: false }],
}));

describe("OpenClaw source recovery", () => {
  it("shows project document configuration guidance while retaining live project data", () => {
    render(<ProjectRunwayBoard date="2026-09-02" onDateChange={vi.fn()} />);

    expect(screen.getByText("Set OPENCLAW_WORKSPACE_PATH to load PROJECTS.md.")).toBeInTheDocument();
    expect(screen.getByText("Live project data remains available.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("shows retry recovery when LinkedIn workspace data is unavailable", () => {
    render(<LinkedInBoard date="2026-09-02" onDateChange={vi.fn()} />);

    expect(screen.getByText("LinkedIn planning data is unavailable. Check the workspace and retry.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(linkedInRefetch).toHaveBeenCalledOnce();
  });

  it("shows promises configuration guidance while retaining live radar data", () => {
    render(<FollowThroughRadar date="2026-09-02" onDateChange={vi.fn()} />);

    expect(screen.getByText("Set OPENCLAW_WORKSPACE_PATH to load tracked promises.")).toBeInTheDocument();
    expect(screen.getByText("Review the live task queue.")).toBeInTheDocument();
  });
});
