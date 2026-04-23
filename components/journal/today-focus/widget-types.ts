// Re-export so consumers get the full picture from one import
export type { WidgetLayoutConfig } from "./grid-layout";

export type TodayFocusWidgetState = "ready" | "empty" | "error";

export interface TodayFocusWidgetAction {
  id: string;
  label: string;
  kind: "link" | "api" | "dialog";
  href?: string;
}

export interface TodayFocusWidgetBase<TType extends string, TData, TUiConfig = Record<string, unknown>> {
  id: string;
  type: TType;
  title: string;
  subtitle?: string;
  summary?: string;
  state: TodayFocusWidgetState;
  data: TData;
  uiConfig?: TUiConfig;
  actions?: TodayFocusWidgetAction[];
  error?: string;
}

export interface CalendarWidgetEvent {
  id: string;
  title: string;
  startDate: string;
  endDate?: string;
  allDay?: boolean;
  location?: string;
  calendar?: string;
}

export interface CalendarWidgetData {
  totalEvents: number;
  nextEventStart?: string;
  events: CalendarWidgetEvent[];
}

export interface CalendarWidgetUiConfig {
  variant?: "timeline" | "agenda" | "compact";
  maxItems?: number;
  showCalendarNames?: boolean;
}

export type CalendarWidget = TodayFocusWidgetBase<"calendar_today", CalendarWidgetData, CalendarWidgetUiConfig>;

export type WeatherUnit = "C" | "F";

export interface WeatherWidgetHour {
  time: string;
  /** Temperature in the unit specified by WeatherWidgetUiConfig.unit */
  temperature: number;
  condition: string;
  rainChance?: number;
}

export interface WeatherWidgetData {
  /** Current temperature in the unit specified by WeatherWidgetUiConfig.unit */
  currentTemp: number;
  condition: string;
  /** High in the unit specified by WeatherWidgetUiConfig.unit */
  high: number;
  /** Low in the unit specified by WeatherWidgetUiConfig.unit */
  low: number;
  rainChance?: number;
  hourly?: WeatherWidgetHour[];
}

export interface WeatherWidgetUiConfig {
  variant?: "hero" | "compact" | "minimal";
  showHourly?: boolean;
  hourlyCount?: number;
  /** Temperature unit — C or F. Default: C */
  unit?: WeatherUnit;
  /** Explicit weather location, e.g. "Tulum" or "Tulum, Quintana Roo" */
  location?: string;
}

export type WeatherWidget = TodayFocusWidgetBase<"weather", WeatherWidgetData, WeatherWidgetUiConfig>;

export interface UnresolvedTaskItem {
  id: string;
  text: string;
  status: "open" | "in-progress" | "blocked";
  priority?: "high" | "normal" | "low";
  lane?: string | null;
  waitingOn?: string | null;
  date?: string;
}

export interface UnresolvedTasksWidgetData {
  counts: {
    blocked: number;
    inProgress: number;
    open: number;
  };
  blocked: UnresolvedTaskItem[];
  inProgress: UnresolvedTaskItem[];
  topOpen: UnresolvedTaskItem[];
}

export interface UnresolvedTasksWidgetUiConfig {
  variant?: "sections" | "compact";
  maxItemsPerSection?: number;
  showLane?: boolean;
  showWaitingOn?: boolean;
  showInlineActions?: boolean;
}

export type UnresolvedTasksWidget = TodayFocusWidgetBase<"journal_unresolved", UnresolvedTasksWidgetData, UnresolvedTasksWidgetUiConfig>;

// ─── Jira Widget ─────────────────────────────────────────────────────────────

export type JiraIssueGroup = "urgent" | "blocked" | "active";

export interface JiraWidgetItem {
  key: string;
  summary: string;
  status: string;
  priority: string;
  url: string;
  group: JiraIssueGroup;
}

export interface JiraWidgetData {
  counts: {
    urgent: number;
    blocked: number;
    active: number;
  };
  urgent: JiraWidgetItem[];
  blocked: JiraWidgetItem[];
  active: JiraWidgetItem[];
  totalShown: number;
}

export interface JiraWidgetUiConfig {
  variant?: "grouped" | "compact";
  maxItemsPerSection?: number;
  showPriority?: boolean;
  showStatus?: boolean;
}

export type JiraWidget = TodayFocusWidgetBase<"jira_assigned", JiraWidgetData, JiraWidgetUiConfig>;

// ─── Do Next Widget ──────────────────────────────────────────────────────────

export interface DoNextItem {
  id: string;
  text: string;
  status: "open" | "in-progress";
  priority?: "high" | "normal" | "low";
  lane?: string | null;
}

export interface DoNextWidgetData {
  inProgress: DoNextItem[];
  topOpen: DoNextItem[];
  counts: {
    inProgress: number;
    open: number;
  };
}

export interface DoNextWidgetUiConfig {
  variant?: "focused" | "compact";
  maxInProgress?: number;
  maxOpen?: number;
  showLane?: boolean;
}

export type DoNextWidget = TodayFocusWidgetBase<"journal_do_next", DoNextWidgetData, DoNextWidgetUiConfig>;

export type TodayFocusWidget = CalendarWidget | WeatherWidget | UnresolvedTasksWidget | JiraWidget | DoNextWidget;
