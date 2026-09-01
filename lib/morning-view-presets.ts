import { getDb } from "@/lib/db";

export interface MorningViewPromptRow {
  id: string;
  title: string;
  prompt_text: string;
  source_type: string;
  source_config: string | null;
  ui_config: string | null;
  frequency: string;
  active: number;
  sort_order: number;
}

interface RecommendedPromptSpec {
  id: string;
  title: string;
  promptText: string;
  sourceType: string;
  sourceConfig: string | null;
  frequency: string;
  uiConfig: Record<string, unknown>;
}

export interface RecommendedPromptStatus {
  sourceType: string;
  title: string;
  state: "missing" | "stale" | "ready";
  reason: string;
}

export interface RecommendedStackAudit {
  presetId: "jynx-recommended";
  label: string;
  description: string;
  counts: {
    ready: number;
    stale: number;
    missing: number;
  };
  prompts: RecommendedPromptStatus[];
}

const RECOMMENDED_PROMPTS: RecommendedPromptSpec[] = [
  {
    id: "mvp-recommended-unresolved",
    title: "Unresolved Tasks",
    promptText: "Show the real blockers, active work, and next open tasks without canceled noise or fake urgency.",
    sourceType: "journal_unresolved",
    sourceConfig: null,
    frequency: "daily",
    uiConfig: {
      variant: "grouped",
      maxItemsPerSection: 3,
      showLane: true,
      showWaitingOn: true,
      showInlineActions: false,
      colSpan: 4,
      rowSpan: 1,
      order: 0,
      heightMode: "single",
    },
  },
  {
    id: "mvp-recommended-calendar",
    title: "Today's Calendar",
    promptText: "Show today's calendar events with the next fixed commitments first.",
    sourceType: "calendar_today",
    sourceConfig: null,
    frequency: "daily",
    uiConfig: {
      variant: "timeline",
      maxItems: 5,
      showCalendarNames: true,
      colSpan: 2,
      rowSpan: 1,
      order: 1,
      heightMode: "single",
    },
  },
  {
    id: "mvp-recommended-weather",
    title: "Weather",
    promptText: "Show today's weather in Tulum using Celsius so outdoor plans are easy to judge at a glance.",
    sourceType: "weather",
    sourceConfig: JSON.stringify({ location: "Tulum" }),
    frequency: "daily",
    uiConfig: {
      variant: "hero",
      showHourly: true,
      hourlyCount: 4,
      unit: "C",
      location: "Tulum",
      colSpan: 2,
      rowSpan: 1,
      order: 2,
      heightMode: "single",
    },
  },
  {
    id: "mvp-recommended-do-next",
    title: "What needs moving",
    promptText: "Show the active working set and the next open tasks worth touching so the next move is obvious.",
    sourceType: "journal_do_next",
    sourceConfig: null,
    frequency: "daily",
    uiConfig: {
      variant: "focused",
      maxInProgress: 3,
      maxOpen: 3,
      showLane: true,
      colSpan: 4,
      rowSpan: 1,
      order: 3,
      heightMode: "single",
    },
  },
  {
    id: "mvp-recommended-health-cut",
    title: "Health Cut",
    promptText: "Show today's health cut checkpoints so Moogs can stay on-plan without thinking.",
    sourceType: "health_cut",
    sourceConfig: null,
    frequency: "daily",
    uiConfig: {
      maxItems: 6,
      showCategory: true,
      colSpan: 4,
      rowSpan: 1,
      order: 4,
      heightMode: "single",
    },
  },
];

function normalizeJson(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return JSON.stringify(JSON.parse(raw));
  } catch {
    return raw;
  }
}

function serializeConfig(config: Record<string, unknown>): string {
  return JSON.stringify(config);
}

function getCurrentPromptMap() {
  const db = getDb();
  const prompts = db
    .prepare(
      `
      SELECT id, title, prompt_text, source_type, source_config, ui_config, frequency, active, sort_order
      FROM morning_view_prompts
      ORDER BY sort_order ASC, created_at ASC
      `,
    )
    .all() as MorningViewPromptRow[];

  const bySourceType = new Map<string, MorningViewPromptRow>();
  for (const prompt of prompts) {
    if (!bySourceType.has(prompt.source_type)) {
      bySourceType.set(prompt.source_type, prompt);
    }
  }

  return { prompts, bySourceType };
}

