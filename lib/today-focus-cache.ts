/**
 * lib/today-focus-cache.ts
 *
 * Singleton in-memory cache for Today Focus summaries.
 * Owns the cache Map and the background refresh scheduler.
 *
 * Design notes:
 * - Uses globalThis guards so dev-mode hot reloads don't spawn duplicate intervals.
 * - TTL is deliberately longer than the refresh cadence (40 min vs 30 min)
 *   so a failed refresh doesn't immediately evict good data.
 * - Cache keys are date-scoped; midnight naturally invalidates yesterday's data.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TodayFocusCacheEntry<T = unknown> {
  data: T;
  cachedAt: number;
  /** YYYY-MM-DD the entry was built for. Used to detect day-boundary staleness. */
  date: string;
}

export interface CacheStatus {
  fresh: boolean;
  cachedAt?: string;
  ageMs?: number;
  nextRefreshAt?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Safety-net TTL — background refresh keeps things fresher than this. */
export const CACHE_TTL_MS = 40 * 60 * 1000; // 40 minutes
export const SCHEDULER_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Globals (survive hot reloads) ───────────────────────────────────────────

type SchedulerGlobal = {
  __todayFocusCache?: Map<string, TodayFocusCacheEntry>;
  __todayFocusScheduler?: ReturnType<typeof setInterval>;
  __todayFocusSchedulerStartedAt?: number;
};

const g = globalThis as typeof globalThis & SchedulerGlobal;

if (!g.__todayFocusCache) {
  g.__todayFocusCache = new Map();
}

export const todayFocusCache: Map<string, TodayFocusCacheEntry> = g.__todayFocusCache!;

// ─── Cache operations ─────────────────────────────────────────────────────────

export function makeCacheKey(date: string): string {
  return `summary:${date}`;
}

export function getFromCache<T>(key: string): TodayFocusCacheEntry<T> | null {
  const entry = todayFocusCache.get(key) as TodayFocusCacheEntry<T> | undefined;
  if (!entry) return null;

  const today = new Date().toISOString().split("T")[0];
  const isStale = entry.date !== today || Date.now() - entry.cachedAt > CACHE_TTL_MS;

  if (isStale) {
    todayFocusCache.delete(key);
    return null;
  }

  return entry;
}

export function setCache<T>(key: string, data: T, date: string): void {
  // Evict entries for old dates before adding a new one
  if (todayFocusCache.size > 5) {
    const today = new Date().toISOString().split("T")[0];
    for (const [k, v] of todayFocusCache.entries()) {
      if (v.date !== today) todayFocusCache.delete(k);
    }
  }
  todayFocusCache.set(key, { data, cachedAt: Date.now(), date });
}

export function getCacheStatus(key: string): CacheStatus {
  const entry = todayFocusCache.get(key);
  if (!entry) return { fresh: false };

  const ageMs = Date.now() - entry.cachedAt;
  const fresh = ageMs < CACHE_TTL_MS;

  return {
    fresh,
    cachedAt: new Date(entry.cachedAt).toISOString(),
    ageMs,
    nextRefreshAt: getNextRefreshAt(),
  };
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

/** Returns when the scheduler will next fire, or undefined if not started. */
export function getNextRefreshAt(): string | undefined {
  if (!g.__todayFocusSchedulerStartedAt) return undefined;
  const elapsed = Date.now() - g.__todayFocusSchedulerStartedAt;
  const cyclePosition = elapsed % SCHEDULER_INTERVAL_MS;
  const msUntilNext = SCHEDULER_INTERVAL_MS - cyclePosition;
  return new Date(Date.now() + msUntilNext).toISOString();
}

/**
 * Start the background refresh scheduler.
 * Safe to call on every module import — uses globalThis guard to avoid duplicates.
 *
 * @param refreshFn  async function that rebuilds and re-caches the summary.
 */
export function initBackgroundScheduler(refreshFn: () => Promise<void>): void {
  if (g.__todayFocusScheduler) return; // already running

  console.log("[TodayFocusCache] Starting background refresh scheduler (30 min interval)");
  g.__todayFocusSchedulerStartedAt = Date.now();

  g.__todayFocusScheduler = setInterval(async () => {
    const now = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    try {
      console.log(`[TodayFocusCache] Background refresh starting at ${now}...`);
      await refreshFn();
      console.log(`[TodayFocusCache] Background refresh complete.`);
    } catch (err) {
      console.error(`[TodayFocusCache] Background refresh failed:`, err);
    }
  }, SCHEDULER_INTERVAL_MS);

  // Don't keep the Node process alive purely for this timer
  if (typeof g.__todayFocusScheduler === "object" && "unref" in g.__todayFocusScheduler) {
    (g.__todayFocusScheduler as NodeJS.Timeout).unref?.();
  }
}
