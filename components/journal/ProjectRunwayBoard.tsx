"use client";

import { AlertTriangle, FolderKanban, Layers3, Milestone, Sparkles } from "lucide-react";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetProjectRunwayQuery } from "@/store/api/projectRunwayApi";

function getCancunTodayDate(): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Cancun", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function shiftDate(date: string, amount: number): string {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + amount);
  return next.toISOString().split("T")[0];
}

function ProjectRunwaySkeleton() {
  return <div className="mx-auto flex max-w-6xl flex-col gap-4"><Skeleton className="h-40 rounded-[2rem]" /><div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-48 rounded-3xl" /><Skeleton className="h-48 rounded-3xl" /><Skeleton className="h-48 rounded-3xl" /></div><Skeleton className="h-[34rem] rounded-3xl" /></div>;
}

export function ProjectRunwayBoard({ date, onDateChange }: { date: string; onDateChange: (date: string) => void }) {
  const { data, isLoading, error } = useGetProjectRunwayQuery(date);

  return (
    <div className="flex h-full flex-col overflow-auto">
      <JournalHeader date={date} onPrevDay={() => onDateChange(shiftDate(date, -1))} onNextDay={() => onDateChange(shiftDate(date, 1))} onToday={() => onDateChange(getCancunTodayDate())} showCapture={false} />
      <main className="flex-1 px-4 py-5 sm:px-6">
        {isLoading ? <ProjectRunwaySkeleton /> : null}
        {!isLoading && error ? <Card className="mx-auto max-w-xl border-destructive/30 bg-destructive/10"><CardContent className="flex items-center gap-3 p-5 text-sm text-foreground"><AlertTriangle className="h-5 w-5 text-destructive" /> Project runway failed to load. Even the truth board faceplanted.</CardContent></Card> : null}
        {!isLoading && data ? (
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <section className="rounded-[2rem] border border-primary/20 bg-[linear-gradient(135deg,rgba(255,61,154,0.16),rgba(255,255,255,0.02),rgba(125,211,252,0.12))] p-5 shadow-[0_0_60px_rgba(255,61,154,0.08)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div><p className="text-xs uppercase tracking-[0.35em] text-primary/80">Project runway</p><h1 className="mt-2 text-3xl font-semibold text-foreground">{data.headline}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">One honest screen for the written plan, the blocker list, and the stale in-progress pile pretending to be active work.</p></div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                  <Card className="border-primary/20 bg-background/35 px-3 py-2"><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Doc updated</p><p className="mt-2 text-sm font-semibold text-foreground">{data.document.lastUpdated || "Unknown"}</p></Card>
                  <Card className="border-primary/20 bg-background/35 px-3 py-2"><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Active projects</p><p className="mt-2 text-xl font-semibold text-foreground">{data.document.activeProjects}</p></Card>
                  <Card className="border-primary/20 bg-background/35 px-3 py-2"><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Live in progress</p><p className="mt-2 text-xl font-semibold text-foreground">{data.truthGap.liveInProgressCount}</p></Card>
                  <Card className="border-primary/20 bg-background/35 px-3 py-2"><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Legacy sludge</p><p className="mt-2 text-xl font-semibold text-foreground">{data.truthGap.legacyInProgressCount}</p></Card>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <Card className="border-primary/20 bg-card/85"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Next move</CardTitle></CardHeader><CardContent className="space-y-3"><div className="rounded-2xl border border-primary/20 bg-primary/8 p-4"><p className="text-base font-medium text-foreground">{data.nextMove}</p></div><p className="text-sm text-muted-foreground">{data.document.staleDays !== null ? `PROJECTS.md has been stale for ${data.document.staleDays} days as of ${data.requestedDate}.` : `PROJECTS.md does not expose a last-updated stamp.`}</p></CardContent></Card>
              <Card className="bg-card/85"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Layers3 className="h-4 w-4 text-primary" /> Lane pressure</CardTitle></CardHeader><CardContent className="space-y-3">{data.liveLanes.map((lane) => <div key={lane.lane} className="rounded-2xl border border-border/60 bg-background/35 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium capitalize text-foreground">{lane.lane}</p><Badge variant="outline">{lane.inProgressCount} in progress</Badge></div><p className="mt-2 text-sm text-muted-foreground">{lane.openCount} open · {lane.blockedCount} blocked</p></div>)}</CardContent></Card>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <Card className="bg-card/85"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FolderKanban className="h-4 w-4 text-primary" /> Documented active projects</CardTitle></CardHeader><CardContent className="space-y-3">{data.documentedProjects.map((project) => <div key={project.title} className="rounded-3xl border border-border/60 bg-background/35 p-4"><div className="flex flex-wrap items-center gap-2"><p className="text-base font-semibold text-foreground">{project.title}</p><Badge variant="outline">{project.priority}</Badge><Badge variant="outline">{project.status}</Badge></div>{project.blocker ? <p className="mt-3 text-sm text-foreground">Blocker: {project.blocker}</p> : <p className="mt-3 text-sm text-muted-foreground">No explicit blocker captured in the doc.</p>}{project.localPath ? <p className="mt-2 text-xs text-muted-foreground">Path: {project.localPath}</p> : null}{project.currentPriorities.length ? <p className="mt-3 text-sm text-muted-foreground">Current priorities: {project.currentPriorities.slice(0, 3).join(" | ")}</p> : null}{project.recentWork.length ? <p className="mt-2 text-sm text-muted-foreground">Recent: {project.recentWork.slice(0, 2).join(" | ")}</p> : null}</div>)}</CardContent></Card>
              <Card className="bg-card/85"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Milestone className="h-4 w-4 text-primary" /> Live in-progress truth</CardTitle></CardHeader><CardContent className="space-y-3">{data.currentInProgress.length ? data.currentInProgress.map((task) => <div key={task.id} className="rounded-2xl border border-border/60 bg-background/35 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-foreground">{task.title}</p><Badge variant="outline">{task.lane}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{task.ageDays} days old · {task.priority || "no priority"}</p></div>) : <p className="text-sm text-muted-foreground">No non-legacy in-progress tasks were found.</p>}</CardContent></Card>
            </section>

            <Card className="bg-card/85">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-primary" /> Stale in-progress pile</CardTitle></CardHeader>
              <CardContent className="space-y-3">{data.staleInProgress.map((task) => <div key={task.id} className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-foreground">{task.title}</p><Badge variant="outline">{task.lane}</Badge><Badge variant="outline">{task.ageDays}d old</Badge></div><p className="mt-2 text-sm text-muted-foreground">{task.waitingOn ? `Waiting on: ${task.waitingOn}` : "No waiting note. Just vibes and neglect."}</p></div>)}</CardContent>
            </Card>
          </div>
        ) : null}
      </main>
    </div>
  );
}
