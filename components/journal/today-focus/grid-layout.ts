import type { TodayFocusWidget } from "./widget-types";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Layout config stored in ui_config JSON alongside widget display settings.
 * colSpan: columns occupied in the 8-column grid (2=¼, 4=½, 8=full)
 * rowSpan: height preset (1=normal, 2=tall)
 * order:   explicit display order (lower = earlier); null = use list order
 */
export interface WidgetLayoutConfig {
  colSpan?: 2 | 4 | 8;
  rowSpan?: 1 | 2;
  order?: number;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

/**
 * Infer a sensible default colSpan from widget type + variant.
 * Compact/minimal variants default to half-width; everything else goes full.
 */
function getDefaultColSpan(widget?: TodayFocusWidget): 2 | 4 | 8 {
  if (!widget) return 8;
  switch (widget.type) {
    case "weather":
      return widget.uiConfig?.variant === "minimal" || widget.uiConfig?.variant === "compact"
        ? 4
        : 8;
    case "calendar_today":
      return widget.uiConfig?.variant === "compact" ? 4 : 8;
    case "journal_unresolved":
      return widget.uiConfig?.variant === "compact" ? 4 : 8;
    default:
      return 8;
  }
}

// ─── Resolvers ────────────────────────────────────────────────────────────────

/** Resolve colSpan: explicit config > variant-inferred > 8 (full) */
export function resolveColSpan(
  uiConfig: Record<string, unknown> | null | undefined,
  widget?: TodayFocusWidget
): 2 | 4 | 8 {
  const stored = uiConfig?.colSpan;
  if (stored === 2 || stored === 4 || stored === 8) return stored;
  return getDefaultColSpan(widget);
}

/** Resolve rowSpan: explicit config > 1 (normal) */
export function resolveRowSpan(
  uiConfig: Record<string, unknown> | null | undefined
): 1 | 2 {
  const stored = uiConfig?.rowSpan;
  if (stored === 1 || stored === 2) return stored;
  return 1;
}

/** Resolve explicit order field; returns fallback (list index) if not set */
export function resolveOrder(
  uiConfig: Record<string, unknown> | null | undefined,
  fallback: number
): number {
  const stored = uiConfig?.order;
  return typeof stored === "number" ? stored : fallback;
}

// ─── Tailwind class maps ───────────────────────────────────────────────────────
// Full class strings must be present in source so Tailwind's scanner detects them.

/**
 * Grid column span classes.
 *
 * Responsive behaviour:
 *  colSpan 2 → full on mobile, half on sm (≥640), quarter on md (≥768)
 *  colSpan 4 → full on mobile, half on sm (≥640)
 *  colSpan 8 → always full
 */
export const COL_SPAN_CLASSES: Record<2 | 4 | 8, string> = {
  2: "col-span-8 sm:col-span-4 md:col-span-2",
  4: "col-span-8 sm:col-span-4",
  8: "col-span-8",
};

export const ROW_SPAN_CLASSES: Record<1 | 2, string> = {
  1: "row-span-1",
  2: "row-span-2",
};

// ─── Human-readable labels ────────────────────────────────────────────────────

export const COL_SPAN_LABELS: Record<2 | 4 | 8, string> = {
  2: "Compact (¼ width)",
  4: "Half (½ width)",
  8: "Full width",
};

export const ROW_SPAN_LABELS: Record<1 | 2, string> = {
  1: "Normal height",
  2: "Tall (2×)",
};
