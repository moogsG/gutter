"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, Settings2, Calendar, ListChecks, Cloud, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { TodayFocusWidget } from "@/components/journal/today-focus/widget-types";
import { TodayFocusFallbackCard, renderTodayFocusWidget } from "@/components/journal/today-focus/widgets";
import {
  resolveColSpan,
  resolveRowSpan,
  resolveOrder,
  COL_SPAN_CLASSES,
  ROW_SPAN_CLASSES,
} from "@/components/journal/today-focus/grid-layout";

interface PromptResult {
  prompt: {
    id: string;
    title: string;
    prompt_text: string;
    source_type: string;
    ui_config?: string | null;
  };
  content: string;
  error?: string;
  widget?: TodayFocusWidget;
}

interface SummaryMeta {
  cached?: boolean;
  cachedAt?: string;
}

interface MorningViewProps {
  date: string;
  onOpenCapture: () => void;
}

const SOURCE_ICONS = {
  static: Settings2,
  journal_unresolved: ListChecks,
  calendar_today: Calendar,
  meeting_prep_today: Calendar,
  weather: Cloud,
  jira_assigned: ListChecks,
};

/** Parse ui_config JSON safely, returning an empty object on failure */
function parseUiConfig(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

/**
 * Determine the grid cell classes for a given result.
 * Priority: widget.uiConfig.colSpan > prompt.ui_config.colSpan > variant-inferred default
 */
function getCellClasses(result: PromptResult): string {
  const promptUiConfig = parseUiConfig(result.prompt.ui_config);
  // Widget uiConfig takes precedence for typed widgets (it already includes layout fields)
  const effectiveUiConfig = (result.widget?.uiConfig as Record<string, unknown> | undefined) ?? promptUiConfig;

  const colSpan = resolveColSpan(effectiveUiConfig, result.widget);
  const rowSpan = resolveRowSpan(effectiveUiConfig);

  return cn(COL_SPAN_CLASSES[colSpan], ROW_SPAN_CLASSES[rowSpan]);
}

/** Sort results by explicit order field, then by original list position */
function sortResults(results: PromptResult[]): PromptResult[] {
  return [...results].sort((a, b) => {
    const aCfg = parseUiConfig(a.prompt.ui_config);
    const bCfg = parseUiConfig(b.prompt.ui_config);
    const aWidget = a.widget?.uiConfig as Record<string, unknown> | undefined;
    const bWidget = b.widget?.uiConfig as Record<string, unknown> | undefined;
    const aOrder = resolveOrder(aWidget ?? aCfg, results.indexOf(a));
    const bOrder = resolveOrder(bWidget ?? bCfg, results.indexOf(b));
    return aOrder - bOrder;
  });
}

export function MorningView({ date, onOpenCapture }: MorningViewProps) {
  const [results, setResults] = useState<PromptResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<SummaryMeta>({});

  const loadSummary = async (force = false) => {
    try {
      setError(null);
      const url = force ? "/api/morning-view/summary?force=true" : "/api/morning-view/summary";
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to load summary");
      const data = await response.json();
      setResults(data.results || []);
      setMeta({ cached: data.cached, cachedAt: data.cachedAt });
    } catch (err) {
      console.error("Error loading Today Focus:", err);
      setError(err instanceof Error ? err.message : "Failed to load Today Focus");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { loadSummary(); }, [date]);

  const handleRefresh = () => { setIsRefreshing(true); loadSummary(true); };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-primary/60" />
          <div className="text-sm text-muted-foreground">Loading your Today Focus...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 py-6">
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Failed to load Today Focus</p>
              <p className="text-xs text-destructive/80 mt-1">{error}</p>
            </div>
          </div>
        </div>
        <div className="flex justify-center gap-3">
          <Button onClick={() => loadSummary(true)} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
          <Button onClick={onOpenCapture} size="sm" className="gap-2">
            <Sparkles className="w-4 h-4" />
            Start Your Day
          </Button>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="space-y-4 py-6">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-medium text-foreground">Nothing surfaced right now</h3>
          <p className="text-sm text-muted-foreground">
            Your Today Focus prompts exist, but none produced visible items for this run.
          </p>
        </div>
        <div className="flex justify-center gap-3">
          <Link href="/settings/morning-view">
            <Button variant="outline" size="sm" className="gap-2">
              <Settings2 className="w-4 h-4" />
              Review Today Focus Settings
            </Button>
          </Link>
          <Button onClick={handleRefresh} variant="outline" size="sm" className="gap-2" disabled={isRefreshing}>
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
          <Button onClick={onOpenCapture} size="lg" className="gap-2">
            <Sparkles className="w-5 h-5" />
            Start Your Day
          </Button>
        </div>
      </div>
    );
  }

  const sortedResults = sortResults(results);

  return (
    <div className="space-y-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Today Focus
        </h3>
        <div className="flex items-center gap-1">
          <Link href="/settings/morning-view">
            <Button variant="ghost" size="sm" className="h-7 px-2">
              <Settings2 className="w-3.5 h-3.5" />
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="h-7 px-2">
            <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/*
        8-column grid.
        Desktop (≥768px): up to 8 cols active — widgets can be ¼, ½ or full.
        Tablet (640-767px): colSpan 2 becomes half, colSpan 4+ stays full.
        Mobile (<640px): all widgets stack full-width (col-span-8 override).
      */}
      <div className="grid grid-cols-8 gap-3 auto-rows-auto">
        {sortedResults.map((result) => {
          const cellCls = getCellClasses(result);

          if (result.widget) {
            const rendered = renderTodayFocusWidget(result.widget);
            if (rendered) {
              return (
                <div key={result.prompt.id} className={cellCls}>
                  {rendered}
                </div>
              );
            }
          }

          const SourceIcon = SOURCE_ICONS[result.prompt.source_type as keyof typeof SOURCE_ICONS] || Settings2;
          return (
            <div key={result.prompt.id} className={cellCls}>
              <TodayFocusFallbackCard
                title={result.prompt.title}
                content={result.content}
                error={result.error}
                icon={<SourceIcon className="w-3.5 h-3.5" />}
              />
            </div>
          );
        })}
      </div>

      {meta.cached && meta.cachedAt && (
        <div className="flex justify-center">
          <span className="text-[10px] text-muted-foreground/50">
            Cached ·{" "}
            {new Date(meta.cachedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
        </div>
      )}

    </div>
  );
}
