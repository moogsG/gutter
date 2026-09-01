export interface Task {
  id: string;
  date: string;
  text: string;
  title?: string;
  status: string;
  tags: string;
  lane?: string | null;
  priority?: string | null;
  waiting_on?: string | null;
  collection_id?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  comment_count?: number;
  last_comment_at?: string | null;
}

export interface TaskComment {
  id: string;
  task_id: string;
  body: string;
  actor_type: "human" | "agent" | "system";
  actor_id: string;
  source_ref: string | null;
  idempotency_key: string | null;
  created_at: string;
}

export interface DailyLogEntry {
  id: string;
  text: string;
  project: string;
  completed_at: string;
  type: "completed" | "captured" | "note";
}

export interface WinStats {
  today: number;
  week: number;
  streak: number;
}

export interface CaptureInput {
  text: string;
  category?: "task" | "idea" | "reminder" | "note" | "chat";
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: string;
  timestamp: string;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  calendar: string;
  allDay: boolean;
  location?: string;
  isCanceled?: boolean;
}

export interface CalendarRunwayConflict {
  id: string;
  date: string;
  dayLabel: string;
  startDate: string;
  endDate: string;
  calendars: string[];
  overlapMinutes: number;
  title: string;
  events: Array<{
    id: string;
    title: string;
    calendar: string;
    startDate: string;
    endDate: string;
  }>;
}

export interface CalendarRunwayDay {
  date: string;
  label: string;
  dayName: string;
  totalEvents: number;
  allDayCount: number;
  canceledCount: number;
  events: CalendarEvent[];
}

export interface CalendarRunwayData {
  requestedDate: string;
  rangeEndDate: string;
  displayRange: string;
  generatedAt: string;
  totalEvents: number;
  activeEvents: number;
  busyDays: number;
  allDayCount: number;
  conflictCount: number;
  failedCalendars: string[];
  nextMove: string;
  calendarBreakdown: Array<{
    calendar: string;
    count: number;
  }>;
  upcomingDays: CalendarRunwayDay[];
  conflicts: CalendarRunwayConflict[];
}

export interface StatusCheck {
  label: string;
  state: "healthy" | "warning" | "down" | "disabled";
  summary: string;
  detail: string;
  checkedAt: string | null;
}

export interface StatusTaskSnapshot {
  open: number;
  inProgress: number;
  blocked: number;
  doneToday: number;
  totalActive: number;
  latestTaskDate: string | null;
  latestUpdateAt: string | null;
}

export interface StatusCalendarSnapshot {
  enabled: boolean;
  ok: boolean;
  eventCount: number;
  failedCalendars: string[];
  lastError: string | null;
  lastSyncAt: string | null;
}

export interface StatusDailySignal {
  date: string;
  source: "memory";
  message: string;
  severity: "warning" | "info";
}

export interface StatusServiceProbe {
  service: "gutter" | "calendar";
  label: string;
  state: "healthy" | "warning" | "down";
  durationMs: number | null;
  thresholdMs: number;
  summary: string;
  detail: string;
  checkedAt: string | null;
}

export interface StatusIncident {
  id: string;
  service: "gutter" | "calendar";
  status: "up" | "down";
  timestamp: string;
  summary: string;
  detail: string;
}

export interface StatusNightlySnapshot {
  date: string | null;
  topic: string | null;
  status: string | null;
  category: string | null;
}

export interface StatusBoardData {
  requestedDate: string;
  generatedAt: string;
  overall: "healthy" | "warning";
  headline: string;
  nextMove: string;
  checks: StatusCheck[];
  probes: StatusServiceProbe[];
  incidents: StatusIncident[];
  warnings: string[];
  tasks: StatusTaskSnapshot;
  calendar: StatusCalendarSnapshot;
  nightly: StatusNightlySnapshot;
  dailySignals: StatusDailySignal[];
}

export interface SessionActivitySession {
  id: string;
  agentId: string;
  date: string;
  title: string;
  category: "cron" | "manual";
  cronLabel: string | null;
  startedAt: string;
  updatedAt: string;
  model: string;
  source: string;
  transcriptPath: string;
}

export interface SessionActivityReport {
  date: string;
  reportedActive: number;
  observedSessions: number;
  delta: number;
  line: string;
}

export interface SessionActivityDay {
  date: string;
  label: string;
  totalSessions: number;
  cronSessions: number;
  uniqueAgents: number;
}

