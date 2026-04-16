"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Settings2, Calendar, ListChecks, Cloud, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import type { COL_SPAN_CLASSES } from "./grid-layout";

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

const ROW_BTNS: Array<{ v: 1 | 2; label: string; title: string }> = [
  { v: 1, label: "1×", title: "Normal height" },
  { v: 2, label: "2×", title: "Tall – double height" },
];

export interface GridEditorTileProps {
  id: string;
  title: string;
  sourceType: string;
  active: boolean;
  colSpan: 2 | 4 | 8;
  rowSpan: 1 | 2;
  /** Pre-computed Tailwind col-span class string from COL_SPAN_CLASSES */
  colSpanClass: string;
  /** Pre-computed Tailwind row-span class string from ROW_SPAN_CLASSES */
  rowSpanClass: string;
  onColSpanChange: (v: 2 | 4 | 8) => void;
  onRowSpanChange: (v: 1 | 2) => void;
}

export function GridEditorTile({
  id,
  title,
  sourceType,
  active,
  colSpan,
  rowSpan,
  colSpanClass,
  rowSpanClass,
  onColSpanChange,
  onRowSpanChange,
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
        rowSpanClass,
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

        {/* Height presets */}
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 w-4 shrink-0">
            H
          </span>
          {ROW_BTNS.map(({ v, label, title: ttl }) => (
            <button
              key={v}
              onClick={() => onRowSpanChange(v)}
              title={ttl}
              className={cn(
                "flex-1 rounded text-[10px] py-0.5 leading-tight font-medium transition-colors",
                rowSpan === v
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
