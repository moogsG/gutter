import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getJournalDate, shiftJournalDate } from "@/lib/journal-date";
import { fetchCalendarEvents, calendarCache, CALENDAR_ENABLED } from "@/lib/calendar";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import type {
  StatusBoardData,
  StatusCheck,
  StatusDailySignal,
  StatusIncident,
  StatusServiceProbe,
} from "@/types";

const WORKSPACE_ROOT = join(homedir(), ".openclaw", "workspace");
const MEMORY_DIR = join(WORKSPACE_ROOT, "memory");
const NIGHTLY_STATE_PATH = join(MEMORY_DIR, "nightly-initiative-state.json");
const SERVICE_HEALTH_LOG_PATH = join(MEMORY_DIR, "service-health.jsonl");

const GUTTER_WARNING_MS = 1500;
const GUTTER_DOWN_MS = 5000;
const CALENDAR_WARNING_MS = 3000;
const CALENDAR_DOWN_MS = 8000;
const INCIDENT_LOOKBACK = 60;

type ServiceHealthLogEntry = {
  service: "gutter" | "calendar";
  status: "up" | "down";
  timestamp: number;
  error?: string;
};

function getRequestedDate(input: string | null): string {
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  return getJournalDate();
}

function shiftDate(date: string, amount: number): string {
  return shiftJournalDate(date, amount);
}

function formatTimestamp(timestamp: number | null): string | null {
  if (!timestamp) return null;
  return new Date(timestamp).toISOString();
}

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
}

function formatDuration(durationMs: number | null): string {
  if (durationMs === null) return "no timing";
  if (durationMs >= 1000) return `${(durationMs / 1000).toFixed(2)}s`;
  return `${Math.round(durationMs)}ms`;
}

function isSignalLine(line: string): boolean {
  return /alert|down|slow|timeout|failed|unavailable|recovered|degraded/i.test(line);
}

function toSignalSeverity(line: string): "warning" | "info" {
  return /down|slow|timeout|failed|unavailable|degraded/i.test(line) ? "warning" : "info";
}

async function readDailySignals(date: string): Promise<StatusDailySignal[]> {
  const dates = [date, shiftDate(date, -1)];
  const signals = await Promise.all(
    dates.map(async (targetDate) => {
      try {
        const markdown = await readFile(join(MEMORY_DIR, `${targetDate}.md`), "utf8");
        return markdown
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.startsWith("- "))
          .map((line) => line.replace(/^- /, "").trim())
          .filter((line) => isSignalLine(line))
          .map((message) => ({
            date: targetDate,
            source: "memory" as const,
            message,
            severity: toSignalSeverity(message),
          }));
      } catch {
        return [] as StatusDailySignal[];
      }
    }),
  );

  return signals.flat();
}

function parseFailedCalendars(lastError: string | null): string[] {
  if (!lastError) return [];
  return lastError
    .split("|")
    .map((part) => part.trim())
    .map((part) => part.split(":")[0]?.trim())
    .filter(Boolean);
}

function buildHeadline(checks: StatusCheck[], probes: StatusServiceProbe[]): string {
  const downCount = [...checks, ...probes].filter((check) => check.state === "down").length;
  const warningCount = [...checks, ...probes].filter((check) => check.state === "warning").length;

  if (downCount > 0) {
    return `${downCount} support lane${downCount === 1 ? " is" : "s are"} down`;
  }
  if (warningCount > 0) {
    return `${warningCount} support lane${warningCount === 1 ? " needs" : "s need"} a hard stare`;
  }
  return "Support stack is behaving itself for once";
}

