"use client";

import Link from "next/link";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getJournalDate, shiftJournalDate } from "@/lib/journal-date";
import { useGetHabitsMomentumQuery } from "@/store/api/habitsApi";
import type { HabitsMomentumStatus } from "@/types";

const LABELS: Record<HabitsMomentumStatus, string> = {
  done: "Done",
  skipped: "Skipped",
  missed: "Missed",
  unlogged: "Unlogged",
};

const TONES: Record<HabitsMomentumStatus, string> = {
  done: "border-chart-3/40 bg-chart-3/70",
  skipped: "border-chart-4/40 bg-chart-4/35",
  missed: "border-destructive/40 bg-destructive/65",
  unlogged: "border-dashed border-border/70 bg-transparent",
};

export function HabitsMomentumBoard({ date, onDateChange }: { date: string; onDateChange: (date: string) => void }) {
  const { data, isLoading, error, isFetching } = useGetHabitsMomentumQuery(date);

  return (
    <div className="flex h-full flex-col overflow-auto">
      <JournalHeader
        date={date}
        onPrevDay={() => onDateChange(shiftJournalDate(date, -1))}
        onNextDay={() => onDateChange(shiftJournalDate(date, 1))}
        onToday={() => onDateChange(getJournalDate())}
        showCapture={false}
      />
      <main className="flex-1 px-4 py-5 sm:px-6">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading habit history…</p> : null}
        {!isLoading && error ? <p role="alert" className="text-sm text-destructive">Habit history could not load. Try again.</p> : null}
        {!isLoading && data ? (
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <section className="rounded-3xl border border-border/60 bg-card/85 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold text-foreground">Habit history</h1>
                  <p className="mt-1 text-sm text-muted-foreground">Today is where you check in. This page is a {data.windowDays}-day reporting window for review.</p>
                </div>
                <Button asChild size="sm"><Link href={`/?date=${date}`}>Check in on Today</Link></Button>
              </div>
              <p className="mt-4 text-sm text-foreground">
                {data.summary.trackedDays === 0
                  ? `No check-ins from ${data.displayRange}.`
                  : `${data.summary.trackedDays} days include a direct check-in from ${data.displayRange}.`}
              </p>
            </section>

            <Card className="border-border/60 bg-card/85">
              <CardHeader className="pb-3">
                <h2 className="text-base font-semibold">Daily history</h2>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Legend state="done" label="Done" />
                  <Legend state="skipped" label="Skipped" />
                  <Legend state="missed" label="Missed (explicit policy only)" />
                  <Legend state="unlogged" label="Unlogged" />
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <div className="space-y-4" data-testid="habit-history-grid">
                  {data.habits.map((habit) => (
                    <div key={habit.id}>
                      <p className="mb-2 text-sm font-medium text-foreground">{habit.label}</p>
                      <div className="flex gap-2">
                        {data.days.map((day) => {
                          const state = day.statuses[habit.id] ?? "unlogged";
                          return (
                            <span
                              key={`${habit.id}-${day.date}`}
                              aria-label={`${habit.label} on ${day.label}: ${LABELS[state]}`}
                              title={`${day.label}: ${LABELS[state]}`}
                              className={cn("h-9 w-9 shrink-0 rounded-xl border", TONES[state])}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <details className="rounded-2xl border border-border/60 bg-card/60 px-4 py-3 text-sm text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">Source status</summary>
              <p className="mt-2">Optional signal source: {data.trackerHealth.mode}. Signals can suggest a check-in, but never decide it.</p>
            </details>
            <p aria-live="polite" className="text-center text-xs text-muted-foreground">{isFetching ? "Refreshing…" : "History up to date"}</p>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function Legend({ state, label }: { state: HabitsMomentumStatus; label: string }) {
  return (
    <span className="flex items-center gap-2 rounded-full border border-border/60 px-3 py-1.5">
      <span aria-hidden="true" className={cn("h-3 w-3 rounded-full border", TONES[state])} />
      {label}
    </span>
  );
}
