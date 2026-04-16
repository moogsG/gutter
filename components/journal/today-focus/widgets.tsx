"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Cloud,
  ListChecks,
  MapPin,
  AlertCircle,
  Circle,
  PlayCircle,
  Clock,
  Droplets,
  Thermometer,
  Briefcase,
  ExternalLink,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CalendarWidget,
  CalendarWidgetEvent,
  DoNextItem,
  DoNextWidget,
  JiraWidget,
  JiraWidgetItem,
  TodayFocusWidget,
  UnresolvedTaskItem,
  UnresolvedTasksWidget,
  WeatherWidget,
} from "./widget-types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(dateString: string, allDay?: boolean) {
  if (allDay) return "All day";
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getTaskStatusIcon(status: UnresolvedTaskItem["status"], size: "sm" | "xs" = "sm") {
  const cls = size === "xs" ? "w-3 h-3" : "w-3.5 h-3.5";
  switch (status) {
    case "blocked":
      return <AlertCircle className={cn(cls, "text-destructive")} />;
    case "in-progress":
      return <PlayCircle className={cn(cls, "text-primary")} />;
    default:
      return <Circle className={cn(cls, "text-muted-foreground")} />;
  }
}

// ─── Calendar Widget ─────────────────────────────────────────────────────────

/** Timeline: vertical time-rail with dot + connector line */
function CalendarTimeline({ events, showCalendarNames }: { events: CalendarWidgetEvent[]; showCalendarNames: boolean }) {
  return (
    <div className="space-y-0">
      {events.map((event, idx) => (
        <div key={event.id} className="flex gap-3">
          {/* time column */}
          <div className="w-14 shrink-0 text-right">
            <span className="text-[11px] font-semibold text-primary leading-none pt-0.5 block">
              {formatTime(event.startDate, event.allDay)}
            </span>
          </div>
          {/* rail */}
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 rounded-full bg-primary ring-2 ring-primary/20 mt-1 shrink-0" />
            {idx < events.length - 1 && <div className="w-px flex-1 bg-primary/20 my-1" />}
          </div>
          {/* content */}
          <div className={cn("flex-1 min-w-0", idx < events.length - 1 ? "pb-3" : "")}>
            <div className="text-sm font-medium text-foreground leading-tight">{event.title}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              {showCalendarNames && event.calendar && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary/70">{event.calendar}</Badge>
              )}
              {event.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate max-w-[140px]">{event.location}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Agenda: clear table-style rows with distinct time/title/meta columns */
function CalendarAgenda({ events, showCalendarNames }: { events: CalendarWidgetEvent[]; showCalendarNames: boolean }) {
  return (
    <div className="divide-y divide-border/40">
      {events.map((event) => (
        <div key={event.id} className="flex items-start gap-4 py-2.5 first:pt-0 last:pb-0">
          <div className="flex items-center gap-1.5 text-xs text-primary/70 w-16 shrink-0 pt-0.5">
            <Clock className="w-3 h-3 shrink-0" />
            <span className="font-semibold">{formatTime(event.startDate, event.allDay)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground">{event.title}</div>
            {(event.location || event.calendar) && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {event.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {event.location}
                  </span>
                )}
                {showCalendarNames && event.calendar && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{event.calendar}</Badge>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Compact: single-line pill rows, very dense */
function CalendarCompact({ events, showCalendarNames }: { events: CalendarWidgetEvent[]; showCalendarNames: boolean }) {
  return (
    <div className="space-y-1">
      {events.map((event) => (
        <div key={event.id} className="flex items-center gap-2 rounded-md bg-primary/5 border border-primary/10 px-2 py-1">
          <span className="text-[10px] font-mono text-primary w-12 shrink-0">
            {formatTime(event.startDate, event.allDay)}
          </span>
          <span className="text-xs text-foreground truncate flex-1">{event.title}</span>
          {showCalendarNames && event.calendar && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">{event.calendar}</Badge>
          )}
        </div>
      ))}
    </div>
  );
}

export function CalendarTodayWidgetCard({ widget }: { widget: CalendarWidget }) {
  const variant = widget.uiConfig?.variant ?? "timeline";
  const showCalendarNames = widget.uiConfig?.showCalendarNames !== false;
  const events = widget.data.events;

  return (
    <Card className="bg-card/60 backdrop-blur-xl border-border transition-all">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-primary" />
          {widget.title}
          <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 font-normal normal-case tracking-normal">
            {variant}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {widget.summary && <p className="text-sm text-foreground/80 mb-3 leading-relaxed">{widget.summary}</p>}
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events today.</p>
        ) : variant === "agenda" ? (
          <CalendarAgenda events={events} showCalendarNames={showCalendarNames} />
        ) : variant === "compact" ? (
          <CalendarCompact events={events} showCalendarNames={showCalendarNames} />
        ) : (
          <CalendarTimeline events={events} showCalendarNames={showCalendarNames} />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Weather Widget ──────────────────────────────────────────────────────────

/** Hero: full-size temperature-first card with prominent visuals */
function WeatherHero({ widget }: { widget: WeatherWidget }) {
  const d = widget.data;
  const hourlyCount = widget.uiConfig?.hourlyCount ?? 4;
  const showHourly = widget.uiConfig?.showHourly !== false;
  const unit = widget.uiConfig?.unit ?? "C";
  const sym = `°${unit}`;
  const hours = showHourly ? (d.hourly ?? []).slice(0, hourlyCount) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4">
        <div>
          <div className="text-6xl font-thin text-primary leading-none">{d.currentTemp}{sym}</div>
          <div className="text-base text-foreground/80 mt-2 font-medium">{d.condition}</div>
        </div>
        <div className="ml-auto text-right space-y-1 pb-1">
          <div className="flex items-center justify-end gap-1.5 text-sm text-foreground/70">
            <Thermometer className="w-3.5 h-3.5 text-primary" />
            <span className="font-semibold text-foreground">{d.high}{sym}</span>
            <span className="text-muted-foreground">/ {d.low}{sym}</span>
          </div>
          {typeof d.rainChance === "number" && (
            <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
              <Droplets className="w-3 h-3 text-accent" />
              <span>{d.rainChance}% rain</span>
            </div>
          )}
        </div>
      </div>
      {widget.summary && <p className="text-sm text-foreground/80 leading-relaxed">{widget.summary}</p>}
      {hours.length > 0 && (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${hours.length}, 1fr)` }}>
          {hours.map((h) => (
            <div key={h.time} className="rounded-lg border border-primary/15 bg-primary/5 px-2 py-2 text-center">
              <div className="text-[10px] text-muted-foreground">{h.time}</div>
              <div className="text-sm font-semibold text-primary mt-1">{h.temperature}{sym}</div>
              {typeof h.rainChance === "number" && (
                <div className="text-[10px] text-accent mt-0.5">{h.rainChance}%</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Compact: mid-size, two-column layout, minimal chrome */
function WeatherCompact({ widget }: { widget: WeatherWidget }) {
  const d = widget.data;
  const showHourly = widget.uiConfig?.showHourly !== false;
  const hourlyCount = widget.uiConfig?.hourlyCount ?? 4;
  const unit = widget.uiConfig?.unit ?? "C";
  const sym = `°${unit}`;
  const hours = showHourly ? (d.hourly ?? []).slice(0, hourlyCount) : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/15 px-3 py-2.5">
        <div className="text-3xl font-semibold text-primary">{d.currentTemp}{sym}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-foreground/80">{d.condition}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            H {d.high}{sym} · L {d.low}{sym}
            {typeof d.rainChance === "number" ? ` · ${d.rainChance}% rain` : ""}
          </div>
        </div>
      </div>
      {hours.length > 0 && (
        <div className="flex gap-1">
          {hours.map((h) => (
            <div key={h.time} className="flex-1 text-center py-1.5 rounded-md bg-primary/5 border border-primary/10">
              <div className="text-[10px] text-muted-foreground">{h.time}</div>
              <div className="text-xs font-semibold text-primary mt-0.5">{h.temperature}{sym}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Minimal: single-line low-chrome layout */
function WeatherMinimal({ widget }: { widget: WeatherWidget }) {
  const d = widget.data;
  const unit = widget.uiConfig?.unit ?? "C";
  const sym = `°${unit}`;
  return (
    <div className="flex items-center gap-3 py-0.5">
      <span className="text-2xl font-semibold text-primary">{d.currentTemp}{sym}</span>
      <div className="h-5 w-px bg-border" />
      <span className="text-sm text-foreground/70">{d.condition}</span>
      <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
        <span className="text-foreground/70 font-medium">{d.high}{sym}</span>
        <span>/</span>
        <span>{d.low}{sym}</span>
        {typeof d.rainChance === "number" && (
          <>
            <div className="h-3 w-px bg-border" />
            <Droplets className="w-3 h-3 text-accent" />
            <span>{d.rainChance}%</span>
          </>
        )}
      </div>
    </div>
  );
}

export function WeatherWidgetCard({ widget }: { widget: WeatherWidget }) {
  const variant = widget.uiConfig?.variant ?? "hero";

  return (
    <Card className="bg-card/60 backdrop-blur-xl border-border transition-all overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Cloud className="w-3.5 h-3.5 text-primary" />
          {widget.title}
          <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 font-normal normal-case tracking-normal">
            {variant}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {variant === "minimal" ? (
          <WeatherMinimal widget={widget} />
        ) : variant === "compact" ? (
          <WeatherCompact widget={widget} />
        ) : (
          <WeatherHero widget={widget} />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Unresolved Tasks Widget ──────────────────────────────────────────────────

/** Sections variant: grouped by status with headers and bordered cards */
function TasksSections({
  widget,
}: {
  widget: UnresolvedTasksWidget;
}) {
  const showLane = widget.uiConfig?.showLane !== false;
  const showWaitingOn = widget.uiConfig?.showWaitingOn !== false;
  const max = widget.uiConfig?.maxItemsPerSection ?? 3;

  const groups: { title: string; items: UnresolvedTaskItem[]; accent: string; labelCls: string }[] = [
    { title: "Blocked", items: widget.data.blocked.slice(0, max), accent: "border-l-destructive", labelCls: "text-destructive/70" },
    { title: "In Progress", items: widget.data.inProgress.slice(0, max), accent: "border-l-primary", labelCls: "text-primary/70" },
    { title: "Top Open", items: widget.data.topOpen.slice(0, max), accent: "border-l-accent/50", labelCls: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-4">
      {groups.map(({ title, items, accent, labelCls }) => {
        if (items.length === 0) return null;
        return (
          <div key={title} className="space-y-1.5">
            <div className={cn("text-[10px] font-semibold uppercase tracking-wider", labelCls)}>{title}</div>
            <div className="space-y-1.5">
              {items.map((task) => (
                <div
                  key={task.id}
                  className={cn("rounded-lg border border-border/60 bg-background/40 border-l-2 px-3 py-2", accent)}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 shrink-0">{getTaskStatusIcon(task.status)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-foreground">{task.text}</div>
                      {(task.priority || (showLane && task.lane) || (showWaitingOn && task.waitingOn)) && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          {task.priority && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{task.priority}</Badge>
                          )}
                          {showLane && task.lane && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{task.lane}</Badge>
                          )}
                          {showWaitingOn && task.waitingOn && <span>Waiting on {task.waitingOn}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Compact variant: flat dense list, no section borders, dividers only */
function TasksCompact({ widget }: { widget: UnresolvedTasksWidget }) {
  const showLane = widget.uiConfig?.showLane !== false;
  const max = widget.uiConfig?.maxItemsPerSection ?? 3;

  const allItems: UnresolvedTaskItem[] = [
    ...widget.data.blocked.slice(0, max),
    ...widget.data.inProgress.slice(0, max),
    ...widget.data.topOpen.slice(0, max),
  ];

  return (
    <div className="divide-y divide-border/30">
      {allItems.map((task) => (
        <div key={task.id} className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0">
          <div className="shrink-0">{getTaskStatusIcon(task.status, "xs")}</div>
          <span className="flex-1 text-xs text-foreground truncate">{task.text}</span>
          {showLane && task.lane && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">{task.lane}</Badge>
          )}
          {task.priority && task.priority !== "normal" && (
            <Badge
              variant="outline"
              className={cn(
                "text-[9px] px-1 py-0 shrink-0",
                task.priority === "high" && "border-destructive/50 text-destructive"
              )}
            >
              {task.priority}
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
}

export function UnresolvedTasksWidgetCard({ widget }: { widget: UnresolvedTasksWidget }) {
  const variant = widget.uiConfig?.variant ?? "sections";
  const counts = widget.data.counts;

  return (
    <Card className="bg-card/60 backdrop-blur-xl border-border transition-all">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <ListChecks className="w-3.5 h-3.5 text-primary" />
          {widget.title}
          <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 font-normal normal-case tracking-normal">
            {variant}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          {counts.blocked > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              {counts.blocked} blocked
            </Badge>
          )}
          {counts.inProgress > 0 && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0">
              {counts.inProgress} in progress
            </Badge>
          )}
          {counts.open > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {counts.open} open
            </Badge>
          )}
        </div>

        {widget.summary && <p className="text-sm text-foreground/80 leading-relaxed">{widget.summary}</p>}

        {variant === "compact" ? (
          <TasksCompact widget={widget} />
        ) : (
          <TasksSections widget={widget} />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Jira Widget ─────────────────────────────────────────────────────────────

function jiraPriorityBadgeCls(priority: string): string {
  const p = priority.toLowerCase();
  if (p.includes("highest") || p.includes("critical") || p.includes("blocker")) {
    return "border-destructive/60 text-destructive bg-destructive/5";
  }
  if (p.includes("high")) return "border-orange-500/50 text-orange-400 bg-orange-500/5";
  if (p.includes("medium") || p.includes("normal")) return "border-border text-muted-foreground";
  return "border-border/50 text-muted-foreground/60";
}

function JiraIssueRow({ item, showPriority, showStatus }: { item: JiraWidgetItem; showPriority: boolean; showStatus: boolean }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-2.5 rounded-lg border border-border/50 bg-background/40 px-3 py-2 transition-colors hover:bg-background/70 hover:border-primary/30 no-underline"
    >
      <span className="mt-0.5 shrink-0 font-mono text-[10px] font-semibold text-primary/70 w-16 truncate group-hover:text-primary transition-colors">
        {item.key}
      </span>
      <span className="flex-1 min-w-0 text-sm text-foreground leading-snug">{item.summary}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        {showStatus && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 normal-case font-normal">
            {item.status}
          </Badge>
        )}
        {showPriority && item.priority && (
          <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 normal-case font-normal", jiraPriorityBadgeCls(item.priority))}>
            {item.priority}
          </Badge>
        )}
        <ExternalLink className="w-3 h-3 text-muted-foreground/40 group-hover:text-primary/60 transition-colors shrink-0" />
      </div>
    </a>
  );
}

function JiraGrouped({ widget }: { widget: JiraWidget }) {
  const showPriority = widget.uiConfig?.showPriority !== false;
  const showStatus = widget.uiConfig?.showStatus !== false;
  const max = widget.uiConfig?.maxItemsPerSection ?? 3;

  const groups: { title: string; items: JiraWidgetItem[]; accentCls: string; labelCls: string }[] = [
    { title: "Urgent", items: widget.data.urgent.slice(0, max), accentCls: "border-l-destructive", labelCls: "text-destructive/70" },
    { title: "Blocked", items: widget.data.blocked.slice(0, max), accentCls: "border-l-orange-500/70", labelCls: "text-orange-400/80" },
    { title: "Active", items: widget.data.active.slice(0, max), accentCls: "border-l-primary", labelCls: "text-primary/70" },
  ];

  return (
    <div className="space-y-4">
      {groups.map(({ title, items, accentCls, labelCls }) => {
        if (items.length === 0) return null;
        return (
          <div key={title} className="space-y-1.5">
            <div className={cn("text-[10px] font-semibold uppercase tracking-wider", labelCls)}>{title}</div>
            <div className="space-y-1.5">
              {items.map((item) => (
                <a
                  key={item.key}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "group flex items-start gap-2.5 rounded-lg border border-border/50 bg-background/40 border-l-2 px-3 py-2 transition-colors hover:bg-background/70 no-underline",
                    accentCls
                  )}
                >
                  <span className="mt-0.5 shrink-0 font-mono text-[10px] font-semibold text-primary/70 w-16 truncate group-hover:text-primary transition-colors">
                    {item.key}
                  </span>
                  <span className="flex-1 min-w-0 text-sm text-foreground leading-snug">{item.summary}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {showStatus && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 normal-case font-normal">
                        {item.status}
                      </Badge>
                    )}
                    {showPriority && item.priority && (
                      <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 normal-case font-normal", jiraPriorityBadgeCls(item.priority))}>
                        {item.priority}
                      </Badge>
                    )}
                    <ExternalLink className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary/60 transition-colors shrink-0" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function JiraCompact({ widget }: { widget: JiraWidget }) {
  const max = widget.uiConfig?.maxItemsPerSection ?? 3;
  const showPriority = widget.uiConfig?.showPriority !== false;

  const allItems: JiraWidgetItem[] = [
    ...widget.data.urgent.slice(0, max),
    ...widget.data.blocked.slice(0, max),
    ...widget.data.active.slice(0, max),
  ];

  return (
    <div className="divide-y divide-border/30">
      {allItems.map((item) => (
        <a
          key={item.key}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2 py-1.5 first:pt-0 last:pb-0 no-underline hover:opacity-80 transition-opacity"
        >
          <span className="shrink-0 font-mono text-[10px] font-semibold text-primary/70 w-14 group-hover:text-primary transition-colors">
            {item.key}
          </span>
          <span className="flex-1 text-xs text-foreground truncate">{item.summary}</span>
          {showPriority && (
            <Badge variant="outline" className={cn("text-[9px] px-1 py-0 shrink-0 normal-case font-normal", jiraPriorityBadgeCls(item.priority))}>
              {item.priority}
            </Badge>
          )}
          <ExternalLink className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary/50 transition-colors shrink-0" />
        </a>
      ))}
    </div>
  );
}

export function JiraWidgetCard({ widget }: { widget: JiraWidget }) {
  const variant = widget.uiConfig?.variant ?? "grouped";
  const { counts } = widget.data;

  return (
    <Card className="bg-card/60 backdrop-blur-xl border-border transition-all">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Briefcase className="w-3.5 h-3.5 text-primary" />
          {widget.title}
          <div className="ml-auto flex items-center gap-1.5">
            {counts.urgent > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {counts.urgent} urgent
              </Badge>
            )}
            {counts.blocked > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-500/50 text-orange-400">
                {counts.blocked} blocked
              </Badge>
            )}
            {counts.active > 0 && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0">
                {counts.active} active
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {widget.data.totalShown === 0 ? (
          <p className="text-sm text-muted-foreground">No active Jira issues.</p>
        ) : variant === "compact" ? (
          <JiraCompact widget={widget} />
        ) : (
          <JiraGrouped widget={widget} />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Do Next Widget ───────────────────────────────────────────────────────────

function DoNextTaskRow({ item, showLane }: { item: DoNextItem; showLane: boolean }) {
  const isInProgress = item.status === "in-progress";
  const isHighPriority = item.priority === "high";

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors",
        isInProgress
          ? "border-primary/30 bg-primary/5"
          : isHighPriority
          ? "border-destructive/25 bg-destructive/5"
          : "border-border/50 bg-background/40"
      )}
    >
      <div className="mt-0.5 shrink-0">
        {isInProgress ? (
          <PlayCircle className="w-3.5 h-3.5 text-primary" />
        ) : (
          <Circle className="w-3.5 h-3.5 text-muted-foreground/60" />
        )}
      </div>
      <span className="flex-1 min-w-0 text-sm text-foreground leading-snug">{item.text}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        {isHighPriority && !isInProgress && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-destructive/50 text-destructive">
            high
          </Badge>
        )}
        {showLane && item.lane && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 normal-case font-normal">
            {item.lane}
          </Badge>
        )}
      </div>
    </div>
  );
}

function DoNextFocused({ widget }: { widget: DoNextWidget }) {
  const showLane = widget.uiConfig?.showLane !== false;
  const maxInProgress = widget.uiConfig?.maxInProgress ?? 3;
  const maxOpen = widget.uiConfig?.maxOpen ?? 3;

  const inProgress = widget.data.inProgress.slice(0, maxInProgress);
  const topOpen = widget.data.topOpen.slice(0, maxOpen);

  return (
    <div className="space-y-4">
      {inProgress.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">In Progress</div>
          <div className="space-y-1.5">
            {inProgress.map((item) => (
              <DoNextTaskRow key={item.id} item={item} showLane={showLane} />
            ))}
          </div>
        </div>
      )}
      {topOpen.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Up Next</div>
          <div className="space-y-1.5">
            {topOpen.map((item) => (
              <DoNextTaskRow key={item.id} item={item} showLane={showLane} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DoNextCompact({ widget }: { widget: DoNextWidget }) {
  const showLane = widget.uiConfig?.showLane !== false;
  const maxInProgress = widget.uiConfig?.maxInProgress ?? 3;
  const maxOpen = widget.uiConfig?.maxOpen ?? 3;

  const allItems = [
    ...widget.data.inProgress.slice(0, maxInProgress),
    ...widget.data.topOpen.slice(0, maxOpen),
  ];

  return (
    <div className="divide-y divide-border/30">
      {allItems.map((item) => (
        <div key={item.id} className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0">
          <div className="shrink-0">
            {item.status === "in-progress" ? (
              <PlayCircle className="w-3 h-3 text-primary" />
            ) : (
              <Circle className="w-3 h-3 text-muted-foreground/50" />
            )}
          </div>
          <span className="flex-1 text-xs text-foreground truncate">{item.text}</span>
          {item.priority === "high" && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 border-destructive/50 text-destructive">high</Badge>
          )}
          {showLane && item.lane && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 normal-case font-normal">{item.lane}</Badge>
          )}
        </div>
      ))}
    </div>
  );
}

export function DoNextWidgetCard({ widget }: { widget: DoNextWidget }) {
  const variant = widget.uiConfig?.variant ?? "focused";
  const { counts } = widget.data;
  const total = counts.inProgress + counts.open;

  return (
    <Card className="bg-card/60 backdrop-blur-xl border-border transition-all">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-primary" />
          {widget.title}
          <div className="ml-auto flex items-center gap-1.5">
            {counts.inProgress > 0 && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0">
                {counts.inProgress} active
              </Badge>
            )}
            {counts.open > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {counts.open} open
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">Working set is clear.</p>
        ) : variant === "compact" ? (
          <DoNextCompact widget={widget} />
        ) : (
          <DoNextFocused widget={widget} />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Dispatch ────────────────────────────────────────────────────────────────

export function renderTodayFocusWidget(widget: TodayFocusWidget) {
  switch (widget.type) {
    case "calendar_today":
      return <CalendarTodayWidgetCard widget={widget} />;
    case "weather":
      return <WeatherWidgetCard widget={widget} />;
    case "journal_unresolved":
      return <UnresolvedTasksWidgetCard widget={widget} />;
    case "jira_assigned":
      return <JiraWidgetCard widget={widget} />;
    case "journal_do_next":
      return <DoNextWidgetCard widget={widget} />;
    default:
      return null;
  }
}

export function TodayFocusFallbackCard({
  title,
  content,
  error,
  icon,
}: {
  title: string;
  content: string;
  error?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "bg-card/60 backdrop-blur-xl border-border transition-all",
        error && "border-destructive/30 bg-destructive/5"
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : (
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{content}</p>
        )}
      </CardContent>
    </Card>
  );
}
