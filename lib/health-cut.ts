import { getDb } from "@/lib/db";
import type {
  HealthCutBacklogAudit,
  HealthCutBacklogGroup,
  HealthCutCategory,
  HealthCutCheckpointSummary,
  HealthCutData,
  HealthCutHistoryDay,
  HealthCutStatus,
} from "@/types";

interface HealthCutRow {
  id: string;
  text: string;
  status: HealthCutStatus;
  tags: string | null;
}

interface HealthMealLogRow {
  id: string;
  text: string;
  created_at: string;
}

interface HealthPrepLockRow {
  id: string;
  text: string;
  created_at: string;
}

interface HealthHistoryRow {
  date: string;
  total: number;
  done: number;
  blocked: number;
  meal_logged: number;
}

interface HealthBacklogRow {
  id: string;
  date: string;
  text: string;
  status: HealthCutStatus;
  tags: string | null;
}

function normalizePromptText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function isCleanupEligible(row: HealthBacklogRow, requestedDate: string, activePromptKeys: Set<string>): boolean {
  if (row.date >= requestedDate) return false;
  if (row.status !== "open") return false;
  const category = getHealthCutCategory(parseHealthCutTags(row.tags));
  return activePromptKeys.has(`${category}::${normalizePromptText(row.text)}`);
}

export function formatCancunIsoDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Cancun",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

export function formatDisplayDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function parseHealthCutTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return [];
  }
}

export function getHealthCutCategory(tags: string[]): HealthCutCategory {
  if (tags.includes("health-cut:omad")) return "omad";
  if (tags.includes("health-cut:workout")) return "workout";
  if (tags.includes("health-cut:alcohol")) return "alcohol";
  if (tags.includes("health-cut:prep")) return "prep";
  if (tags.includes("health-cut:nutrition")) return "nutrition";
  return "other";
}

function buildHistoryLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function shiftIsoDate(date: string, amount: number): string {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + amount);
  return next.toISOString().split("T")[0];
}

function mapCheckpoint(row: HealthCutRow): HealthCutCheckpointSummary {
  const tags = parseHealthCutTags(row.tags);

  return {
    id: row.id,
    text: row.text,
    status: row.status,
    category: getHealthCutCategory(tags),
  };
}

function mapHistoryDay(row: HealthHistoryRow): HealthCutHistoryDay {
  const remaining = Math.max(0, row.total - row.done - row.blocked);

  return {
    date: row.date,
    label: buildHistoryLabel(row.date),
    total: row.total,
    done: row.done,
    remaining,
    blocked: row.blocked,
    mealLogged: row.meal_logged > 0,
  };
}

