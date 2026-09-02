import { access, open, readdir, stat } from "node:fs/promises";
import { constants as fsConstants, existsSync } from "node:fs";
import { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { getJournalDate, shiftJournalDate } from "@/lib/journal-date";
import { getOpenClawAgentsPath, getOpenClawWorkspacePath } from "@/lib/paths";
import type {
  OptionalSourceState,
  SessionActivityBoardData,
  SessionActivityDay,
  SessionActivityReport,
  SessionActivitySession,
} from "@/types";

const AGENTS_ROOT = getOpenClawAgentsPath();
const WORKSPACE_ROOT = getOpenClawWorkspacePath();
const MEMORY_ROOT = join(WORKSPACE_ROOT, "memory");
const LOOKBACK_DAYS = 7;
const RECENT_SESSION_LIMIT = 16;
const HEAD_BYTES = 524288;

type RawActivityReport = Pick<SessionActivityReport, "date" | "reportedActive" | "line">;

function getRequestedDate(input: string | null): string {
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  return getJournalDate();
}

function shiftDate(date: string, amount: number): string {
  return shiftJournalDate(date, amount);
}

function getDisplayDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function readFileHead(path: string): Promise<string> {
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(HEAD_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.toString("utf8", 0, bytesRead);
  } finally {
    await handle.close();
  }
}

function parseTitle(lines: string[]): string {
  const pickMeaningfulLine = (text: string): string | null => {
    const boringPatterns = [
      /^Filesystem sandboxing defines/i,
      /^Approval policy is currently never/i,
      /^You are /i,
      /^# AGENTS\.md instructions/i,
      /^<recommended_plugins>/i,
      /^Here is a list of plugins/i,
      /^<environment_context>/i,
      /^<permissions instructions>/i,
      /^<\/.+>$/i,
      /^The current date is /i,
      /^## /,
      /^### /,
    ];

    const candidates = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => {
        if (line.startsWith("{") || line.startsWith("```")) return false;
        if (boringPatterns.some((pattern) => pattern.test(line))) return false;
        return true;
      });

    const preferred =
      candidates.find((line) => line.startsWith("[cron:")) ||
      candidates.find((line) => line.startsWith("A scheduled reminder")) ||
      candidates.find((line) => /^(Run|Build|Fix|Review|Create|Send|Check|Nightly|Morning|Midday|Evening)\b/.test(line));

    return preferred || candidates.at(-1) || null;
  };

  for (const line of lines.slice(1, 12)) {
    try {
      const parsed = JSON.parse(line) as Record<string, any>;
      if (parsed.type === "response_item" && parsed.payload?.type === "message") {
        const text = parsed.payload?.content?.find((item: any) => item.type === "input_text")?.text;
        if (typeof text === "string" && text.trim()) {
          const meaningful = pickMeaningfulLine(text);
          if (meaningful) return meaningful.slice(0, 140);
        }
      }

      if (parsed.type === "event_msg" && typeof parsed.payload?.message === "string" && parsed.payload.message.trim()) {
        const meaningful = pickMeaningfulLine(parsed.payload.message);
        if (meaningful) return meaningful.slice(0, 140);
      }
    } catch {
      continue;
    }
  }

  return "Untitled session";
}

function parseCronLabel(title: string): string | null {
  const match = title.match(/^\[cron:[^\]]+\s+([^\]]+)\]/);
  return match ? match[1].trim() : null;
}

function cleanTitle(title: string): string {
  const cronMatch = title.match(/^\[cron:[^\]]+\s+([^\]]+)\]\s*(.*)$/);
  if (cronMatch) {
    return cronMatch[1].trim();
  }
  return title;
}

async function readSessionSummary(agentId: string, date: string, fileName: string): Promise<SessionActivitySession> {
  const [year, month, day] = date.split("-");
  const filePath = join(AGENTS_ROOT, agentId, "agent", "codex-home", "sessions", year, month, day, fileName);

  const [fileHead, fileStats] = await Promise.all([readFileHead(filePath), stat(filePath)]);
  const lines = fileHead.split("\n").filter(Boolean);
  if (!lines.length) throw new Error(`Transcript is empty: ${filePath}`);

  const meta = JSON.parse(lines[0]) as Record<string, any>;
  const payload = meta.payload ?? {};
  const title = parseTitle(lines);
  const cronLabel = parseCronLabel(title);

  return {
    id: payload.session_id || payload.id || fileName.replace(/\.jsonl$/, ""),
    agentId,
    date,
    title: cleanTitle(title),
    category: cronLabel ? "cron" : "manual",
    cronLabel,
    startedAt: payload.timestamp || meta.timestamp || new Date(fileStats.mtimeMs).toISOString(),
    updatedAt: new Date(fileStats.mtimeMs).toISOString(),
    model: payload.model_provider || "unknown",
    source: payload.source || payload.originator || "unknown",
    transcriptPath: filePath,
  };
}

