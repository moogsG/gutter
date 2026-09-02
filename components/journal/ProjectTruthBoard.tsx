"use client";

import { AlertTriangle, ArrowUpRight, BookOpenText, FileWarning, Sparkles, Target, Workflow } from "lucide-react";
import Link from "next/link";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetProjectTruthQuery } from "@/store/api/truthApi";
import type { ProjectTruthLiveTask, ProjectTruthProject, ProjectTruthRecurringTask } from "@/types";
import { getJournalDate, shiftJournalDate } from "@/lib/journal-date";

function getCancunTodayDate(): string {
  return getJournalDate();
}

function shiftDate(date: string, amount: number): string {
  return shiftJournalDate(date, amount);
}

function ProjectCard({ project }: { project: ProjectTruthProject }) {
  return (
    <div className="rounded-3xl border border-border/60 bg-background/35 p-4">
      <p className="text-lg font-medium text-foreground">{project.name}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {project.priority ? <Badge variant="outline">{project.priority}</Badge> : null}
        {project.status ? <Badge variant="outline">{project.status}</Badge> : null}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{project.blocker || "No explicit blocker captured in PROJECTS.md."}</p>
    </div>
  );
}

function RecurringTaskCard({ task }: { task: ProjectTruthRecurringTask }) {
  return (
    <div className="rounded-3xl border border-border/60 bg-background/35 p-4">
      <p className="text-sm font-medium leading-relaxed text-foreground">{task.title}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <Badge variant="outline" className="border-primary/30 text-primary">{task.currentStreakDays}d streak</Badge>
        <span>{task.appearances} sightings</span>
        <span>{task.firstSeen} to {task.lastSeen}</span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Seen on {task.dates.join(", ")}</p>
    </div>
  );
}

function LiveTaskCard({ task }: { task: ProjectTruthLiveTask }) {
  return (
    <div className="rounded-3xl border border-border/60 bg-background/35 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium leading-relaxed text-foreground">{task.title}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Badge variant="outline">{task.status}</Badge>
            <span>{task.ageDays}d old</span>
            <span>{task.lane || "unknown lane"}</span>
            {task.priority ? <span>{task.priority}</span> : null}
          </div>
          {task.waitingOn ? <p className="mt-3 text-xs text-muted-foreground">Waiting on {task.waitingOn}</p> : null}
        </div>
        <Link
          href={`/day/${task.date}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2 py-1 text-xs text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
        >
          {task.date}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function StatPill({ icon: Icon, label, value }: { icon: typeof FileWarning; label: string; value: string | number }) {
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

function FailureState() {
  return (
    <Card className="mx-auto max-w-xl border-destructive/30 bg-destructive/10">
      <CardContent className="flex items-center gap-3 p-5 text-sm text-foreground">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        Truth board failed to load. Even the honesty layer is having performance issues.
      </CardContent>
    </Card>
  );
}

function TruthSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Skeleton className="h-40 rounded-[2rem]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-96 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    </div>
  );
}

export function ProjectTruthBoard({ date, onDateChange }: { date: string; onDateChange: (date: string) => void }) {
  const { data, isLoading, error, isFetching } = useGetProjectTruthQuery(date);

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
        {isLoading ? <TruthSkeleton /> : null}
        {!isLoading && error ? <FailureState /> : null}
        {!isLoading && data ? (
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <section className="rounded-[2rem] border border-primary/20 bg-[linear-gradient(135deg,rgba(255,61,154,0.16),rgba(255,255,255,0.02),rgba(125,211,252,0.12))] p-5 shadow-[0_0_60px_rgba(255,61,154,0.08)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-primary/80">Project truth</p>
                  <h1 className="mt-2 text-3xl font-semibold text-foreground">Stop calling drift a plan</h1>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    One honest screen for stale project docs, repeated fake-progress tasks, and older work still squatting in Gutter.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                  <StatPill icon={BookOpenText} label="Projects" value={data.counts.activeProjects} />
                  <StatPill icon={FileWarning} label="Doc age" value={data.counts.projectDocAgeDays ?? "?"} />
                  <StatPill icon={Workflow} label="Zombie loops" value={data.counts.recurringTaskCount} />
                  <StatPill icon={Target} label="Stale work" value={data.counts.staleWorkCount} />
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <Card className="border-primary/20 bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Start here
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-2xl border border-primary/20 bg-primary/8 p-4">
                    <p className="text-base font-medium text-foreground">{data.nextMove}</p>
                  </div>
                  <div className="space-y-2">
                    {data.notes.map((note) => (
                      <p key={note} className="text-sm text-muted-foreground">{note}</p>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="text-base text-foreground">Reality checks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>Reviewed {data.counts.memoryDaysReviewed} recent memory day(s) against the live task database.</p>
                  <p>{data.projectDoc.lastUpdated ? `PROJECTS.md last changed on ${data.projectDoc.lastUpdated}.` : "PROJECTS.md does not expose a usable last-updated stamp."}</p>
                  <p>{isFetching ? "Refreshing live..." : data.projectDoc.stale ? "Treat the project doc as reference material until it gets refreshed." : "The project doc is recent enough to trust."}</p>
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><BookOpenText className="h-4 w-4 text-primary" /> Active projects</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.projectDoc.projects.map((project) => <ProjectCard key={project.name} project={project} />)}
                </CardContent>
              </Card>

              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Workflow className="h-4 w-4 text-primary" /> Repeated in progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.recurringTasks.length
                    ? data.recurringTasks.map((task) => <RecurringTaskCard key={task.title} task={task} />)
                    : <p className="text-sm text-muted-foreground">No repeated in-progress loops found across the recent daily notes.</p>}
                </CardContent>
              </Card>
            </section>

            <Card className="bg-card/85">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><FileWarning className="h-4 w-4 text-primary" /> Older live work</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 lg:grid-cols-2">
                {data.counts.staleWorkCount > data.staleWork.length ? (
                  <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-background/35 p-3 text-sm text-muted-foreground">
                    Showing the oldest {data.staleWork.length} of {data.counts.staleWorkCount} active work tasks so the page stays readable.
                  </div>
                ) : null}
                {data.staleWork.length
                  ? data.staleWork.map((task) => <LiveTaskCard key={task.id} task={task} />)
                  : <p className="text-sm text-muted-foreground">No older active work tasks surfaced from live Gutter data.</p>}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </main>
    </div>
  );
}
