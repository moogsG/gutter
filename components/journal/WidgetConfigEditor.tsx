"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LayoutFootprintSection } from "./today-focus/LayoutFootprintSection";

type UiConfigState = Record<string, unknown>;

interface WidgetConfigEditorProps {
  sourceType: string;
  uiConfig: UiConfigState;
  onChange: (config: UiConfigState) => void;
}

const WIDGET_SOURCE_TYPES = new Set(["calendar_today", "weather", "journal_unresolved"]);

export function hasWidgetConfig(sourceType: string): boolean {
  return WIDGET_SOURCE_TYPES.has(sourceType);
}

export function defaultUiConfig(sourceType: string): UiConfigState {
  switch (sourceType) {
    case "calendar_today":
      return { variant: "timeline", maxItems: 5, showCalendarNames: true, colSpan: 8, rowSpan: 1, order: 0 };
    case "weather":
      return { variant: "hero", showHourly: true, hourlyCount: 4, colSpan: 8, rowSpan: 1, order: 0 };
    case "journal_unresolved":
      return { variant: "sections", maxItemsPerSection: 3, showLane: true, showWaitingOn: true, showInlineActions: false, colSpan: 8, rowSpan: 1, order: 0 };
    default:
      // Non-widget prompts still get layout defaults
      return { colSpan: 8, rowSpan: 1, order: 0 };
  }
}

function SwitchRow({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function WidgetConfigEditor({ sourceType, uiConfig, onChange }: WidgetConfigEditorProps) {
  const set = (key: string, value: unknown) => onChange({ ...uiConfig, [key]: value });

  if (sourceType === "calendar_today") {
    return (
      <div className="space-y-3">
      <div className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Widget Display</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Variant</Label>
            <select
              value={(uiConfig.variant as string) ?? "timeline"}
              onChange={(e) => set("variant", e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="timeline">Timeline — time-rail with dots</option>
              <option value="agenda">Agenda — rows with metadata</option>
              <option value="compact">Compact — dense pill list</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max Events</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={(uiConfig.maxItems as number) ?? 5}
              onChange={(e) => set("maxItems", Number(e.target.value))}
              className="h-9"
            />
          </div>
        </div>
        <SwitchRow
          label="Show calendar names"
          checked={(uiConfig.showCalendarNames as boolean) ?? true}
          onCheckedChange={(v) => set("showCalendarNames", v)}
        />
      </div>
      <LayoutFootprintSection uiConfig={uiConfig} onChange={onChange} />
      </div>
    );
  }

  if (sourceType === "weather") {
    return (
      <div className="space-y-3">
      <div className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Widget Display</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Variant</Label>
            <select
              value={(uiConfig.variant as string) ?? "hero"}
              onChange={(e) => set("variant", e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="hero">Hero — large temp-first card</option>
              <option value="compact">Compact — tighter two-column</option>
              <option value="minimal">Minimal — single-line summary</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Hourly slots</Label>
            <Input
              type="number"
              min={1}
              max={8}
              value={(uiConfig.hourlyCount as number) ?? 4}
              onChange={(e) => set("hourlyCount", Number(e.target.value))}
              disabled={(uiConfig.showHourly as boolean) === false}
              className="h-9"
            />
          </div>
        </div>
        <SwitchRow
          label="Show hourly forecast"
          checked={(uiConfig.showHourly as boolean) ?? true}
          onCheckedChange={(v) => set("showHourly", v)}
        />
      </div>
      <LayoutFootprintSection uiConfig={uiConfig} onChange={onChange} />
      </div>
    );
  }

  if (sourceType === "journal_unresolved") {
    return (
      <div className="space-y-3">
      <div className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Widget Display</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Variant</Label>
            <select
              value={(uiConfig.variant as string) ?? "sections"}
              onChange={(e) => set("variant", e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="sections">Sections — grouped by status</option>
              <option value="compact">Compact — dense flat list</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Items per section</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={(uiConfig.maxItemsPerSection as number) ?? 3}
              onChange={(e) => set("maxItemsPerSection", Number(e.target.value))}
              className="h-9"
            />
          </div>
        </div>
        <div className="space-y-2">
          <SwitchRow
            label="Show lane badges"
            checked={(uiConfig.showLane as boolean) ?? true}
            onCheckedChange={(v) => set("showLane", v)}
          />
          <SwitchRow
            label="Show waiting-on"
            checked={(uiConfig.showWaitingOn as boolean) ?? true}
            onCheckedChange={(v) => set("showWaitingOn", v)}
          />
          <SwitchRow
            label="Show inline actions"
            checked={(uiConfig.showInlineActions as boolean) ?? false}
            onCheckedChange={(v) => set("showInlineActions", v)}
          />
        </div>
      </div>
      <LayoutFootprintSection uiConfig={uiConfig} onChange={onChange} />
      </div>
    );
  }

  return null;
}
