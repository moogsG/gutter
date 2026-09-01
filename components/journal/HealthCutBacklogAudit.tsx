"use client";

import { AlertTriangle, Clock3, Layers3, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HealthCutBacklogAudit, HealthCutCategory } from "@/types";

const CATEGORY_LABELS: Record<HealthCutCategory, string> = {
  omad: "OMAD",
  workout: "Workout",
  alcohol: "Alcohol",
  prep: "Prep",
  nutrition: "Nutrition",
  other: "Other",
};

export function HealthCutBacklogAuditPanel({
  audit,
  busy,
  onCleanup,
}: {
  audit: HealthCutBacklogAudit;
  busy: boolean;
  onCleanup: (category?: HealthCutCategory) => void;
}) {
  const hasStale = audit.staleCount > 0;
  const hasSafeCleanup = audit.cleanupEligibleCount > 0;

  return (
    <Card className="border-amber-500/20 bg-card/85">
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Backlog Audit
            </CardTitle>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Only older open copies that are safely superseded by today&apos;s prompts should die here. Protected history stays put.
            </p>
          </div>
          {hasSafeCleanup ? (
            <Button size="sm" variant="secondary" onClick={() => onCleanup()} disabled={busy}>
              <Trash2 className="h-4 w-4" />
              {busy ? "Cleaning..." : `Clean ${audit.cleanupEligibleCount} safe open cop${audit.cleanupEligibleCount === 1 ? "y" : "ies"}`}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-4">
          <StatChip icon={Layers3} label="Unresolved total" value={audit.unresolvedCount} />
          <StatChip icon={Trash2} label="Stale copies" value={audit.staleCount} />
          <StatChip icon={Trash2} label="Safe to clean" value={audit.cleanupEligibleCount} />
          <StatChip icon={AlertTriangle} label="Dirty categories" value={audit.categoriesWithStale} />
          <StatChip icon={Clock3} label="Oldest open" value={audit.oldestOpenDays === null ? "clean" : `${audit.oldestOpenDays}d`} />
        </div>

        <div className="rounded-3xl border border-border/60 bg-background/35 p-4">
          <p className="text-sm text-foreground">{audit.nextMove}</p>
        </div>

        {hasStale ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {audit.groups.map((group) => (
              <div key={group.category} className="rounded-3xl border border-border/60 bg-background/35 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{CATEGORY_LABELS[group.category]}</h3>
                      <Badge variant="outline">{group.staleCount} stale</Badge>
                      <Badge variant="outline">{group.cleanupEligibleCount} safe</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {group.unresolvedCount} unresolved total • oldest {group.oldestOpenDate} • newest {group.newestOpenDate}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => onCleanup(group.category)} disabled={busy || group.cleanupEligibleCount === 0}>
                    {group.cleanupEligibleCount > 0 ? `Clean ${group.cleanupEligibleCount}` : "Protected"}
                  </Button>
                </div>

                <div className="mt-3 space-y-2">
                  {group.items.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-border/50 bg-background/50 px-3 py-2">
                      <p className="text-sm text-foreground">{item.text}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.date} • {item.ageDays}d old • {item.status}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-foreground">
            No safe stale open copies to clean. Protected history stays honest.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/35 px-3 py-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold text-foreground">{value}</div>
    </div>
  );
}
