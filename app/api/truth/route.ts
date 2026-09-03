import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error-handler";
import { getDb } from "@/lib/db";
import { getJournalDate } from "@/lib/journal-date";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { getOpenClawWorkspacePath } from "@/lib/paths";
import type { ProjectTruthData, ProjectTruthLiveTask, ProjectTruthProject, ProjectTruthRecurringTask } from "@/types";

const WORKSPACE_ROOT = getOpenClawWorkspacePath();
const MEMORY_DIR = join(WORKSPACE_ROOT, "memory");
const PROJECTS_PATH = join(WORKSPACE_ROOT, "PROJECTS.md");

type TaskRow = {
  id: string;
  date: string;
  text: string;
  status: string;
  lane: string | null;
  priority: string | null;
  waiting_on: string | null;
};

function getRequestedDate(input: string | null): string {
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  return getJournalDate();
}

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
}

function normalizeTaskTitle(line: string): string {
  return line
    .replace(/^-+\s*/, "")
    .replace(/^🔄\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.$/, "");
}

function parseInProgressTasks(markdown: string): string[] {
  const lines = markdown.split("\n");
  const startIndex = lines.findIndex((line) => /^\*\*In Progress \(\d+\):\*\*$/.test(line.trim()));
  if (startIndex === -1) return [];

  const tasks: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    if (line.startsWith("### ")) break;
    if (line.startsWith("**") && !line.startsWith("**In Progress")) break;
    if (line.startsWith("- ")) {
      tasks.push(normalizeTaskTitle(line));
    }
  }

  return tasks;
}

async function getRecentMemoryDates(requestedDate: string, limit = 7): Promise<string[]> {
  const entries = await readdir(MEMORY_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /^\d{4}-\d{2}-\d{2}\.md$/.test(entry.name))
    .map((entry) => entry.name.replace(/\.md$/, ""))
    .filter((date) => date <= requestedDate)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit);
}

async function getRecurringTasks(requestedDate: string): Promise<{ datesReviewed: number; tasks: ProjectTruthRecurringTask[] }> {
  const dates = await getRecentMemoryDates(requestedDate);
  const sightings = new Map<string, string[]>();

  await Promise.all(
    dates.map(async (date) => {
      const raw = await readFile(join(MEMORY_DIR, `${date}.md`), "utf8");
      for (const task of parseInProgressTasks(raw)) {
        const seen = sightings.get(task) || [];
        seen.push(date);
        sightings.set(task, seen);
      }
    }),
  );

  const tasks = Array.from(sightings.entries())
    .filter(([, seenDates]) => seenDates.length >= 2)
    .map(([title, seenDates]) => {
      const ordered = [...seenDates].sort();
      let currentStreakDays = 1;
      for (let index = ordered.length - 1; index > 0; index -= 1) {
        const current = ordered[index];
        const previous = ordered[index - 1];
        if (daysBetween(previous, current) === 1) {
          currentStreakDays += 1;
        } else {
          break;
        }
      }

      return {
        title,
        appearances: ordered.length,
        firstSeen: ordered[0],
        lastSeen: ordered[ordered.length - 1],
        currentStreakDays,
        dates: ordered,
      };
    })
    .sort((a, b) => {
      if (b.currentStreakDays !== a.currentStreakDays) return b.currentStreakDays - a.currentStreakDays;
      return b.appearances - a.appearances;
    });

  return { datesReviewed: dates.length, tasks };
}

async function getProjectDoc(requestedDate: string): Promise<{ lastUpdated: string | null; stale: boolean; ageDays: number | null; projects: ProjectTruthProject[] }> {
  const markdown = await readFile(PROJECTS_PATH, "utf8");
  const lastUpdated = markdown.match(/Last updated:\s*(\d{4}-\d{2}-\d{2})/)?.[1] || null;
  const ageDays = lastUpdated ? daysBetween(lastUpdated, requestedDate) : null;
  const stale = ageDays !== null ? ageDays >= 30 : true;

  const lines = markdown.split("\n");
  const activeIndex = lines.findIndex((line) => line.includes("## 🔴 Active Projects"));
  const projects: ProjectTruthProject[] = [];

  for (let index = activeIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("## ") && index > activeIndex + 1) break;
    if (!line.startsWith("### ")) continue;

    const header = line.replace(/^###\s+/, "").trim();
    const name = header.split("|")[0].trim();
    let status = header.match(/\|\s*Status:\s*([^|]+)/)?.[1]?.trim() || null;
    let priority = header.match(/\|\s*Priority:\s*([^|]+)/)?.[1]?.trim() || null;
    let blocker: string | null = null;

    const block = lines.slice(index + 1, index + 14);
    for (const blockLine of block) {
      if (!priority && blockLine.includes("Priority:")) {
        priority = blockLine.split("Priority:")[1]?.split("|")[0]?.trim() || null;
      }
      if (!status && blockLine.includes("Status:")) {
        status = blockLine.split("Status:")[1]?.trim() || null;
      }
      if (blockLine.startsWith("- **Current Blocker:**")) {
        blocker = blockLine.replace("- **Current Blocker:**", "").trim();
      }
    }

    projects.push({ name, status, priority, blocker });
  }

  return { lastUpdated, stale, ageDays, projects };
}

function normalizeLiveTask(row: TaskRow, requestedDate: string): ProjectTruthLiveTask {
  return {
    id: row.id,
    title: row.text,
    status: row.status,
    lane: row.lane,
    priority: row.priority,
    waitingOn: row.waiting_on,
    date: row.date,
    ageDays: daysBetween(row.date, requestedDate),
  };
}

