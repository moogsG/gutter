"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COL_SPAN_LABELS, ROW_SPAN_LABELS } from "./grid-layout";

type UiConfigState = Record<string, unknown>;

interface LayoutFootprintSectionProps {
  uiConfig: UiConfigState;
  onChange: (config: UiConfigState) => void;
}

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm " +
  "ring-offset-background focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-ring focus-visible:ring-offset-2";

export function LayoutFootprintSection({ uiConfig, onChange }: LayoutFootprintSectionProps) {
  const set = (key: string, value: unknown) => onChange({ ...uiConfig, [key]: value });

  const colSpan = (uiConfig.colSpan as number) ?? 8;
  const rowSpan = (uiConfig.rowSpan as number) ?? 1;
  const order = (uiConfig.order as number) ?? 0;

  return (
    <div className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Grid Layout
      </p>

      <div className="grid grid-cols-2 gap-3">
        {/* Width */}
        <div className="space-y-1.5">
          <Label className="text-xs">Width</Label>
          <select
            value={colSpan}
            onChange={(e) => set("colSpan", Number(e.target.value))}
            className={selectCls}
          >
            {(Object.entries(COL_SPAN_LABELS) as [string, string][]).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Height */}
        <div className="space-y-1.5">
          <Label className="text-xs">Height</Label>
          <select
            value={rowSpan}
            onChange={(e) => set("rowSpan", Number(e.target.value))}
            className={selectCls}
          >
            {(Object.entries(ROW_SPAN_LABELS) as [string, string][]).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Order */}
      <div className="space-y-1.5">
        <Label className="text-xs">
          Display order{" "}
          <span className="text-muted-foreground font-normal">(lower = appears first; 0 = use list order)</span>
        </Label>
        <Input
          type="number"
          min={0}
          max={99}
          value={order}
          onChange={(e) => set("order", Number(e.target.value))}
          className="h-9 max-w-[100px]"
          placeholder="0"
        />
      </div>
    </div>
  );
}
