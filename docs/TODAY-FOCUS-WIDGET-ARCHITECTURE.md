# Today Focus Widget Architecture

## Why this exists

Today Focus currently treats every prompt result as the same shape:

- prompt metadata
- `content: string`
- optional error

That got us moving, but it is the wrong shape for where the product wants to go.

Moogs wants Today Focus to feel:

- more personal
- more glanceable
- more configurable per widget
- more interactive
- more visually distinct per source

That means the current model, "prompt generates a blob of text and the UI renders a generic card," needs to evolve into a real widget system.

## Current problems

### 1. Everything is flattened into text

Right now `calendar_today`, `weather`, `journal_unresolved`, `jira_assigned`, and `meeting_prep_today` all end up as `content: string`.

That blocks:

- timeline layouts for calendar
- real weather cards
- grouped task lists with actions
- status badges and counts
- structured empty states
- widget-specific affordances

### 2. UI and data are coupled in the worst possible way

The backend decides presentation by producing prose.
The frontend can only render prose.

That means every visual improvement becomes an LLM/prompt hack instead of a product/system improvement.

### 3. Prompt config is not widget config

`morning_view_prompts` currently describes orchestration:

- title
- prompt_text
- source_type
- source_config
- frequency
- active
- sort_order

It does **not** describe:

- layout variant
- density
- max items shown
- icon/accent treatment
- whether to show summary
- whether to show actions
- behavior when empty

### 4. Interactivity is blocked

If unresolved tasks are a paragraph, we cannot cleanly support:

- mark done
- move to today
- snooze
- open task
- create follow-up

The UI needs structured task objects, not narration.

## Product direction

Today Focus should become a typed widget system.

The architecture should be:

1. **source adapter** fetches raw source data
2. **normalizer** converts it into typed widget data
3. **optional AI summarizer** adds short personal/contextual commentary
4. **widget renderer** owns the visual treatment for that widget type
5. **widget UI config** controls layout and behavior per widget instance

The key principle:

**Structured data drives the UI. AI adds flavor, not primary structure.**

## Target response shape

## Base envelope

```ts
type WidgetState = "ready" | "empty" | "error";

type WidgetAction = {
  id: string;
  label: string;
  kind: "api" | "link" | "dialog";
  href?: string;
  api?: {
    endpoint: string;
    method?: "POST" | "PATCH" | "DELETE";
    body?: Record<string, unknown>;
  };
  confirm?: string;
  icon?: string;
};

type WidgetEnvelope<TType extends string, TData, TUiConfig> = {
  id: string;
  type: TType;
  title: string;
  subtitle?: string;
  summary?: string;
  state: WidgetState;
  data: TData;
  uiConfig?: TUiConfig;
  actions?: WidgetAction[];
  error?: string;
  lastUpdatedAt?: string;
};
```

## Widget data contracts

### Calendar widget

```ts
type CalendarEventItem = {
  id: string;
  title: string;
  startDate: string;
  endDate?: string;
  allDay?: boolean;
  location?: string;
  calendar?: string;
  prepStatus?: "none" | "partial" | "ready";
};

type CalendarWidgetData = {
  totalEvents: number;
  nextEventStart?: string;
  events: CalendarEventItem[];
};

type CalendarWidgetUiConfig = {
  variant?: "timeline" | "agenda" | "compact";
  maxItems?: number;
  showCalendarNames?: boolean;
  showPrepStatus?: boolean;
  emptyStateMode?: "minimal" | "encouraging";
};
```

### Weather widget

```ts
type WeatherHour = {
  time: string;
  temperatureF: number;
  condition: string;
  rainChance?: number;
};

type WeatherWidgetData = {
  currentTempF: number;
  condition: string;
  highF: number;
  lowF: number;
  rainChance?: number;
  hourly?: WeatherHour[];
};

type WeatherWidgetUiConfig = {
  variant?: "hero" | "compact" | "minimal";
  showHourly?: boolean;
  hourlyCount?: number;
};
```

### Unresolved tasks widget

