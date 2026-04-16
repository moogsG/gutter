import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// ─── In-memory cache ────────────────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface SummaryResponse {
  results: PromptResult[];
  totalPrompts: number;
  ranPrompts: number;
}

interface CacheEntry {
  data: SummaryResponse;
  cachedAt: number;
}

const summaryCache = new Map<string, CacheEntry>();

function makeCacheKey(date: string): string {
  return `summary:${date}`;
}

function getFromCache(key: string): CacheEntry | null {
  const entry = summaryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    summaryCache.delete(key);
    return null;
  }
  return entry;
}

function setCache(key: string, data: SummaryResponse): void {
  // Evict old entries if cache grows large
  if (summaryCache.size > 20) summaryCache.clear();
  summaryCache.set(key, { data, cachedAt: Date.now() });
}
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { generateCompletion } from "@/lib/llm-router";
import type { LLMMessage } from "@/lib/llm-router";
import type {
  CalendarWidget,
  DoNextItem,
  DoNextWidget,
  JiraWidget,
  JiraWidgetItem,
  TodayFocusWidget,
  UnresolvedTaskItem,
  UnresolvedTasksWidget,
  WeatherWidget,
} from "@/components/journal/today-focus/widget-types";

interface MorningViewPrompt {
  id: string;
  title: string;
  prompt_text: string;
  source_type: string;
  source_config: string | null;
  ui_config: string | null;
  frequency: string;
  last_run: string | null;
}

function parseUiConfig<T extends object>(raw: string | null, defaults: T): T {
  if (!raw) return defaults;
  try {
    return { ...defaults, ...JSON.parse(raw) } as T;
  } catch {
    return defaults;
  }
}

