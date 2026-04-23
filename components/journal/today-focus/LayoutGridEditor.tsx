"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutGrid, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { GridEditorTile } from "./GridEditorTile";
import { COL_SPAN_CLASSES, HEIGHT_MODE_PREVIEW_CLASSES, type HeightMode } from "./grid-layout";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LayoutGridEditorPrompt {
  id: string;
  title: string;
  source_type: string;
  ui_config: string | null;
  active: number;
}

interface DraftItem {
  id: string;
  title: string;
  sourceType: string;
  active: boolean;
  colSpan: 2 | 4 | 8;
  heightMode: HeightMode;
  /** Full parsed ui_config so we preserve display settings on save */
  fullConfig: Record<string, unknown>;
}

interface LayoutGridEditorProps {
  prompts: LayoutGridEditorPrompt[];
  onSaved: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseFullConfig(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
}

function extractLayoutFromConfig(cfg: Record<string, unknown>): {
  colSpan: 2 | 4 | 8;
  heightMode: HeightMode;
  order: number;
} {
  const cs = cfg.colSpan;
  const colSpan = cs === 2 || cs === 4 || cs === 8 ? cs : 8;

  // Resolve heightMode — strict slot model; all legacy fuzzy modes map to "single".
  const hm = cfg.heightMode;
  let heightMode: HeightMode = "single";
  if (hm === "single" || hm === "double") {
    heightMode = hm;
  } else if (hm === "auto" || hm === "tall" || hm === "scroll" || hm === "match-row") {
    // Backward compat: old fuzzy modes → single-slot
    heightMode = "single";
  } else if (cfg.rowSpan === 2) {
    // Backward compat: legacy rowSpan:2 → double-slot
    heightMode = "double";
  }

  return {
    colSpan,
    heightMode,
    order: typeof cfg.order === "number" ? cfg.order : 0,
  };
}

function promptsToDraft(prompts: LayoutGridEditorPrompt[]): DraftItem[] {
  return [...prompts]
    .map((p) => {
      const cfg = parseFullConfig(p.ui_config);
      const layout = extractLayoutFromConfig(cfg);
      return { p, cfg, layout };
    })
    .sort((a, b) => a.layout.order - b.layout.order)
    .map(({ p, cfg, layout }) => ({
      id: p.id,
      title: p.title,
      sourceType: p.source_type,
      active: p.active === 1,
      colSpan: layout.colSpan,
      heightMode: layout.heightMode,
      fullConfig: cfg,
    }));
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LayoutGridEditor({ prompts, onSaved }: LayoutGridEditorProps) {
  const [items, setItems] = useState<DraftItem[]>(() => promptsToDraft(prompts));
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const from = prev.findIndex((i) => i.id === active.id);
      const to = prev.findIndex((i) => i.id === over.id);
      return arrayMove(prev, from, to);
    });
    setIsDirty(true);
  }, []);

  const updateColSpan = useCallback((id: string, v: 2 | 4 | 8) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, colSpan: v } : i)));
    setIsDirty(true);
  }, []);

  const updateHeightMode = useCallback((id: string, v: HeightMode) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, heightMode: v } : i)));
    setIsDirty(true);
  }, []);

  const handleReset = useCallback(() => {
    setItems(promptsToDraft(prompts));
    setIsDirty(false);
  }, [prompts]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Parallel PATCH for every prompt: merge layout fields into full ui_config.
      // heightMode is the source of truth; rowSpan is written for legacy compat.
      await Promise.all(
        items.map((item, idx) => {
          const mergedConfig = {
            ...item.fullConfig,
            colSpan: item.colSpan,
            heightMode: item.heightMode,
            // Legacy field: double-slot maps to rowSpan:2; single-slot uses 1.
            rowSpan: item.heightMode === "double" ? 2 : 1,
            order: idx,
          };
          return fetch("/api/morning-view/prompts", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: item.id,
              sort_order: idx,
              uiConfig: mergedConfig,
            }),
          });
        })
      );
      setIsDirty(false);
      toast.success("Layout saved");
      onSaved();
    } catch {
      toast.error("Failed to save layout");
    } finally {
      setIsSaving(false);
    }
  };

  if (prompts.length === 0) return null;

  return (
    <Card className="bg-card/60 border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-primary/70 shrink-0" />
            <div>
              <CardTitle className="text-base">Layout Editor</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Drag tiles to reorder · W = width · H = height slot (1×=256px / 2×=512px on desktop)
              </p>
            </div>
          </div>

          {isDirty && (
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="sm" onClick={handleReset} disabled={isSaving}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                <span className="hidden sm:inline">Reset</span>
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                <Save className="w-3.5 h-3.5 mr-1.5" />
                {isSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
            {/*
              8-column grid — mirrors the real MorningView board exactly:
                grid-cols-8      same column count
                auto-rows-auto   rows size to content, not equal-fraction heights
                items-start      cells top-align so single/double slots don't stretch each other
              Previously used auto-rows-fr which forced all rows to the same height,
              hiding the visual difference between 1-slot and 2-slot tiles.
            */}
            <div className="grid grid-cols-8 gap-3 auto-rows-auto items-start">
              {items.map((item) => (
                <GridEditorTile
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  sourceType={item.sourceType}
                  active={item.active}
                  colSpan={item.colSpan}
                  heightMode={item.heightMode}
                  colSpanClass={COL_SPAN_CLASSES[item.colSpan]}
                  heightModeClass={HEIGHT_MODE_PREVIEW_CLASSES[item.heightMode]}
                  onColSpanChange={(v) => updateColSpan(item.id, v)}
                  onHeightModeChange={(v) => updateHeightMode(item.id, v)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {!isDirty && (
          <p className="mt-3 text-center text-[11px] text-muted-foreground/40">
            Layout saved · Drag or resize to make changes
          </p>
        )}
      </CardContent>
    </Card>
  );
}
