import { readFile } from "node:fs/promises";
import { getDb } from "@/lib/db";
import type {
  ProjectRunwayData,
  ProjectRunwayDocProject,
  ProjectRunwayTask,
} from "@/types";

const PROJECTS_DOC_PATH = "/Users/moogs/.openclaw/workspace/PROJECTS.md";

type TaskRow = {
  id: string;
  date: string;
  text: string;
  status: string;
  lane: string | null;
  priority: string | null;
  waiting_on: string | null;
  tags: string | null;
  updated_at: string;
};

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
}

function parseProjectsDoc(markdown: string, requestedDate: string) {
  const lines = markdown.split("\n");
  const updatedMatch = markdown.match(/Last updated:\s*(\d{4}-\d{2}-\d{2})/);
  const lastUpdated = updatedMatch?.[1] ?? null;
  const projects: ProjectRunwayDocProject[] = [];

  let inActiveProjects = false;
  let current: ProjectRunwayDocProject | null = null;
  let currentSection: "recent" | "priorities" | null = null;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      inActiveProjects = line.includes("Active Projects");
      current = null;
      currentSection = null;
      continue;
    }

    if (!inActiveProjects) continue;

    const headingMatch = line.match(/^###\s+(.+?)\s+\|\s+Priority:\s+(.+?)\s+\|\s+Status:\s+(.+)$/);
    if (headingMatch) {
      current = {
        title: headingMatch[1].trim(),
        priority: headingMatch[2].trim(),
        status: headingMatch[3].trim(),
        blocker: null,
        localPath: null,
        recentWork: [],
        currentPriorities: [],
      };
      projects.push(current);
      currentSection = null;
      continue;
    }

    if (!current) continue;

    const trimmed = line.trim();

    if (trimmed.startsWith("- **Local path:**")) {
      current.localPath = trimmed.replace("- **Local path:**", "").trim();
      continue;
    }

    if (trimmed.startsWith("- Repo:")) {
      current.localPath = trimmed.replace("- Repo:", "").trim();
      continue;
    }

    if (trimmed.startsWith("- **Current Blocker:**")) {
      current.blocker = trimmed.replace("- **Current Blocker:**", "").trim();
      continue;
    }

    if (trimmed.startsWith("- **Recent")) {
      currentSection = "recent";
      continue;
    }

    if (trimmed.startsWith("- **Current priorities:**")) {
      currentSection = "priorities";
      continue;
    }

    if (trimmed.startsWith("### ") || trimmed.startsWith("## ")) {
      current = null;
      currentSection = null;
      continue;
    }

    if (trimmed.startsWith("- ") && currentSection === "recent") {
      current.recentWork.push(trimmed.replace("- ", "").trim());
      continue;
    }

    if (trimmed.startsWith("- ") && currentSection === "priorities") {
      current.currentPriorities.push(trimmed.replace("- ", "").trim());
      continue;
    }

    currentSection = null;
  }

  return {
    lastUpdated,
    staleDays: lastUpdated ? daysBetween(lastUpdated, requestedDate) : null,
    projects,
  };
}

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function normalizeTask(row: TaskRow, requestedDate: string): ProjectRunwayTask {
  const tags = parseTags(row.tags);
  return {
    id: row.id,
    title: row.text,
    date: row.date,
    lane: row.lane ?? "unassigned",
    status: row.status,
    priority: row.priority,
    waitingOn: row.waiting_on,
    updatedAt: row.updated_at,
    ageDays: daysBetween(row.date, requestedDate),
    legacy: tags.includes("legacy-task") || tags.some((tag) => tag.startsWith("legacy-project:")),
    tags,
  };
}

export async function buildProjectRunway(requestedDate: string): Promise<ProjectRunwayData> {
  const markdown = await readFile(PROJECTS_DOC_PATH, "utf8");
  const document = parseProjectsDoc(markdown, requestedDate);
  const db = getDb();

  const inProgressRows = db.prepare(`
    SELECT id, date, text, status, lane, priority, waiting_on, tags, updated_at
    FROM journal_entries
    WHERE signifier = 'task'
      AND status = 'in-progress'
    ORDER BY date ASC, updated_at ASC
  `).all() as TaskRow[];

  const laneRows = db.prepare(`
    SELECT
      COALESCE(lane, 'unassigned') as lane,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as openCount,
      SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as inProgressCount,
      SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blockedCount
    FROM journal_entries
    WHERE signifier = 'task'
      AND status IN ('open', 'in-progress', 'blocked')
    GROUP BY COALESCE(lane, 'unassigned')
    ORDER BY inProgressCount DESC, openCount DESC, lane ASC
  `).all() as Array<{
    lane: string;
    openCount: number;
    inProgressCount: number;
    blockedCount: number;
  }>;

  const normalized = inProgressRows.map((row) => normalizeTask(row, requestedDate));
  const staleInProgress = normalized
    .filter((task) => task.legacy || task.ageDays >= 30)
    .sort((a, b) => b.ageDays - a.ageDays)
    .slice(0, 10);

  const currentInProgress = normalized
    .filter((task) => !task.legacy)
    .sort((a, b) => a.ageDays - b.ageDays)
    .slice(0, 6);

  const blockerCount = document.projects.filter((project) => Boolean(project.blocker)).length;
  const legacyCount = normalized.filter((task) => task.legacy).length;

  const headline =
    document.staleDays && document.staleDays > 45
      ? `PROJECTS.md is ${document.staleDays} days stale. The in-progress pile is still very real.`
      : `One place to compare the written plan against the live in-progress mess.`;

  const nextMove =
    staleInProgress.length >= 5
      ? "Start by killing or re-homing the oldest legacy in-progress task. That stale sludge is swallowing the real work signal."
      : blockerCount > 0
        ? "Pick one blocked project from the doc and either change the blocker text into an action or admit it is parked."
        : currentInProgress.length > 0
          ? `Pick one live in-progress task in ${currentInProgress[0].lane} and make it earn its slot.`
          : "The doc is quiet and the task pile is cleaner than expected. Update the written plan before it rots again.";

  return {
    requestedDate,
    generatedAt: new Date().toISOString(),
    headline,
    nextMove,
    document: {
      lastUpdated: document.lastUpdated,
      staleDays: document.staleDays,
      activeProjects: document.projects.length,
      blockerCount,
    },
    documentedProjects: document.projects,
    liveLanes: laneRows.map((row) => ({
      lane: row.lane,
      openCount: row.openCount,
      inProgressCount: row.inProgressCount,
      blockedCount: row.blockedCount,
    })),
    currentInProgress,
    staleInProgress,
    truthGap: {
      liveInProgressCount: normalized.length,
      legacyInProgressCount: legacyCount,
      nonLegacyInProgressCount: Math.max(0, normalized.length - legacyCount),
    },
  };
}