async function listAgentIds(): Promise<{ agentIds: string[]; source: OptionalSourceState }> {
  try {
    const entries = await readdir(AGENTS_ROOT, { withFileTypes: true });
    const agentIds = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    return {
      agentIds,
      source: {
        state: agentIds.length > 0 ? "ready" : "empty",
        message: agentIds.length > 0 ? "Agent transcripts loaded." : "No agent transcript sources found.",
        recovery: null,
      },
    };
  } catch {
    const notConfigured = !existsSync(AGENTS_ROOT);
    return {
      agentIds: [],
      source: {
        state: notConfigured ? "not-configured" : "unavailable",
        message: notConfigured
          ? "Set OPENCLAW_AGENTS_PATH to load agent transcripts."
          : "Agent transcripts are unavailable. Check the agents path and retry.",
        recovery: notConfigured ? "configure" : "retry",
      },
    };
  }
}

async function collectSessionsForDate(agentIds: string[], date: string): Promise<SessionActivitySession[]> {
  const [year, month, day] = date.split("-");
  const sessions = await Promise.all(
    agentIds.map(async (agentId) => {
      const dateDir = join(AGENTS_ROOT, agentId, "agent", "codex-home", "sessions", year, month, day);
      if (!(await pathExists(dateDir))) return [] as SessionActivitySession[];

      const files = (await readdir(dateDir))
        .filter((file) => file.endsWith(".jsonl"))
        .sort();

      return Promise.all(files.map((file) => readSessionSummary(agentId, date, file)));
    }),
  );

  return sessions.flat();
}

