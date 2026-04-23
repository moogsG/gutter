import type { TodayFocusWidget } from "./widget-types";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Strict desktop slot-height model — two hard fixed-height slots.
 *
 *  "single" – 1 slot: the card is fixed at 256 px on desktop (md+).
 *             Content that overflows the slot scrolls internally.
 *             Mobile: natural content height (no constraint).
 *
 *  "double" – 2 slots: the card is fixed at 512 px on desktop (md+).
 *             Content that overflows the slot scrolls internally.
 *             Mobile: natural content height (no constraint).
 *
 * Backward-compat mapping (resolveHeightMode handles these silently):
 *   "auto"       → "single"
 *   "tall"       → "single"
 *   "scroll"     → "single"
 *   "match-row"  → "single"
 *   rowSpan: 2   → "double"
 */
export type HeightMode = "single" | "double";

/**
 * Layout config stored in ui_config JSON alongside widget display settings.
 *
 * colSpan:    columns occupied in the 8-column grid (2=¼, 4=½, 8=full)
 * heightMode: desktop slot-height — "single" (256 px) or "double" (512 px)
 * order:      explicit display order (lower = earlier); null = use list order
 *
 * Legacy fields kept for backward-compat:
 * rowSpan:    old 1|2 row-span value – resolveHeightMode() maps rowSpan:2 → "double".
 */
export interface WidgetLayoutConfig {
  colSpan?: 2 | 4 | 8;
  heightMode?: HeightMode;
  /** @deprecated use heightMode instead */
  rowSpan?: 1 | 2;
  order?: number;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

/**
 * Infer a sensible default colSpan from widget type + variant.
 *
 * Desktop philosophy (md ≥ 768px):
 *  – weather + calendar_today both default to half-width (colSpan 4) so they
 *    naturally pair side-by-side, leaving room for task widgets below at full width.
 *  – weather minimal is a single line and can sit at quarter-width (colSpan 2).
 *  – task/jira widgets default full-width (colSpan 8) — they are content-heavy.
 *
 * Mobile: colSpan 4 → col-span-8 (full) and colSpan 2 → col-span-8 sm:col-span-4,
 * so mobile is unaffected.
 */
function getDefaultColSpan(widget?: TodayFocusWidget): 2 | 4 | 8 {
  if (!widget) return 8;
  switch (widget.type) {
    case "weather":
      // Minimal is a single line — quarter-width on desktop is fine
      if (widget.uiConfig?.variant === "minimal") return 2;
      // Hero and compact both default to half-width; pairs naturally with calendar
      return 4;
    case "calendar_today":
      // All calendar variants default to half-width so weather can sit alongside
      return 4;
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

/**
 * Resolve heightMode with backward-compat from legacy fields.
 *
 * Current modes:
 *  "single" → 1-slot fixed height (256 px desktop)
 *  "double" → 2-slot fixed height (512 px desktop)
 *
 * Legacy mappings:
 *  1. "auto", "tall", "scroll" (old fuzzy modes) → "single"
 *  2. "match-row" (removed coupling mode) → "single"
 *  3. rowSpan === 2 (old row-span) → "double"
 *  4. Otherwise → "single" (default)
 */
export function resolveHeightMode(
  uiConfig: Record<string, unknown> | null | undefined
): HeightMode {
  const stored = uiConfig?.heightMode;
  // Current valid modes
  if (stored === "single" || stored === "double") return stored;
  // Backward compat: old fuzzy modes all fall back to single-slot
  if (stored === "auto" || stored === "tall" || stored === "scroll" || stored === "match-row") return "single";
  // Backward compat: rowSpan:2 maps to double-slot
  if (uiConfig?.rowSpan === 2) return "double";
  return "single";
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

/**
 * Slot-height classes — desktop-only (all gated behind md: prefix; mobile unaffected).
 *
 *  "single" → md:h-64  = 256 px fixed on desktop. Content that overflows scrolls
 *             internally via md:[&>*]:overflow-y-auto on the Card.
 *
 *  "double" → md:h-[calc(32rem+0.75rem)] = 512 px fixed on desktop. Same overflow handling.
 *
 * How it works:
 *  - The grid cell wrapper gets a hard fixed height via md:h-{n}.
 *  - md:[&>*]:h-full makes the Card child fill the slot completely.
 *  - md:[&>*]:overflow-y-auto lets the Card scroll when content exceeds the slot.
 *  - md:overflow-hidden clips any stray pixel-level overflow at the wrapper level.
 *  - Mobile (< md): no height classes applied → natural content height, no constraints.
 */
export const HEIGHT_MODE_CLASSES: Record<HeightMode, string> = {
  single: "md:h-64 md:overflow-hidden md:[&>*]:h-full md:[&>*]:overflow-y-auto",
  // md:row-span-2 lets the CSS grid engine know this item spans 2 rows so
  // subsequent half-width tiles (e.g. Whats next) can backfill beside it
  // instead of falling below it. The explicit md:h-[calc(32rem+0.75rem)] sets the visual
  // height; the row-span reserves the correct grid real-estate.
  double: "md:row-span-2 md:h-[calc(32rem+0.75rem)] md:overflow-hidden md:[&>*]:h-full md:[&>*]:overflow-y-auto",
};

// ─── Legacy row-span kept for backward compat ─────────────────────────────────

/** @deprecated Not used in the layout renderer – kept for editor backward compat only. */
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

export const HEIGHT_MODE_LABELS: Record<HeightMode, string> = {
  single: "1 slot — fixed 256 px on desktop, scrolls if full",
  double: "2 slots — fixed 512 px on desktop, scrolls if full",
};

/** @deprecated Legacy row-span labels — not shown in UI. Kept for DB migration tools only. */
export const ROW_SPAN_LABELS: Record<1 | 2, string> = {
  1: "Normal height",
  2: "Tall (2×)",
};

/**
 * Preview-only height classes for the layout editor.
 *
 * Applies only the fixed height + overflow clip to editor tiles — the child-fill
 * and child-scroll rules in HEIGHT_MODE_CLASSES (md:[&>*]:h-full etc.) are
 * intentionally omitted because editor tiles contain controls, not real card content.
 * Using these classes keeps the visual size of each tile in parity with the real
 * Today Focus board without distorting the tile's internal control layout.
 *
 *  "single" → md:h-64         (256 px, same as real board single slot)
 *  "double" → md:h-[calc(32rem+0.75rem)]    (512 px, same as real board double slot)
 */
export const HEIGHT_MODE_PREVIEW_CLASSES: Record<HeightMode, string> = {
  single: "md:h-64 md:overflow-hidden",
  // md:row-span-2 mirrors the real board so the editor tile occupies the same
  // two-row footprint and adjacent tiles pack beside it correctly.
  double: "md:row-span-2 md:h-[calc(32rem+0.75rem)] md:overflow-hidden",
};