function getDayDiff(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T12:00:00`);
  const to = new Date(`${toDate}T12:00:00`);
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}

function buildBacklogAudit(date: string, rows: HealthBacklogRow[], activePromptKeys: Set<string>): HealthCutBacklogAudit {
  const relevantRows = rows.filter((row) => row.date <= date);
  const staleRows = relevantRows.filter((row) => row.date < date);
  const grouped = new Map<HealthCutCategory, HealthCutBacklogGroup>();

  for (const row of relevantRows) {
    const category = getHealthCutCategory(parseHealthCutTags(row.tags));
    const existing = grouped.get(category);
    const backlogItem = {
      id: row.id,
      date: row.date,
      text: row.text,
      status: row.status,
      ageDays: getDayDiff(row.date, date),
    };

    if (!existing) {
      grouped.set(category, {
        category,
        unresolvedCount: 1,
        staleCount: row.date < date ? 1 : 0,
        cleanupEligibleCount: isCleanupEligible(row, date, activePromptKeys) ? 1 : 0,
        oldestOpenDate: row.date,
        newestOpenDate: row.date,
        items: [backlogItem],
      });
      continue;
    }

    existing.unresolvedCount += 1;
    existing.staleCount += row.date < date ? 1 : 0;
    existing.cleanupEligibleCount += isCleanupEligible(row, date, activePromptKeys) ? 1 : 0;
    existing.oldestOpenDate =
      existing.oldestOpenDate && existing.oldestOpenDate < row.date
        ? existing.oldestOpenDate
        : row.date;
    existing.newestOpenDate =
      existing.newestOpenDate && existing.newestOpenDate > row.date
        ? existing.newestOpenDate
        : row.date;
    existing.items.push(backlogItem);
  }

  const groups = Array.from(grouped.values())
    .filter((group) => group.staleCount > 0)
    .sort((left, right) => right.staleCount - left.staleCount || right.unresolvedCount - left.unresolvedCount)
    .map((group) => ({
      ...group,
      items: group.items.sort((left, right) => right.ageDays - left.ageDays).slice(0, 6),
    }));

  const oldestOpenDate = staleRows
    .map((row) => row.date)
    .sort()[0] ?? null;
  const oldestOpenDays = oldestOpenDate ? getDayDiff(oldestOpenDate, date) : null;
  const cleanupEligibleCount = staleRows.filter((row) => isCleanupEligible(row, date, activePromptKeys)).length;

  return {
    unresolvedCount: relevantRows.length,
    staleCount: staleRows.length,
    cleanupEligibleCount,
    categoriesWithStale: groups.length,
    oldestOpenDate,
    oldestOpenDays,
    groups,
    nextMove:
      cleanupEligibleCount > 0
        ? "Clean only the older open copies that are safely superseded by today’s active cut prompts."
        : staleRows.length > 0
          ? "Stale cut history exists, but nothing here is safe to auto-kill. Review the old blocked or in-progress rows by hand."
        : "No stale cut sludge detected. Just handle today’s checkpoints honestly.",
  };
}

export function getHealthCutData(date: string): HealthCutData {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, text, status, tags
    FROM journal_entries
    WHERE date = ?
      AND signifier = 'task'
      AND tags LIKE '%health-cut%'
      AND status IN ('open', 'in-progress', 'blocked', 'done')
    ORDER BY
      CASE status
        WHEN 'blocked' THEN 0
        WHEN 'in-progress' THEN 1
        WHEN 'open' THEN 2
        WHEN 'done' THEN 3
        ELSE 4
      END,
      sort_order ASC
  `).all(date) as HealthCutRow[];

  const mealLogRows = db.prepare(`
    SELECT id, text, created_at
    FROM journal_entries
    WHERE date = ?
      AND signifier IN ('note', 'memory')
      AND tags LIKE '%health-log:meal%'
    ORDER BY created_at DESC
  `).all(date) as HealthMealLogRow[];

  const prepLockRows = db.prepare(`
    SELECT id, text, created_at
    FROM journal_entries
    WHERE date = ?
      AND signifier IN ('note', 'memory')
      AND tags LIKE '%health-log:prep%'
    ORDER BY created_at DESC
  `).all(date) as HealthPrepLockRow[];

  const history = db.prepare(`
    SELECT
      date,
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
      SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blocked,
      (
        SELECT COUNT(*)
        FROM journal_entries logs
        WHERE logs.date = tasks.date
          AND logs.tags LIKE '%health-log:meal%'
      ) AS meal_logged
    FROM journal_entries tasks
    WHERE signifier = 'task'
      AND date <= ?
      AND tags LIKE '%health-cut%'
      AND status IN ('open', 'in-progress', 'blocked', 'done')
    GROUP BY date
    ORDER BY date DESC
    LIMIT 7
  `).all(date) as HealthHistoryRow[];

  const backlogRows = db.prepare(`
    SELECT id, date, text, status, tags
    FROM journal_entries
    WHERE signifier = 'task'
      AND tags LIKE '%health-cut%'
      AND status IN ('open', 'in-progress', 'blocked')
    ORDER BY date DESC, sort_order ASC
  `).all() as HealthBacklogRow[];

  const latestMealLog = mealLogRows[0];
  const latestPrepLock = prepLockRows[0];
  const activePromptKeys = new Set(
    rows.map((row) => `${getHealthCutCategory(parseHealthCutTags(row.tags))}::${normalizePromptText(row.text)}`),
  );
  const done = rows.filter((row) => row.status === "done").length;
  const blocked = rows.filter((row) => row.status === "blocked").length;
  const remaining = rows.filter(
    (row) => row.status === "open" || row.status === "in-progress",
  ).length;
  const mode = rows.some((row) =>
    parseHealthCutTags(row.tags).includes("health-mode:weekend"),
  )
    ? "weekend"
    : "cut";

  return {
    requestedDate: date,
    displayDate: formatDisplayDate(date),
    generatedAt: new Date().toISOString(),
    mode,
    counts: {
      done,
      remaining,
      blocked,
      total: rows.length,
    },
    checkpoints: rows.map(mapCheckpoint),
    mealLog: {
      required: rows.some((row) =>
        parseHealthCutTags(row.tags).includes("health-cut:nutrition"),
      ),
      completed: Boolean(latestMealLog),
      prompt:
        mode === "cut"
          ? "Log what you actually ate today before you vanish. Protein, portions, sauces, drinks."
          : "Log the weekend meals honestly. Keep the fun, drop the fiction.",
      entriesCount: mealLogRows.length,
      latestEntry: latestMealLog
        ? {
            id: latestMealLog.id,
            text: latestMealLog.text,
            createdAt: latestMealLog.created_at,
          }
        : undefined,
    },
    prepLock: {
      targetDate: shiftIsoDate(date, 1),
      completed: Boolean(latestPrepLock),
      prompt: "Lock tomorrow's protein before lunch-brain starts negotiating with taco goblins.",
      entriesCount: prepLockRows.length,
      latestEntry: latestPrepLock
        ? {
            id: latestPrepLock.id,
            text: latestPrepLock.text,
            createdAt: latestPrepLock.created_at,
          }
        : undefined,
    },
    history: history.reverse().map(mapHistoryDay),
    audit: buildBacklogAudit(date, backlogRows, activePromptKeys),
  };
}