export interface SessionActivityBoardData {
  requestedDate: string;
  displayDate: string;
  generatedAt: string;
  overview: {
    requestedDaySessions: number;
    requestedDayCronSessions: number;
    recentSevenDaySessions: number;
    activeAgents: number;
  };
  activityReport: SessionActivityReport | null;
  days: SessionActivityDay[];
  byAgent: Array<{
    agentId: string;
    count: number;
    cronCount: number;
  }>;
  recentSessions: SessionActivitySession[];
  topCronLabels: Array<{
    label: string;
    count: number;
  }>;
  nextMove: string;
}

export interface ProjectRunwayDocProject {
  title: string;
  priority: string;
  status: string;
  blocker: string | null;
  localPath: string | null;
  recentWork: string[];
  currentPriorities: string[];
}

export interface ProjectRunwayTask {
  id: string;
  title: string;
  date: string;
  lane: string;
  status: string;
  priority: string | null;
  waitingOn: string | null;
  updatedAt: string;
  ageDays: number;
  legacy: boolean;
  tags: string[];
}

export interface ProjectRunwayData {
  requestedDate: string;
  generatedAt: string;
  headline: string;
  nextMove: string;
  document: {
    lastUpdated: string | null;
    staleDays: number | null;
    activeProjects: number;
    blockerCount: number;
  };
  documentedProjects: ProjectRunwayDocProject[];
  liveLanes: Array<{
    lane: string;
    openCount: number;
    inProgressCount: number;
    blockedCount: number;
  }>;
  currentInProgress: ProjectRunwayTask[];
  staleInProgress: ProjectRunwayTask[];
  truthGap: {
    liveInProgressCount: number;
    legacyInProgressCount: number;
    nonLegacyInProgressCount: number;
  };
}

export interface LinkedInIdeaGroup {
  label: string;
  items: string[];
}

export interface LinkedInDraft {
  title: string;
  excerpt: string;
  wordCount: number;
  content: string;
}

export interface LinkedInPostLogEntry {
  date: string;
  label: string;
  status: string;
  type: string;
  goal: string;
  hook: string;
  reviewWorked: string;
  reviewFailed: string;
  patternToReuse: string;
  ruleUpdate: string;
}

export interface LinkedInAnalyticsPost {
  date: string;
  label: string;
  status: string;
  type: string;
  theme: string;
  goal: string;
  hook: string;
  postedAt: string;
  text: string;
  metrics: {
    impressions: number;
    membersReached: number;
    engagements: number;
    reactions?: number;
    comments?: number;
    reposts?: number;
    profileViews?: number;
    followersGained?: number;
  };
  inboundNotes: string;
  review: {
    worked: string;
    failed: string;
    patternToReuse: string;
    ruleUpdate: string;
    classification: string;
  };
}

export interface LinkedInBoardData {
  requestedDate: string;
  generatedAt: string;
  headline: string;
  nextMove: string;
  postingGapDays: number | null;
  overview: {
    totalLoggedPosts: number;
    reviewedPosts: number;
    draftCount: number;
    readyHooks: number;
  };
  themeBank: LinkedInIdeaGroup[];
  prompts: LinkedInIdeaGroup[];
  hooks: string[];
  angles: string[];
  drafts: LinkedInDraft[];
  postLog: LinkedInPostLogEntry[];
  analyticsPosts: LinkedInAnalyticsPost[];
  bestPost: LinkedInAnalyticsPost | null;
  latestPost: LinkedInPostLogEntry | null;
  latestAnalyticsPost: LinkedInAnalyticsPost | null;
}

export interface MeetingPrep {
  id: string;
  eventId: string;
  title: string;
  time: string;
  calendar: string;
  occurrenceDate?: string;
  prepNotes: string | null;
  prepStatus: "none" | "preparing" | "ready";
  transcript: string | null;
  summary: string | null;
  actionItems: string[] | null;
}

export interface MeetingPrepQueueItem {
  id: string;
  eventId: string;
  title: string;
  calendar: string;
  startDate: string;
  endDate: string;
  occurrenceDate: string;
  location?: string;
  prepStatus: "none" | "preparing" | "ready";
  hasPrepNotes: boolean;
  hasTranscript: boolean;
  hasSummary: boolean;
  actionItemCount: number;
  urgency: "today" | "tomorrow" | "later";
  hoursUntil: number | null;
}

export interface MeetingPrepQueueData {
  requestedDate: string;
  rangeEndDate: string;
  displayRange: string;
  generatedAt: string;
  counts: {
    total: number;
    redZone: number;
    ready: number;
    later: number;
    notesCaptured: number;
  };
  groups: {
    redZone: MeetingPrepQueueItem[];
    ready: MeetingPrepQueueItem[];
    later: MeetingPrepQueueItem[];
  };
}

