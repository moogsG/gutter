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

export interface WeatherWidgetHour {
  time: string;
  temperatureF: number;
  condition: string;
  rainChance?: number;
}

export interface WeatherWidgetData {
  currentTempF: number;
  condition: string;
  highF: number;
  lowF: number;
  rainChance?: number;
  hourly?: WeatherWidgetHour[];
}

export interface WeatherWidgetUiConfig {
  variant?: "hero" | "compact" | "minimal";
  showHourly?: boolean;
  hourlyCount?: number;
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

export type TodayFocusWidget = CalendarWidget | WeatherWidget | UnresolvedTasksWidget;
