"use client";

import { AlertTriangle, CalendarHeart, Heart, Gift, Sparkles, ShieldAlert } from "lucide-react";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useGetDateNightQuery } from "@/store/api/dateNightApi";
import { getJournalDate, shiftJournalDate } from "@/lib/journal-date";

function getCancunTodayDate(): string {
  return getJournalDate();
}

function shiftDate(date: string, amount: number): string {
  return shiftJournalDate(date, amount);
}

function tone(status: "drifting" | "locked-in" | "scheduled") {
  if (status === "drifting") return "border-destructive/25";
  if (status === "locked-in") return "border-chart-3/25";
  return "border-primary/20";
}

function formatEventDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function DateNightBoard({ date, onDateChange }: { date: string; onDateChange: (date: string) => void }) {
  const { data, isLoading, error, isFetching } = useGetDateNightQuery(date);

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
        {isLoading ? <DateNightSkeleton /> : null}
        {!isLoading && error ? <FailureState /> : null}
        {!isLoading && data ? (
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <section className={cn("rounded-[2rem] bg-[linear-gradient(135deg,rgba(244,114,182,0.17),rgba(255,255,255,0.02),rgba(251,191,36,0.12))] p-5 shadow-[0_0_60px_rgba(244,114,182,0.12)]", tone(data.status))}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-primary/80">Date night radar</p>
                  <h1 className="mt-2 text-3xl font-semibold text-foreground">{data.displayDate}</h1>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{data.headline}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <StatPill label="Events" value={data.counts.upcomingEvents} icon={CalendarHeart} />
                  <StatPill label="Ideas" value={data.counts.giftIdeas} icon={Gift} />
                  <StatPill label="Prep" value={data.counts.prepQuestions} icon={Sparkles} />
                </div>
              </div>
            </section>

            {data.warnings.length ? (
              <Card className="border-chart-5/30 bg-chart-5/10">
                <CardContent className="flex items-start gap-3 p-5 text-sm text-foreground">
                  <ShieldAlert className="mt-0.5 h-5 w-5 text-chart-5" />
                  <div className="space-y-1">
                    {data.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <Card className={cn("bg-card/85", data.drift.hasRealDateNight ? "border-chart-3/20" : "border-destructive/20")}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><CalendarHeart className="h-4 w-4 text-primary" /> Relationship status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-3xl border border-border/60 bg-background/35 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Next event</p>
                    <p className="mt-2 text-lg font-medium text-foreground">{data.nextEvent?.title || "Nothing scheduled"}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {data.nextEvent ? `${formatEventDate(data.nextEvent.start)} • ${data.nextEvent.calendar}` : "No real date night found in the next 30 days."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant={data.drift.hasRealDateNight ? "secondary" : "outline"}>{data.status}</Badge>
                      {data.nextEvent ? <Badge variant="outline">{data.nextEvent.daysUntil}d away</Badge> : null}
                      {data.drift.hasCheckInOnly ? <Badge variant="outline">check-in drift</Badge> : null}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {data.partner.nextMoves.map((move) => <p key={move}>• {move}</p>)}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Heart className="h-4 w-4 text-primary" /> Jess context</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Metric label="Budget" value={data.partner.budget} />
                    <Metric label="Last gesture" value={data.drift.staleGestureDays === null ? "none logged" : `${data.drift.staleGestureDays}d ago`} />
                  </div>
                  <div className="rounded-3xl border border-border/60 bg-background/35 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Last logged move</p>
                    <p className="mt-2 text-lg font-medium text-foreground">{data.lastGesture?.gesture || "Nothing logged yet"}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {data.lastGesture ? `${data.lastGesture.date} • ${data.lastGesture.cost} • ${data.lastGesture.notes}` : "The romance log has been sleeping on the job."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.partner.favorites.map((favorite) => <Badge key={favorite} variant="outline">{favorite}</Badge>)}
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Check-in prep</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-3xl border border-border/60 bg-background/35 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Prep source</p>
                    <p className="mt-2 text-lg font-medium text-foreground">{data.prep?.eventTitle || "No prep note found"}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{data.prep?.date || "No saved check-in prep file yet."}</p>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">Questions to ask</p>
                      {(data.prep?.questions || []).slice(0, 4).map((question) => <p key={question}>• {question}</p>)}
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">How not to screw it up</p>
                      {(data.prep?.tips || []).map((tip) => <p key={tip}>• {tip}</p>)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Gift className="h-4 w-4 text-primary" /> Idea bank</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  {data.giftIdeas.length ? data.giftIdeas.map((idea) => (
                    <div key={idea} className="rounded-2xl border border-border/60 bg-background/35 px-3 py-3 text-foreground">{idea}</div>
                  )) : (
                    <div className="rounded-3xl border border-dashed border-border/60 bg-background/25 p-4">
                      There are zero saved Jess gift ideas right now. That is not mysterious, just lazy memory management.
                    </div>
                  )}
                </CardContent>
              </Card>
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

function StatPill({ label, value, icon: Icon }: { label: string; value: number; icon: typeof CalendarHeart }) {
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/35 px-3 py-3 text-center">
      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function FailureState() {
  return (
    <Card className="mx-auto max-w-xl border-destructive/30 bg-destructive/10">
      <CardContent className="flex items-center gap-3 p-5 text-sm text-foreground">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        Date night radar failed to load. Relationship support should not be this slippery.
      </CardContent>
    </Card>
  );
}

function DateNightSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Skeleton className="h-40 rounded-[2rem]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-3xl" />
        <Skeleton className="h-80 rounded-3xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    </div>
  );
}