async function readActivityReports(targetDates: string[]): Promise<{
  reports: RawActivityReport[];
  source: OptionalSourceState;
}> {
  try {
    await access(MEMORY_ROOT, fsConstants.R_OK);
  } catch {
    const notConfigured = !existsSync(WORKSPACE_ROOT);
    return {
      reports: [],
      source: {
        state: notConfigured ? "not-configured" : "unavailable",
        message: notConfigured
          ? "Set OPENCLAW_WORKSPACE_PATH to load session activity notes."
          : "Session activity notes are unavailable. Check the workspace and retry.",
        recovery: notConfigured ? "configure" : "retry",
      },
    };
  }

  let reports: Array<RawActivityReport | null>;
  try {
    reports = await Promise.all(
      targetDates.map(async (date) => {
        try {
          const markdown = await open(join(MEMORY_ROOT, `${date}.md`), "r");
          try {
            const head = await markdown.readFile({ encoding: "utf8" });
            const lines = head.split("\n").map((entry) => entry.trim());
            let reportedActive: number | null = null;

            for (let index = 0; index < lines.length - 1; index += 1) {
              if (lines[index] !== "### Activity") continue;
              const match = lines[index + 1]?.match(/^(\d+)\s+active session\(s\)$/);
              if (match) {
                reportedActive = Number.parseInt(match[1], 10);
              }
            }

            if (reportedActive === null) return null;

            return {
              date,
              reportedActive,
              line: `Activity ${reportedActive} active session(s)`,
            } satisfies RawActivityReport;
          } finally {
            await markdown.close();
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
          throw error;
        }
      }),
    );
  } catch {
    return {
      reports: [],
      source: {
        state: "unavailable",
        message: "Session activity notes are unavailable. Check the workspace and retry.",
        recovery: "retry",
      },
    };
  }

  const availableReports = reports.filter((report): report is SessionActivityReport => Boolean(report));
  return {
    reports: availableReports,
    source: {
      state: availableReports.length > 0 ? "ready" : "empty",
      message: availableReports.length > 0 ? "Session activity notes loaded." : "No session activity notes found.",
      recovery: null,
    },
  };
}

function summarizeDays(dates: string[], sessionsByDate: Map<string, SessionActivitySession[]>): SessionActivityDay[] {
  return dates.map((date) => {
    const sessions = sessionsByDate.get(date) || [];
    return {
      date,
      label: new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      totalSessions: sessions.length,
      cronSessions: sessions.filter((session) => session.category === "cron").length,
      uniqueAgents: new Set(sessions.map((session) => session.agentId)).size,
    };
  });
}

function buildNextMove(
  requestedDay: SessionActivityDay,
  activityReport: SessionActivityReport | null,
  transcriptsSource: OptionalSourceState,
  memorySource: OptionalSourceState,
): string {
  if (transcriptsSource.state === "unavailable") {
    return "Agent transcripts are unavailable. Check the agents path and retry before trusting session totals.";
  }
  if (transcriptsSource.state === "not-configured") {
    return "Configure OPENCLAW_AGENTS_PATH to load session evidence.";
  }
  if (memorySource.state === "unavailable") {
    return "Session activity notes are unavailable. Check the workspace and retry before trusting activity comparisons.";
  }
  if (memorySource.state === "not-configured") {
    return "Configure OPENCLAW_WORKSPACE_PATH to compare session evidence with activity notes.";
  }
  if (activityReport && activityReport.date === requestedDay.date && requestedDay.totalSessions === 0) {
    return "The daily note claimed session activity, but the Codex transcript lane is empty for that date. Audit the logger before you trust the number.";
  }
  if (activityReport && activityReport.date === requestedDay.date && activityReport.reportedActive > Math.max(40, requestedDay.totalSessions * 4)) {
    return "The reported activity count is wildly higher than the transcript evidence. Treat that metric like gossip until the source is fixed.";
  }
  if (activityReport && activityReport.date !== requestedDay.date) {
    return `No transcript sessions were found for ${requestedDay.date} yet. The latest activity note is from ${activityReport.date}, where the board recorded ${activityReport.observedSessions} transcript sessions against a reported ${activityReport.reportedActive}.`;
  }
  if (requestedDay.cronSessions > requestedDay.totalSessions * 0.7 && requestedDay.totalSessions > 0) {
    return "Most of the load is cron chatter, not Moogs doing thirty-seven things at once. Good. The machine is the noisy one.";
  }
  if (requestedDay.totalSessions > 24) {
    return "This was a genuinely busy session day. If the support stack keeps feeling loud, trim duplicate cron work before adding more helpers.";
  }
  return "Session load looks readable. Use this board when the support stack starts waving fake huge numbers around again.";
}

export async function GET(req: NextRequest) {
  const limited = rateLimitMiddleware(req, {
    windowMs: 60000,
    maxRequests: 40,
  });
  if (limited) return limited;

  try {
    const requestedDate = getRequestedDate(req.nextUrl.searchParams.get("date"));
    const dates = Array.from({ length: LOOKBACK_DAYS }, (_, index) => shiftDate(requestedDate, -index));
    const { agentIds, source: agentsSource } = await listAgentIds();
    let transcriptsSource = agentsSource;
    let sessionsPerDate: SessionActivitySession[][] = dates.map(() => []);

    if (agentsSource.state === "ready") {
      try {
        sessionsPerDate = await Promise.all(dates.map((date) => collectSessionsForDate(agentIds, date)));
        const hasSessions = sessionsPerDate.some((sessions) => sessions.length > 0);
        transcriptsSource = {
          state: hasSessions ? "ready" : "empty",
          message: hasSessions ? "Agent transcripts loaded." : "No agent transcripts found.",
          recovery: null,
        };
      } catch {
        transcriptsSource = {
          state: "unavailable",
          message: "Agent transcripts are unavailable. Check the agents path and retry.",
          recovery: "retry",
        };
      }
    }

    const sessionsByDate = new Map(dates.map((date, index) => [date, sessionsPerDate[index] || []]));
    const allSessions = sessionsPerDate.flat().sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const days = summarizeDays(dates, sessionsByDate);
    const requestedDay = days[0];
    const { reports: activityReports, source: memorySource } = await readActivityReports(dates);
    const rawActivityReport = activityReports.find((report) => report.date === requestedDate) || activityReports[0] || null;
    const activityReport = rawActivityReport
      ? {
          ...rawActivityReport,
          observedSessions: (sessionsByDate.get(rawActivityReport.date) || []).length,
          delta: rawActivityReport.reportedActive - (sessionsByDate.get(rawActivityReport.date) || []).length,
        }
      : null;

    const agentEntries = Array.from(
      allSessions.reduce((map, session) => {
        map.set(session.agentId, (map.get(session.agentId) || 0) + 1);
        return map;
      }, new Map<string, number>()),
    );

    const byAgent = agentEntries
      .map(([agentId, count]) => ({
        agentId,
        count,
        cronCount: allSessions.filter((session) => session.agentId === agentId && session.category === "cron").length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const topCronLabels = Array.from(
      allSessions.reduce((map, session) => {
        if (session.cronLabel) {
          map.set(session.cronLabel, (map.get(session.cronLabel) || 0) + 1);
        }
        return map;
      }, new Map<string, number>()),
    )
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const payload: SessionActivityBoardData = {
      sources: {
        transcripts: transcriptsSource,
        memory: memorySource,
      },
      requestedDate,
      displayDate: getDisplayDate(requestedDate),
      generatedAt: new Date().toISOString(),
      overview: {
        requestedDaySessions: requestedDay.totalSessions,
        requestedDayCronSessions: requestedDay.cronSessions,
        recentSevenDaySessions: allSessions.length,
        activeAgents: agentEntries.length,
      },
      activityReport: activityReport
        ? {
            ...activityReport,
          }
        : null,
      days,
      byAgent,
      recentSessions: allSessions.slice(0, RECENT_SESSION_LIMIT),
      topCronLabels,
      nextMove: buildNextMove(requestedDay, activityReport, transcriptsSource, memorySource),
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[session-activity] failed to build board", error);
    return NextResponse.json({ error: "Failed to build session board" }, { status: 500 });
  }
}
