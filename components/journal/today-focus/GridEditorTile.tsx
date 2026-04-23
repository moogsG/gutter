"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Settings2, Calendar, ListChecks, Cloud, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HeightMode } from "./grid-layout";
import { HEIGHT_MODE_LABELS } from "./grid-layout";

// Icon map matches source_type values
const SOURCE_ICONS: Record<string, React.ElementType> = {
  static: Settings2,
  journal_unresolved: ListChecks,
  calendar_today: Calendar,
  meeting_prep_today: Calendar,
  weather: Cloud,
  jira_assigned: Briefcase,
};

const COL_BTNS: Array<{ v: 2 | 4 | 8; label: string; title: string }> = [
  { v: 2, label: "¼", title: "Compact – quarter width" },
  { v: 4, label: "½", title: "Half width" },
  { v: 8, label: "■", title: "Full width" },
];

const HEIGHT_BTNS: Array<{ v: HeightMode; label: string; title: string }> = [
  { v: "single", label: "1×", title: HEIGHT_MODE_LABELS.single },
  { v: "double", label: "2×", title: HEIGHT_MODE_LABELS.double },
];

export interface GridEditorTileProps {
  id: string;
  title: string;
  sourceType: string;
  active: boolean;
  colSpan: 2 | 4 | 8;
  heightMode: HeightMode;
  /** Pre-computed Tailwind col-span class string from COL_SPAN_CLASSES */
  colSpanClass: string;
  /**
   * Pre-computed preview height class string from HEIGHT_MODE_PREVIEW_CLASSES.
   * Applies the same fixed desktop height as the real Today Focus board
   * (md:h-64 for single / md:h-[32rem] for double) so the editor tile
   * matches the actual on-board footprint.
   */
  heightModeClass: string;
  onColSpanChange: (v: 2 | 4 | 8) => void;
  onHeightModeChange: (v: HeightMode) => void;
}

export function GridEditorTile({
  id,
  title,
  sourceType,
  active,
  colSpan,
  heightMode,
  colSpanClass,
  heightModeClass,
  onColSpanChange,
  onHeightModeChange,
}: GridEditorTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const Icon = SOURCE_ICONS[sourceType] ?? Settings2;

  // CSS variables for dnd-kit transforms — required at runtime, consumed via className
  const dynamicStyle = {
    "--dnd-t": CSS.Transform.toString(transform) ?? "none",
    "--dnd-tr": transition ?? "",
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={dynamicStyle}
      className={cn(
        colSpanClass,
        // Apply the same fixed desktop height as the real Today Focus board.
        // On mobile (< md) this has no effect — tile collapses to content height,
        // matching the real board's mobile behaviour.
        heightModeClass,
        "relative rounded-xl border-2 bg-card/80 backdrop-blur-sm p-3 select-none",
        "[transform:var(--dnd-t)] [transition:var(--dnd-tr)]",
        isDragging
          ? "border-primary/80 shadow-2xl z-50 opacity-90 scale-[1.02]"
          : "border-border/60 hover:border-border/90 transition-colors",
        !active && "opacity-40 grayscale-[40%]"
      )}
    >
      {/* Drag handle — top-right corner */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground rounded p-0.5"
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Icon + title */}
      <div className="flex items-center gap-2 mb-3 pr-6">
        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-primary/70" />
        </div>
        <p className="text-xs font-semibold truncate text-foreground/90">{title}</p>
      </div>

      {/* Resize controls */}
      <div className="space-y-1">
        {/* Width presets */}
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 w-4 shrink-0">
            W
          </span>
          {COL_BTNS.map(({ v, label, title: ttl }) => (
            <button
              key={v}
              onClick={() => onColSpanChange(v)}
              title={ttl}
              className={cn(
                "flex-1 rounded text-[10px] py-0.5 leading-tight font-medium transition-colors",
                colSpan === v
                  ? "bg-primary/90 text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Height slot presets (desktop-only — mobile always natural height) */}
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 w-4 shrink-0">
            H
          </span>
          {HEIGHT_BTNS.map(({ v, label, title: ttl }) => (
            <button
              key={v}
              onClick={() => onHeightModeChange(v)}
              title={ttl}
              className={cn(
                "flex-1 rounded text-[10px] py-0.5 leading-tight font-medium transition-colors",
                heightMode === v
                  ? "bg-primary/90 text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