export interface TomorrowLaunchpadTask {
  title: string;
  lane: string | null;
  status: string | null;
  priority: string | null;
  staleDays: number | null;
  raw: string;
}

export interface TomorrowLaunchpadMeeting {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  calendar: string;
  location?: string;
  prepStatus: "none" | "preparing" | "ready";
}

export interface TomorrowLaunchpadData {
  requestedDate: string;
  displayDate: string;
  generatedAt: string;
  focus: {
    pickOne: TomorrowLaunchpadTask | null;
    topThree: TomorrowLaunchpadTask[];
    boardLoad: {
      open: number;
      inProgress: number;
      blocked: number;
      actionable: number;
    } | null;
  };
  meetings: TomorrowLaunchpadMeeting[];
  family: {
    dinner: {
      day: string;
      mealName: string;
      prepTime: string;
      notes: string;
    } | null;
    mealPlan: {
      displayRange: string | null;
      source: "saved" | "generated" | "missing";
      updatedAt: string | null;
    };
    grocery: {
      itemCount: number;
      sections: MealPlanGrocerySection[];
    };
    relationship: {
      status: "drifting" | "locked-in" | "scheduled" | "unknown";
      headline: string | null;
      nextEventTitle: string | null;
      nextEventDate: string | null;
      nextMove: string | null;
    };
    chores: {
      cycleNumber: number | null;
      remaining: number | null;
      suggestedChoices: ChoreBoardChoice[];
      nextMove: string | null;
    };
    nextMove: string | null;
  };
  systemHealth: {
    overall: "healthy" | "warning" | "stale";
    gutter: {
      status: string;
      checkedAt: string | null;
    };
    calendar: {
      status: string;
      checkedAt: string | null;
    };
  };
}

export interface BacklogTriageItem {
  id: string;
  date: string;
  title: string;
  text: string;
  status: string;
  lane: string | null;
  priority: string | null;
  waiting_on: string | null;
  tags: string[];
  updated_at: string;
  ageDays: number;
  isLegacy: boolean;
}

export interface ChoreBoardChoice {
  id: string;
  name: string;
  label: "A" | "B";
}

export interface ChoreBoardItem {
  id: string;
  name: string;
  completedInCycle: boolean;
  completedAt: string | null;
  totalCompletions: number;
  isSuggested: boolean;
}

export interface ChoreBoardHistoryEntry {
  choreId: string;
  choreName: string;
  completedAt: string;
}

export interface ChoreBoardData {
  generatedAt: string;
  cycleNumber: number;
  cycleStartedAt: string;
  lastCompletedCycleAt: string | null;
  counts: {
    total: number;
    completed: number;
    remaining: number;
  };
  suggestedChoices: ChoreBoardChoice[];
  chores: ChoreBoardItem[];
  history: ChoreBoardHistoryEntry[];
  nextMove: string;
}

export interface BacklogTriageData {
  requestedDate: string;
  generatedAt: string;
  buckets: {
    blockers: BacklogTriageItem[];
    staleActive: BacklogTriageItem[];
    legacy: BacklogTriageItem[];
    deepArchive: BacklogTriageItem[];
  };
  counts: {
    total: number;
    blockers: number;
    staleActive: number;
    legacy: number;
    deepArchive: number;
  };
}

export interface WipLimitItem {
  id: string;
  date: string;
  title: string;
  status: string;
  lane: string | null;
  priority: string | null;
  waitingOn: string | null;
  tags: string[];
  updatedAt: string;
  ageDays: number;
  isLegacy: boolean;
  keepScore: number;
}

export interface WipLimitData {
  requestedDate: string;
  generatedAt: string;
  headline: string;
  nextMove: string;
  counts: {
    total: number;
    keep: number;
    coolDown: number;
    stale: number;
    legacy: number;
  };
  laneBreakdown: Array<{
    lane: string;
    count: number;
  }>;
  keepFocus: WipLimitItem[];
  coolDownQueue: WipLimitItem[];
}

export interface FollowThroughPromise {
  id: string;
  text: string;
  context: string | null;
  deadline: string | null;
  madeAt: string | null;
  staleDays: number;
  overdue: boolean;
}

export interface FollowThroughMutationResponse {
  ok: boolean;
  targetType: "promise" | "task";
  id: string;
  status: string;
}

export interface FollowThroughTask {
  id: string;
  date: string;
  title: string;
  status: string;
  lane: string | null;
  priority: string | null;
  waitingOn: string | null;
  tags: string[];
  ageDays: number;
  updatedAt: string;
}

