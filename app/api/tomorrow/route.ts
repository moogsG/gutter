import type { NextRequest } from "next/server";
import { readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  findSectionLines,
  getDisplayDate,
  getFamilyData,
  getMeetings,
  getRequestedDate,
} from "@/lib/launchpad-data";
import type {
  TomorrowLaunchpadData,
  TomorrowLaunchpadTask,
} from "@/types";

const WORKSPACE_ROOT = join(homedir(), ".openclaw", "workspace");

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

async function readLatestReport(dirName: string): Promise<string | null> {
  const dir = join(WORKSPACE_ROOT, dirName, "reports");
  const files = (await readdir(dir)).filter((file) => file.endsWith(".md")).sort();
  const latest = files.at(-1);
  if (!latest) return null;
  return readFile(join(dir, latest), "utf8");
}

async function getFocusData() {
  const markdown = await readLatestReport("focus-reset");
  if (!markdown) {
    return { pickOne: null, topThree: [], boardLoad: null };
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
    pickOne: pickOne ? parseTaskLine(pickOne) : null,
    topThree,
    boardLoad: {
      open: readCount("Open"),
      inProgress: readCount("In progress"),
      blocked: readCount("Blocked"),
      actionable: readCount("Actionable after filtering"),
    },
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
    const [focus, meetings, family, systemHealth] = await Promise.all([
      getFocusData(),
      getMeetings(requestedDate),
      getFamilyData(requestedDate),
      getSystemHealth(),
    ]);

    const payload: TomorrowLaunchpadData = {
      requestedDate,
      displayDate: getDisplayDate(requestedDate),
      generatedAt: new Date().toISOString(),
      focus,
      meetings,
      family,
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