function getNextMove(projectAgeDays: number | null, recurringCount: number, staleWorkCount: number): string {
  if ((projectAgeDays ?? 999) >= 30 && recurringCount > 0) {
    return "Refresh PROJECTS.md after you either close or rewrite the oldest zombie task. Stop letting stale planning and stale execution protect each other.";
  }
  if (recurringCount > 0) {
    return "Take the oldest recurring task, decide whether it is done, dead, or needs a concrete next step, then update Gutter so tomorrow stops inheriting a lie.";
  }
  if (staleWorkCount > 0) {
    return "Trim the oldest active work item first. A seven-day-old in-progress card is usually a vague wish wearing a status label.";
  }
  return "Nothing major is rotting right now. Try not to ruin it.";
}

export async function GET(req: NextRequest) {
  const limited = rateLimitMiddleware(req, {
    windowMs: 60000,
    maxRequests: 60,
  });
  if (limited) return limited;

  try {
    const requestedDate = getRequestedDate(req.nextUrl.searchParams.get("date"));
    const db = getDb();
    const workspaceConfigured = existsSync(WORKSPACE_ROOT);
    const [projectDocResult, recurringResult] = await Promise.all([
      workspaceConfigured
        ? getProjectDoc(requestedDate)
            .then((data) => ({ data, error: null }))
            .catch(() => ({ data: null, error: "unavailable" as const }))
        : Promise.resolve({ data: null, error: "not-configured" as const }),
      workspaceConfigured
        ? getRecurringTasks(requestedDate)
            .then((data) => ({ data, error: null }))
            .catch(() => ({ data: null, error: "unavailable" as const }))
        : Promise.resolve({ data: null, error: "not-configured" as const }),
    ]);
    const projectDoc = projectDocResult.data || {
      lastUpdated: null,
      stale: true,
      ageDays: null,
      projects: [],
    };
    const recurring = recurringResult.data || { datesReviewed: 0, tasks: [] };

    const staleWorkCountRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM journal_entries
      WHERE signifier = 'task'
        AND lane = 'work'
        AND status IN ('open', 'in-progress', 'blocked', 'review')
        AND date < ?
    `).get(requestedDate) as { count: number };

    const staleWorkRows = db.prepare(`
      SELECT id, date, text, status, lane, priority, waiting_on
      FROM journal_entries
      WHERE signifier = 'task'
        AND lane = 'work'
        AND status IN ('open', 'in-progress', 'blocked', 'review')
        AND date < ?
      ORDER BY date ASC, updated_at ASC
      LIMIT 8
    `).all(requestedDate) as TaskRow[];

    const staleWork = staleWorkRows
      .map((row) => normalizeLiveTask(row, requestedDate))
      .filter((task) => task.ageDays >= 2);

    const notes = [
      projectDoc.stale
        ? `PROJECTS.md is ${projectDoc.ageDays} days old, so it is backdrop, not truth.`
        : "PROJECTS.md is recent enough to trust as a planning source.",
      recurring.tasks.length
        ? `${recurring.tasks.length} in-progress task loop(s) repeated across recent daily memory.`
        : "Recent daily memory did not repeat the same in-progress task twice.",
      staleWorkCountRow.count
        ? `Showing the oldest ${staleWork.length} of ${staleWorkCountRow.count} older work task(s) still active in Gutter.`
        : "No stale work tasks surfaced from the live journal database.",
    ];

    const payload: ProjectTruthData = {
      sources: {
        projectDocument: projectDocResult.error
          ? {
              state: projectDocResult.error,
              message: projectDocResult.error === "not-configured"
                ? "Set OPENCLAW_WORKSPACE_PATH to load PROJECTS.md."
                : "PROJECTS.md is unavailable. Check the workspace and retry.",
              recovery: projectDocResult.error === "not-configured" ? "configure" : "retry",
            }
          : {
              state: projectDoc.projects.length > 0 ? "ready" : "empty",
              message: projectDoc.projects.length > 0 ? "Project document loaded." : "PROJECTS.md has no active projects.",
              recovery: null,
            },
        dailyMemory: recurringResult.error
          ? {
              state: recurringResult.error,
              message: recurringResult.error === "not-configured"
                ? "Set OPENCLAW_WORKSPACE_PATH to review daily memory."
                : "Daily memory is unavailable. Check the workspace and retry.",
              recovery: recurringResult.error === "not-configured" ? "configure" : "retry",
            }
          : {
              state: recurring.datesReviewed > 0 ? "ready" : "empty",
              message: recurring.datesReviewed > 0 ? "Daily memory reviewed." : "No daily memory files were found.",
              recovery: null,
            },
      },
      requestedDate,
      generatedAt: new Date().toISOString(),
      nextMove: getNextMove(projectDoc.ageDays, recurring.tasks.length, staleWork.length),
      counts: {
        activeProjects: projectDoc.projects.length,
        projectDocAgeDays: projectDoc.ageDays,
        recurringTaskCount: recurring.tasks.length,
        staleWorkCount: staleWorkCountRow.count,
        memoryDaysReviewed: recurring.datesReviewed,
      },
      projectDoc: {
        lastUpdated: projectDoc.lastUpdated,
        stale: projectDoc.stale,
        projects: projectDoc.projects,
      },
      recurringTasks: recurring.tasks.slice(0, 6),
      staleWork,
      notes,
    };

    return NextResponse.json(payload);
  } catch (error) {
    return handleApiError("build project truth board", error);
  }
}