export interface FollowThroughRadarData {
  requestedDate: string;
  generatedAt: string;
  nextMove: string;
  counts: {
    pendingPromises: number;
    overduePromises: number;
    blocked: number;
    waiting: number;
    unresolvedCarryover: number;
    oldestCarryoverDays: number;
  };
  sections: {
    promises: FollowThroughPromise[];
    stuck: FollowThroughTask[];
    carryover: FollowThroughTask[];
  };
}

export interface MealPlanMeal {
  day: string;
  mealName: string;
  prepTime: string;
  texture: string;
  notes: string;
  ingredients: string[];
  category: string;
}

export interface MealPlanGrocerySection {
  id: string;
  title: string;
  items: string[];
}

export interface SchoolRunwayEvent {
  id: string;
  title: string;
  calendar: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
}

export interface SchoolRunwayDay {
  date: string;
  label: string;
  schoolEvents: SchoolRunwayEvent[];
  familyEvents: SchoolRunwayEvent[];
  headline: string;
}

export interface SchoolKidProfile {
  id: string;
  name: string;
  gradeLabel: string;
  interests: string[];
  supportNeeds: string[];
  focusBlocks: string[];
  nextMove: string;
}

export interface SchoolBoardData {
  requestedDate: string;
  displayRange: string;
  generatedAt: string;
  mode: "quiet" | "scheduled" | "mixed";
  headline: string;
  nextMove: string;
  warnings: string[];
  counts: {
    schoolEvents: number;
    familyEvents: number;
    quietDays: number;
  };
  days: SchoolRunwayDay[];
  dailyPlan: SchoolDailyBlock[];
  kids: SchoolKidProfile[];
}

export interface SchoolDailyBlock {
  id: string;
  windowLabel: string;
  title: string;
  detail: string;
}

export interface MealPlanData {
  requestedDate: string;
  weekOf: string;
  displayRange: string;
  generatedAt: string;
  planUpdatedAt: string | null;
  source: "saved" | "generated";
  highlight: MealPlanMeal | null;
  meals: MealPlanMeal[];
  grocerySections: MealPlanGrocerySection[];
  groceryItemCount: number;
  groceryChecklist: MealPlanChecklistSection[];
  groceryCheckedCount: number;
  groceryRemainingCount: number;
}

export interface MealPlanChecklistItem {
  label: string;
  checked: boolean;
}

export interface MealPlanChecklistSection {
  id: string;
  title: string;
  items: MealPlanChecklistItem[];
  checkedCount: number;
  totalCount: number;
}

export interface ProjectTruthProject {
  name: string;
  status: string | null;
  priority: string | null;
  blocker: string | null;
}

export interface ProjectTruthRecurringTask {
  title: string;
  appearances: number;
  firstSeen: string;
  lastSeen: string;
  currentStreakDays: number;
  dates: string[];
}

export interface ProjectTruthLiveTask {
  id: string;
  title: string;
  status: string;
  lane: string | null;
  priority: string | null;
  waitingOn: string | null;
  date: string;
  ageDays: number;
}

export interface ProjectTruthData {
  requestedDate: string;
  generatedAt: string;
  nextMove: string;
  counts: {
    activeProjects: number;
    projectDocAgeDays: number | null;
    recurringTaskCount: number;
    staleWorkCount: number;
    memoryDaysReviewed: number;
  };
  projectDoc: {
    lastUpdated: string | null;
    stale: boolean;
    projects: ProjectTruthProject[];
  };
  recurringTasks: ProjectTruthRecurringTask[];
  staleWork: ProjectTruthLiveTask[];
  notes: string[];
}

export interface EveningResetTask {
  id: string;
  date: string;
  title: string;
  status: string;
  lane: string | null;
  priority: string | null;
  waitingOn: string | null;
  tags: string[];
}

export interface EveningResetMeeting {
  id: string;
  title: string;
  startDate: string;
  calendar: string;
  location?: string;
  prepStatus: "none" | "preparing" | "ready";
}

export interface EveningResetData {
  requestedDate: string;
  tomorrowDate: string;
  displayDate: string;
  generatedAt: string;
  checklist: string[];
  today: {
    completedCount: number;
    leftoverCount: number;
    carryoverCount: number;
    wins: EveningResetTask[];
    leftovers: EveningResetTask[];
  };
  tomorrow: {
    seededCount: number;
    nonHealthCount: number;
    topTasks: EveningResetTask[];
    healthCount: number;
    meetings: EveningResetMeeting[];
    dinner: {
      mealName: string;
      prepTime: string;
    } | null;
    groceryItemCount: number;
  };
}

