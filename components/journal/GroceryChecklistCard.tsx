"use client";

import { CheckCircle2, Circle, RotateCcw, ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MealPlanChecklistSection } from "@/types";

interface GroceryChecklistCardProps {
  checklist: MealPlanChecklistSection[];
  checkedCount: number;
  remainingCount: number;
  isSaving: boolean;
  onToggle: (sectionId: string, item: string, checked: boolean) => void;
  onClear: () => void;
}

export function GroceryChecklistCard({
  checklist,
  checkedCount,
  remainingCount,
  isSaving,
  onToggle,
  onClear,
}: GroceryChecklistCardProps) {
  const totalCount = checkedCount + remainingCount;

  return (
    <Card className="bg-card/85">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingBasket className="h-4 w-4 text-chart-2" />
            Grocery Run
          </CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Check things off as you shop so the list stops resetting inside that pretty skull of his.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-2xl border border-chart-2/20 bg-chart-2/10 px-3 py-2 text-sm text-foreground">
            {checkedCount}/{totalCount} grabbed
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/35 px-3 py-2 text-sm text-muted-foreground">
            {remainingCount} left
          </div>
          <Button variant="outline" className="gap-2" onClick={onClear} disabled={isSaving || checkedCount === 0}>
            <RotateCcw className="h-4 w-4" />
            Clear checks
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {checklist.filter((section) => section.items.length > 0).map((section) => (
          <div key={section.id} className="rounded-3xl border border-border/60 bg-background/35 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">{section.title}</p>
              <p className="text-xs text-muted-foreground">
                {section.checkedCount}/{section.totalCount}
              </p>
            </div>
            <div className="mt-3 space-y-2">
              {section.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left text-sm transition-colors",
                    item.checked
                      ? "border-emerald-500/30 bg-emerald-500/10 text-foreground"
                      : "border-border/60 bg-background/45 text-muted-foreground hover:border-chart-2/30 hover:text-foreground",
                  )}
                  onClick={() => onToggle(section.id, item.label, !item.checked)}
                  disabled={isSaving}
                >
                  {item.checked ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className={cn(item.checked && "line-through decoration-emerald-400/70")}>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