interface PromptResult {
  prompt: MorningViewPrompt;
  content: string;
  error?: string;
  widget?: TodayFocusWidget;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

interface JournalSummaryRow {
  id: string;
  date: string;
  text: string;
  signifier: string;
  status: string;
  priority: "high" | "normal" | "low" | null;
  lane: string | null;
  waiting_on: string | null;
}

interface JiraSummaryRow {
  key: string;
  summary: string;
  status: string;
  priority: string;
  assignee: string | null;
  url: string;
  updated: string;
}

function formatTaskLine(entry: JournalSummaryRow): string {
  const bits: string[] = [];

  if (entry.priority === "high") bits.push("high");
  if (entry.lane) bits.push(entry.lane);
  if (entry.waiting_on) bits.push(`waiting on ${entry.waiting_on}`);

  return bits.length > 0 ? `- ${entry.text} (${bits.join(", ")})` : `- ${entry.text}`;
}

function buildJournalSummary(entries: JournalSummaryRow[]): string {
  if (entries.length === 0) {
    return "No unresolved items. You're all caught up.";
  }

  const blocked = entries.filter((entry) => entry.status === "blocked");
  const inProgress = entries.filter((entry) => entry.status === "in-progress");
  const open = entries.filter((entry) => entry.status === "open");
  const topNow = open.slice(0, 3);

  const parts: string[] = [];

  if (blocked.length > 0) {
    parts.push(`Blockers (${blocked.length}):\n${blocked.slice(0, 3).map(formatTaskLine).join("\n")}`);
  }

  if (inProgress.length > 0) {
    parts.push(`In progress (${inProgress.length}):\n${inProgress.slice(0, 3).map(formatTaskLine).join("\n")}`);
  }

  if (topNow.length > 0) {
    parts.push(`Top 3 to focus on now:\n${topNow.map(formatTaskLine).join("\n")}`);
  } else if (open.length > 0) {
    parts.push(`Open tasks (${open.length}):\n${open.slice(0, 5).map(formatTaskLine).join("\n")}`);
  }

  const waitingCount = entries.filter((entry) => entry.waiting_on).length;
  if (waitingCount > 0) {
    parts.push(`Tasks waiting on someone or something: ${waitingCount}`);
  }

  return parts.join("\n\n");
}

function jiraPriorityRank(priority: string): number {
  const normalized = priority.toLowerCase();
  if (normalized.includes("highest") || normalized.includes("critical") || normalized.includes("blocker")) return 0;
  if (normalized.includes("high")) return 1;
  if (normalized.includes("medium") || normalized.includes("normal")) return 2;
  if (normalized.includes("low") || normalized.includes("lowest")) return 3;
  return 4;
}

function formatJiraLine(issue: JiraSummaryRow): string {
  return `- ${issue.key} ${issue.summary} [${issue.status}] (${issue.priority})`;
}

function buildJiraSummary(issues: JiraSummaryRow[]): string {
  if (issues.length === 0) {
    return "No assigned Jira issues.";
  }

  const sorted = [...issues].sort((a, b) => {
    const byPriority = jiraPriorityRank(a.priority) - jiraPriorityRank(b.priority);
    if (byPriority !== 0) return byPriority;
    return new Date(b.updated).getTime() - new Date(a.updated).getTime();
  });

  const activeStatuses = ["In Progress", "In Review", "Selected for Development", "To Do", "Blocked"];
  const active = sorted.filter((issue) => activeStatuses.some((status) => issue.status.toLowerCase().includes(status.toLowerCase())));
  const blocked = sorted.filter((issue) => issue.status.toLowerCase().includes("block"));
  const urgent = sorted.filter((issue) => jiraPriorityRank(issue.priority) <= 1).slice(0, 3);
  const topNow = active.slice(0, 3);

  const parts: string[] = [];

  if (urgent.length > 0) {
    parts.push(`Urgent Jira work (${urgent.length}):\n${urgent.map(formatJiraLine).join("\n")}`);
  }

  if (blocked.length > 0) {
    parts.push(`Blocked tickets (${blocked.length}):\n${blocked.slice(0, 3).map(formatJiraLine).join("\n")}`);
  }

  if (topNow.length > 0) {
    parts.push(`Top tickets to keep moving:\n${topNow.map(formatJiraLine).join("\n")}`);
  }

  if (parts.length === 0) {
    parts.push(`Assigned Jira issues (${issues.length}):\n${sorted.slice(0, 5).map(formatJiraLine).join("\n")}`);
  }

  return parts.join("\n\n");
}

function shouldRunToday(prompt: MorningViewPrompt): boolean {
  const { frequency } = prompt;
  const today = new Date();
  const dayOfWeek = today.getDay();

  switch (frequency) {
    case "daily":
      return true;
    case "weekly":
      return dayOfWeek === 1;
    case "weekdays":
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case "weekends":
      return dayOfWeek === 0 || dayOfWeek === 6;
    default:
      return true;
  }
}

function toUnresolvedTaskItem(entry: JournalSummaryRow): UnresolvedTaskItem {
  return {
    id: entry.id,
    text: entry.text,
    status: entry.status as UnresolvedTaskItem["status"],
    priority: entry.priority ?? undefined,
    lane: entry.lane,
    waitingOn: entry.waiting_on,
    date: entry.date,
  };
}

async function buildJournalUnresolvedWidget(prompt: MorningViewPrompt): Promise<UnresolvedTasksWidget> {
  const uiCfg = parseUiConfig(prompt.ui_config, {
    variant: "sections" as const,
    maxItemsPerSection: 3,
    showLane: true,
    showWaitingOn: true,
    showInlineActions: false,
  });
  const maxPer = uiCfg.maxItemsPerSection ?? 3;

  const db = getDb();
  const fetchLimit = maxPer * 3 + 6; // enough rows to fill all three sections
  const unresolved = db.prepare(`
    SELECT id, date, text, signifier, status, priority, lane, waiting_on
    FROM journal_entries 
    WHERE signifier = 'task' AND status IN ('open', 'in-progress', 'blocked')
    ORDER BY 
      CASE status
        WHEN 'blocked' THEN 0
        WHEN 'in-progress' THEN 1
        WHEN 'open' THEN 2
        ELSE 3
      END,
      CASE priority
        WHEN 'high' THEN 0
        WHEN 'normal' THEN 1
        WHEN 'low' THEN 2
        ELSE 3
      END,
      date DESC,
      sort_order ASC
    LIMIT ?
  `).all(fetchLimit) as JournalSummaryRow[];

  const blocked = unresolved.filter((entry) => entry.status === "blocked").slice(0, maxPer).map(toUnresolvedTaskItem);
  const inProgress = unresolved.filter((entry) => entry.status === "in-progress").slice(0, maxPer).map(toUnresolvedTaskItem);
  const topOpen = unresolved.filter((entry) => entry.status === "open").slice(0, maxPer).map(toUnresolvedTaskItem);

  return {
    id: prompt.id,
    type: "journal_unresolved",
    title: prompt.title,
    state: unresolved.length > 0 ? "ready" : "empty",
    data: {
      counts: {
        blocked: unresolved.filter((entry) => entry.status === "blocked").length,
        inProgress: unresolved.filter((entry) => entry.status === "in-progress").length,
        open: unresolved.filter((entry) => entry.status === "open").length,
      },
      blocked,
      inProgress,
      topOpen,
    },
    uiConfig: uiCfg,
  };
}

async function buildCalendarTodayWidget(prompt: MorningViewPrompt): Promise<CalendarWidget> {
  const uiCfg = parseUiConfig(prompt.ui_config, {
    variant: "timeline" as const,
    maxItems: 5,
    showCalendarNames: true,
  });
  const maxItems = uiCfg.maxItems ?? 5;

  const { getTodayEvents } = await import("@/lib/calendar");
  const events = await getTodayEvents();
  const sortedEvents = [...events].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  return {
    id: prompt.id,
    type: "calendar_today",
    title: prompt.title,
    state: sortedEvents.length > 0 ? "ready" : "empty",
    data: {
      totalEvents: sortedEvents.length,
      nextEventStart: sortedEvents[0]?.startDate,
      events: sortedEvents.slice(0, maxItems).map((event) => ({
        id: event.id,
        title: event.summary,
        startDate: event.startDate,
        endDate: event.endDate,
        allDay: event.allDay,
        location: event.location,
        calendar: event.calendar,
      })),
    },
    uiConfig: uiCfg,
  };
}

function fToC(f: number): number {
  return Math.round((f - 32) * 5 / 9);
}

async function buildWeatherWidget(prompt: MorningViewPrompt): Promise<WeatherWidget> {
  const uiCfg = parseUiConfig(prompt.ui_config, {
    variant: "hero" as const,
    showHourly: true,
    hourlyCount: 4,
    unit: "C" as const,
  });
  const hourlyCount = uiCfg.hourlyCount ?? 4;
  const unit = uiCfg.unit ?? "C";

  const response = await withTimeout(
    fetch("https://wttr.in/?format=j1"),
    5000,
    "Weather request"
  );

  if (!response.ok) {
    throw new Error("Weather data unavailable.");
  }

  const data = await response.json();
  const current = data.current_condition?.[0];
  const today = data.weather?.[0];
  const hourly = today?.hourly ?? [];

  // wttr.in always returns Fahrenheit values in numeric fields
  // Normalize to configured unit at build time — renderer is unit-agnostic
  const norm = (f: number) => unit === "C" ? fToC(f) : Math.round(f);

  return {
    id: prompt.id,
    type: "weather",
    title: prompt.title,
    state: current && today ? "ready" : "empty",
    data: {
      currentTemp: norm(Number(current?.temp_F ?? 0)),
      condition: current?.weatherDesc?.[0]?.value ?? "Unknown",
      high: norm(Number(today?.maxtempF ?? 0)),
      low: norm(Number(today?.mintempF ?? 0)),
      rainChance: Number(hourly[4]?.chanceofrain ?? hourly[0]?.chanceofrain ?? 0),
      hourly: uiCfg.showHourly
        ? hourly.slice(0, hourlyCount).map((entry: any) => ({
            time: (() => {
              const raw = String(entry.time ?? "0").padStart(4, "0");
              const hour = Number(raw.slice(0, 2));
              const minute = raw.slice(2, 4);
              const date = new Date();
              date.setHours(hour, Number(minute), 0, 0);
              return date.toLocaleTimeString("en-US", { hour: "numeric" });
            })(),
            temperature: norm(Number(entry.tempF ?? 0)),
            condition: entry.weatherDesc?.[0]?.value ?? "Unknown",
            rainChance: Number(entry.chanceofrain ?? 0),
          }))
        : [],
    },
    uiConfig: uiCfg,
  };
}

async function buildJiraWidget(prompt: MorningViewPrompt): Promise<JiraWidget> {
  const uiCfg = parseUiConfig(prompt.ui_config, {
    variant: "grouped" as const,
    maxItemsPerSection: 3,
    showPriority: true,
    showStatus: true,
  });

  let rawIssues: Array<{ key: string; summary: string; status: string; priority: string; url: string; updated: string }> = [];

  try {
    const { fetchAssignedIssues } = await import("@/lib/jira");
    rawIssues = await withTimeout(fetchAssignedIssues(false), 5000, "Jira widget fetch") as typeof rawIssues;
  } catch {
    // fall through with empty
  }

  function jiraPriorityRankLocal(priority: string): number {
    const p = priority.toLowerCase();
    if (p.includes("highest") || p.includes("critical") || p.includes("blocker")) return 0;
    if (p.includes("high")) return 1;
    if (p.includes("medium") || p.includes("normal")) return 2;
    return 3;
  }

  const sorted = [...rawIssues].sort((a, b) => {
    const byPriority = jiraPriorityRankLocal(a.priority) - jiraPriorityRankLocal(b.priority);
    if (byPriority !== 0) return byPriority;
    return new Date(b.updated).getTime() - new Date(a.updated).getTime();
  });

  const blockedStatuses = ["blocked", "impediment"];
  const activeStatuses = ["in progress", "in review", "selected for development", "to do"];

  const urgent: JiraWidgetItem[] = sorted
    .filter((i) => jiraPriorityRankLocal(i.priority) <= 1)
    .map((i) => ({ ...i, group: "urgent" as const }));

  const blockedItems: JiraWidgetItem[] = sorted
    .filter((i) => blockedStatuses.some((s) => i.status.toLowerCase().includes(s)))
    .map((i) => ({ ...i, group: "blocked" as const }));

  const activeItems: JiraWidgetItem[] = sorted
    .filter(
      (i) =>
        activeStatuses.some((s) => i.status.toLowerCase().includes(s)) &&
        !blockedStatuses.some((s) => i.status.toLowerCase().includes(s)) &&
        jiraPriorityRankLocal(i.priority) > 1
    )
    .map((i) => ({ ...i, group: "active" as const }));

  const totalShown = urgent.length + blockedItems.length + activeItems.length;

  return {
    id: prompt.id,
    type: "jira_assigned",
    title: prompt.title,
    state: totalShown > 0 ? "ready" : "empty",
    data: {
      counts: {
        urgent: urgent.length,
        blocked: blockedItems.length,
        active: activeItems.length,
      },
      urgent,
      blocked: blockedItems,
      active: activeItems,
      totalShown,
    },
    uiConfig: uiCfg,
  };
}

async function buildDoNextWidget(prompt: MorningViewPrompt): Promise<DoNextWidget> {
  const uiCfg = parseUiConfig(prompt.ui_config, {
    variant: "focused" as const,
    maxInProgress: 3,
    maxOpen: 3,
    showLane: true,
  });

  const db = getDb();
  const rows = db.prepare(`
    SELECT id, date, text, signifier, status, priority, lane, waiting_on
    FROM journal_entries
    WHERE signifier = 'task' AND status IN ('in-progress', 'open')
    ORDER BY
      CASE status
        WHEN 'in-progress' THEN 0
        WHEN 'open' THEN 1
        ELSE 2
      END,
      CASE priority
        WHEN 'high' THEN 0
        WHEN 'normal' THEN 1
        WHEN 'low' THEN 2
        ELSE 3
      END,
      date DESC,
      sort_order ASC
    LIMIT 20
  `).all() as JournalSummaryRow[];

  function toDoNextItem(row: JournalSummaryRow): DoNextItem {
    return {
      id: row.id,
      text: row.text,
      status: row.status as "open" | "in-progress",
      priority: row.priority ?? undefined,
      lane: row.lane,
    };
  }

  const inProgress = rows.filter((r) => r.status === "in-progress").slice(0, uiCfg.maxInProgress ?? 3).map(toDoNextItem);
  const topOpen = rows.filter((r) => r.status === "open").slice(0, uiCfg.maxOpen ?? 3).map(toDoNextItem);

  const allInProgress = rows.filter((r) => r.status === "in-progress");
  const allOpen = rows.filter((r) => r.status === "open");

  return {
    id: prompt.id,
    type: "journal_do_next",
    title: prompt.title,
    state: rows.length > 0 ? "ready" : "empty",
    data: {
      inProgress,
      topOpen,
      counts: {
        inProgress: allInProgress.length,
        open: allOpen.length,
      },
    },
    uiConfig: uiCfg,
  };
}

async function buildWidget(prompt: MorningViewPrompt): Promise<TodayFocusWidget | undefined> {
  switch (prompt.source_type) {
    case "journal_unresolved":
      return await buildJournalUnresolvedWidget(prompt);
    case "calendar_today":
      return await buildCalendarTodayWidget(prompt);
    case "weather":
      return await buildWeatherWidget(prompt);
    case "jira_assigned":
      return await buildJiraWidget(prompt);
    case "journal_do_next":
      return await buildDoNextWidget(prompt);
    default:
      return undefined;
  }
}

async function summarizeWidget(widget: TodayFocusWidget, prompt: MorningViewPrompt, sourceData: string): Promise<string | undefined> {
  if (!sourceData && prompt.source_type === "static") {
    return prompt.prompt_text;
  }

  if (sourceData && (!process.env.OLLAMA_URL && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY)) {
    return sourceData;
  }

  const messages: LLMMessage[] = [
    {
      role: "system",
      content: "You are Jynx, generating one concise morning-view section. Be direct, useful, and specific. Prefer concrete priorities, blockers, and next actions over vague encouragement. Keep it to 2 or 3 short sentences max. If the source data is already well structured, lightly compress it instead of rewriting it into generic sludge."
    },
    {
      role: "user",
      content: `${prompt.prompt_text}\n\n${sourceData}`
    }
  ];

  try {
    const completion = await withTimeout(
      generateCompletion({
        messages,
        temperature: 0.7,
        maxTokens: 150
      }),
      10000,
      `LLM generation for ${prompt.title}`
    );

    return completion.content || sourceData || "No content generated.";
  } catch (error) {
    console.error("Error generating content:", error);
    return sourceData || `LLM unavailable: ${prompt.prompt_text}`;
  }
}

async function executePrompt(prompt: MorningViewPrompt): Promise<{ content: string; widget?: TodayFocusWidget }> {
  const db = getDb();
  const { source_type, source_config, prompt_text } = prompt;

  let sourceData = "";
  let widget: TodayFocusWidget | undefined;

  try {
    widget = await buildWidget(prompt);

    switch (source_type) {
      case "journal_unresolved": {
        const unresolved = db.prepare(`
          SELECT id, date, text, signifier, status, priority, lane, waiting_on
          FROM journal_entries 
          WHERE signifier = 'task' AND status IN ('open', 'in-progress', 'blocked')
          ORDER BY 
            CASE status
              WHEN 'blocked' THEN 0
              WHEN 'in-progress' THEN 1
              WHEN 'open' THEN 2
              ELSE 3
            END,
            CASE priority
              WHEN 'high' THEN 0
              WHEN 'normal' THEN 1
              WHEN 'low' THEN 2
              ELSE 3
            END,
            date DESC,
            sort_order ASC
          LIMIT 15
        `).all() as JournalSummaryRow[];
        sourceData = buildJournalSummary(unresolved);
        break;
      }

      case "calendar_today": {
        const { getTodayEvents } = await import("@/lib/calendar");
        const events = await getTodayEvents();
        if (events.length > 0) {
          sourceData = `Today's calendar (${events.length} events):\n${events.map(e => {
            const time = e.allDay ? "All day" : new Date(e.startDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
            return `- ${time}: ${e.summary}${e.location ? ` @ ${e.location}` : ""}`;
          }).join("\n")}`;
        } else {
          sourceData = "No calendar events today. Free day! 📅";
        }
        break;
      }

      case "meeting_prep_today": {
        try {
          const today = new Date().toISOString().split("T")[0];
          const meetings = db.prepare(`
            SELECT title, time, prep_status, prep_notes
            FROM meeting_prep
            WHERE occurrence_date = ?
            ORDER BY time ASC
          `).all(today) as Array<{ title: string; time: string; prep_status: string; prep_notes: string | null }>;

          if (meetings.length > 0) {
            const needsPrep = meetings.filter(m => m.prep_status === "none" || m.prep_status === "partial");
            if (needsPrep.length > 0) {
              sourceData = `Meetings needing prep (${needsPrep.length}):\n${needsPrep.map(m =>
                `- ${m.time ? new Date(`2000-01-01T${m.time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "TBD"}: ${m.title}`
              ).join("\n")}`;
            } else {
              sourceData = `All ${meetings.length} meetings today are prepped! ✅`;
            }
          } else {
            sourceData = "No meetings scheduled for today.";
          }
        } catch (error) {
          console.error("Meeting prep error:", error);
          sourceData = "Meeting prep data unavailable.";
        }
        break;
      }

      case "weather": {
        if (widget?.type === "weather") {
          const unit = widget.uiConfig?.unit ?? "C";
          const sym = `°${unit}`;
          sourceData = `Weather:\n- Current: ${widget.data.currentTemp}${sym}, ${widget.data.condition}\n- High/Low: ${widget.data.high}${sym} / ${widget.data.low}${sym}\n- Rain chance: ${widget.data.rainChance ?? 0}%`;
        } else {
          sourceData = "Weather unavailable.";
        }
        break;
      }

      case "jira_assigned": {
        try {
          const { fetchAssignedIssues } = await import("@/lib/jira");
          const issues = await withTimeout(
            fetchAssignedIssues(false),
            5000,
            "Jira assigned issues"
          );
          sourceData = buildJiraSummary(issues as JiraSummaryRow[]);
        } catch (error) {
          console.error("Jira error:", error);
          sourceData = "Jira unavailable.";
        }
        break;
      }

      case "static":
        sourceData = "";
        break;

      case "custom":
        if (source_config) {
          try {
            const config = JSON.parse(source_config);
            sourceData = `Custom source: ${JSON.stringify(config)}`;
          } catch {
            sourceData = "Invalid source configuration.";
          }
        }
        break;

      default:
        sourceData = "Unknown source type.";
    }
  } catch (error) {
    console.error(`Error gathering data for ${source_type}:`, error);
    sourceData = `Error gathering data: ${error}`;
  }

  const content = await summarizeWidget(widget as TodayFocusWidget, prompt, sourceData);
  return {
    content: content || sourceData || "No content generated.",
    widget,
  };
}

export async function GET(req: NextRequest) {
  const limited = rateLimitMiddleware(req, {
    windowMs: 60000,
    maxRequests: 10,
  });
  if (limited) return limited;

  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";
    const today = new Date().toISOString().split("T")[0];
    const cacheKey = makeCacheKey(today);

    // Return cached result for non-force requests within TTL
    if (!force) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        return NextResponse.json({
          ...cached.data,
          cached: true,
          cachedAt: new Date(cached.cachedAt).toISOString(),
        });
      }
    }

    const allPrompts = db.prepare(`
      SELECT * FROM morning_view_prompts
      WHERE active = 1
      ORDER BY sort_order ASC
    `).all() as MorningViewPrompt[];

    const promptsToRun = force
      ? allPrompts
      : allPrompts.filter(shouldRunToday);

    const results: PromptResult[] = [];

    for (const prompt of promptsToRun) {
      try {
        const result = await withTimeout(
          executePrompt(prompt),
          12000,
          `Prompt ${prompt.id}`
        );
        results.push({
          prompt,
          content: result.content,
          widget: result.widget,
        });

        db.prepare(`
          UPDATE morning_view_prompts 
          SET last_run = datetime('now')
          WHERE id = ?
        `).run(prompt.id);
      } catch (error) {
        console.error(`Error executing prompt ${prompt.id}:`, error);
        results.push({
          prompt,
          content: "",
          error: String(error)
        });
      }
    }

    const responseData: SummaryResponse = {
      results,
      totalPrompts: allPrompts.length,
      ranPrompts: promptsToRun.length,
    };

    // Cache fresh results (always store, even after force=true refresh)
    setCache(cacheKey, responseData);

    return NextResponse.json({
      ...responseData,
      cached: false,
      cachedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating morning view summary:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}
