"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COL_SPAN_LABELS, HEIGHT_MODE_LABELS, resolveHeightMode } from "./grid-layout";

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
  const heightMode = resolveHeightMode(uiConfig);
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

        {/* Height slot — desktop only; mobile always natural height */}
        <div className="space-y-1.5">
          <Label className="text-xs">
            Height slot{" "}
            <span className="text-muted-foreground font-normal">(desktop only)</span>
          </Label>
          <select
            value={heightMode}
            onChange={(e) => {
              const v = e.target.value as import("./grid-layout").HeightMode;
              onChange({
                ...uiConfig,
                heightMode: v,
                // Legacy field kept for backward compat
                rowSpan: v === "double" ? 2 : 1,
              });
            }}
            className={selectCls}
          >
            {(Object.entries(HEIGHT_MODE_LABELS) as [string, string][]).map(([val, label]) => (
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

      <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
        <strong className="font-semibold">1 slot</strong> — card is fixed at 256 px on desktop; overflowing content scrolls inside the card.{" "}
        <strong className="font-semibold">2 slots</strong> — card is fixed at 512 px on desktop; same overflow behaviour.
        Mobile always stacks at natural content height — no fixed heights applied on small screens.
      </p>
    </div>
  );
}
