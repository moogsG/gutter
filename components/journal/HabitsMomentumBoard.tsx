"use client";

import Link from "next/link";
import { AlertTriangle, BookOpenText, Dumbbell, Flame, Martini, NotebookPen, ScrollText } from "lucide-react";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useGetHabitsMomentumQuery } from "@/store/api/habitsApi";

const ICONS = {
  omad: Flame,
  workout: Dumbbell,
  alcohol: Martini,
  prep: NotebookPen,
  mealLog: ScrollText,
  reading: BookOpenText,
} as const;

function getCancunTodayDate(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Cancun",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function shiftDate(date: string, amount: number): string {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + amount);
  return next.toISOString().split("T")[0];
}

function toneFor(status: "hit" | "miss" | "off" | "untracked"): string {
  if (status === "hit") return "bg-chart-3/80";
  if (status === "miss") return "bg-destructive/80";
  if (status === "untracked") return "bg-transparent";
  return "bg-muted/30";
}

export function HabitsMomentumBoard({ date, onDateChange }: { date: string; onDateChange: (date: string) => void }) {
  const { data, isLoading, error, isFetching } = useGetHabitsMomentumQuery(date);

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
        {isLoading ? <HabitsSkeleton /> : null}
        {!isLoading && error ? <FailureState /> : null}
        {!isLoading && data ? (
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <section className="rounded-[2rem] border border-chart-4/25 bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(255,255,255,0.02),rgba(56,189,248,0.12))] p-5 shadow-[0_0_60px_rgba(245,158,11,0.12)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-chart-4">Habit truth board</p>
                  <h1 className="mt-2 text-3xl font-semibold text-foreground">{data.displayRange}</h1>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    Weekly momentum inferred from daily memory wins and food-log proof, with missing-signal days called out separately so the board stops bluffing.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="border-chart-4/30 bg-background/35 px-3 py-1">
                    {data.summary.trackedDays}/{data.windowDays} tracked days
                  </Badge>
                  <Badge variant="outline" className="border-chart-4/30 bg-background/35 px-3 py-1">
                    {data.summary.coveragePercent}% coverage
                  </Badge>
                  <Badge variant="outline" className="border-chart-4/30 bg-background/35 px-3 py-1">
                    {data.summary.strongHabits} strong habits
                  </Badge>
                  <Badge variant="outline" className="border-chart-4/30 bg-background/35 px-3 py-1">
                    {data.summary.slippingHabits} slipping habits
                  </Badge>
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <Card className="border-border/60 bg-card/85">
                <CardContent className="flex flex-col gap-4 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Signal coverage</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {data.summary.missingDays > 0
                          ? `${data.summary.missingDays} of the last ${data.windowDays} days have no usable health proof at all. Those are gaps, not honest misses.`
                          : `Every day in this ${data.windowDays}-day window has at least some usable health signal.`}
                      </p>
                    </div>
                    <Badge variant={data.summary.missingDays > 0 ? "outline" : "secondary"}>
                      {data.summary.missingDays > 0 ? `${data.summary.missingDays} missing days` : "fully covered"}
                    </Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <StatTile label="Tracked" value={`${data.summary.trackedDays}`} />
                    <StatTile label="Missing" value={`${data.summary.missingDays}`} />
                    <StatTile label="Coverage" value={`${data.summary.coveragePercent}%`} />
                  </div>

                  <div className="rounded-3xl border border-border/60 bg-background/35 p-4">
                    <p className="text-sm text-foreground">{data.nextMove}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href="/health-cut">Open Health</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/?date=${date}`}>Open Today</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className={cn("bg-card/85", data.trackerHealth.mode === "stale" ? "border-chart-5/30" : "border-border/60")}>
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Passive tracker honesty check</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {data.trackerHealth.mode === "missing"
                          ? "Legacy tracker file is missing, so this board leans on live Gutter signals only."
                          : `Last tracker snapshot: ${data.trackerHealth.lastUpdated} (${data.trackerHealth.daysStale} days stale). Health prompts still sit open in Gutter, so this board trusts the written daily wins instead of dangling task state.`}
                      </p>
                    </div>
                    <Badge variant={data.trackerHealth.mode === "healthy" ? "secondary" : "outline"}>
                      {data.trackerHealth.mode}
                    </Badge>
                  </div>

                  {data.trackerHealth.note ? (
                    <div className="rounded-3xl border border-border/60 bg-background/35 p-4 text-sm text-muted-foreground">
                      {data.trackerHealth.note}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {data.habits.map((habit) => {
                const Icon = ICONS[habit.id as keyof typeof ICONS] || ScrollText;
                return (
                  <Card key={habit.id} className="bg-card/85">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Icon className="h-4 w-4 text-chart-4" />
                        {habit.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">{habit.description}</p>
                      <div className="grid grid-cols-3 gap-2">
                        <StatTile label="Current" value={`${habit.currentStreak}d`} />
                        <StatTile label="Best" value={`${habit.bestStreak}d`} />
                        <StatTile label="Hit rate" value={`${habit.hitRate}%`} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {habit.hits}/{habit.trackedDays} tracked hits{habit.lastHitDate ? ` • last hit ${habit.lastHitDate}` : ""}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </section>

            <Card className="bg-card/85">
              <CardHeader>
                <CardTitle className="text-base">14-Day Scoreboard</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 overflow-x-auto">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <LegendChip label="Hit" swatchClassName="bg-chart-3/80" />
                  <LegendChip label="Miss" swatchClassName="bg-destructive/80" />
                  <LegendChip label="Open today" swatchClassName="bg-muted/30" />
                  <LegendChip label="Untracked gap" swatchClassName="bg-transparent border border-dashed border-border/70" />
                </div>

                {data.habits.map((habit) => (
                  <div key={habit.id} className="min-w-[42rem]">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">{habit.label}</p>
                      <p className="text-xs text-muted-foreground">{habit.description}</p>
                    </div>
                    <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-2">
                      {data.days.map((day) => {
                        const status = day.statuses[habit.id];

                        return (
                          <div key={`${habit.id}-${day.date}`} className="space-y-2 text-center">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{day.weekday}</p>
                            <div
                              className={cn(
                                "h-10 rounded-2xl",
                                status === "untracked" ? "border border-dashed border-border/70" : "border border-border/40",
                                toneFor(status),
                              )}
                            />
                            <p className="text-[10px] text-muted-foreground">{day.label}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {data.trackerHealth.mode === "healthy" ? (
              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="text-base">Legacy Snapshot</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {data.legacySnapshot.map((item) => (
                    <div key={item.id} className="rounded-3xl border border-border/60 bg-background/35 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{item.label}</p>
                      <p className="mt-2 text-lg font-medium text-foreground">
                        {item.value === null ? "unknown" : item.value ? "last seen: yes" : "last seen: no"}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <p className="text-center text-xs text-muted-foreground">
              {isFetching ? "Refreshing..." : `Generated ${new Date(data.generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/35 px-3 py-3 text-center">
      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function LegendChip({ label, swatchClassName }: { label: string; swatchClassName: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/35 px-3 py-1.5">
      <span className={cn("h-3 w-3 rounded-full", swatchClassName)} />
      <span>{label}</span>
    </div>
  );
}

function FailureState() {
  return (
    <Card className="mx-auto max-w-xl border-destructive/30 bg-destructive/10">
      <CardContent className="flex items-center gap-3 p-5 text-sm text-foreground">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        Habits board failed to load. The support stack is lying again.
      </CardContent>
    </Card>
  );
}

function HabitsSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Skeleton className="h-36 rounded-[2rem]" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-64 rounded-[2rem]" />
        <Skeleton className="h-64 rounded-[2rem]" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-52 rounded-[2rem]" />
        <Skeleton className="h-52 rounded-[2rem]" />
        <Skeleton className="h-52 rounded-[2rem]" />
      </div>
      <Skeleton className="h-96 rounded-[2rem]" />
      <Skeleton className="h-52 rounded-[2rem]" />
    </div>
  );
}