```ts
type UnresolvedTaskItem = {
  id: string;
  text: string;
  status: "open" | "in-progress" | "blocked";
  priority?: "high" | "normal" | "low";
  lane?: string | null;
  waitingOn?: string | null;
  date?: string;
};

type UnresolvedTasksWidgetData = {
  counts: {
    blocked: number;
    inProgress: number;
    open: number;
  };
  blocked: UnresolvedTaskItem[];
  inProgress: UnresolvedTaskItem[];
  topOpen: UnresolvedTaskItem[];
};

type UnresolvedTasksWidgetUiConfig = {
  variant?: "sections" | "kanban-lite" | "compact";
  maxItemsPerSection?: number;
  showLane?: boolean;
  showWaitingOn?: boolean;
  showInlineActions?: boolean;
};
```

### Jira widget

```ts
type JiraTicketItem = {
  key: string;
  summary: string;
  status: string;
  priority: string;
  assignee?: string | null;
  url: string;
  updated: string;
};

type JiraWidgetData = {
  urgent: JiraTicketItem[];
  blocked: JiraTicketItem[];
  active: JiraTicketItem[];
  totalAssigned: number;
};

type JiraWidgetUiConfig = {
  variant?: "sections" | "compact";
  maxItemsPerSection?: number;
  showPriorityBadges?: boolean;
  showStatusBadges?: boolean;
};
```

### Meeting prep widget

```ts
type MeetingPrepItem = {
  id?: string;
  title: string;
  time?: string;
  prepStatus: "none" | "partial" | "ready";
  hasPrepNotes?: boolean;
};

type MeetingPrepWidgetData = {
  meetings: MeetingPrepItem[];
  needingPrep: MeetingPrepItem[];
  readyCount: number;
};

type MeetingPrepWidgetUiConfig = {
  variant?: "checklist" | "compact";
  showReadyMeetings?: boolean;
  maxItems?: number;
};
```

## API direction

## Near-term evolution

Do **not** break the current UI all at once.

Add structured fields alongside existing text fields.

### Current

```ts
type PromptResult = {
  prompt: MorningViewPrompt;
  content: string;
  error?: string;
};
```

### Transitional shape

```ts
type PromptResult = {
  prompt: MorningViewPrompt;
  content: string;
  error?: string;
  widget?: WidgetEnvelope<string, unknown, Record<string, unknown>>;
};
```

This lets us:

- keep existing text rendering as fallback
- add typed rendering one widget at a time
- avoid a giant all-or-nothing migration

## Backend refactor plan

### 1. Split source gathering from summarization

Current `executePrompt(prompt)` does too much.

Break it into:

```ts
async function gatherWidgetData(prompt: MorningViewPrompt): Promise<WidgetEnvelope<...>>
async function summarizeWidget(widget: WidgetEnvelope<...>, prompt: MorningViewPrompt): Promise<string | undefined>
```

Responsibilities:

- `gatherWidgetData` returns structured widget data
- `summarizeWidget` generates optional short summary/subtitle

### 2. Introduce widget builders per source type

Example:

```ts
const widgetBuilders = {
  calendar_today: buildCalendarWidget,
  weather: buildWeatherWidget,
  journal_unresolved: buildUnresolvedTasksWidget,
  jira_assigned: buildJiraWidget,
  meeting_prep_today: buildMeetingPrepWidget,
  static: buildStaticWidget,
};
```

This is cleaner than a giant switch that mixes:

- data gathering
- text formatting
- AI prompting
- fallback handling

### 3. Add timeout boundaries per builder

Each builder should fail independently.

If weather hangs:
- weather widget becomes `state: "error"`
- the rest of Today Focus still renders

That needs to be preserved as a first-class design rule.

## Database direction

Keep `morning_view_prompts` as the orchestration table.

Add widget UI config to it.

### Proposed column

- `ui_config TEXT NULL`

Stored JSON example:

```json
{
  "variant": "timeline",
  "maxItems": 5,
  "showSummary": true,
  "showActions": true,
  "showCalendarNames": false
}
```

### Why not a totally new table yet?

Because we are still in early evolution.
The prompt record is already the right unit for:

- ordering
- enabling/disabling
- frequency
- source selection

We can split widget instances from prompt orchestration later if the model gets more complex.

## Frontend direction

## Renderer map

Instead of one generic card, use widget-specific renderers.

```ts
const widgetRenderers = {
  calendar_today: CalendarWidget,
  weather: WeatherWidget,
  journal_unresolved: UnresolvedTasksWidget,
  jira_assigned: JiraWidget,
  meeting_prep_today: MeetingPrepWidget,
  static: StaticPromptWidget,
};
```

## Rendering rules

1. If `result.widget` exists and renderer exists, use the typed renderer
2. Else fall back to current text card
3. If widget state is `error`, render widget-specific error state when possible
4. If widget state is `empty`, render widget-specific empty state

## Component boundaries

Suggested new files:

- `components/journal/today-focus/widgets/CalendarWidget.tsx`
- `components/journal/today-focus/widgets/WeatherWidget.tsx`
- `components/journal/today-focus/widgets/UnresolvedTasksWidget.tsx`
- `components/journal/today-focus/widgets/JiraWidget.tsx`
- `components/journal/today-focus/widgets/MeetingPrepWidget.tsx`
- `components/journal/today-focus/widgets/StaticPromptWidget.tsx`
- `components/journal/today-focus/widget-types.ts`
- `components/journal/today-focus/renderWidget.tsx`

## Personalization model

"More personal" should not mean more random AI prose.

It should come from:

- smarter prioritization
- better selection of what to show
- short summaries that reflect the actual state
- more direct actions
- stronger visual distinction

Good personalization examples:

- calendar subtitle: `Three meetings before lunch, one still needs prep.`
- unresolved tasks summary: `Two blockers are likely to slow the afternoon.`
- weather summary: `Rain risk spikes after 3 PM, so don’t plan errands late.`

That is useful.
A paragraph of generic encouragement is not.

## Actions model

Actions should be attached to widget items or widget headers.

Examples:

### Unresolved tasks
- mark done
- move to today
- snooze
- open task
- add note

### Calendar
- open prep
- add prep note
- create follow-up

### Jira
- open ticket
- create note from ticket
- capture next step

Actions should be declared in data, but the frontend should own actual affordance styling.

## Migration plan

## Phase 1, transitional infrastructure

- Add `widget` field to summary API response
- Keep `content` for fallback
- Add `ui_config` support in prompt settings and DB
- Add base widget types and renderer map
- Keep generic text card fallback working

## Phase 2, first-class widgets

Implement typed renderers for:

1. `calendar_today`
2. `weather`
3. `journal_unresolved`

These will deliver the biggest visual and product payoff fastest.

## Phase 3, richer interactions

- Add inline actions for unresolved tasks
- Add meeting prep quick actions
- Add Jira actions / deep links
- Add per-widget display settings in Today Focus settings UI

## Phase 4, prompt simplification

Once widget renderers are mature:

- reduce prompt text dependence for data-heavy widgets
- use AI mostly for summary/subtitle generation
- reserve full prompt text for static or highly custom widgets

## Opinionated guardrails

### Do this

- use typed widget contracts
- keep AI as enhancement, not foundation
- support fallback rendering during migration
- define widget-specific empty and error states
- make one widget at a time excellent

### Do not do this

- do not build an arbitrary JSON blob system with no contracts
- do not let the LLM define core widget structure
- do not over-generalize before 3 or 4 concrete widgets exist
- do not replace all current rendering in one risky pass

## Recommended first implementation slice

If building this now, the first slice should be:

### Backend
- add `widget` to summary response
- create typed builders for `calendar_today`, `weather`, `journal_unresolved`
- keep `content` generation as fallback

### Frontend
- add renderer map
- render typed calendar widget
- render typed weather widget
- render typed unresolved tasks widget
- fall back to generic text cards for everything else

### Settings
- add `ui_config` column support
- expose only a few settings first:
  - variant
  - max items
  - show summary
  - show actions

That gives us a real system without trying to swallow the whole problem in one bite like a greedy little beast.
