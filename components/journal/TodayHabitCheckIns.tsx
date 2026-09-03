"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  useGetHabitsMomentumQuery,
  useSetHabitCheckInMutation,
} from "@/store/api/habitsApi";
import type { HabitCheckInState } from "@/types";

const OPTIONS: Array<{ state: HabitCheckInState; label: string }> = [
  { state: "done", label: "Done" },
  { state: "skipped", label: "Skipped / Not applicable" },
  { state: "unlogged", label: "Unlogged" },
];

export function TodayHabitCheckIns({ date }: { date: string }) {
  const { data, isLoading, error } = useGetHabitsMomentumQuery(date);
  const [saveCheckIn] = useSetHabitCheckInMutation();
  const [states, setStates] = useState<Record<string, HabitCheckInState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    setStates(Object.fromEntries(data.today.map((habit) => [habit.habitId, habit.state])));
  }, [data]);

  async function choose(habitId: string, label: string, state: HabitCheckInState) {
    const previous = states[habitId] ?? "unlogged";
    setStates((current) => ({ ...current, [habitId]: state }));
    setErrors((current) => ({ ...current, [habitId]: "" }));
    try {
      await saveCheckIn({ habitId, date, state }).unwrap();
    } catch {
      setStates((current) => ({ ...current, [habitId]: previous }));
      setErrors((current) => ({ ...current, [habitId]: `Could not save ${label}. Try again.` }));
    }
  }

  if (isLoading) return <p className="px-4 py-3 text-sm text-muted-foreground">Loading habit check-ins…</p>;
  if (error || !data) return null;

  return (
    <section className="px-4 py-3 sm:px-6" aria-labelledby="habit-check-ins-heading">
      <Card className="mx-auto max-w-4xl border-border/60 bg-card/85">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="habit-check-ins-heading" className="text-base font-semibold">Habit check-ins</h2>
              <p className="mt-1 text-sm text-muted-foreground">A quick check-in for {date}. You decide what counts.</p>
            </div>
            <Button asChild variant="ghost" size="sm"><Link href={`/habits?date=${date}`}>View history</Link></Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.today.map((habit) => {
            const selected = states[habit.habitId] ?? habit.state;
            return (
              <div key={habit.habitId} className="rounded-2xl border border-border/60 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{habit.label}</p>
                    {habit.suggestion ? <p className="text-xs text-muted-foreground">{habit.suggestion}</p> : null}
                  </div>
                  <div data-testid="habit-actions" className="flex flex-wrap gap-2" role="group" aria-label={`${habit.label} check-in`}>
                    {OPTIONS.map((option) => (
                      <Button
                        key={option.state}
                        type="button"
                        size="sm"
                        variant={selected === option.state ? "default" : "outline"}
                        aria-pressed={selected === option.state}
                        aria-label={option.state === "done"
                          ? `Mark ${habit.label} done`
                          : option.state === "skipped"
                            ? `Mark ${habit.label} skipped or not applicable`
                            : `Leave ${habit.label} unlogged`}
                        className={cn("h-auto whitespace-normal text-left", option.state === "unlogged" && "text-muted-foreground")}
                        onClick={() => choose(habit.habitId, habit.label, option.state)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
                {errors[habit.habitId] ? <p role="alert" className="mt-2 text-sm text-destructive">{errors[habit.habitId]}</p> : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
