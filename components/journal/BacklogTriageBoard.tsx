"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Archive, ArrowUpRight, Clock3, Layers3, ShieldAlert } from "lucide-react";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useGetBacklogTriageQuery } from "@/store/api/triageApi";
import type { BacklogTriageItem } from "@/types";
import { getJournalDate, shiftJournalDate } from "@/lib/journal-date";

function getCancunTodayDate(): string {
  return getJournalDate();
}

function shiftDate(date: string, amount: number): string {
  return shiftJournalDate(date, amount);
}

function laneTone(lane: string | null) {
  switch (lane) {
    case "work":
      return "border-sky-500/30 text-sky-200";
    case "family":
      return "border-amber-500/30 text-amber-200";
    case "petalz":
      return "border-fuchsia-500/30 text-fuchsia-200";
    case "jw":
      return "border-emerald-500/30 text-emerald-200";
    default:
      return "border-border text-muted-foreground";
  }
}

function priorityTone(priority: string | null) {
  if (priority === "high") return "border-destructive/40 text-destructive";
  if (priority === "low") return "border-border text-muted-foreground";
  return "border-primary/30 text-primary";
}

function BucketSection({
  title,
  subtitle,
  count,
  tone,
  items,
  expanded,
  onToggle,
}: {
  title: string;
  subtitle: string;
  count: number;
  tone: string;
  items: BacklogTriageItem[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const visibleItems = expanded ? items : items.slice(0, 8);

  return (
    <Card className={cn("bg-card/85", tone)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base text-foreground">{title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <Badge variant="outline" className="border-primary/25 bg-background/40 px-2.5 py-1">
            {count}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? visibleItems.map((item) => (
          <div key={item.id} className="rounded-2xl border border-border/60 bg-background/35 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium leading-relaxed text-foreground">{item.title}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  <Badge variant="outline" className={laneTone(item.lane)}>{item.lane || "personal"}</Badge>
                  <Badge variant="outline" className={priorityTone(item.priority)}>{item.priority || "normal"}</Badge>
                  <span>{item.ageDays}d old</span>
                  <span>{item.status}</span>
                </div>
                {item.waiting_on ? (
                  <p className="mt-2 text-xs text-muted-foreground">Waiting on {item.waiting_on}</p>
                ) : null}
              </div>
              <Link
                href={`/day/${item.date}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2 py-1 text-xs text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
              >
                {item.date}
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )) : (
          <p className="text-sm text-muted-foreground">Nothing rotting in this bucket for this date.</p>
        )}
        {items.length > 8 ? (
          <Button variant="outline" size="sm" onClick={onToggle} className="w-full">
            {expanded ? "Show fewer" : `Show all ${items.length}`}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function BacklogTriageBoard({ date, onDateChange }: { date: string; onDateChange: (date: string) => void }) {
  const { data, isLoading, error, isFetching } = useGetBacklogTriageQuery(date);
  const [expandedBuckets, setExpandedBuckets] = useState<Record<string, boolean>>({});

  const toggleBucket = (key: string) => {
    setExpandedBuckets((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  return (
    <div className="flex h-full flex-col overflow-auto">
      <JournalHeader
        date={date}
        onPrevDay={() => onDateChange(shiftDate(date, -1))}
        onNextDay={() => onDateChange(shiftDate(date, 1))}
        onToday={() => onDateChange(getCancunTodayDate())}
        showCapture={false}
      />

      <main className="flex-1 px-4 py-5 sm:px-6">
        {isLoading ? <BacklogSkeleton /> : null}
        {!isLoading && error ? <FailureState /> : null}
        {!isLoading && data ? (
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <section className="rounded-[2rem] border border-primary/20 bg-[linear-gradient(135deg,rgba(255,61,154,0.16),rgba(255,255,255,0.02),rgba(56,189,248,0.08))] p-5 shadow-[0_0_60px_rgba(255,61,154,0.08)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-primary/80">Backlog triage</p>
                  <h1 className="mt-2 text-3xl font-semibold text-foreground">Clear the task graveyard</h1>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    One obvious screen for blocked work, stale carryover, and old junk that keeps making the board feel heavier than it is.
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground/80">
                    Buckets below are priority slices, not a full partition of every older task.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                  <StatPill icon={ShieldAlert} label="Blockers" value={data.counts.blockers} />
                  <StatPill icon={Clock3} label="Stale active" value={data.counts.staleActive} />
                  <StatPill icon={Archive} label="Legacy" value={data.counts.legacy} />
                  <StatPill icon={Layers3} label="Older tasks" value={data.counts.total} />
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <Card className="border-primary/20 bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-primary" /> What deserves attention first</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  <PriorityCard
                    label="Unblock first"
                    value={`${data.counts.blockers} blockers`}
                    body="Kill blockers or rewrite them into something actionable before they keep squatting in your head."
                  />
                  <PriorityCard
                    label="Trim stale active"
                    value={`${data.counts.staleActive} stale`}
                    body="These are the fake-current tasks that make the board look busier than your actual life."
                  />
                  <PriorityCard
                    label="Archive old ghosts"
                    value={`${data.counts.legacy} legacy`}
                    body="Mission Control leftovers and dead projects should stop pretending they still deserve eye contact."
                  />
                </CardContent>
              </Card>

              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="text-base text-foreground">Triage rule</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>1. Resolve or rewrite blockers.</p>
                  <p>2. Decide whether stale active work belongs this week.</p>
                  <p>3. Archive or kill legacy tasks that no longer match reality.</p>
                  <p>4. Open the source day for anything that still needs context.</p>
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <BucketSection
                title="Blocked"
                subtitle="Tasks explicitly jammed by someone, something, or missing context."
                count={data.counts.blockers}
                tone="border-destructive/20"
                items={data.buckets.blockers}
                expanded={Boolean(expandedBuckets.blocked)}
                onToggle={() => toggleBucket("blocked")}
              />
              <BucketSection
                title="Stale Active"
                subtitle="Open or in-progress carryover older than three days."
                count={data.counts.staleActive}
                tone="border-chart-5/20"
                items={data.buckets.staleActive}
                expanded={Boolean(expandedBuckets.staleActive)}
                onToggle={() => toggleBucket("staleActive")}
              />
              <BucketSection
                title="Legacy"
                subtitle="Old task imports and dead-board leftovers still cluttering the room."
                count={data.counts.legacy}
                tone="border-primary/20"
                items={data.buckets.legacy}
                expanded={Boolean(expandedBuckets.legacy)}
                onToggle={() => toggleBucket("legacy")}
              />
              <BucketSection
                title="Deep Archive"
                subtitle="Older open tasks created a month or more ago."
                count={data.counts.deepArchive}
                tone="border-border/70"
                items={data.buckets.deepArchive}
                expanded={Boolean(expandedBuckets.deepArchive)}
                onToggle={() => toggleBucket("deepArchive")}
              />
            </section>

            <p className="text-center text-xs text-muted-foreground">
              {isFetching ? "Refreshing..." : `Generated ${new Date(data.generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function StatPill({ icon: Icon, label, value }: { icon: typeof AlertTriangle; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-background/35 px-3 py-2">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function PriorityCard({ label, value, body }: { label: string; value: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/35 p-3">
      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function FailureState() {
  return (
    <Card className="mx-auto max-w-xl border-destructive/30 bg-destructive/10">
      <CardContent className="flex items-center gap-3 p-5 text-sm text-foreground">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        Backlog triage failed to load. The board is hiding its corpses again.
      </CardContent>
    </Card>
  );
}

function BacklogSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Skeleton className="h-40 rounded-[2rem]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-52 rounded-3xl" />
        <Skeleton className="h-52 rounded-3xl" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-96 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    </div>
  );
}
