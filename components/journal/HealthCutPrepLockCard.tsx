"use client";

import Link from "next/link";
import { Loader2, NotebookPen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { HealthCutQueryResponse } from "@/store/api/journalApi";

interface HealthCutPrepLockCardProps {
  prepLock: HealthCutQueryResponse["prepLock"];
  draft: string;
  isSubmitting: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
}

function formatTargetDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function HealthCutPrepLockCard({
  prepLock,
  draft,
  isSubmitting,
  onDraftChange,
  onSubmit,
}: HealthCutPrepLockCardProps) {
  return (
    <Card className={cn("bg-card/85", prepLock.completed ? "border-emerald-500/25" : "border-primary/20")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <NotebookPen className="h-4 w-4 text-primary" />
          Tomorrow Protein Lock
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={cn("rounded-3xl border p-4", prepLock.completed ? "border-emerald-500/30 bg-emerald-500/10" : "border-primary/30 bg-primary/10")}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-foreground">{prepLock.prompt}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Target meal day: {formatTargetDate(prepLock.targetDate)}
              </p>
            </div>
            <Badge variant={prepLock.completed ? "secondary" : "outline"}>
              {prepLock.completed ? "locked" : "open"}
            </Badge>
          </div>

          {prepLock.latestEntry ? (
            <div className="mt-3 rounded-2xl border border-border/60 bg-background/40 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Latest choice</p>
              <p className="mt-2 text-sm text-foreground">{prepLock.latestEntry.text}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(prepLock.latestEntry.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                {" "}• {prepLock.entriesCount} lock{prepLock.entriesCount === 1 ? "" : "s"}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              No protein locked yet. That’s how lunch turns into dumb chaos.
            </p>
          )}
        </div>

        <Textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Chicken thighs, steak bowl, protein shake backup, whatever tomorrow actually is..."
          className="min-h-[110px] resize-none bg-background/70"
        />

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Keep it concrete. Protein first, fallback if the day goes feral. <Link href="/meal-plan" className="text-primary underline-offset-4 hover:underline">Need meal-plan bait?</Link>
          </p>
          <Button size="sm" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? "Saving..." : prepLock.completed ? "Update lock" : "Lock protein"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