function getPromptState(spec: RecommendedPromptSpec, prompt?: MorningViewPromptRow): RecommendedPromptStatus {
  if (!prompt) {
    return {
      sourceType: spec.sourceType,
      title: spec.title,
      state: "missing",
      reason: "Not installed yet.",
    };
  }

  const expectedUiConfig = serializeConfig(spec.uiConfig);
  const actualUiConfig = normalizeJson(prompt.ui_config);
  const expectedSourceConfig = normalizeJson(spec.sourceConfig);
  const actualSourceConfig = normalizeJson(prompt.source_config);

  const reasons: string[] = [];

  if (prompt.active !== 1) reasons.push("disabled");
  if (prompt.title !== spec.title) reasons.push("title drift");
  if (prompt.prompt_text !== spec.promptText) reasons.push("old copy");
  if (prompt.frequency !== spec.frequency) reasons.push("wrong frequency");
  if (actualSourceConfig !== expectedSourceConfig) reasons.push("source config drift");
  if (actualUiConfig !== expectedUiConfig) reasons.push("layout drift");

  if (reasons.length === 0) {
    return {
      sourceType: spec.sourceType,
      title: spec.title,
      state: "ready",
      reason: "Installed and aligned.",
    };
  }

  return {
    sourceType: spec.sourceType,
    title: spec.title,
    state: "stale",
    reason: reasons.join(", "),
  };
}

export function getRecommendedMorningViewStackAudit(): RecommendedStackAudit {
  const { bySourceType } = getCurrentPromptMap();
  const prompts = RECOMMENDED_PROMPTS.map((spec) => getPromptState(spec, bySourceType.get(spec.sourceType)));

  return {
    presetId: "jynx-recommended",
    label: "Jynx Recommended",
    description:
      "Repair the daily entry stack with five dependable widgets: unresolved work, calendar, weather, do-next focus, and health cut.",
    counts: {
      ready: prompts.filter((prompt) => prompt.state === "ready").length,
      stale: prompts.filter((prompt) => prompt.state === "stale").length,
      missing: prompts.filter((prompt) => prompt.state === "missing").length,
    },
    prompts,
  };
}

export function applyRecommendedMorningViewStack(): RecommendedStackAudit {
  const db = getDb();
  const { prompts, bySourceType } = getCurrentPromptMap();
  const usedIds = new Set<string>();

  RECOMMENDED_PROMPTS.forEach((spec, index) => {
    const existing = bySourceType.get(spec.sourceType);
    const uiConfigJson = serializeConfig(spec.uiConfig);

    if (existing) {
      db.prepare(
        `
        UPDATE morning_view_prompts
        SET title = ?, prompt_text = ?, source_config = ?, frequency = ?, ui_config = ?, active = 1, sort_order = ?, updated_at = datetime('now')
        WHERE id = ?
        `,
      ).run(
        spec.title,
        spec.promptText,
        spec.sourceConfig,
        spec.frequency,
        uiConfigJson,
        index,
        existing.id,
      );
      usedIds.add(existing.id);
      return;
    }

    db.prepare(
      `
      INSERT INTO morning_view_prompts
      (id, title, prompt_text, source_type, source_config, frequency, ui_config, active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      `,
    ).run(
      spec.id,
      spec.title,
      spec.promptText,
      spec.sourceType,
      spec.sourceConfig,
      spec.frequency,
      uiConfigJson,
      index,
    );
    usedIds.add(spec.id);
  });

  const trailingPrompts = prompts
    .filter((prompt) => !usedIds.has(prompt.id))
    .sort((left, right) => left.sort_order - right.sort_order);

  trailingPrompts.forEach((prompt, offset) => {
    db.prepare(
      `
      UPDATE morning_view_prompts
      SET sort_order = ?, updated_at = datetime('now')
      WHERE id = ?
      `,
    ).run(RECOMMENDED_PROMPTS.length + offset, prompt.id);
  });

  return getRecommendedMorningViewStackAudit();
}