async function measureProbe<T>(
  run: () => Promise<T>,
  warningMs: number,
  downMs: number,
): Promise<{ ok: true; durationMs: number; data: T } | { ok: false; durationMs: number; error: string }> {
  const startedAt = performance.now();

  try {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Probe exceeded ${downMs}ms timeout`)), downMs);
    });

    const data = await Promise.race([run(), timeout]);
    return {
      ok: true,
      durationMs: performance.now() - startedAt,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      durationMs: Math.max(performance.now() - startedAt, warningMs),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function probeGutterTasks(): StatusServiceProbe {
  const db = getDb();
  const startedAt = performance.now();

  try {
    const result = db.prepare("SELECT COUNT(*) as total FROM journal_entries WHERE signifier = 'task'").get() as {
      total: number | null;
    };
    const durationMs = performance.now() - startedAt;
    const total = result.total ?? 0;
    const state: StatusServiceProbe["state"] = durationMs > GUTTER_WARNING_MS ? "warning" : "healthy";

    return {
      service: "gutter" as const,
      label: "Live Gutter probe",
      state,
      durationMs,
      thresholdMs: GUTTER_WARNING_MS,
      summary:
        state === "warning"
          ? `Task read worked, but it took ${formatDuration(durationMs)}`
          : `Task read answered in ${formatDuration(durationMs)}`,
      detail: `${total} task row${total === 1 ? "" : "s"} were reachable from the live journal database probe.`,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    const durationMs = performance.now() - startedAt;
    return {
      service: "gutter" as const,
      label: "Live Gutter probe",
      state: "down" as const,
      durationMs,
      thresholdMs: GUTTER_WARNING_MS,
      summary: `Task read blew past the limit at ${formatDuration(durationMs)}`,
      detail: error instanceof Error ? error.message : String(error),
      checkedAt: new Date().toISOString(),
    };
  }
}

async function probeCalendarBridge(requestedDate: string): Promise<{
  result: Awaited<ReturnType<typeof fetchCalendarEvents>>;
  probe: StatusServiceProbe;
}> {
  const result = await measureProbe(
    async () => fetchCalendarEvents(requestedDate, requestedDate),
    CALENDAR_WARNING_MS,
    CALENDAR_DOWN_MS,
  );

  if (!result.ok) {
    return {
      result: { ok: false as const, error: result.error },
      probe: {
        service: "calendar" as const,
        label: "Live calendar probe",
        state: "down" as const,
        durationMs: result.durationMs,
        thresholdMs: CALENDAR_WARNING_MS,
        summary: `Calendar probe timed out at ${formatDuration(result.durationMs)}`,
        detail: result.error,
        checkedAt: new Date().toISOString(),
      },
    };
  }

  const response = result.data;
  if (!response.ok) {
    return {
      result: response,
      probe: {
        service: "calendar" as const,
        label: "Live calendar probe",
        state: "down" as const,
        durationMs: result.durationMs,
        thresholdMs: CALENDAR_WARNING_MS,
        summary: `Calendar probe failed after ${formatDuration(result.durationMs)}`,
        detail: response.error || "Calendar unavailable",
        checkedAt: new Date().toISOString(),
      },
    };
  }

  const state: StatusServiceProbe["state"] =
    result.durationMs > CALENDAR_WARNING_MS || Boolean(calendarCache.lastError) ? "warning" : "healthy";
  const eventCount = response.data?.length ?? 0;

  return {
    result: response,
    probe: {
      service: "calendar" as const,
      label: "Live calendar probe",
      state,
      durationMs: result.durationMs,
      thresholdMs: CALENDAR_WARNING_MS,
      summary: `${eventCount} event${eventCount === 1 ? "" : "s"} loaded in ${formatDuration(result.durationMs)}`,
      detail: calendarCache.lastError
        ? `Calendar answered, but the last read was degraded: ${calendarCache.lastError}`
        : "Calendar answered cleanly on the live probe.",
      checkedAt: new Date().toISOString(),
    },
  };
}

async function readRecentIncidents(): Promise<StatusIncident[]> {
  try {
    const raw = await readFile(SERVICE_HEALTH_LOG_PATH, "utf8");
    const entries = raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ServiceHealthLogEntry)
      .filter((entry) => entry.service === "gutter" || entry.service === "calendar");

    const recentEntries = entries.slice(-INCIDENT_LOOKBACK);
    const incidents: StatusIncident[] = [];
    let previousStatusByService: Partial<Record<ServiceHealthLogEntry["service"], ServiceHealthLogEntry["status"]>> = {};

    for (const entry of recentEntries) {
      const previousStatus = previousStatusByService[entry.service];
      previousStatusByService[entry.service] = entry.status;

      if (previousStatus === entry.status && entry.status === "up") {
        continue;
      }

      incidents.push({
        id: `${entry.service}-${entry.timestamp}`,
        service: entry.service,
        status: entry.status,
        timestamp: new Date(entry.timestamp).toISOString(),
        summary:
          entry.status === "down"
            ? `${entry.service === "gutter" ? "Gutter" : "Calendar"} went down`
            : `${entry.service === "gutter" ? "Gutter" : "Calendar"} recovered`,
        detail: entry.error || "State change recorded by the service-health monitor.",
      });
    }

    return incidents.slice(-8).reverse();
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const limited = rateLimitMiddleware(req, {
    windowMs: 60000,
    maxRequests: 60,
  });
  if (limited) return limited;

  const requestedDate = getRequestedDate(req.nextUrl.searchParams.get("date"));
  const db = getDb();

  const [
    activeCounts,
    doneTodayRow,
    latestTaskRow,
    dailySignals,
    nightlyStateRaw,
    incidents,
    gutterProbe,
    calendarSnapshot,
  ] = await Promise.all([
    Promise.resolve(
      db.prepare(`
        SELECT
          SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as openCount,
          SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as inProgressCount,
          SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blockedCount,
          COUNT(*) as totalActive
        FROM journal_entries
        WHERE signifier = 'task' AND status IN ('open', 'in-progress', 'blocked')
      `).get() as {
        openCount: number | null;
        inProgressCount: number | null;
        blockedCount: number | null;
        totalActive: number | null;
      },
    ),
    Promise.resolve(
      db.prepare(`
        SELECT COUNT(*) as doneToday
        FROM journal_entries
        WHERE signifier = 'task' AND status = 'done' AND date = ?
      `).get(requestedDate) as { doneToday: number | null },
    ),
    Promise.resolve(
      db.prepare(`
        SELECT date, updated_at
        FROM journal_entries
        WHERE signifier = 'task'
        ORDER BY updated_at DESC
        LIMIT 1
      `).get() as { date: string | null; updated_at: string | null } | undefined,
    ),
    readDailySignals(requestedDate),
    readFile(NIGHTLY_STATE_PATH, "utf8").catch(() => null),
    readRecentIncidents(),
    probeGutterTasks(),
    CALENDAR_ENABLED
      ? probeCalendarBridge(requestedDate)
      : Promise.resolve({
          result: { ok: false as const, error: "Calendar integration is disabled" },
          probe: {
            service: "calendar" as const,
            label: "Live calendar probe",
            state: "down" as const,
            durationMs: null,
            thresholdMs: CALENDAR_WARNING_MS,
            summary: "Calendar integration is disabled",
            detail: "No live calendar probe was attempted because the bridge is disabled.",
            checkedAt: new Date().toISOString(),
          },
        }),
  ]);

  const nightlyRecent = nightlyStateRaw
    ? ((JSON.parse(nightlyStateRaw) as { recent?: Array<{ date?: string; topic?: string; status?: string; category?: string }> }).recent || [])
        .filter((entry) => entry.date)
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0]
    : null;

  const calendarResult = calendarSnapshot.result;
  const calendarProbe = calendarSnapshot.probe;
  const calendarEventCount = calendarResult.ok ? calendarResult.data?.length ?? 0 : 0;
  const probes: StatusServiceProbe[] = [gutterProbe, calendarProbe];
  const checks: StatusCheck[] = [];

  checks.push({
    label: "Gutter tasks",
    state: latestTaskRow?.updated_at ? "healthy" : "warning",
    summary: latestTaskRow?.updated_at
      ? `Task database read is working; ${activeCounts.totalActive ?? 0} active task${(activeCounts.totalActive ?? 0) === 1 ? "" : "s"} visible`
      : "Task database answered, but no task writes were found yet",
    detail:
      latestTaskRow?.updated_at
        ? `Latest task write hit the database at ${latestTaskRow.updated_at}. This is a live read check, not a fake progress score.`
        : "A blank task history might be legitimate on a fresh board, but it is not strong enough to call healthy without evidence.",
    checkedAt: new Date().toISOString(),
  });

  if (!CALENDAR_ENABLED) {
    checks.push({
      label: "Calendar bridge",
      state: "disabled",
      summary: "Calendar integration is disabled",
      detail: "No calendar data will appear until accli wiring is enabled again.",
      checkedAt: new Date().toISOString(),
    });
  } else {
    const incidentWarning = incidents.find((incident) => incident.service === "calendar" && incident.status === "down");
    checks.push({
      label: "Calendar bridge",
      state: !calendarResult.ok
        ? "down"
        : calendarCache.lastError || calendarProbe.state === "warning" || Boolean(incidentWarning)
          ? "warning"
          : "healthy",
      summary: calendarResult.ok
        ? `${calendarEventCount} event${calendarEventCount === 1 ? "" : "s"} loaded for ${requestedDate}`
        : "Calendar fetch failed for the requested day",
      detail: calendarResult.ok
        ? incidentWarning
          ? `Recent incident: ${incidentWarning.summary.toLowerCase()} on ${incidentWarning.timestamp}.`
          : calendarCache.lastError
            ? `Partial calendar failure: ${calendarCache.lastError}`
            : "All configured calendars answered on the last read."
        : (calendarResult.error || "Calendar unavailable"),
      checkedAt: formatTimestamp(calendarCache.lastSync),
    });
  }

  checks.push({
    label: "Daily note signals",
    state: dailySignals.some((signal) => signal.severity === "warning") ? "warning" : "healthy",
    summary: dailySignals.length
      ? `${dailySignals.length} signal line${dailySignals.length === 1 ? "" : "s"} surfaced from July 24-25 memory notes`
      : "No recent signal lines found in daily memory",
    detail: dailySignals.length
      ? "The daily notes are carrying support-health context, so the board should not pretend the night was clean."
      : "The last two day notes were clean on support-health signals.",
    checkedAt: new Date().toISOString(),
  });

  checks.push({
    label: "Nightly initiative",
    state:
      nightlyRecent?.status === "completed" &&
      nightlyRecent.date &&
      daysBetween(nightlyRecent.date, requestedDate) <= 2
        ? "healthy"
        : "warning",
    summary: nightlyRecent?.topic
      ? `${nightlyRecent.topic} (${nightlyRecent.status || "unknown"})`
      : "No recent nightly initiative state found",
    detail: nightlyRecent?.date
      ? `Last recorded nightly run: ${nightlyRecent.date}.`
      : "Nightly initiative history file is missing or empty.",
    checkedAt: nightlyRecent?.date ? `${nightlyRecent.date}T00:00:00.000Z` : null,
  });

  const warnings = [
    ...dailySignals.map((signal) => `${signal.date}: ${signal.message}`),
    ...incidents
      .filter((incident) => incident.status === "down")
      .map((incident) => `${incident.service}: ${incident.detail}`),
    ...(calendarCache.lastError && calendarResult.ok ? [`Calendar returned with degraded data: ${calendarCache.lastError}`] : []),
  ];

  const payload: StatusBoardData = {
    requestedDate,
    generatedAt: new Date().toISOString(),
    overall:
      [...checks, ...probes].some((check) => check.state === "down" || check.state === "warning")
        ? "warning"
        : "healthy",
    headline: buildHeadline(checks, probes),
    nextMove:
      probes.some((probe) => probe.service === "calendar" && probe.state === "down")
        ? "Treat the calendar as suspect until the bridge answers cleanly again."
        : dailySignals.some((signal) => signal.severity === "warning")
          ? "Open the July 24, 2026 note first. That is where tonight's trust break actually showed its teeth."
          : incidents.some((incident) => incident.status === "down")
            ? "Review the recent incident trail before trusting a clean morning briefing."
            : "You can use the board tomorrow without wondering whether the support stack is gaslighting you.",
    checks,
    probes,
    incidents,
    warnings,
    tasks: {
      open: activeCounts.openCount ?? 0,
      inProgress: activeCounts.inProgressCount ?? 0,
      blocked: activeCounts.blockedCount ?? 0,
      doneToday: doneTodayRow.doneToday ?? 0,
      totalActive: activeCounts.totalActive ?? 0,
      latestTaskDate: latestTaskRow?.date ?? null,
      latestUpdateAt: latestTaskRow?.updated_at ?? null,
    },
    calendar: {
      enabled: CALENDAR_ENABLED,
      ok: calendarResult.ok,
      eventCount: calendarEventCount,
      failedCalendars: parseFailedCalendars(calendarCache.lastError),
      lastError: calendarCache.lastError,
      lastSyncAt: formatTimestamp(calendarCache.lastSync),
    },
    nightly: {
      date: nightlyRecent?.date ?? null,
      topic: nightlyRecent?.topic ?? null,
      status: nightlyRecent?.status ?? null,
      category: nightlyRecent?.category ?? null,
    },
    dailySignals,
  };

  return NextResponse.json(payload);
}
