"use client";

import { AlertTriangle, BookOpen, CalendarRange, Sparkles, Users } from "lucide-react";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getJournalDate, shiftJournalDate } from "@/lib/journal-date";
import { useGetSchoolQuery } from "@/store/api/schoolApi";

function getRuntimeTodayDate(): string {
  return getJournalDate();
}

function shiftDate(date: string, amount: number): string {
  return shiftJournalDate(date, amount);
}

export function SchoolRunwayBoard({ date, onDateChange }: { date: string; onDateChange: (date: string) => void }) {
  const { data, isLoading, error, isFetching } = useGetSchoolQuery(date);

  return (
    <div className="flex h-full flex-col overflow-auto">
      <JournalHeader date={date} onPrevDay={() => onDateChange(shiftDate(date, -1))} onNextDay={() => onDateChange(shiftDate(date, 1))} onToday={() => onDateChange(getRuntimeTodayDate())} showCapture={false} />
      <main className="flex-1 px-4 py-5 sm:px-6">
        {isLoading ? <SchoolSkeleton /> : null}
        {!isLoading && error ? <FailureState /> : null}
        {!isLoading && data ? (
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <section className={cn("rounded-[2rem] border p-5 shadow-[0_0_60px_rgba(56,189,248,0.08)]", data.mode === "quiet" ? "border-sky-400/20 bg-[linear-gradient(135deg,rgba(56,189,248,0.16),rgba(255,255,255,0.02),rgba(250,204,21,0.10))]" : "border-emerald-400/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.15),rgba(255,255,255,0.02),rgba(251,191,36,0.10))]")}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-sky-300">Homeschool runway</p>
                  <h1 className="mt-2 text-3xl font-semibold text-foreground">{data.displayRange}</h1>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{data.headline}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <StatPill label="School" value={data.counts.schoolEvents} icon={CalendarRange} />
                  <StatPill label="Family" value={data.counts.familyEvents} icon={Users} />
                  <StatPill label="Quiet" value={data.counts.quietDays} icon={Sparkles} />
                </div>
              </div>
            </section>

            {data.warnings.length ? <Card className="border-chart-5/30 bg-chart-5/10"><CardContent className="p-5 text-sm text-foreground">{data.warnings.join(" ")}</CardContent></Card> : null}

            <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <Card className="bg-card/85">
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarRange className="h-4 w-4 text-sky-300" /> Next 7 days</CardTitle></CardHeader>
                <CardContent className="grid gap-3">
                  {data.days.map((day) => <div key={day.date} className="rounded-3xl border border-border/60 bg-background/35 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{day.label}</p><p className="mt-2 text-sm text-foreground">{day.headline}</p></div><Badge variant="outline">{day.schoolEvents.length + day.familyEvents.length} item{day.schoolEvents.length + day.familyEvents.length === 1 ? "" : "s"}</Badge></div><div className="mt-3 flex flex-wrap gap-2">{[...day.schoolEvents, ...day.familyEvents].length ? [...day.schoolEvents, ...day.familyEvents].map((event) => <Badge key={event.id} variant="secondary">{event.calendar}: {event.title}</Badge>) : <Badge variant="outline">blank runway</Badge>}</div></div>)}
                </CardContent>
              </Card>

              <Card className="bg-card/85">
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4 text-sky-300" /> Daily plan</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-3xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm text-foreground">{data.nextMove}</div>
                  <div className="grid gap-3">
                    {data.dailyPlan.map((block) => <div key={block.id} className="rounded-3xl border border-border/60 bg-background/35 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-medium text-foreground">{block.title}</p><p className="text-sm text-muted-foreground">{block.windowLabel}</p></div><Badge variant="outline">planned</Badge></div><p className="mt-3 text-sm text-foreground">{block.detail}</p></div>)}
                  </div>
                </CardContent>
              </Card>
            </section>

            <Card className="bg-card/85">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-sky-300" /> Kid context</CardTitle></CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                {data.kids.map((kid) => <div key={kid.id} className="rounded-3xl border border-border/60 bg-background/35 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-medium text-foreground">{kid.name}</p><p className="text-sm text-muted-foreground">{kid.gradeLabel}</p></div><Badge variant="outline">{kid.interests[0]}</Badge></div><p className="mt-3 text-sm text-foreground">{kid.nextMove}</p><div className="mt-3 flex flex-wrap gap-2">{kid.supportNeeds.map((need) => <Badge key={need} variant="secondary">{need}</Badge>)}</div><div className="mt-3 space-y-2 text-sm text-muted-foreground">{kid.focusBlocks.map((block) => <p key={block}>• {block}</p>)}</div></div>)}
              </CardContent>
            </Card>

            <p className="text-center text-xs text-muted-foreground">{isFetching ? "Refreshing..." : `Generated ${new Date(data.generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}</p>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function StatPill({ label, value, icon: Icon }: { label: string; value: number; icon: typeof CalendarRange }) {
  return <div className="rounded-2xl border border-white/10 bg-background/35 px-3 py-2"><div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div><p className="mt-2 text-xl font-semibold text-foreground">{value}</p></div>;
}

function FailureState() {
  return <Card className="mx-auto max-w-xl border-destructive/30 bg-destructive/10"><CardContent className="flex items-center gap-3 p-5 text-sm text-foreground"><AlertTriangle className="h-5 w-5 text-destructive" />School runway failed to load. Even the homeschool support stack managed to trip over itself.</CardContent></Card>;
}

function SchoolSkeleton() {
  return <div className="mx-auto flex max-w-6xl flex-col gap-4"><Skeleton className="h-40 rounded-[2rem]" /><div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-[32rem] rounded-[2rem]" /><Skeleton className="h-[32rem] rounded-[2rem]" /></div></div>;
}
