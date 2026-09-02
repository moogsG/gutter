"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CalendarDays, CheckCircle2, Clock3, Eye, FileCheck2, Loader2, NotebookTabs, Sparkles } from "lucide-react";
import { MeetingDrawer } from "@/components/meeting/MeetingDrawer";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useGetMeetingPrepQueueQuery, useRequestPrepMutation } from "@/store/api/meetingPrepApi";
import type { MeetingPrep, MeetingPrepQueueItem } from "@/types";

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

function formatMeetingTime(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function prepTone(meeting: MeetingPrepQueueItem) {
  if (meeting.prepStatus === "ready") return "border-emerald-500/30 bg-emerald-500/10";
  if (meeting.urgency === "later") return "border-primary/20 bg-primary/5";
  return "border-destructive/30 bg-destructive/10";
}

function QueueSection({
  title,
  subtitle,
  items,
  tone,
  onOpen,
  onPrep,
  preppingId,
}: {
  title: string;
  subtitle: string;
  items: MeetingPrepQueueItem[];
  tone: string;
  onOpen: (meeting: MeetingPrepQueueItem) => void;
  onPrep: (meeting: MeetingPrepQueueItem) => void;
  preppingId: string | null;
}) {
  return (
    <Card className={cn("bg-card/85", tone)}>
      <CardHeader>
        <CardTitle className="text-base text-foreground">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? items.map((meeting) => (
          <div key={meeting.id} className={cn("rounded-2xl border p-3", prepTone(meeting))}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium leading-relaxed text-foreground">{meeting.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatMeetingTime(meeting.startDate)} • {meeting.calendar}{meeting.location ? ` • ${meeting.location}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant={meeting.prepStatus === "ready" ? "default" : "outline"}>{meeting.prepStatus}</Badge>
                  <Badge variant="outline">{meeting.urgency}</Badge>
                  {meeting.hoursUntil !== null ? <Badge variant="outline">{meeting.hoursUntil}h out</Badge> : null}
                  {meeting.hasPrepNotes ? <Badge variant="outline">prep notes</Badge> : null}
                  {meeting.hasSummary ? <Badge variant="outline">summary</Badge> : null}
                  {meeting.hasTranscript ? <Badge variant="outline">transcript</Badge> : null}
                  {meeting.actionItemCount ? <Badge variant="outline">{meeting.actionItemCount} actions</Badge> : null}
                </div>
              </div>
              <Link
                href={`/day/${meeting.occurrenceDate}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2 py-1 text-xs text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
              >
                Open day
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={meeting.prepStatus === "ready" ? "outline" : "default"}
                onClick={() => onPrep(meeting)}
                disabled={meeting.prepStatus === "preparing" || preppingId === meeting.id}
              >
                {preppingId === meeting.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {meeting.prepStatus === "ready" ? "Refresh prep" : meeting.prepStatus === "preparing" ? "Preparing..." : "Prep now"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onOpen(meeting)}>
                <Eye className="h-4 w-4" />
                {meeting.hasPrepNotes || meeting.hasSummary || meeting.hasTranscript ? "View prep" : "Open drawer"}
              </Button>
            </div>
          </div>
        )) : <p className="text-sm text-muted-foreground">Nothing in this lane. Miracles happen.</p>}
      </CardContent>
    </Card>
  );
}

export function MeetingPrepQueueBoard({ date, onDateChange }: { date: string; onDateChange: (date: string) => void }) {
  const { data, isLoading, error, isFetching } = useGetMeetingPrepQueueQuery(date);
  const [requestPrep] = useRequestPrepMutation();
  const [activeMeeting, setActiveMeeting] = useState<MeetingPrepQueueItem | null>(null);
  const [preppingId, setPreppingId] = useState<string | null>(null);

  const handlePrep = async (meeting: MeetingPrepQueueItem) => {
    try {
      setPreppingId(meeting.id);
      await requestPrep({
        eventId: meeting.eventId,
        title: meeting.title,
        time: meeting.startDate,
        calendar: meeting.calendar,
        occurrenceDate: meeting.occurrenceDate,
      }).unwrap();
    } finally {
      setPreppingId(null);
    }
  };

  const activeMeetingForDrawer: MeetingPrep | null = activeMeeting
    ? {
        id: activeMeeting.id,
        eventId: activeMeeting.eventId,
        title: activeMeeting.title,
        time: activeMeeting.startDate,
        calendar: activeMeeting.calendar,
        occurrenceDate: activeMeeting.occurrenceDate,
        prepNotes: null,
        prepStatus: activeMeeting.prepStatus,
        transcript: null,
        summary: null,
        actionItems: null,
      }
    : null;

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
        {isLoading ? <MeetingQueueSkeleton /> : null}
        {!isLoading && error ? <FailureState /> : null}
        {!isLoading && data ? (
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <section className="rounded-[2rem] border border-primary/20 bg-[linear-gradient(135deg,rgba(255,61,154,0.16),rgba(255,255,255,0.02),rgba(56,189,248,0.08))] p-5 shadow-[0_0_60px_rgba(255,61,154,0.08)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-primary/80">Meeting runway</p>
                  <h1 className="mt-2 text-3xl font-semibold text-foreground">{data.displayRange}</h1>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    One obvious screen for the meetings about to land on your face, whether prep exists, and which day to open before you improvise yourself into a ditch.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                  <StatPill icon={AlertTriangle} label="Red zone" value={data.counts.redZone} />
                  <StatPill icon={CheckCircle2} label="Ready" value={data.counts.ready} />
                  <StatPill icon={Clock3} label="Later" value={data.counts.later} />
                  <StatPill icon={FileCheck2} label="Captured" value={data.counts.notesCaptured} />
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <Card className="border-primary/20 bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><NotebookTabs className="h-4 w-4 text-primary" /> How to use it</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>1. Clear the red zone first. Those are today or tomorrow meetings without ready prep.</p>
                  <p>2. Open the day page from any card to capture notes or prep in the place that already owns the context.</p>
                  <p>3. Use the ready lane as proof you do not need to mentally carry every damn meeting yourself.</p>
                </CardContent>
              </Card>

              <Card className="bg-card/85">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-primary" /> Week load</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>{data.counts.total} meetings are on the runway for this seven-day window.</p>
                  <p>{data.counts.redZone} need attention fast because the prep is missing or still half-baked.</p>
                  <p>{data.counts.notesCaptured} already have prep notes, summaries, transcripts, or action items tied to their occurrence.</p>
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 xl:grid-cols-3">
              <QueueSection
                title="Red Zone"
                subtitle="Today and tomorrow, but not actually ready."
                items={data.groups.redZone}
                tone="border-destructive/20"
                onOpen={setActiveMeeting}
                onPrep={(meeting) => void handlePrep(meeting)}
                preppingId={preppingId}
              />
              <QueueSection
                title="Ready"
                subtitle="Prep is marked ready, so your future self can stop clutching it."
                items={data.groups.ready}
                tone="border-emerald-500/20"
                onOpen={setActiveMeeting}
                onPrep={(meeting) => void handlePrep(meeting)}
                preppingId={preppingId}
              />
              <QueueSection
                title="Later This Week"
                subtitle="Upcoming meetings that still need prep, but not immediately."
                items={data.groups.later}
                tone="border-primary/20"
                onOpen={setActiveMeeting}
                onPrep={(meeting) => void handlePrep(meeting)}
                preppingId={preppingId}
              />
            </section>

            <p className="text-center text-xs text-muted-foreground">
              {isFetching ? "Refreshing..." : `Generated ${new Date(data.generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
            </p>
          </div>
        ) : null}
      </main>
      {activeMeetingForDrawer ? (
        <MeetingDrawer
          meeting={activeMeetingForDrawer}
          open={Boolean(activeMeetingForDrawer)}
          onClose={() => setActiveMeeting(null)}
        />
      ) : null}
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

function FailureState() {
  return (
    <Card className="mx-auto max-w-xl border-destructive/30 bg-destructive/10">
      <CardContent className="flex items-center gap-3 p-5 text-sm text-foreground">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        Meeting runway failed to load. The calendar stack is acting precious again.
      </CardContent>
    </Card>
  );
}

function MeetingQueueSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Skeleton className="h-40 rounded-[2rem]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-48 rounded-3xl" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-96 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    </div>
  );
}
