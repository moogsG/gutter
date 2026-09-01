"use client";

import { AlertTriangle, BarChart3, Flame, Megaphone, PenSquare, Rocket, Sparkles } from "lucide-react";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetLinkedInBoardQuery } from "@/store/api/linkedinApi";

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

function LinkedInBoardSkeleton() {
  return <div className="mx-auto flex max-w-6xl flex-col gap-4"><Skeleton className="h-40 rounded-[2rem]" /><div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-48 rounded-3xl" /><Skeleton className="h-48 rounded-3xl" /><Skeleton className="h-48 rounded-3xl" /></div><Skeleton className="h-[34rem] rounded-3xl" /></div>;
}

export function LinkedInBoard({ date, onDateChange }: { date: string; onDateChange: (date: string) => void }) {
  const { data, isLoading, error } = useGetLinkedInBoardQuery(date);

  return (
    <div className="flex h-full flex-col overflow-auto">
      <JournalHeader date={date} onPrevDay={() => onDateChange(shiftDate(date, -1))} onNextDay={() => onDateChange(shiftDate(date, 1))} onToday={() => onDateChange(getCancunTodayDate())} showCapture={false} />
      <main className="flex-1 px-4 py-5 sm:px-6">
        {isLoading ? <LinkedInBoardSkeleton /> : null}
        {!isLoading && error ? <Card className="mx-auto max-w-xl border-destructive/30 bg-destructive/10"><CardContent className="flex items-center gap-3 p-5 text-sm text-foreground"><AlertTriangle className="h-5 w-5 text-destructive" /> LinkedIn cockpit failed to load. Spectacularly unhelpful.</CardContent></Card> : null}
        {!isLoading && data ? (
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <section className="rounded-[2rem] border border-primary/20 bg-[linear-gradient(135deg,rgba(59,130,246,0.16),rgba(255,255,255,0.02),rgba(16,185,129,0.12))] p-5 shadow-[0_0_60px_rgba(59,130,246,0.08)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div><p className="text-xs uppercase tracking-[0.35em] text-primary/80">LinkedIn cockpit</p><h1 className="mt-2 text-3xl font-semibold text-foreground">{data.headline}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">A funding-leverage screen for hooks, lessons, and the next post instead of leaving all of that buried in flat files like a little goblin hoard.</p></div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                  <Card className="border-primary/20 bg-background/35 px-3 py-2"><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Posting gap</p><p className="mt-2 text-xl font-semibold text-foreground">{data.postingGapDays ?? "?"}d</p></Card>
                  <Card className="border-primary/20 bg-background/35 px-3 py-2"><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Drafts ready</p><p className="mt-2 text-xl font-semibold text-foreground">{data.overview.draftCount}</p></Card>
                  <Card className="border-primary/20 bg-background/35 px-3 py-2"><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Logged posts</p><p className="mt-2 text-xl font-semibold text-foreground">{data.overview.totalLoggedPosts}</p></Card>
                  <Card className="border-primary/20 bg-background/35 px-3 py-2"><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Ready hooks</p><p className="mt-2 text-xl font-semibold text-foreground">{data.overview.readyHooks}</p></Card>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <Card className="border-primary/20 bg-card/85"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Rocket className="h-4 w-4 text-primary" /> Next move</CardTitle></CardHeader><CardContent className="space-y-3"><div className="rounded-2xl border border-primary/20 bg-primary/8 p-4"><p className="text-base font-medium text-foreground">{data.nextMove}</p></div><p className="text-sm text-muted-foreground">{data.latestPost ? `Latest logged post: ${data.latestPost.label} on ${data.latestPost.date}.` : "No logged LinkedIn posts found."}</p>{data.latestAnalyticsPost ? <p className="text-xs text-muted-foreground">Latest analytics snapshot: {data.latestAnalyticsPost.label} ({data.latestAnalyticsPost.date}).</p> : null}</CardContent></Card>
              <Card className="bg-card/85"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4 text-primary" /> Best proof on file</CardTitle></CardHeader><CardContent className="space-y-3">{data.bestPost ? <div className="rounded-3xl border border-border/60 bg-background/35 p-4"><div className="flex flex-wrap items-center gap-2"><p className="text-base font-semibold text-foreground">{data.bestPost.label}</p><Badge variant="outline">{data.bestPost.review.classification}</Badge></div><p className="mt-3 text-sm text-muted-foreground">{data.bestPost.hook}</p><div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4"><Card className="border-border/60 bg-background/50 px-3 py-2"><p>Impressions</p><p className="mt-1 text-lg font-semibold text-foreground">{data.bestPost.metrics.impressions.toLocaleString()}</p></Card><Card className="border-border/60 bg-background/50 px-3 py-2"><p>Engagements</p><p className="mt-1 text-lg font-semibold text-foreground">{data.bestPost.metrics.engagements.toLocaleString()}</p></Card><Card className="border-border/60 bg-background/50 px-3 py-2"><p>Followers</p><p className="mt-1 text-lg font-semibold text-foreground">{(data.bestPost.metrics.followersGained ?? 0).toLocaleString()}</p></Card><Card className="border-border/60 bg-background/50 px-3 py-2"><p>Pattern</p><p className="mt-1 text-sm font-semibold text-foreground">{data.bestPost.review.patternToReuse}</p></Card></div></div> : <p className="text-sm text-muted-foreground">No analytics-backed win found.</p>}</CardContent></Card>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className="bg-card/85"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><PenSquare className="h-4 w-4 text-primary" /> Drafts ready to tighten</CardTitle></CardHeader><CardContent className="space-y-3">{data.drafts.map((draft) => <div key={draft.title} className="rounded-3xl border border-border/60 bg-background/35 p-4"><div className="flex flex-wrap items-center gap-2"><p className="text-base font-semibold text-foreground">{draft.title}</p><Badge variant="outline">{draft.wordCount} words</Badge></div><p className="mt-3 text-sm text-muted-foreground">{draft.excerpt}</p><div className="mt-4 rounded-2xl border border-border/50 bg-background/55 p-4"><pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-foreground">{draft.content}</pre></div></div>)}</CardContent></Card>
              <Card className="bg-card/85"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Strong hooks</CardTitle></CardHeader><CardContent className="space-y-3">{data.hooks.slice(0, 6).map((hook) => <div key={hook} className="rounded-2xl border border-border/60 bg-background/35 p-4 text-sm text-foreground">{hook}</div>)}</CardContent></Card>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <Card className="bg-card/85"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Megaphone className="h-4 w-4 text-primary" /> Theme bank</CardTitle></CardHeader><CardContent className="space-y-3">{data.themeBank.map((group) => <div key={group.label} className="rounded-3xl border border-border/60 bg-background/35 p-4"><p className="text-sm font-semibold text-foreground">{group.label}</p><div className="mt-3 flex flex-wrap gap-2">{group.items.slice(0, 4).map((item) => <Badge key={item} variant="secondary" className="whitespace-normal text-left">{item}</Badge>)}</div></div>)}</CardContent></Card>
              <Card className="bg-card/85"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Flame className="h-4 w-4 text-primary" /> High-value angles</CardTitle></CardHeader><CardContent className="space-y-3">{data.angles.slice(0, 6).map((angle) => <div key={angle} className="rounded-2xl border border-border/60 bg-background/35 p-4 text-sm text-foreground">{angle}</div>)}</CardContent></Card>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <Card className="bg-card/85"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Megaphone className="h-4 w-4 text-primary" /> Concrete post prompts</CardTitle></CardHeader><CardContent className="space-y-3">{data.prompts.map((group) => <div key={group.label} className="rounded-3xl border border-border/60 bg-background/35 p-4"><p className="text-sm font-semibold text-foreground">{group.label}</p><div className="mt-3 space-y-2">{group.items.slice(0, 5).map((item) => <p key={item} className="text-sm text-muted-foreground">{item}</p>)}</div></div>)}</CardContent></Card>
              <Card className="bg-card/85"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4 text-primary" /> Post log and analytics history</CardTitle></CardHeader><CardContent className="space-y-3">{data.postLog.map((post) => { const analytics = data.analyticsPosts.find((entry) => entry.date === post.date && entry.label === post.label); return <div key={`${post.date}-${post.label}`} className="rounded-3xl border border-border/60 bg-background/35 p-4"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-foreground">{post.label}</p><Badge variant="outline">{post.goal}</Badge><Badge variant="outline">{post.type}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{post.date}</p><p className="mt-3 text-sm text-foreground">{post.hook}</p><p className="mt-3 text-sm text-muted-foreground">Reuse: {post.patternToReuse}</p>{analytics ? <p className="mt-2 text-xs text-muted-foreground">{analytics.metrics.impressions.toLocaleString()} impressions · {analytics.metrics.engagements.toLocaleString()} engagements · {(analytics.metrics.followersGained ?? 0).toLocaleString()} followers</p> : <p className="mt-2 text-xs text-muted-foreground">No analytics snapshot matched this post yet.</p>}</div>; })}</CardContent></Card>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
