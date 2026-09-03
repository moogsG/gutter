import type { NextRequest } from "next/server";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  findSectionLines,
  getDisplayDate,
  getFamilyData,
  getMeetings,
  getRequestedDate,
  readLatestWorkspaceReport,
} from "@/lib/launchpad-data";
import { getOpenClawWorkspacePath } from "@/lib/paths";
import type {
  TomorrowLaunchpadData,
  TomorrowLaunchpadTask,
} from "@/types";

const WORKSPACE_ROOT = getOpenClawWorkspacePath();

function parseTaskLine(line: string): TomorrowLaunchpadTask {
  const match = line.match(/^- (.+?) \[([^\]]+)\]\[([^\]]+)\]\[([^\]]+)\]\[([^\]]+)\]$/);
  if (!match) {
    return {
      title: line.replace(/^- /, "").trim(),
      lane: null,
      status: null,
      priority: null,
      staleDays: null,
      raw: line.replace(/^- /, "").trim(),
    };
  }

  const [, title, lane, status, priority, staleToken] = match;
  const staleDaysMatch = staleToken.match(/(\d+)d/);
  return {
    title,
    lane,
    status,
    priority,
    staleDays: staleDaysMatch ? Number.parseInt(staleDaysMatch[1], 10) : null,
    raw: line.replace(/^- /, "").trim(),
  };
}

async function getFocusData() {
  const report = await readLatestWorkspaceReport("focus-reset");
  const markdown = report.markdown;
  if (!markdown) {
    return {
      data: { pickOne: null, topThree: [], boardLoad: null },
      reportState: report.state,
    };
  }

  const pickOne = findSectionLines(markdown, "## Pick One").find((line) => line.startsWith("- "));
  const topThree = findSectionLines(markdown, "## Top Three")
    .filter((line) => line.startsWith("- "))
    .map(parseTaskLine)
    .slice(0, 3);

  const boardLines = findSectionLines(markdown, "## Board Load");
  const readCount = (label: string) => {
    const line = boardLines.find((entry) => entry.startsWith(`- ${label}:`));
    return line ? Number.parseInt(line.split(":")[1].trim(), 10) : 0;
  };

  return {
    data: {
      pickOne: pickOne ? parseTaskLine(pickOne) : null,
      topThree,
      boardLoad: {
        open: readCount("Open"),
        inProgress: readCount("In progress"),
        blocked: readCount("Blocked"),
        actionable: readCount("Actionable after filtering"),
      },
    },
    reportState: report.state,
  };
}

function formatTimestamp(timestamp: number | null | undefined): string | null {
  if (!timestamp) return null;
  return new Date(timestamp).toISOString();
}

async function getSystemHealth(): Promise<TomorrowLaunchpadData["systemHealth"]> {
  try {
    const raw = await readFile(
      join(WORKSPACE_ROOT, "service-health-monitor", "state.json"),
      "utf8",
    );
    const parsed = JSON.parse(raw) as {
      gutter?: { status?: string; lastCheck?: number };
      calendar?: { status?: string; lastCheck?: number };
    };
    const gutter = {
      status: parsed.gutter?.status || "unknown",
      checkedAt: formatTimestamp(parsed.gutter?.lastCheck),
    };
    const calendar = {
      status: parsed.calendar?.status || "unknown",
      checkedAt: formatTimestamp(parsed.calendar?.lastCheck),
    };

    const lastCheck = Math.min(
      parsed.gutter?.lastCheck ?? Number.MAX_SAFE_INTEGER,
      parsed.calendar?.lastCheck ?? Number.MAX_SAFE_INTEGER,
    );
    const isStale = Date.now() - lastCheck > 1000 * 60 * 20;
    const hasWarning = gutter.status !== "up" || calendar.status !== "up";

    return {
      overall: isStale ? "stale" : hasWarning ? "warning" : "healthy",
      gutter,
      calendar,
    };
  } catch {
    return {
      overall: "warning",
      gutter: { status: "unknown", checkedAt: null },
      calendar: { status: "unknown", checkedAt: null },
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const requestedDate = getRequestedDate(new URL(request.url).searchParams.get("date"), "tomorrow");
    const [focus, meetingData, familyData, systemHealth] = await Promise.all([
      getFocusData(),
      getMeetings(requestedDate),
      getFamilyData(requestedDate),
      getSystemHealth(),
    ]);

    const payload: TomorrowLaunchpadData = {
      sources: {
        focus: existsSync(WORKSPACE_ROOT)
          ? focus.reportState === "unavailable"
            ? {
                state: "unavailable",
                message: "Focus reports are unavailable. Check OPENCLAW_WORKSPACE_PATH and retry.",
                recovery: "retry",
              }
            : {
                state: focus.data.pickOne || focus.data.topThree.length > 0 ? "ready" : "empty",
                message: focus.data.pickOne || focus.data.topThree.length > 0 ? "Focus report loaded." : "No focus report is available yet.",
                recovery: null,
              }
          : {
              state: "not-configured",
              message: "Set OPENCLAW_WORKSPACE_PATH to load focus reports.",
              recovery: "configure",
            },
        calendar: meetingData.source,
        family: familyData.source,
      },
      requestedDate,
      displayDate: getDisplayDate(requestedDate),
      generatedAt: new Date().toISOString(),
      focus: focus.data,
      meetings: meetingData.meetings,
      family: familyData.data,
      systemHealth,
    };

    return Response.json(payload);
  } catch (error) {
    console.error("[tomorrow-launchpad] failed to build payload", error);
    return Response.json(
      { error: "Failed to build tomorrow launchpad" },
      { status: 500 },
    );
  }
}