export type HealthCutStatus = "open" | "in-progress" | "blocked" | "done";

export type HealthCutCategory =
  | "omad"
  | "workout"
  | "alcohol"
  | "prep"
  | "nutrition"
  | "other";

export interface HealthCutCheckpointSummary {
  id: string;
  text: string;
  status: HealthCutStatus;
  category: HealthCutCategory;
}

export interface HealthCutMealLogSummary {
  required: boolean;
  completed: boolean;
  prompt: string;
  entriesCount: number;
  latestEntry?: {
    id: string;
    text: string;
    createdAt: string;
  };
}

export interface HealthCutPrepLockSummary {
  targetDate: string;
  completed: boolean;
  prompt: string;
  entriesCount: number;
  latestEntry?: {
    id: string;
    text: string;
    createdAt: string;
  };
}

export interface HealthCutHistoryDay {
  date: string;
  label: string;
  total: number;
  done: number;
  remaining: number;
  blocked: number;
  mealLogged: boolean;
}

export interface HealthCutBacklogItem {
  id: string;
  date: string;
  text: string;
  status: HealthCutStatus;
  ageDays: number;
}

export interface HealthCutBacklogGroup {
  category: HealthCutCategory;
  unresolvedCount: number;
  staleCount: number;
  cleanupEligibleCount: number;
  oldestOpenDate: string | null;
  newestOpenDate: string | null;
  items: HealthCutBacklogItem[];
}

export interface HealthCutBacklogAudit {
  unresolvedCount: number;
  staleCount: number;
  cleanupEligibleCount: number;
  categoriesWithStale: number;
  oldestOpenDate: string | null;
  oldestOpenDays: number | null;
  groups: HealthCutBacklogGroup[];
  nextMove: string;
}

export interface HealthCutData {
  requestedDate: string;
  displayDate: string;
  generatedAt: string;
  mode: "cut" | "weekend";
  counts: {
    done: number;
    remaining: number;
    blocked: number;
    total: number;
  };
  checkpoints: HealthCutCheckpointSummary[];
  mealLog: HealthCutMealLogSummary;
  prepLock: HealthCutPrepLockSummary;
  history: HealthCutHistoryDay[];
  audit: HealthCutBacklogAudit;
}

export type HabitsMomentumStatus = "hit" | "miss" | "off" | "untracked";

export interface HabitsMomentumDay {
  date: string;
  label: string;
  weekday: string;
  statuses: Record<string, HabitsMomentumStatus>;
}

export interface HabitsMomentumHabit {
  id: string;
  label: string;
  description: string;
  hits: number;
  trackedDays: number;
  currentStreak: number;
  bestStreak: number;
  hitRate: number;
  lastHitDate: string | null;
}

export interface HabitsLegacySnapshotItem {
  id: string;
  label: string;
  value: boolean | null;
}

export interface HabitsMomentumData {
  requestedDate: string;
  generatedAt: string;
  windowDays: number;
  displayRange: string;
  trackerHealth: {
    mode: "healthy" | "stale" | "missing";
    lastUpdated: string | null;
    daysStale: number | null;
    note: string | null;
  };
  summary: {
    trackedDays: number;
    missingDays: number;
    coveragePercent: number;
    strongHabits: number;
    slippingHabits: number;
  };
  nextMove: string;
  habits: HabitsMomentumHabit[];
  days: HabitsMomentumDay[];
  legacySnapshot: HabitsLegacySnapshotItem[];
}

export interface DateNightEvent {
  title: string;
  start: string;
  end: string;
  calendar: string;
  isCheckInOnly: boolean;
  daysUntil: number;
}

export interface DateNightLastGesture {
  date: string;
  gesture: string;
  cost: string;
  notes: string;
}

export interface DateNightPrep {
  eventTitle: string | null;
  date: string | null;
  questions: string[];
  tips: string[];
}

export interface DateNightData {
  requestedDate: string;
  displayDate: string;
  generatedAt: string;
  status: "drifting" | "locked-in" | "scheduled";
  headline: string;
  warnings: string[];
  nextEvent: DateNightEvent | null;
  counts: {
    upcomingEvents: number;
    giftIdeas: number;
    prepQuestions: number;
  };
  drift: {
    hasRealDateNight: boolean;
    hasCheckInOnly: boolean;
    staleGestureDays: number | null;
  };
  lastGesture: DateNightLastGesture | null;
  prep: DateNightPrep | null;
  partner: {
    budget: string;
    favorites: string[];
    nextMoves: string[];
  };
  giftIdeas: string[];
}
